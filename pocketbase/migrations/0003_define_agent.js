migrate(
  (app) => {
    $ai.agents.define(app, {
      slug: 'developer-assistant',
      name: 'Developer Assistant',
      description: 'Technical expert in software architecture and accessibility.',
      systemPrompt:
        'You are a technical expert. You help developers understand their SAM (Semantic Application Map) results and improve accessibility scores. Focus on identifying and resolving structural and navigation issues.',
      tier: 'fast',
      tools: [
        { collection: 'projects', perms: { read: true, list: true } },
        { collection: 'scans', perms: { read: true, list: true } },
        { collection: 'semantic_entities', perms: { read: true, list: true } },
      ],
    })
  },
  (app) => {
    $ai.agents.delete(app, 'developer-assistant')
  },
)
