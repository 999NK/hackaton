function scannerStatus(e) {
  const authHeader = e.request.header.get('Authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!token) return e.json(401, { error: 'Token ausente' })

  const scanId = e.request.pathValue('scanId')
  let scan
  try {
    scan = $app.findRecordById('scans', scanId)
  } catch (_) {
    return e.json(404, { error: 'Scan não encontrado' })
  }

  if (scan.getString('token') !== token) {
    return e.json(401, { error: 'Token inválido' })
  }

  var entitiesCount = scan.getInt('entitiesCount')
  if (!entitiesCount) entitiesCount = 0

  var errorMessage = scan.getString('errorMessage')
  if (!errorMessage) errorMessage = null

  return e.json(200, {
    scanId: scan.id,
    status: scan.getString('status'),
    entitiesCount: entitiesCount,
    errorMessage: errorMessage,
  })
}

routerAdd('GET', '/backend/v1/scanner/status/{scanId}', scannerStatus)
routerAdd('GET', '/backend/v1/api/scanner/status/{scanId}', scannerStatus)
