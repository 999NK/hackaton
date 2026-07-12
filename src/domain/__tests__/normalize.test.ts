// ============================================================
// src/domain/__tests__/normalize.test.ts
// Testes unitários para normalização, deduplicação e score.
// Execute com: npx vitest run src/domain/__tests__
// ============================================================

import { describe, it, expect } from 'vitest'
import { normalizeSeverity } from '../types'
import { computeFingerprint, normalizeLegacyScanResult, computeWeightedScore } from '../normalize'
import { getRuleDefinition, getGenericSuggestion } from '../rule-catalog'

// ─── 1. Normalização de severidade ───────────────────────────

describe('normalizeSeverity', () => {
  it('normalizes lowercase correctly', () => {
    expect(normalizeSeverity('critical')).toBe('critical')
    expect(normalizeSeverity('serious')).toBe('serious')
    expect(normalizeSeverity('moderate')).toBe('moderate')
    expect(normalizeSeverity('minor')).toBe('minor')
  })

  it('normalizes uppercase', () => {
    expect(normalizeSeverity('CRITICAL')).toBe('critical')
    expect(normalizeSeverity('SERIOUS')).toBe('serious')
  })

  it('normalizes mixed case', () => {
    expect(normalizeSeverity('Critical')).toBe('critical')
    expect(normalizeSeverity('Moderate')).toBe('moderate')
  })

  // ─── 2. Severidade ausente retorna unknown, NUNCA minor ───
  it('returns unknown for missing severity', () => {
    expect(normalizeSeverity(undefined)).toBe('unknown')
    expect(normalizeSeverity(null)).toBe('unknown')
    expect(normalizeSeverity('')).toBe('unknown')
    expect(normalizeSeverity('invalid')).toBe('unknown')
  })

  it('never returns minor as fallback for invalid input', () => {
    const result = normalizeSeverity('xyz')
    expect(result).not.toBe('minor')
    expect(result).toBe('unknown')
  })
})

// ─── 3. Fingerprint e deduplicação ───────────────────────────

describe('computeFingerprint', () => {
  it('returns same fingerprint for same inputs', () => {
    const a = computeFingerprint('img-alt', 'src/App.tsx', 12, 5, 'img.logo')
    const b = computeFingerprint('img-alt', 'src/App.tsx', 12, 5, 'img.logo')
    expect(a).toBe(b)
  })

  it('returns different fingerprint for different files', () => {
    const a = computeFingerprint('img-alt', 'src/App.tsx', 12, 5)
    const b = computeFingerprint('img-alt', 'src/Other.tsx', 12, 5)
    expect(a).not.toBe(b)
  })

  it('normalizes path separators', () => {
    const a = computeFingerprint('btn-name', 'src\\components\\Button.tsx', 5)
    const b = computeFingerprint('btn-name', 'src/components/Button.tsx', 5)
    expect(a).toBe(b)
  })
})

// ─── 4. Mesmo erro em 8 rotas = 1 problema único, 8 afetadas ─

describe('normalizeLegacyScanResult - deduplication', () => {
  const makeViolation = (screen: string) => ({
    id: `v-${screen}`,
    rule: 'img-alt',
    severity: 'critical',
    title: 'Imagem sem alt',
    filePath: 'src/App.tsx',
    selector: 'img.logo',
    screen,
  })

  const legacyReport = {
    wcag: {
      violations: [
        makeViolation('/dashboard'),
        makeViolation('/pdv'),
        makeViolation('/produtos'),
        makeViolation('/estoque'),
        makeViolation('/vendas'),
        makeViolation('/relatorios'),
        makeViolation('/configuracoes'),
        makeViolation('/integracoes'),
      ],
    },
  }

  it('deduplicates 8 identical findings into 1 unique with 8 affected screens', () => {
    const result = normalizeLegacyScanResult(legacyReport, { scanId: 'test' })
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].affectedScreens).toHaveLength(8)
    expect(result.findings[0].occurrenceCount).toBe(8)
  })

  it('stats reflect 1 unique finding, 8 occurrences', () => {
    const result = normalizeLegacyScanResult(legacyReport, { scanId: 'test' })
    expect(result.stats.uniqueFindings).toBe(1)
    expect(result.stats.totalOccurrences).toBe(8)
  })

  it('severity is critical, not minor', () => {
    const result = normalizeLegacyScanResult(legacyReport, { scanId: 'test' })
    expect(result.findings[0].severity).toBe('critical')
  })
})

