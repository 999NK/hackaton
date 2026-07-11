migrate(
  (app) => {
    const projectsCol = app.findCollectionByNameOrId('projects')
    if (!projectsCol.fields.getByName('lastScannedAt')) {
      projectsCol.fields.add(new DateField({ name: 'lastScannedAt' }))
    }
    app.save(projectsCol)

    const scansCol = app.findCollectionByNameOrId('scans')
    scansCol.addIndex('idx_scans_project', false, 'project', '')
    app.save(scansCol)

    const entitiesCol = app.findCollectionByNameOrId('semantic_entities')
    entitiesCol.addIndex('idx_entities_scan', false, 'scan', '')
    app.save(entitiesCol)

    const relsCol = app.findCollectionByNameOrId('relationships')
    relsCol.addIndex('idx_rels_scan', false, 'scan', '')
    app.save(relsCol)
  },
  (app) => {
    const projectsCol = app.findCollectionByNameOrId('projects')
    const field = projectsCol.fields.getByName('lastScannedAt')
    if (field) projectsCol.fields.remove(field)
    app.save(projectsCol)

    const scansCol = app.findCollectionByNameOrId('scans')
    scansCol.removeIndex('idx_scans_project')
    app.save(scansCol)

    const entitiesCol = app.findCollectionByNameOrId('semantic_entities')
    entitiesCol.removeIndex('idx_entities_scan')
    app.save(entitiesCol)

    const relsCol = app.findCollectionByNameOrId('relationships')
    relsCol.removeIndex('idx_rels_scan')
    app.save(relsCol)
  },
)
