routerAdd('OPTIONS', '/backend/v1/widget/entities', (e) => {
  var token = (e.requestInfo().query || {}).token || ''
  var corsOrigin = '*'
  if (token) {
    try {
      var proj = $app.findFirstRecordByData('projects', 'token', token)
      var baseUrl = proj.getString('baseUrl')
      var origin = e.request.header.get('Origin') || ''
      if (baseUrl && origin && baseUrl.indexOf(origin) === -1) {
        corsOrigin = ''
      } else if (origin) {
        corsOrigin = origin
      }
    } catch (_) {}
  }
  if (corsOrigin) {
    e.response.header().set('Access-Control-Allow-Origin', corsOrigin)
    e.response.header().set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    e.response.header().set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }
  return e.noContent(204)
})

routerAdd('GET', '/backend/v1/widget/entities', (e) => {
  var token = (e.requestInfo().query || {}).token || ''
  var currentPath = (e.requestInfo().query || {}).path || ''
  var project = null
  try {
    project = $app.findFirstRecordByData('projects', 'token', token)
  } catch (_) {}

  var corsOrigin = '*'
  if (project) {
    var baseUrl = project.getString('baseUrl')
    var origin = e.request.header.get('Origin') || ''
    if (baseUrl && origin && baseUrl.indexOf(origin) === -1) {
      corsOrigin = ''
    } else if (origin) {
      corsOrigin = origin
    }
  }
  if (corsOrigin) {
    e.response.header().set('Access-Control-Allow-Origin', corsOrigin)
    e.response.header().set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    e.response.header().set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }

  if (!token || !project) {
    return e.json(401, { error: 'Token inválido' })
  }

  var scan = null
  try {
    scan = $app.findFirstRecordByFilter(
      'scans',
      "project = '" + project.id + "' && status = 'COMPLETED'",
      '-created',
    )
  } catch (_) {
    return e.json(200, { entities: [] })
  }

  var routeEntity = null
  if (currentPath) {
    try {
      routeEntity = $app.findFirstRecordByFilter(
        'semantic_entities',
        "scan = '" +
          scan.id +
          "' && type = 'ROUTE' && path = '" +
          currentPath.replace(/'/g, '') +
          "'",
      )
    } catch (_) {}
  }

  var componentIds = []
  if (routeEntity) {
    var rels = $app.findRecordsByFilter(
      'relationships',
      "scan = '" + scan.id + "' && source = '" + routeEntity.id + "' && type = 'CONTAINS'",
      '',
      1000,
    )
    rels.forEach(function (rel) {
      componentIds.push(rel.getString('target'))
    })
  }

  var components = []
  if (componentIds.length > 0) {
    componentIds.forEach(function (tid) {
      try {
        var r = $app.findRecordById('semantic_entities', tid)
        components.push(r)
      } catch (_) {}
    })
  } else {
    components = $app.findRecordsByFilter(
      'semantic_entities',
      "scan = '" + scan.id + "' && type = 'COMPONENT'",
      '',
      1000,
    )
  }

  var exported = components.map(function (r) {
    return {
      id: r.id,
      type: r.getString('type'),
      name: r.getString('name'),
      slug: r.getString('slug'),
      path: r.getString('path'),
      description: r.getString('description'),
      accessibilityHint: r.getString('accessibilityHint'),
      semanticLabels: r.get('semanticLabels') || [],
      metadata: r.get('metadata') || {},
    }
  })

  return e.json(200, { entities: exported })
})
