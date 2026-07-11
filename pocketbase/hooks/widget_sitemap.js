routerAdd('OPTIONS', '/backend/v1/widget/sitemap', (e) => {
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

routerAdd('GET', '/backend/v1/widget/sitemap', (e) => {
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
    return e.json(200, { routes: [] })
  }

  var routes = $app.findRecordsByFilter(
    'semantic_entities',
    "scan = '" + scan.id + "' && type = 'ROUTE'",
    'name',
    1000,
  )

  var exported = routes.map(function (r) {
    return {
      id: r.id,
      name: r.getString('name'),
      slug: r.getString('slug'),
      path: r.getString('path'),
      pageTitle: r.getString('pageTitle'),
      description: r.getString('description'),
      semanticLabels: r.get('semanticLabels') || [],
    }
  })

  return e.json(200, { routes: exported })
})
