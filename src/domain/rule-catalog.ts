// ============================================================
// src/domain/rule-catalog.ts
// Catálogo de definições de regras de acessibilidade.
// Fornece orientação determinística sem depender de IA.
// ============================================================

import type { RuleDefinition, Severity } from './types'

const catalog: Record<string, RuleDefinition> = {
  'img-alt': {
    ruleId: 'img-alt',
    title: 'Imagem sem texto alternativo',
    description: 'Imagens que transmitem informação precisam de um atributo alt descritivo. Imagens decorativas devem ter alt="".',
    wcag: ['1.1.1'],
    defaultSeverity: 'critical',
    whyItMatters: 'Leitores de tela anunciam o nome do arquivo da imagem quando alt está ausente, criando uma experiência confusa para pessoas cegas ou com baixa visão.',
    howToFix: [
      'Para imagens informativas: adicione alt="Descrição concisa do que a imagem mostra".',
      'Para imagens decorativas: use alt="" (string vazia).',
      'Nunca use o nome do arquivo como valor de alt.',
      'Em JSX, use a prop alt diretamente: <img src="..." alt="descrição" />',
    ],
    documentation: ['https://www.w3.org/WAI/tutorials/images/', 'https://www.w3.org/TR/WCAG21/#non-text-content'],
    examples: {
      before: '<img src="logo.png" />',
      after: '<img src="logo.png" alt="Skip — ferramenta de acessibilidade" />',
    },
    promptTemplate: `Corrija as imagens sem texto alternativo (regra img-alt, WCAG 1.1.1).

Arquivos afetados:
{{FILES}}

Para cada imagem:
1. Se a imagem transmite informação: adicione alt="descrição concisa".
2. Se a imagem é decorativa: use alt="" (string vazia).
3. Não use o nome do arquivo como alt.
4. Preserve o comportamento e layout atual.
5. Execute os testes após a alteração.`,
  },

  'btn-name': {
    ruleId: 'btn-name',
    title: 'Botão sem nome acessível',
    description: 'Botões devem ter um nome acessível para que tecnologias assistivas possam anunciá-los.',
    wcag: ['4.1.2'],
    defaultSeverity: 'critical',
    whyItMatters: 'Sem um nome acessível, leitores de tela anunciam apenas "botão", sem indicar sua função. Usuários de voz não conseguem acionar o controle.',
    howToFix: [
      'Use texto visível dentro do botão: <button>Salvar</button>.',
      'Para botões apenas com ícones: adicione aria-label="Fechar" ou <span className="sr-only">Fechar</span>.',
      'aria-labelledby pode referenciar outro elemento como rótulo.',
      'Não use title como substituto — ele não é confiável em dispositivos touch.',
    ],
    documentation: ['https://www.w3.org/WAI/ARIA/apg/patterns/button/', 'https://www.w3.org/TR/WCAG21/#name-role-value'],
    examples: {
      before: '<button><XIcon /></button>',
      after: '<button aria-label="Fechar"><XIcon /></button>',
    },
    promptTemplate: `Corrija os botões sem nome acessível (regra btn-name, WCAG 4.1.2).

Arquivos afetados:
{{FILES}}

Para cada botão:
1. Se o botão só contém ícone: adicione aria-label descritivo ou <span className="sr-only">.
2. Se contém texto visível, verifique se ele não está oculto por CSS.
3. Preserve comportamento e layout.
4. Execute os testes após a alteração.`,
  },

  'input-label': {
    ruleId: 'input-label',
    title: 'Campo sem rótulo acessível',
    description: 'Todo campo de formulário deve estar associado a um rótulo visível e acessível.',
    wcag: ['1.3.1', '3.3.2'],
    defaultSeverity: 'critical',
    whyItMatters: 'Sem rótulo, usuários de leitor de tela não sabem o propósito do campo. Placeholder não é substituto de label.',
    howToFix: [
      'Use <label htmlFor="id">Rótulo</label> com <input id="id" />.',
      'Ou envolva o input dentro do label: <label>Rótulo<input /></label>.',
      'Para casos visuais: use aria-label="Rótulo" no input.',
      'Nunca use apenas placeholder como rótulo.',
    ],
    documentation: ['https://www.w3.org/WAI/tutorials/forms/labels/', 'https://www.w3.org/TR/WCAG21/#info-and-relationships'],
    examples: {
      before: '<input type="email" placeholder="seu@email.com" />',
      after: '<label htmlFor="email">E-mail</label>\n<input id="email" type="email" placeholder="seu@email.com" />',
    },
    promptTemplate: `Corrija os campos sem rótulo acessível (regra input-label, WCAG 1.3.1 e 3.3.2).

Arquivos afetados:
{{FILES}}

Para cada campo:
1. Associe um label visível usando htmlFor e id.
2. Quando label visual não for adequado, use aria-label ou aria-labelledby.
3. Não use placeholder como substituto de label.
4. Preserve comportamento, estado e layout atuais.
5. Execute os testes após a alteração.`,
  },

  'link-href': {
    ruleId: 'link-href',
    title: 'Link sem destino ou sem nome acessível',
    description: 'Links devem ter um destino válido (href) e um nome acessível que indique onde o link leva.',
    wcag: ['2.4.4', '4.1.2'],
    defaultSeverity: 'serious',
    whyItMatters: 'Links sem destino ou sem nome confundem usuários de leitor de tela, que dependem do texto do link para entender a navegação.',
    howToFix: [
      'Em React Router: use <Link to="/rota">Texto descritivo</Link>.',
      'Em links HTML: use <a href="/rota">Texto descritivo</a>.',
      'Para links com ícones: adicione aria-label ou texto sr-only.',
      'Não use "clique aqui" ou "saiba mais" como único texto do link.',
    ],
    documentation: ['https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-in-context.html'],
    examples: {
      before: '<a href="#">Saiba mais</a>',
      after: '<a href="/sobre">Saiba mais sobre o produto</a>',
    },
    promptTemplate: `Corrija os links sem destino ou sem nome acessível (regra link-href, WCAG 2.4.4).

Arquivos afetados:
{{FILES}}

Para cada link:
1. Em React Router, use <Link to="caminho"> com texto descritivo.
2. Remova href="#" ou href="javascript:void(0)" e substitua por evento de clique em button.
3. Para links com ícones, adicione aria-label.
4. Preserve comportamento e layout.`,
  },

  'heading': {
    ruleId: 'heading',
    title: 'Hierarquia de títulos incorreta',
    description: 'Os headings (h1–h6) devem seguir uma hierarquia lógica sem pular níveis.',
    wcag: ['1.3.1', '2.4.6'],
    defaultSeverity: 'moderate',
    whyItMatters: 'Headings são usados por leitores de tela para navegar rapidamente pelo conteúdo. Hierarquia incorreta desorientar esses usuários.',
    howToFix: [
      'Cada página deve ter exatamente um <h1>.',
      'Não pule níveis: após h2, use h3 — não h4 direto.',
      'Use headings para estrutura, não para estilo (use classes CSS para tamanho visual).',
    ],
    documentation: ['https://www.w3.org/WAI/tutorials/page-structure/headings/'],
    examples: {
      before: '<h1>Título</h1>\n<h3>Seção (pulou h2)</h3>',
      after: '<h1>Título</h1>\n<h2>Seção</h2>',
    },
    promptTemplate: `Corrija a hierarquia de títulos (regra heading, WCAG 1.3.1).

Arquivos afetados:
{{FILES}}

Para cada arquivo:
1. Garanta que há exatamente um h1 por página.
2. Não pule níveis de heading.
3. Use CSS para estilo visual, não para nível semântico.`,
  },

  'skip': {
    ruleId: 'skip',
    title: 'Link de skip navigation ausente',
    description: 'Páginas com muito conteúdo de navegação antes do conteúdo principal devem ter um link "Pular para o conteúdo".',
    wcag: ['2.4.1'],
    defaultSeverity: 'moderate',
    whyItMatters: 'Usuários de teclado e leitor de tela precisam percorrer toda a navegação repetidamente sem um link de skip.',
    howToFix: [
      'Adicione no início do body: <a href="#main-content" className="sr-only focus:not-sr-only">Pular para o conteúdo</a>.',
      'Marque o conteúdo principal com id="main-content" no elemento <main>.',
    ],
    examples: {
      before: '<!-- nenhum link de skip -->',
      after: '<a href="#main" className="skip-link">Pular para o conteúdo</a>\n<main id="main">...</main>',
    },
    promptTemplate: `Adicione link de skip navigation (regra skip, WCAG 2.4.1).

Arquivos afetados:
{{FILES}}

1. Adicione <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4">Pular para o conteúdo principal</a> no início do layout.
2. Adicione id="main-content" no elemento <main>.`,
  },

  'contrast': {
    ruleId: 'contrast',
    title: 'Possível contraste insuficiente',
    description: 'A taxa de contraste entre texto e fundo pode ser menor que o mínimo WCAG (4.5:1 para texto normal, 3:1 para texto grande).',
    wcag: ['1.4.3'],
    defaultSeverity: 'serious',
    whyItMatters: 'Contraste insuficiente dificulta a leitura para pessoas com baixa visão ou daltonismo.',
    howToFix: [
      'Verifique a taxa de contraste com ferramentas como: WebAIM Contrast Checker, browser DevTools.',
      'Para texto normal (< 18pt): mínimo 4.5:1.',
      'Para texto grande (≥ 18pt ou negrito ≥ 14pt): mínimo 3:1.',
      'Evite texto cinza claro sobre fundo branco.',
    ],
    documentation: ['https://webaim.org/resources/contrastchecker/', 'https://www.w3.org/TR/WCAG21/#contrast-minimum'],
    promptTemplate: `Verifique e corrija possíveis problemas de contraste (regra contrast, WCAG 1.4.3).

Nota: contraste depende da combinação real de cores renderizadas. Verifique manualmente com WebAIM Contrast Checker.

Arquivos afetados:
{{FILES}}`,
  },

  'html-lang': {
    ruleId: 'html-lang',
    title: 'Atributo lang ausente no HTML',
    description: 'O elemento <html> deve ter o atributo lang definido com o idioma principal da página.',
    wcag: ['3.1.1'],
    defaultSeverity: 'serious',
    whyItMatters: 'Sem lang, leitores de tela podem usar o idioma errado para pronunciar o conteúdo.',
    howToFix: [
      'Adicione lang="pt-BR" (ou o idioma correto) ao elemento <html> no arquivo index.html.',
      'Em SPAs, este problema afeta todas as rotas — corrija uma vez no arquivo HTML raiz.',
    ],
    examples: {
      before: '<html>',
      after: '<html lang="pt-BR">',
    },
    promptTemplate: `Adicione o atributo lang ao elemento html (regra html-lang, WCAG 3.1.1).

Arquivo afetado: index.html

Adicione lang="pt-BR" (ou o idioma correto) ao elemento <html>.
Este problema afeta todas as {{SCREENS}} telas da aplicação.`,
  },
}

