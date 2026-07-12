import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildResponse,
  classifyIntent,
  extractTarget,
  interpret,
  matchEntities,
  normalize,
  planPath,
  scoreEntity,
  tokenize,
} from '../widget-nlu.js'

// Fixture de mapa semantico realista (rotas + acoes + formularios).
const entities = [
  { id: 'r-home', type: 'ROUTE', name: 'Início', slug: 'inicio', path: '/', pageTitle: 'Início', semanticLabels: ['home', 'inicio'], metadata: {} },
  { id: 'r-settings', type: 'ROUTE', name: 'Configurações', slug: 'configuracoes', path: '/settings', pageTitle: 'Configurações', semanticLabels: ['config', 'configuracoes', 'ajustes'], metadata: {} },
  { id: 'r-stock', type: 'ROUTE', name: 'Estoque', slug: 'estoque', path: '/estoque', pageTitle: 'Estoque', semanticLabels: ['estoque', 'inventory'], metadata: {} },
  { id: 'r-sales', type: 'ROUTE', name: 'Vendas', slug: 'vendas', path: '/vendas', pageTitle: 'Tela de Vendas', semanticLabels: ['vendas', 'sales', 'pdv'], metadata: {} },
  { id: 'r-pdv', type: 'ROUTE', name: 'PDV', slug: 'pdv', path: '/pdv', pageTitle: 'Ponto de Venda', semanticLabels: ['pdv', 'ponto de venda', 'caixa'], metadata: {} },
  {
    id: 'a-finalize',
    type: 'BUTTON',
    name: 'Finalizar venda',
    slug: 'finalizar-venda',
    semanticLabels: ['finalizar venda', 'concluir venda'],
    metadata: { kind: 'submit', cssSelector: 'button[data-skip-anchor="finalize"]', intent: 'submit' },
  },
  {
    id: 'i-email',
    type: 'INPUT',
    name: 'E-mail',
    slug: 'email',
    semanticLabels: ['email', 'e-mail', 'correo'],
    metadata: { kind: 'fill', cssSelector: 'input[name="email"]', inputName: 'email', inputType: 'email' },
  },
]

const relationships = [
  { source: 'r-home', target: 'r-settings', type: 'NAVIGATES_TO' },
  { source: 'r-home', target: 'r-stock', type: 'NAVIGATES_TO' },
  { source: 'r-home', target: 'r-sales', type: 'NAVIGATES_TO' },
  { source: 'r-sales', target: 'r-pdv', type: 'NAVIGATES_TO' },
  { source: 'r-sales', target: 'a-finalize', type: 'CONTAINS' },
  { source: 'r-sales', target: 'i-email', type: 'FILLS' },
]

describe('widget-nlu normalization', () => {
  it('strips accents, case and punctuation', () => {
    assert.equal(normalize('ENTRE na TELA de Configurações!'), 'entre na tela de configuracoes')
    assert.equal(normalize('PDV'), 'pdv')
  })

  it('drops stopwords on tokenize', () => {
    assert.deepEqual(tokenize('entre na tela de configuracoes'), ['entre', 'tela', 'configuracoes'])
  })
})

describe('widget-nlu intent classification', () => {
  it('classifies navigation commands', () => {
    assert.equal(classifyIntent('abre o estoque').intent, 'NAVIGATE')
    assert.equal(classifyIntent('vai pra tela de vendas').intent, 'NAVIGATE')
    assert.equal(classifyIntent('entra no PDV').intent, 'NAVIGATE')
    assert.equal(classifyIntent('ir para configurações').intent, 'NAVIGATE')
  })

  it('classifies fill commands', () => {
    assert.equal(classifyIntent('digita meu e-mail').intent, 'FILL')
    assert.equal(classifyIntent('preencha o campo de senha').intent, 'FILL')
  })

  it('classifies click commands', () => {
    assert.equal(classifyIntent('clica em finalizar venda').intent, 'CLICK')
    assert.equal(classifyIntent('apertar o botão salvar').intent, 'CLICK')
  })

  it('classifies highlight, read and settings', () => {
    assert.equal(classifyIntent('destaca o botão de enviar').intent, 'HIGHLIGHT')
    assert.equal(classifyIntent('ler a página').intent, 'READ')
    assert.equal(classifyIntent('aumenta o contraste').intent, 'SETTINGS')
    assert.equal(classifyIntent('diminuir a fonte').intent, 'SETTINGS')
  })

  it('falls back to NAVIGATE when only a target name is spoken', () => {
    assert.equal(classifyIntent('configurações').intent, 'NAVIGATE')
  })
})

