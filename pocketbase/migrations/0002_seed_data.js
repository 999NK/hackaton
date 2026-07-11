migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    let user
    try {
      user = app.findAuthRecordByEmail('_pb_users_auth_', 'nk1.arcanjo@gmail.com')
    } catch (_) {
      user = new Record(users)
      user.setEmail('nk1.arcanjo@gmail.com')
      user.setPassword('Skip@Pass')
      user.setVerified(true)
      user.set('name', 'Admin')
      app.save(user)
    }

    const projects = app.findCollectionByNameOrId('projects')
    let project
    try {
      project = app.findFirstRecordByData('projects', 'token', 'demo-token-novafiscal')
    } catch (_) {
      project = new Record(projects)
      project.set('name', 'NovaFiscal ERP')
      project.set('token', 'demo-token-novafiscal')
      project.set('baseUrl', 'https://erp.novafiscal.com')
      project.set('framework', 'Next.js')
      project.set('language', 'TypeScript')
      project.set('user', user.id)
      app.save(project)
    }

    try {
      app.findFirstRecordByData('scans', 'project', project.id)
      return // Already seeded
    } catch (_) {}

    const scans = app.findCollectionByNameOrId('scans')
    const scan = new Record(scans)
    scan.set('project', project.id)
    scan.set('status', 'COMPLETED')
    scan.set('filesCount', 142)
    scan.set('secretsFound', 0)
    app.save(scan)

    const ents = app.findCollectionByNameOrId('semantic_entities')
    const createEnt = (type, name, slug, desc, labels) => {
      const e = new Record(ents)
      e.set('scan', scan.id)
      e.set('type', type)
      e.set('name', name)
      e.set('slug', slug)
      e.set('description', desc)
      e.set('semanticLabels', labels)
      e.set('confidence', 0.95)
      app.save(e)
      return e
    }

    const r1 = createEnt('ROUTE', 'Dashboard', '/dashboard', 'Main dashboard overview', [
      'home',
      'inicio',
      'painel',
    ])
    const r2 = createEnt('ROUTE', 'Invoices', '/invoices', 'List of invoices', [
      'notas',
      'faturas',
      'notas fiscais',
    ])
    const r3 = createEnt('ROUTE', 'Emit Invoice', '/invoices/new', 'Create new invoice form', [
      'emitir',
      'nova nota',
      'criar nota',
    ])
    const r4 = createEnt('ROUTE', 'Customers', '/clients', 'Client management', [
      'clientes',
      'fregueses',
      'cadastro de clientes',
    ])
    const r5 = createEnt('ROUTE', 'Settings', '/settings', 'System settings', [
      'configurações',
      'ajustes',
    ])

    const c1 = createEnt(
      'COMPONENT',
      'InvoiceForm',
      'comp-invoice-form',
      'Form to input invoice data',
      ['formulário de nota'],
    )
    const c2 = createEnt(
      'COMPONENT',
      'ClientSelect',
      'comp-client-select',
      'Dropdown to select a client',
      ['selecionar cliente'],
    )
    const c3 = createEnt('COMPONENT', 'SubmitButton', 'comp-submit-btn', 'Button to save invoice', [
      'botão salvar',
      'enviar',
    ])
    const c4 = createEnt('COMPONENT', 'DashboardChart', 'comp-dash-chart', 'Revenue chart', [
      'gráfico',
      'receita',
    ])
    const c5 = createEnt('COMPONENT', 'SidebarNav', 'comp-sidebar', 'Main navigation', [
      'menu lateral',
      'navegação',
    ])
    const c6 = createEnt('COMPONENT', 'NotificationBadge', 'comp-notif', 'Shows unread alerts', [
      'notificações',
      'alertas',
    ])

    const rels = app.findCollectionByNameOrId('relationships')
    const createRel = (s, t, type) => {
      const r = new Record(rels)
      r.set('scan', scan.id)
      r.set('source', s.id)
      r.set('target', t.id)
      r.set('type', type)
      app.save(r)
    }

    createRel(r3, c1, 'CONTAINS')
    createRel(c1, c2, 'CONTAINS')
    createRel(c1, c3, 'CONTAINS')
    createRel(r1, c4, 'CONTAINS')
    createRel(r1, c5, 'CONTAINS')
    createRel(c5, c6, 'CONTAINS')
    createRel(c3, r2, 'REDIRECTS')
  },
  (app) => {
    app.db().newQuery("DELETE FROM projects WHERE token = 'demo-token-novafiscal'").execute()
  },
)
