routerAdd(
  'POST',
  '/backend/v1/manual-scan',
  (e) => {
    const userId = e.auth && e.auth.id
    if (!userId) return e.unauthorizedError('auth required')

    const body = e.requestInfo().body || {}
    const projectId = body.projectId
    const data = body.data || {}

    if (!projectId) return e.badRequestError('projectId is required')
    if (!data.entities || !Array.isArray(data.entities) || data.entities.length === 0) {
      return e.badRequestError('data.entities is required and must be a non-empty array')
    }

    let project
    try {
      project = $app.findRecordById('projects', projectId)
    } catch (_) {
      return e.notFoundError('project not found')
    }
    if (project.getString('user') !== userId) return e.forbiddenError('access denied')

    const validTypes = ['ROUTE', 'COMPONENT', 'API', 'FLOW', 'BUSINESS_RULE']
    const validRelTypes = ['CONTAINS', 'CONSUMES', 'TRIGGERS', 'REDIRECTS', 'VALIDATES']
    const errors = []
    const slugSet = {}

    for (var i = 0; i < data.entities.length; i++) {
      var ent = data.entities[i]
      if (!ent.type || validTypes.indexOf(ent.type) === -1) {
        errors.push('Entity ' + i + ' has invalid type: ' + (ent.type || 'missing'))
      }
      if (!ent.name) {
        errors.push('Entity ' + i + ' is missing name')
      }
      if (ent.slug) slugSet[ent.slug] = true
    }

    var relationships = data.relationships || []
    for (var j = 0; j < relationships.length; j++) {
      var rel = relationships[j]
      if (!rel.type || validRelTypes.indexOf(rel.type) === -1) {
        errors.push('Relationship ' + j + ' has invalid type: ' + (rel.type || 'missing'))
      }
    }

    if (errors.length > 0) {
      return e.json(400, { error: 'Validation failed', details: errors })
    }

    var scansCol = $app.findCollectionByNameOrId('scans')
    var scan = new Record(scansCol)
    scan.set('project', projectId)
    scan.set('status', 'PROCESSING')
    scan.set('phase', 'Ingesting')
    scan.set('phaseDetail', 'Processing manually pasted semantic data')
    scan.set('filesCount', data.entities.length)
    scan.set('filesUploaded', 0)
    scan.set('secretsFound', 0)
    scan.set('tokenBudget', 0)
    scan.set('tokenUsed', 0)
    $app.save(scan)

    try {
      scan.set('phase', 'Saving')
      scan.set('phaseDetail', 'Creating ' + data.entities.length + ' entities')
      $app.save(scan)

      var entsCol = $app.findCollectionByNameOrId('semantic_entities')
      var entityMap = {}
      for (var k = 0; k < data.entities.length; k++) {
        var entity = data.entities[k]
        var slug = entity.slug || entity.name.toLowerCase().replace(/\s+/g, '-')
        if (entityMap[slug]) continue
        var r = new Record(entsCol)
        r.set('scan', scan.id)
        r.set('type', entity.type)
        r.set('name', entity.name)
        r.set('slug', slug)
        r.set('path', entity.path || '')
        r.set('pageTitle', entity.pageTitle || '')
        r.set('semanticLabels', entity.semanticLabels || [])
        r.set('description', entity.description || '')
        r.set('accessibilityHint', entity.accessibilityHint || '')
        r.set('confidence', entity.confidence || 0.9)
        r.set('evidence', entity.evidence || [])
        r.set('metadata', entity.metadata || {})
        $app.save(r)
        entityMap[slug] = r.id
      }

      var relsCol = $app.findCollectionByNameOrId('relationships')
      var relCount = 0
      for (var m = 0; m < relationships.length; m++) {
        var relationship = relationships[m]
        var sourceId = entityMap[relationship.sourceSlug] || relationship.source
        var targetId = entityMap[relationship.targetSlug] || relationship.target
        if (!sourceId || !targetId) continue
        var rr = new Record(relsCol)
        rr.set('scan', scan.id)
        rr.set('source', sourceId)
        rr.set('target', targetId)
        rr.set('type', relationship.type)
        $app.save(rr)
        relCount++
      }

      var entityCount = Object.keys(entityMap).length
      scan.set('status', 'COMPLETED')
      scan.set('phase', 'Complete')
      scan.set(
        'phaseDetail',
        'Imported ' + entityCount + ' entities and ' + relCount + ' relationships',
      )
      $app.save(scan)

      var projRecord = $app.findRecordById('projects', projectId)
      projRecord.set('lastScannedAt', new Date().toISOString())
      $app.save(projRecord)

      return e.json(202, { scanId: scan.id })
    } catch (err) {
      scan.set('status', 'FAILED')
      scan.set('errorMessage', (err && err.message) || 'Ingestion failed')
      scan.set('phase', 'Failed')
      scan.set('phaseDetail', (err && err.message) || 'Ingestion failed')
      $app.save(scan)
      return e.json(500, {
        error: (err && err.message) || 'Ingestion failed',
        scanId: scan.id,
      })
    }
  },
  $apis.requireAuth(),
  $apis.bodyLimit(10485760),
)
