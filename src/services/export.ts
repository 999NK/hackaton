import { Project } from '@/services/projects'

export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

export function exportJSON(project: Project, entities: any[], relationships: any[]) {
  const data = {
    project: {
      name: project.name,
      framework: project.framework,
      language: project.language,
      baseUrl: project.baseUrl,
    },
    entities: entities.map((e) => ({
      type: e.type,
      name: e.name,
      slug: e.slug,
      path: e.path,
      pageTitle: e.pageTitle,
      description: e.description,
      accessibilityHint: e.accessibilityHint,
      semanticLabels: e.semanticLabels,
      confidence: e.confidence,
      metadata: e.metadata,
      evidence: e.evidence,
    })),
    relationships: relationships.map((r) => ({
      source: r.source,
      target: r.target,
      type: r.type,
    })),
  }
  downloadFile(
    JSON.stringify(data, null, 2),
    `${sanitizeName(project.name)}-sam.json`,
    'application/json',
  )
}

export function exportMarkdown(
  project: Project,
  entities: any[],
  relationships: any[],
  scanDate?: string,
) {
  const entityName = (id: string) => entities.find((e) => e.id === id)?.name || '?'
  const routes = entities.filter((e) => e.type === 'ROUTE')
  const components = entities.filter((e) => e.type === 'COMPONENT')
  const rules = entities.filter((e) => e.type === 'BUSINESS_RULE')
  const flows = entities.filter((e) => e.type === 'FLOW')
  const dateStr = scanDate ? new Date(scanDate).toLocaleDateString('pt-BR') : 'N/A'

  const lines: string[] = []
  lines.push(`# Mapa Semântico: ${project.name}`)
  lines.push(
    `**Framework:** ${project.framework || 'N/A'} | **Linguagem:** ${project.language || 'N/A'} | **Último Scan:** ${dateStr}`,
  )
  lines.push('')

  lines.push('---')
  lines.push('## Rotas do Sistema')
  for (const r of routes) {
    const linked = relationships
      .filter((rel) => rel.type === 'CONTAINS' && rel.source === r.id)
      .map((rel) => entityName(rel.target))
      .filter((n) => n !== '?')
    lines.push(`### ${r.path || r.name}`)
    lines.push(`- **Descrição:** ${r.description || 'N/A'}`)
    lines.push(`- **Arquivo:** ${r.path || 'N/A'}`)
    lines.push(`- **Componentes nesta rota:** ${linked.length ? linked.join(', ') : 'Nenhum'}`)
    lines.push(`- **Acessibilidade:** ${r.accessibilityHint || 'N/A'}`)
    lines.push('')
  }

  lines.push('---')
  lines.push('## Componentes')
  for (const c of components) {
    lines.push(`### ${c.name}`)
    lines.push(`- **Tipo:** ${c.type}`)
    lines.push(`- **Arquivo:** ${c.path || 'N/A'}`)
    lines.push(`- **Seletor CSS:** ${c.metadata?.cssSelector || 'N/A'}`)
    lines.push(`- **Dica de Acessibilidade:** ${c.accessibilityHint || 'N/A'}`)
    lines.push('')
  }

  lines.push('---')
  lines.push('## Regras de Negócio')
  for (const r of rules) {
    const severity = r.metadata?.severity || 'INFO'
    lines.push(`### [${severity}] ${r.name}`)
    lines.push(`- **Regra:** ${r.metadata?.constraint || r.description || 'N/A'}`)
    lines.push(`- **Evidência:** ${r.evidence ? JSON.stringify(r.evidence) : 'N/A'}`)
    lines.push('')
  }

  lines.push('---')
  lines.push('## Fluxos Operacionais')
  for (const f of flows) {
    lines.push(`### ${f.name}`)
    const steps = f.metadata?.steps || []
    if (steps.length > 0) {
      steps.forEach((s: any, i: number) => {
        lines.push(`${i + 1}. ${s.action || s.entitySlug || 'N/A'}`)
      })
    } else {
      lines.push(`1. ${f.description || 'Sem detalhes'}`)
    }
    lines.push('')
  }

  downloadFile(lines.join('\n'), `${sanitizeName(project.name)}-semantic-map.md`, 'text/markdown')
}
