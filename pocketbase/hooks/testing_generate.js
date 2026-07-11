routerAdd(
  'POST',
  '/backend/v1/testing/generate',
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
      return e.badRequestError('Nenhum scan concluído encontrado')
    }

    var flow
    try {
      flow = $app.findRecordById('semantic_entities', body.flowId)
    } catch (_) {
      return e.notFoundError('Fluxo não encontrado')
    }

    const entities = $app.findRecordsByFilter(
      'semantic_entities',
      "scan = '" + scan.id + "'",
      '',
      1000,
    )

    var businessRules = entities
      .filter(function (r) {
        return r.getString('type') === 'BUSINESS_RULE'
      })
      .map(function (r) {
        return {
          name: r.getString('name'),
          description: r.getString('description'),
          metadata: r.get('metadata') || {},
        }
      })

    var components = entities
      .filter(function (r) {
        return r.getString('type') === 'COMPONENT'
      })
      .map(function (r) {
        return {
          name: r.getString('name'),
          path: r.getString('path'),
          metadata: r.get('metadata') || {},
          accessibilityHint: r.getString('accessibilityHint'),
        }
      })

    var flowData = {
      name: flow.getString('name'),
      description: flow.getString('description'),
      path: flow.getString('path'),
      metadata: flow.get('metadata') || {},
    }

    var systemPrompt = [
      'You are an expert QA engineer specializing in BDD and Playwright testing.',
      'Generate test scenarios based on the semantic map data provided.',
      'Return ONLY valid JSON (no markdown fences) with this exact structure:',
      '{"gherkin":"feature file content","playwright":"typescript test content"}',
      'Rules:',
      '1. Gherkin: Cover the happy path AND at least one error scenario based on a BUSINESS_RULE.',
      '2. Playwright: Use real CSS selectors from component metadata.',
      '3. Include functional assertions in Playwright tests.',
      '4. Descriptions in Portuguese (pt-BR), code in English.',
      '',
      '## Flow to test:',
      JSON.stringify(flowData, null, 2),
      '',
      '## Business Rules:',
      JSON.stringify(businessRules, null, 2),
      '',
      '## Components (for CSS selectors):',
      JSON.stringify(components, null, 2),
    ].join('\n')

    try {
      var result = $ai.chat({
        model: 'fast',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: 'Gere os testes BDD e Playwright para o fluxo: ' + flowData.name,
          },
        ],
      })

      var content = result.choices[0].message.content.trim()
      if (content.startsWith('```')) {
        content = content.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
      }

      var parsed = JSON.parse(content)
      return e.json(200, parsed)
    } catch (err) {
      return e.json(503, { error: 'AI temporariamente indisponível' })
    }
  },
  $apis.requireAuth(),
)
