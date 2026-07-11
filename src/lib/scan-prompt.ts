import { Project } from '@/services/projects'

export function buildSkipAgentPrompt(project: Project) {
  const endpoint = window.location.origin
  return `Quero que você instale e execute a skill Skip AI neste projeto.

1. Baixe a skill oficial deste repositório:
https://github.com/999NK/skip-skill

Comando de download:
git clone https://github.com/999NK/skip-skill.git

Depois do clone, localize a pasta que contém o arquivo SKILL.md e instale essa pasta no diretório de skills compatível com o seu agente (por exemplo, .agents/skills/skip no projeto ou o diretório global de skills do agente). Não apenas descreva os comandos: execute a instalação.

2. Leia integralmente o arquivo SKILL.md e siga todas as etapas da skill. Analise a estrutura real deste projeto, mapeie telas, ações e rotas, execute a auditoria WCAG local, calcule o score, gere fluxos guiados e valide o relatório. Não envie código-fonte.

3. Use estas credenciais do projeto Skip Cloud:
npx @skip-ai/scanner --token=${project.token} --url=${endpoint}

4. Invoque a skill Skip instalada e execute o fluxo completo agora. Ao terminar, envie o relatório enriquecido para o Skip Cloud e me apresente um resumo com telas mapeadas, score WCAG, violações prioritárias e fluxos guiados.

Comece agora. Se a skill já estiver instalada, atualize-a a partir do mesmo repositório antes de executar.`
}
