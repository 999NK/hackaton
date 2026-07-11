import { FileJson, FileText, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exportJSON, exportMarkdown } from '@/services/export'
import { Project } from '@/services/projects'
import { toast } from '@/hooks/use-toast'

export function DataExport({
  project,
  entities,
  relationships,
  scanDate,
}: {
  project: Project
  entities: any[]
  relationships: any[]
  scanDate?: string
}) {
  const handleJSON = () => {
    exportJSON(project, entities, relationships)
    toast({ title: 'JSON exportado com sucesso!' })
  }

  const handleMarkdown = () => {
    exportMarkdown(project, entities, relationships, scanDate)
    toast({ title: 'Markdown exportado com sucesso!' })
  }

  if (entities.length === 0) {
    return (
      <div className="glass-panel rounded-[2rem] flex flex-col items-center justify-center py-20 text-muted-foreground border-dashed border-2 border-white/10 bg-black/20">
        <FileJson size={48} className="mb-4 text-primary/40" />
        <p className="text-xl">Nenhum dado para exportar.</p>
        <p className="text-sm mt-2">Execute o scanner para gerar dados semânticos.</p>
      </div>
    )
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="glass-panel rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <FileJson size={24} className="text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold">JSON Estruturado</h3>
            <p className="text-sm text-muted-foreground">Formato flat de ingestão</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Arquivo JSON contendo todas as entidades e relacionamentos do projeto, compatível com o
          formato de ingestão do scanner.
        </p>
        <Button onClick={handleJSON} className="w-full h-12 rounded-xl font-bold gap-2">
          <Download size={18} /> Exportar JSON
        </Button>
      </div>

      <div className="glass-panel rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <FileText size={24} className="text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Markdown (Vector-RAG)</h3>
            <p className="text-sm text-muted-foreground">Otimizado para embeddings</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Arquivo semantic-map.md estruturado para sistemas RAG, com seções organizadas por tipo de
          entidade e metadados completos.
        </p>
        <Button onClick={handleMarkdown} className="w-full h-12 rounded-xl font-bold gap-2">
          <Download size={18} /> Exportar Markdown
        </Button>
      </div>
    </div>
  )
}
