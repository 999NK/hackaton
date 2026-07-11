import { useState } from 'react'
import { Copy, Check, Terminal, AlertTriangle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Project } from '@/services/projects'
import { toast } from '@/hooks/use-toast'

export function IntegrationPanel({ project }: { project: Project }) {
  const [copiedToken, setCopiedToken] = useState(false)
  const [copiedCommand, setCopiedCommand] = useState(false)

  const origin = window.location.origin
  const npxCommand = `npx @skip-ai/scanner --token=${project.token} --url=${origin}/backend/v1`

  const handleCopyToken = () => {
    navigator.clipboard.writeText(project.token)
    setCopiedToken(true)
    toast({ title: 'Token copiado!' })
    setTimeout(() => setCopiedToken(false), 2000)
  }

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(npxCommand)
    setCopiedCommand(true)
    toast({ title: 'Comando copiado!' })
    setTimeout(() => setCopiedCommand(false), 2000)
  }

  return (
    <div className="space-y-6">
      <Alert className="glass-panel border-amber-500/30 bg-amber-500/5 rounded-2xl">
        <AlertTriangle className="h-5 w-5 text-amber-400" />
        <AlertTitle className="text-amber-400 font-bold">Aviso de Segurança</AlertTitle>
        <AlertDescription className="text-amber-200/80">
          Não compartilhe este token. Ele dá acesso a enviar scans para este projeto.
        </AlertDescription>
      </Alert>

      <div className="glass-panel rounded-[2rem] p-8 lg:p-10 border-white/5">
        <h3 className="text-2xl font-bold mb-4 flex items-center gap-3">
          <Terminal size={24} className="text-primary" /> Comando do Scanner
        </h3>
        <p className="text-muted-foreground text-lg mb-6 max-w-3xl">
          Execute este comando na raiz do seu projeto para iniciar o scan de acessibilidade.
        </p>
        <div className="relative group mb-3">
          <pre className="bg-[#09090b] p-6 rounded-2xl overflow-x-auto text-sm md:text-base text-emerald-400 border border-white/10 shadow-inner font-mono">
            <code>{npxCommand}</code>
          </pre>
          <Button
            variant="secondary"
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-xl h-10 px-4 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md gap-2"
            onClick={handleCopyCommand}
          >
            {copiedCommand ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
            Copiar comando completo
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          A flag <code className="text-emerald-400">--url</code> aponta para a URL do backend do
          ambiente atual ({origin}/backend/v1).
        </p>
      </div>

      <div className="glass-panel rounded-2xl p-6 border-white/5">
        <h4 className="font-semibold text-sm mb-3">Token do Projeto</h4>
        <div className="flex items-center gap-3">
          <code className="flex-1 block bg-black/40 rounded-lg p-3 text-sm text-emerald-400 font-mono break-all border border-white/10">
            {project.token}
          </code>
          <Button
            variant="secondary"
            className="bg-white/10 hover:bg-white/20 text-white rounded-xl h-10 px-4 gap-2 shrink-0"
            onClick={handleCopyToken}
          >
            {copiedToken ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
            Copiar
          </Button>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-6 border-white/5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
            <ExternalLink size={16} className="text-primary" />
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-1">Como funciona</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              O scanner analisa seu projeto e envia o mapa semântico para esta plataforma. Os
              resultados aparecem na aba "Histórico de Scans" automaticamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