describe('widget-nlu target extraction', () => {
  it('keeps the real target after removing verbs and filler nouns', () => {
    assert.equal(extractTarget(classifyIntent('abre o estoque')), 'estoque')
    assert.equal(extractTarget(classifyIntent('vai pra tela de vendas')), 'vendas')
    assert.equal(extractTarget(classifyIntent('entra no PDV')), 'pdv')
    assert.equal(extractTarget(classifyIntent('digita meu e-mail')), 'email')
  })

  it('preserves multi-word targets', () => {
    assert.equal(extractTarget(classifyIntent('clica em finalizar venda')), 'finalizar venda')
  })
})

describe('widget-nlu entity matching', () => {
  it('scores routes higher for navigation intent', () => {
    const score = scoreEntity(entities.find((e) => e.id === 'r-settings'), tokenize('configuracoes'), 'NAVIGATE')
    assert.ok(score >= 0.85, `score ${score} should be >= 0.85`)
  })

  it('scores inputs higher for fill intent', () => {
    const score = scoreEntity(entities.find((e) => e.id === 'i-email'), tokenize('email'), 'FILL')
    assert.ok(score >= 0.85)
  })
})

describe('widget-nlu end-to-end interpretation', () => {
  const cases = [
    { cmd: 'abre o estoque', intent: 'NAVIGATE', match: 'Estoque' },
    { cmd: 'vai pra tela de vendas', intent: 'NAVIGATE', match: 'Vendas' },
    { cmd: 'entra no PDV', intent: 'NAVIGATE', match: 'PDV' },
    { cmd: 'digita meu e-mail', intent: 'FILL', match: 'E-mail' },
    { cmd: 'clica em finalizar venda', intent: 'CLICK', match: 'Finalizar venda' },
    { cmd: 'aumenta o contraste', intent: 'SETTINGS', match: null },
    { cmd: 'destaca o botão de enviar', intent: 'HIGHLIGHT', match: null },
    { cmd: 'ler a página', intent: 'READ', match: null },
  ]

  for (const { cmd, intent, match } of cases) {
    it(`interprets "${cmd}"`, () => {
      const res = interpret({ transcript: cmd, path: '/', entities, relationships })
      assert.equal(res.action, intent === 'SETTINGS' ? 'SETTINGS' : intent)
      if (match) {
        assert.ok(res.matches.length > 0, 'expected at least one match')
        assert.equal(res.matches[0].name, match)
      }
    })
  }

  it('tolerates a typo via fuzzy matching and still returns a suggestion or match', () => {
    const res = interpret({ transcript: 'vai pra confgurações', path: '/', entities, relationships })
    assert.ok(res.matches.length > 0 || res.suggestions.length > 0, 'should not return empty for a typo')
    if (res.matches.length) assert.equal(res.matches[0].name, 'Configurações')
  })

  it('returns suggestions instead of nothing for an unknown target', () => {
    const res = interpret({ transcript: 'vai para blablaqualquer', path: '/', entities, relationships })
    assert.equal(res.matches.length, 0)
    assert.ok(res.suggestions.length > 0)
  })
})

describe('widget-nlu path planning', () => {
  it('plans a single DONE step when already on the target route', () => {
    const plan = planPath({ entities, relationships, startPath: '/settings', target: entities.find((e) => e.id === 'r-settings'), intent: 'NAVIGATE' })
    assert.equal(plan.found, true)
    assert.equal(plan.steps[0].action, 'DONE')
  })

  it('plans a CLICK step when a NAVIGATES_TO edge exists from the current route', () => {
    const plan = planPath({ entities, relationships, startPath: '/', target: entities.find((e) => e.id === 'r-stock'), intent: 'NAVIGATE' })
    assert.equal(plan.found, true)
    assert.ok(plan.steps.length >= 1)
    assert.ok(['CLICK', 'NAVIGATE'].includes(plan.steps[0].action))
  })

  it('produces a fill step for a fill-intent target with a cssSelector', () => {
    const plan = planPath({ entities, relationships, startPath: '/vendas', target: entities.find((e) => e.id === 'i-email'), intent: 'FILL' })
    assert.equal(plan.found, true)
    assert.equal(plan.steps[0].action, 'WAIT_INPUT')
  })
})

describe('widget-nlu response shape', () => {
  it('always returns action/matches/fillValue/steps/suggestions', () => {
    const res = buildResponse({ intent: 'NAVIGATE', matches: [], steps: [], suggestions: [] })
    for (const key of ['action', 'matches', 'fillValue', 'steps', 'suggestions']) {
      assert.ok(key in res)
    }
  })
})
