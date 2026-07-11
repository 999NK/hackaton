import { useState } from 'react'
import { FlaskConical, Loader2, FileCode, Play, Route } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CodeBlock } from '@/components/code-block'
import { generateTests, type TestResult } from '@/services/testing'
import { toast } from '@/hooks/use-toast'

export function TestGenerator({ entities, projectId }: { entities: any[]; projectId: string }) {
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null)
  const [result, setResult] = useState<TestResult | null>(null)
  const [loading, setLoading] = useState(false)

  const flows = entities.filter((e) => e.type === 'FLOW')

  const handleGenerate = async (flowId: string, flowName: string) => {
    setSelectedFlow(flowId)
    setLoading(true)
    setResult(null)
    try {
      const res = await generateTests(projectId, flowId)
      setResult(res)
      toast({ title: `Testes gerados para: ${flowName}` })
    } catch {
      toast({ title: 'Erro ao gerar testes', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  if (flows.length === 0) {
    return (
      <div className="glass-panel rounded-[2rem] flex flex-col items-center justify-center py-20 text-muted-foreground border-dashed border-2 border-white/10 bg-black/20">
        <FlaskConical size={48} className="mb-4 text-primary/40" />
        <p className="text-xl">Nenhum fluxo encontrado.</p>
        <p className="text-sm mt-2">Execute o scanner para mapear fluxos do sistema.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {flows.map((flow) => {
          const steps = flow.metadata?.steps || []
          const isActive = selectedFlow === flow.id
          return (
            <div
              key={flow.id}
              className={`glass-panel rounded-2xl p-5 transition-all ${isActive ? 'border-primary/50 ring-1 ring-primary/30' : 'border-white/5'}`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Route size={20} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold truncate">{flow.name}</h4>
                  <p className="text-xs text-muted-foreground">{steps.length} etapa(s)</p>
                </div>
              </div>
              {flow.description && (
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {flow.description}
                </p>
              )}
              <Button
                onClick={() => handleGenerate(flow.id, flow.name)}
                disabled={loading && !isActive}
                className="w-full h-10 rounded-xl font-bold gap-2"
              >
                {loading && isActive ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Gerando...
                  </>
                ) : (
                  <>
                    <Play size={16} /> Gerar Testes
                  </>
                )}
              </Button>
            </div>
          )
        })}
      </div>

      {loading && (
        <div className="glass-panel rounded-2xl p-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-muted-foreground">Gerando cenários de teste com IA...</p>
          </div>
        </div>
      )}

      {result && !loading && (
        <div className="grid lg:grid-cols-2 gap-6 animate-fade-in-up">
          <div>
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <FileCode size={20} className="text-primary" /> Gherkin (.feature)
            </h3>
            <CodeBlock code={result.gherkin} filename={`${selectedFlow || 'test'}.feature`} />
          </div>
          <div>
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <FileCode size={20} className="text-primary" /> Playwright (TypeScript)
            </h3>
            <CodeBlock code={result.playwright} filename={`${selectedFlow || 'test'}.spec.ts`} />
          </div>
        </div>
      )}
    </div>
  )
}
