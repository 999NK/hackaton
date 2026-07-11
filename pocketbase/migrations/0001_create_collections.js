migrate(
  (app) => {
    const projects = new Collection({
      name: 'projects',
      type: 'base',
      listRule: "@request.auth.id != '' && user = @request.auth.id",
      viewRule: "@request.auth.id != '' && user = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && user = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user = @request.auth.id",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'token', type: 'text', required: true },
        { name: 'baseUrl', type: 'text' },
        { name: 'framework', type: 'text' },
        { name: 'language', type: 'text' },
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_projects_token ON projects (token)'],
    })
    app.save(projects)

    const scans = new Collection({
      name: 'scans',
      type: 'base',
      listRule: "@request.auth.id != '' && project.user = @request.auth.id",
      viewRule: "@request.auth.id != '' && project.user = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && project.user = @request.auth.id",
      deleteRule: "@request.auth.id != '' && project.user = @request.auth.id",
      fields: [
        {
          name: 'project',
          type: 'relation',
          required: true,
          collectionId: projects.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          values: ['PROCESSING', 'ENRICHING', 'COMPLETED', 'FAILED'],
          required: true,
        },
        { name: 'filesCount', type: 'number' },
        { name: 'secretsFound', type: 'number' },
        { name: 'errorMessage', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(scans)

    const entities = new Collection({
      name: 'semantic_entities',
      type: 'base',
      listRule: "@request.auth.id != '' && scan.project.user = @request.auth.id",
      viewRule: "@request.auth.id != '' && scan.project.user = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && scan.project.user = @request.auth.id",
      deleteRule: "@request.auth.id != '' && scan.project.user = @request.auth.id",
      fields: [
        {
          name: 'scan',
          type: 'relation',
          required: true,
          collectionId: scans.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'type',
          type: 'select',
          values: ['ROUTE', 'COMPONENT', 'API', 'FLOW', 'BUSINESS_RULE'],
          required: true,
        },
        { name: 'name', type: 'text', required: true },
        { name: 'slug', type: 'text' },
        { name: 'path', type: 'text' },
        { name: 'pageTitle', type: 'text' },
        { name: 'semanticLabels', type: 'json' },
        { name: 'description', type: 'text' },
        { name: 'accessibilityHint', type: 'text' },
        { name: 'confidence', type: 'number' },
        { name: 'evidence', type: 'json' },
        { name: 'metadata', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(entities)

    const relationships = new Collection({
      name: 'relationships',
      type: 'base',
      listRule: "@request.auth.id != '' && scan.project.user = @request.auth.id",
      viewRule: "@request.auth.id != '' && scan.project.user = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && scan.project.user = @request.auth.id",
      deleteRule: "@request.auth.id != '' && scan.project.user = @request.auth.id",
      fields: [
        {
          name: 'scan',
          type: 'relation',
          required: true,
          collectionId: scans.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'source',
          type: 'relation',
          required: true,
          collectionId: entities.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'target',
          type: 'relation',
          required: true,
          collectionId: entities.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'type',
          type: 'select',
          values: ['CONTAINS', 'CONSUMES', 'TRIGGERS', 'REDIRECTS', 'VALIDATES'],
          required: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(relationships)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('relationships'))
    app.delete(app.findCollectionByNameOrId('semantic_entities'))
    app.delete(app.findCollectionByNameOrId('scans'))
    app.delete(app.findCollectionByNameOrId('projects'))
  },
)
