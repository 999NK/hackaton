function receiveScannerReport(e) {
  const authHeader = e.request.header.get('Authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!token) return e.json(401, { error: 'Token ausente' })

  let project
  try {
    project = $app.findFirstRecordByData('projects', 'token', token)
  } catch (_) {
    return e.json(401, { error: 'Token inválido' })
  }

  const contentLength = parseInt(e.request.header.get('Content-Length') || '0', 10)
  if (contentLength > 5242880) return e.json(413, { error: 'Payload muito grande' })

  const body = e.requestInfo().body || {}
  const report = body.report || body
  var entitiesCount = 0
  if (report && report.navigationMap && Array.isArray(report.navigationMap.screens)) {
    entitiesCount = report.navigationMap.screens.length
  } else if (report && Array.isArray(report.routes)) {
    entitiesCount = report.routes.length
  }

  const scansCol = $app.findCollectionByNameOrId('scans')
  const scan = new Record(scansCol)
  scan.set('project', project.id)
  scan.set('status', 'COMPLETED')
  scan.set('report', report)
  scan.set('entitiesCount', entitiesCount)
  scan.set('token', token)
  scan.set('errorMessage', '')
  scan.set('filesCount', body.filesCount || 0)
  scan.set('secretsFound', body.secretsFound || 0)
  $app.save(scan)

  return e.json(200, { scanId: scan.id })
}

routerAdd('POST', '/backend/v1/scanner', receiveScannerReport, $apis.bodyLimit(5242880))
routerAdd('POST', '/backend/v1/api/scanner', receiveScannerReport, $apis.bodyLimit(5242880))
