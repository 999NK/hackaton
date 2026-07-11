import { useState } from 'react'
import { Copy, Check, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { downloadFile } from '@/services/export'
import { toast } from '@/hooks/use-toast'

export function CodeBlock({ code, filename }: { code: string; filename: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    toast({ title: 'Código copiado!' })
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    downloadFile(code, filename, 'text/plain')
    toast({ title: 'Arquivo baixado!' })
  }

  return (
    <div className="glass-panel rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
        <span className="text-sm font-mono text-muted-foreground">{filename}</span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-8 gap-1.5 text-xs hover:bg-white/10"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            Copiar Código
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-8 gap-1.5 text-xs hover:bg-white/10"
          >
            <Download size={14} />
            Baixar Arquivo
          </Button>
        </div>
      </div>
      <pre className="p-4 overflow-x-auto text-sm font-mono text-emerald-400 bg-[#09090b] max-h-[400px]">
        <code>{code}</code>
      </pre>
    </div>
  )
}
