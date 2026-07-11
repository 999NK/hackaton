migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('scans')

    if (!col.fields.getByName('phase')) {
      col.fields.add(new TextField({ name: 'phase' }))
    }
    if (!col.fields.getByName('phaseDetail')) {
      col.fields.add(new TextField({ name: 'phaseDetail' }))
    }
    if (!col.fields.getByName('tokenUsed')) {
      col.fields.add(new NumberField({ name: 'tokenUsed' }))
    }
    if (!col.fields.getByName('tokenBudget')) {
      col.fields.add(new NumberField({ name: 'tokenBudget' }))
    }
    if (!col.fields.getByName('filesUploaded')) {
      col.fields.add(new NumberField({ name: 'filesUploaded' }))
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('scans')
    const names = ['phase', 'phaseDetail', 'tokenUsed', 'tokenBudget', 'filesUploaded']
    for (const name of names) {
      const field = col.fields.getByName(name)
      if (field) col.fields.remove(field)
    }
    app.save(col)
  },
)