// ─── 5 & 6. Paginação (lógica pura) ──────────────────────────

describe('pagination logic', () => {
  function paginate<T>(items: T[], page: number, pageSize: number) {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }

  it('returns correct first page', () => {
    const items = Array.from({ length: 100 }, (_, i) => i)
    expect(paginate(items, 1, 25)).toHaveLength(25)
    expect(paginate(items, 1, 25)[0]).toBe(0)
    expect(paginate(items, 1, 25)[24]).toBe(24)
  })

  it('returns correct last page', () => {
    const items = Array.from({ length: 100 }, (_, i) => i)
    expect(paginate(items, 4, 25)).toHaveLength(25)
    expect(paginate(items, 4, 25)[0]).toBe(75)
  })

  it('handles partial last page', () => {
    const items = Array.from({ length: 27 }, (_, i) => i)
    expect(paginate(items, 2, 25)).toHaveLength(2)
  })
})

// ─── 8. Score com checks ─────────────────────────────────────

describe('computeWeightedScore', () => {
  it('returns available status with value when checks exist', () => {
    const checks = { total: 100, passed: 80, failed: 20, incomplete: 0, inapplicable: 0 }
    const bySeverity = {
      critical: { uniqueFindings: 2, occurrences: 2 },
      serious: { uniqueFindings: 5, occurrences: 5 },
      moderate: { uniqueFindings: 5, occurrences: 5 },
      minor: { uniqueFindings: 8, occurrences: 8 },
      unknown: { uniqueFindings: 0, occurrences: 0 },
    }
    const score = computeWeightedScore(checks, bySeverity)
    expect(score.status).toBe('available')
    expect(score.value).toBeGreaterThanOrEqual(0)
    expect(score.value).toBeLessThanOrEqual(100)
  })

  // ─── 9. Score indisponível quando sem checks ───────────────
  it('returns unavailable when no checks executed', () => {
    const checks = { total: 0, passed: 0, failed: 0, incomplete: 0, inapplicable: 0 }
    const bySeverity = {
      critical: { uniqueFindings: 0, occurrences: 0 },
      serious: { uniqueFindings: 0, occurrences: 0 },
      moderate: { uniqueFindings: 0, occurrences: 0 },
      minor: { uniqueFindings: 0, occurrences: 0 },
      unknown: { uniqueFindings: 0, occurrences: 0 },
    }
    const score = computeWeightedScore(checks, bySeverity)
    expect(score.status).toBe('unavailable')
    expect(score.value).toBeUndefined()
  })

  it('score never goes below 0 or above 100', () => {
    const checks = { total: 10, passed: 0, failed: 10, incomplete: 0, inapplicable: 0 }
    const bySeverity = {
      critical: { uniqueFindings: 10, occurrences: 10 },
      serious: { uniqueFindings: 0, occurrences: 0 },
      moderate: { uniqueFindings: 0, occurrences: 0 },
      minor: { uniqueFindings: 0, occurrences: 0 },
      unknown: { uniqueFindings: 0, occurrences: 0 },
    }
    const score = computeWeightedScore(checks, bySeverity)
    expect(score.value!).toBeGreaterThanOrEqual(0)
    expect(score.value!).toBeLessThanOrEqual(100)
  })
})

// ─── 11. Validação de payload (semantic map ausente) ─────────

describe('normalizeLegacyScanResult - semantic map', () => {
  // ─── 12. Mapa semântico ausente gera aviso ─────────────────
  it('marks semantic map as missing when not provided', () => {
    const result = normalizeLegacyScanResult({}, { scanId: 'test' })
    expect(result.semanticMap.status).toBe('missing')
    expect(result.semanticMap.warnings.length).toBeGreaterThan(0)
  })

  // ─── 13. Mapa semântico parcial ───────────────────────────
  it('missing data items are present when fields are absent', () => {
    const result = normalizeLegacyScanResult({}, { scanId: 'test' })
    expect(result.semanticMap.missingData.length).toBeGreaterThan(0)
  })
})