/** Retorna a definição de uma regra pelo ID, ou undefined se não catalogada. */
export function getRuleDefinition(ruleId: string): RuleDefinition | undefined {
  const normalized = ruleId.toLowerCase().trim()
  return catalog[normalized]
}

/** Retorna uma sugestão genérica quando a regra não está no catálogo. */
export function getGenericSuggestion(ruleId: string, severity: Severity): RuleDefinition {
  return {
    ruleId,
    title: `Violação de acessibilidade: ${ruleId}`,
    description: `O scanner identificou um problema relacionado à regra "${ruleId}". Esta regra não possui uma definição detalhada no catálogo.`,
    wcag: [],
    defaultSeverity: severity,
    whyItMatters: 'Violações de acessibilidade podem excluir pessoas com deficiência de usar o produto.',
    howToFix: [
      'Consulte a documentação WCAG para a regra específica.',
      'Inspecione o elemento identificado pelo seletor informado.',
      'Considere testar com um leitor de tela (NVDA, JAWS, VoiceOver).',
    ],
    promptTemplate: `Corrija o problema de acessibilidade da regra "${ruleId}".

Arquivos afetados:
{{FILES}}

Contexto:
- Severidade: {{SEVERITY}}
- Telas afetadas: {{SCREENS}}

Analise o elemento identificado e aplique a correção de acessibilidade adequada.`,
  }
}

/** Retorna todas as regras do catálogo. */
export function getAllRules(): RuleDefinition[] {
  return Object.values(catalog)
}

export { catalog as ruleCatalog }
