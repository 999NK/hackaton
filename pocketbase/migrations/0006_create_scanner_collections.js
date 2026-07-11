migrate(
  (app) => {
    const projectsCol = app.findCollectionByNameOrId('projects')

    if (!projectsCol.fields.getByName('owner')) {
      projectsCol.fields.add(
        new RelationField({
          name: 'owner',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        }),
      )
    }

    projectsCol.listRule = 'owner = @request.auth.id'
    projectsCol.viewRule = 'owner = @request.auth.id'
    projectsCol.createRule = 'owner = @request.auth.id'
    projectsCol.updateRule = 'owner = @request.auth.id'
    projectsCol.deleteRule = 'owner = @request.auth.id'

    projectsCol.addIndex('idx_projects_token', true, 'token', '')
    app.save(projectsCol)

    try {
      const existingProjects = app.findRecordsByFilter('projects', "id != ''", '', 1000)
      for (const proj of existingProjects) {
        if (!proj.getString('owner')) {
          proj.set('owner', proj.getString('user'))
          app.saveNoValidate(proj)
        }
      }
    } catch (_) {}

    const scansCol = app.findCollectionByNameOrId('scans')

    if (!scansCol.fields.getByName('report')) {
      scansCol.fields.add(new JSONField({ name: 'report', required: true }))
    }

    if (!scansCol.fields.getByName('entitiesCount')) {
      scansCol.fields.add(new NumberField({ name: 'entitiesCount' }))
    }

    if (!scansCol.fields.getByName('token')) {
      scansCol.fields.add(new TextField({ name: 'token', required: true }))
    }

    scansCol.listRule = 'project.owner = @request.auth.id'
    scansCol.viewRule = 'project.owner = @request.auth.id'
    scansCol.createRule = null
    scansCol.updateRule = null

    scansCol.addIndex('idx_scans_project', false, 'project', '')
    app.save(scansCol)

    try {
      const existingScans = app.findRecordsByFilter('scans', "id != ''", '', 1000)
      for (const scan of existingScans) {
        let needsUpdate = false

        if (!scan.getString('token')) {
          try {
            const proj = app.findRecordById('projects', scan.getString('project'))
            scan.set('token', proj.getString('token'))
          } catch (_) {
            scan.set('token', 'unknown')
          }
          needsUpdate = true
        }

        var reportStr = scan.getString('report')
        if (!reportStr || reportStr === '' || reportStr === 'null') {
          scan.set('report', {})
          needsUpdate = true
        }

        if (needsUpdate) {
          app.saveNoValidate(scan)
        }
      }
    } catch (_) {}
  },
  (app) => {
    const projectsCol = app.findCollectionByNameOrId('projects')
    var ownerField = projectsCol.fields.getByName('owner')
    if (ownerField) projectsCol.fields.remove(ownerField)
    projectsCol.listRule = "@request.auth.id != '' && user = @request.auth.id"
    projectsCol.viewRule = "@request.auth.id != '' && user = @request.auth.id"
    projectsCol.createRule = "@request.auth.id != ''"
    projectsCol.updateRule = "@request.auth.id != '' && user = @request.auth.id"
    projectsCol.deleteRule = "@request.auth.id != '' && user = @request.auth.id"
    app.save(projectsCol)

    const scansCol = app.findCollectionByNameOrId('scans')
    var names = ['report', 'entitiesCount', 'token']
    for (var i = 0; i < names.length; i++) {
      var field = scansCol.fields.getByName(names[i])
      if (field) scansCol.fields.remove(field)
    }
    scansCol.listRule = "@request.auth.id != '' && project.user = @request.auth.id"
    scansCol.viewRule = "@request.auth.id != '' && project.user = @request.auth.id"
    scansCol.createRule = "@request.auth.id != ''"
    scansCol.updateRule = "@request.auth.id != '' && project.user = @request.auth.id"
    scansCol.deleteRule = "@request.auth.id != '' && project.user = @request.auth.id"
    app.save(scansCol)
  },
)
