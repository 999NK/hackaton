import { useState } from 'react'
import { Copy, Check, RefreshCw, Eye, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Project, updateProject } from '@/services/projects'
import { toast } from '@/hooks/use-toast'

export function WidgetConfig({ project, onUpdate }: { project: Project; onUpdate: () => void }) {
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const widgetUrl = `${window.location.origin}/widget.js`
  const iconUrl = `${window.location.origin}/widget-icon.ico`
  const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
  const snippet = `<script src="${widgetUrl}?token=${project.token}&api=${apiUrl}"></script>`

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet)
    setCopied(true)
    toast({ title: 'Snippet copiado!' })
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      const newToken = crypto.randomUUID()
      await updateProject(project.id, { token: newToken })
      toast({ title: 'Token regenerado!' })
      onUpdate()
    } catch {
      toast({ title: 'Erro ao regenerar token', variant: 'destructive' })
    } finally {
      setRegenerating(false)
    }
  }

  const previewHtml = `<!DOCTYPE html><html><body style="margin:0;background:linear-gradient(135deg,#eef4ff,#dbeafe);height:100%;min-height:200px;position:relative;font-family:system-ui,sans-serif;"><div style="position:absolute;bottom:16px;right:16px;width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,0.82);backdrop-filter:blur(14px) saturate(1.4);border:2px solid rgba(37,99,235,0.25);display:flex;align-items:center;justify-content:center;box-shadow:0 6px 24px rgba(37,99,235,0.3),0 0 0 1px rgba(255,255,255,0.6) inset;overflow:hidden;"><img src="${iconUrl}" style="width:38px;height:38px;object-fit:contain;display:block;" /></div></body></html>`

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div className="glass-panel rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-4">Token do Projeto</h3>
          <code className="block bg-black/40 rounded-lg p-3 text-sm text-emerald-400 font-mono break-all border border-white/10 mb-4">
            {project.token}
          </code>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={handleCopy}
              className="gap-2 bg-white/10 hover:bg-white/20 rounded-xl flex-1"
            >
              {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
              Copiar Snippet
            </Button>
            <Button
              variant="secondary"
              onClick={handleRegenerate}
              disabled={regenerating}
              className="gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-xl"
            >
              <RefreshCw size={16} /> Regenerar
            </Button>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Download size={18} /> Exportar Widget
          </h3>
          <pre className="bg-[#09090b] p-4 rounded-xl text-sm text-emerald-400 border border-white/10 overflow-x-auto font-mono">
            <code>{snippet}</code>
          </pre>
          <div className="mt-4 grid gap-2 text-xs text-muted-foreground">
            <span>Script: {widgetUrl}</span>
            <span>API: {apiUrl}</span>
            <span>Ícone: {iconUrl}</span>
          </div>
        </div>

      </div>

      <div className="glass-panel rounded-2xl p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Eye size={18} /> Pré-visualização do Widget
        </h3>
        <iframe
          srcDoc={previewHtml}
          title="Widget Preview"
          className="w-full h-[300px] rounded-xl border border-white/10 bg-background"
        />
        <p className="text-xs text-muted-foreground mt-3">
          O botão flutuante aparece com o ícone configurado e expande para voz, ações e navegação.
        </p>
      </div>
    </div>
  )
}
