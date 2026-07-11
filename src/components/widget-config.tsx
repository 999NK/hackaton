import { useState } from 'react'
import { Copy, Check, RefreshCw, Globe, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Project, updateProject } from '@/services/projects'
import { toast } from '@/hooks/use-toast'

export function WidgetConfig({ project, onUpdate }: { project: Project; onUpdate: () => void }) {
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [baseUrl, setBaseUrl] = useState(project.baseUrl || '')
  const [savingUrl, setSavingUrl] = useState(false)

  const widgetUrl = `${window.location.origin}/widget.js`
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

  const handleSaveUrl = async () => {
    setSavingUrl(true)
    try {
      await updateProject(project.id, { baseUrl })
      toast({ title: 'URL salva!' })
      onUpdate()
    } catch {
      toast({ title: 'Erro ao salvar URL', variant: 'destructive' })
    } finally {
      setSavingUrl(false)
    }
  }

  const previewHtml = `<!DOCTYPE html><html><body style="margin:0;background:#0a0a0f;height:100%;min-height:200px;position:relative;font-family:sans-serif;"><div style="position:absolute;bottom:16px;right:16px;width:56px;height:56px;border-radius:50%;background:rgba(89,34,242,0.65);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;color:white;box-shadow:0 4px 20px rgba(89,34,242,0.4);"><svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11h-2z"/></svg></div></body></html>`

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
          <h3 className="text-lg font-bold mb-4">Snippet de Instalação</h3>
          <pre className="bg-[#09090b] p-4 rounded-xl text-sm text-emerald-400 border border-white/10 overflow-x-auto font-mono">
            <code>{snippet}</code>
          </pre>
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Globe size={18} /> URL Base (CORS Whitelist)
          </h3>
          <div className="space-y-3">
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="bg-black/30 border-white/10 h-12 rounded-xl"
              placeholder="https://sua-app.com"
            />
            <Button
              onClick={handleSaveUrl}
              disabled={savingUrl}
              className="w-full h-11 rounded-xl font-bold"
            >
              {savingUrl ? 'Salvando...' : 'Salvar URL'}
            </Button>
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
          O botão flutuante AssistiveTouch aparecerá no canto inferior direito do seu site.
        </p>
      </div>
    </div>
  )
}
