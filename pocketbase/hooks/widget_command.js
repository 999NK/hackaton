routerAdd('OPTIONS', '/backend/v1/widget/command', (e) => {
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
    e.response.header().set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    e.response.header().set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }
  return e.noContent(204)
})

routerAdd('POST', '/backend/v1/widget/command', (e) => {
  var token = (e.requestInfo().query || {}).token || ''
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
    e.response.header().set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    e.response.header().set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }

  if (!token || !project) {
    return e.json(401, { error: 'Token inválido' })
  }

  var body = e.requestInfo().body || {}
  var transcript = (body.transcript || '').trim()
  if (!transcript) {
    return e.json(400, { error: 'transcript é obrigatório' })
  }

  var scan = null
  try {
    scan = $app.findFirstRecordByFilter(
      'scans',
      "project = '" + project.id + "' && status = 'COMPLETED'",
      '-created',
    )
  } catch (_) {}
  if (!scan) {
    return e.json(404, { error: 'Nenhum scan completado encontrado' })
  }

  var entities = $app.findRecordsByFilter('semantic_entities', "scan = '" + scan.id + "'", '', 1000)

  var entityList = entities.map(function (r) {
    return {
      slug: r.getString('slug'),
      name: r.getString('name'),
      type: r.getString('type'),
      path: r.getString('path'),
      semanticLabels: r.get('semanticLabels') || [],
      description: r.getString('description'),
      accessibilityHint: r.getString('accessibilityHint'),
      metadata: r.get('metadata') || {},
    }
  })

  var systemPrompt = [
    'You are an accessibility assistant that maps natural language voice commands to application entities.',
    'Given a user command in Portuguese and a list of semantic entities with their labels, return ONLY valid JSON (no markdown) with this structure:',
    '{"action":"NAVIGATE|CLICK|FILL","matches":[{"slug":"entity-slug","name":"Entity Name","confidence":0.0-1.0}],"fillValue":"optional value for FILL actions"}',
    'Rules:',
    '1. Match the user transcript against semanticLabels, name, and description fields',
    '2. NAVIGATE: user wants to go to a page/route (use ROUTE entities)',
    '3. CLICK: user wants to click/press a button or link (use COMPONENT entities)',
    '4. FILL: user wants to type or fill an input field (use COMPONENT entities)',
    '5. Return up to 3 matches sorted by confidence (highest first)',
    '6. If no good match found, return empty matches array',
    '7. fillValue is only needed for FILL actions',
  ].join('\n')

  var aiResult = $ai.chat({
    model: 'fast',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify({ transcript: transcript, entities: entityList }) },
    ],
  })

  var content = aiResult.choices[0].message.content.trim()
  if (content.indexOf('```') === 0) {
    content = content.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  }

  var parsed
  try {
    parsed = JSON.parse(content)
  } catch (_) {
    parsed = { action: 'NAVIGATE', matches: [] }
  }

  var enriched = (parsed.matches || [])
    .map(function (m) {
      for (var i = 0; i < entityList.length; i++) {
        if (entityList[i].slug === m.slug) {
          var copy = {}
          var keys = Object.keys(entityList[i])
          for (var j = 0; j < keys.length; j++) {
            copy[keys[j]] = entityList[i][keys[j]]
          }
          copy.confidence = m.confidence || 0.5
          return copy
        }
      }
      return null
    })
    .filter(function (x) {
      return x !== null
    })

  return e.json(200, {
    action: parsed.action || 'NAVIGATE',
    matches: enriched,
    fillValue: parsed.fillValue || '',
  })
})