// ─── 14. Suggestions por ruleId ──────────────────────────────

describe('rule catalog', () => {
  it('returns definition for img-alt', () => {
    const def = getRuleDefinition('img-alt')
    expect(def).toBeDefined()
    expect(def!.howToFix.length).toBeGreaterThan(0)
  })

  it('returns generic suggestion for unknown rule', () => {
    const def = getGenericSuggestion('my-custom-rule', 'serious')
    expect(def).toBeDefined()
    expect(def.howToFix.length).toBeGreaterThan(0)
    expect(def.promptTemplate).toContain('my-custom-rule')
  })

  it('suggestions are never empty', () => {
    for (const rule of ['img-alt', 'btn-name', 'input-label', 'link-href', 'heading', 'skip', 'contrast', 'html-lang']) {
      const def = getRuleDefinition(rule)
      expect(def?.howToFix.length).toBeGreaterThan(0)
    }
  })
})

// ─── 23. Relatórios antigos (legado) ─────────────────────────

describe('legacy report normalization', () => {
  const legacyReport = {
    wcag: {
      score: 72,
      level: 'AA',
      violations: [
        { id: '1', rule: 'img-alt', severity: 'critical', title: 'Alt ausente', screen: '/home', filePath: 'src/Home.tsx', selector: 'img' },
        { id: '2', rule: 'btn-name', severity: 'SERIOUS', title: 'Botão sem nome', screen: '/home', filePath: 'src/Header.tsx', selector: 'button.close' },
        { id: '3', rule: 'btn-name', severity: 'SERIOUS', title: 'Botão sem nome', screen: '/about', filePath: 'src/Header.tsx', selector: 'button.close' },
      ],
      auditedAt: '2026-01-01T00:00:00Z',
      rulesVersion: '2.2',
    },
  }

  it('normalizes and deduplicates correctly', () => {
    const result = normalizeLegacyScanResult(legacyReport, { scanId: 'legacy-1' })
    // btn-name in src/Header.tsx button.close appears in /home and /about → 1 unique
    const btnFinding = result.findings.find((f) => f.ruleId === 'btn-name')
    expect(btnFinding).toBeDefined()
    expect(btnFinding!.affectedScreens).toHaveLength(2)
    expect(btnFinding!.occurrenceCount).toBe(2)
  })

  it('marks score as estimated because no passed checks', () => {
    const result = normalizeLegacyScanResult(legacyReport, { scanId: 'legacy-1' })
    expect(result.score.status).toBe('estimated')
  })

  it('does not invent passed checks', () => {
    const result = normalizeLegacyScanResult(legacyReport, { scanId: 'legacy-1' })
    expect(result.stats.checks.passed).toBe(0)
  })

  it('preserves severity correctly', () => {
    const result = normalizeLegacyScanResult(legacyReport, { scanId: 'legacy-1' })
    const imgFinding = result.findings.find((f) => f.ruleId === 'img-alt')
    expect(imgFinding?.severity).toBe('critical')
    const btnFinding = result.findings.find((f) => f.ruleId === 'btn-name')
    expect(btnFinding?.severity).toBe('serious')
  })
})

// ─── Prompt de correção ───────────────────────────────────────

describe('generated prompt', () => {
  it('contains file names and instructions', () => {
    const legacyReport = {
      wcag: {
        violations: [
          { rule: 'input-label', severity: 'critical', title: 'Campo sem label', filePath: 'src/Login.tsx', screen: '/login', selector: 'input[type=email]' },
        ],
      },
    }
    const result = normalizeLegacyScanResult(legacyReport)
    const finding = result.findings[0]
    expect(finding.suggestion.generatedPrompt).toContain('src/Login.tsx')
    expect(finding.suggestion.generatedPrompt.length).toBeGreaterThan(50)
  })

  it('never generates an empty prompt', () => {
    const legacyReport = {
      wcag: {
        violations: [
          { rule: 'completely-unknown-rule-xyz', severity: 'minor', title: 'Problema genérico' },
        ],
      },
    }
    const result = normalizeLegacyScanResult(legacyReport)
    const finding = result.findings[0]
    expect(finding.suggestion.generatedPrompt.length).toBeGreaterThan(10)
  })
})
