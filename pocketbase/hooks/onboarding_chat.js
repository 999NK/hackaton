routerAdd(
  'POST',
  '/backend/v1/onboarding/chat',
  (e) => {
    const body = e.requestInfo().body || {}
    const userId = e.auth?.id
    if (!userId) return e.unauthorizedError('auth required')

    let project
    try {
      project = $app.findRecordById('projects', body.projectId)
    } catch (_) {
      return e.notFoundError('Projeto não encontrado')
    }

    if (project.getString('user') !== userId) {
      return e.forbiddenError('Acesso negado')
    }

    let scan
    try {
      scan = $app.findFirstRecordByFilter(
        'scans',
        "project = '" + body.projectId + "' && status = 'COMPLETED'",
        '-created',
      )
    } catch (_) {
      return e.json(200, {
        content:
          'Nenhum scan concluído encontrado para este projeto. Execute o scanner local primeiro para que eu possa analisar a arquitetura.',
      })
    }

    const entities = $app.findRecordsByFilter(
      'semantic_entities',
      "scan = '" + scan.id + "'",
      '',
      1000,
    )

    const relationships = $app.findRecordsByFilter(
      'relationships',
      "scan = '" + scan.id + "'",
      '',
      1000,
    )

    var entityIdMap = {}
    entities.forEach(function (r) {
      entityIdMap[r.id] = r.getString('name')
    })

    const entityLines = entities
      .map(function (r) {
        return (
          '- type: ' +
          r.getString('type') +
          ' | name: ' +
          r.getString('name') +
          ' | path: ' +
          r.getString('path') +
          ' | description: ' +
          r.getString('description') +
          ' | accessibilityHint: ' +
          r.getString('accessibilityHint') +
          ' | metadata: ' +
          JSON.stringify(r.get('metadata') || {})
        )
      })
      .join('\n')

    const relLines = relationships
      .map(function (r) {
        return (
          '- ' +
          (entityIdMap[r.getString('source')] || '?') +
          ' ' +
          r.getString('type') +
          ' ' +
          (entityIdMap[r.getString('target')] || '?')
        )
      })
      .join('\n')

    const systemPrompt = [
      'You are a Senior Technical Architect with deep expertise in software architecture and accessibility.',
      "You are analyzing the Semantic Application Map (SAM) of a project called '" +
        project.getString('name') +
        "'.",
      'Be technical, objective, and clear. Cite specific file paths (the path field) when referencing code.',
      'Use Markdown formatting with syntax highlighting for code blocks.',
      'Respond in Portuguese (pt-BR).',
      '',
      '## Semantic Entities:',
      entityLines || '(none)',
      '',
      '## Relationships:',
      relLines || '(none)',
    ].join('\n')

    var messages = [{ role: 'system', content: systemPrompt }]
    if (body.conversationHistory && body.conversationHistory.length) {
      body.conversationHistory.forEach(function (msg) {
        messages.push({ role: msg.role, content: msg.content })
      })
    }
    messages.push({ role: 'user', content: body.message })

    try {
      var result = $ai.chat({ model: 'fast', messages: messages })
      return e.json(200, { content: result.choices[0].message.content })
    } catch (err) {
      return e.json(503, { error: 'AI temporariamente indisponível' })
    }
  },
  $apis.requireAuth(),
)
