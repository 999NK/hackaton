import { useState, useRef, useEffect } from 'react'
import { Copy, Check, Loader2, FileJson, AlertCircle, ClipboardPaste } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { submitManualScan } from '@/services/manual-scan'
import { Scan } from '@/services/scans'
import { ScanProgress } from '@/components/scan-progress'
import { useRealtime } from '@/hooks/use-realtime'
import { toast } from '@/hooks/use-toast'

const EXTRACTION_PROMPT = `You are an AI code analysis expert specializing in semantic mapping and accessibility.

Analyze the source code of the web application provided by the user and generate a Semantic Application Map (SAM).

Return ONLY valid JSON (no markdown fences, no explanation) with this exact structure:

{
  "entities": [
    {
      "type": "ROUTE | COMPONENT | API | FLOW | BUSINESS_RULE",
      "name": "Human-readable name",
      "slug": "unique-kebab-case-slug",
      "path": "file path or URL path",
      "pageTitle": "page title for ROUTE entities",
      "semanticLabels": ["pt-br alias 1", "pt-br alias 2"],
      "description": "PT-BR description of what this entity does",
      "accessibilityHint": "PT-BR accessibility hint for interactive components",
      "confidence": 0.9,
      "evidence": ["specific code reference 1", "specific code reference 2"],
      "metadata": {}
    }
  ],
  "relationships": [
    {
      "sourceSlug": "slug-of-source-entity",
      "targetSlug": "slug-of-target-entity",
      "type": "CONTAINS | CONSUMES | TRIGGERS | REDIRECTS | VALIDATES"
    }
  ]
}

Rules:
1. Generate 3-8 semanticLabels per entity in PT-BR (synonyms, colloquialisms, imperative forms)
2. Generate accessibilityHint in Portuguese for all interactive components
3. Discover at least 1 FLOW and 2 BUSINESS_RULE entities from the code
4. ROUTE entities: must include path and pageTitle
5. COMPONENT metadata: {"cssSelector":"tag#id","componentType":"button|input|form|link","label":"text"}
6. API metadata: {"httpMethod":"GET|POST|PUT|DELETE|PATCH","endpoint":"/api/path"}
7. FLOW metadata: {"steps":[{"order":1,"entitySlug":"slug","action":"description"}]}
8. BUSINESS_RULE metadata: {"severity":"CRITICAL|WARNING|INFO","constraint":"description"}
9. All slugs must be unique kebab-case strings
10. Relationships must reference existing entity slugs
11. Every entity MUST have an evidence array with specific code references (file paths, selectors, imports)
12. Confidence: 0.9+ for directly observed in code, 0.5-0.8 for inferred from patterns`

const VALID_ENTITY_TYPES = ['ROUTE', 'COMPONENT', 'API', 'FLOW', 'BUSINESS_RULE']
const VALID_REL_TYPES = ['CONTAINS', 'CONSUMES', 'TRIGGERS', 'REDIRECTS', 'VALIDATES']

interface ManualScanProps {
  projectId: string
  scans: Scan[]
  onScanComplete?: () => void
}

export function ManualScan({ projectId, scans, onScanComplete }: ManualScanProps) {
  const [mode, setMode] = useState<'input' | 'scanning' | 'complete' | 'error'>('input')
  const [jsonInput, setJsonInput] = useState('')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [scanData, setScanData] = useState<Scan | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const scanningRef = useRef(false)

  useEffect(() => {
    const active = scans.find(
      (s) => (s.status === 'PROCESSING' || s.status === 'ENRICHING') && s.phase,
    )
    if (active) {
      scanningRef.current = true
      setScanData(active)
      setMode('scanning')
    }
  }, [])

  useRealtime('scans', (e) => {
    if (!scanningRef.current) return
    if (e.record.project !== projectId) return
    setScanData(e.record as unknown as Scan)
    if (e.record.status === 'COMPLETED') {
      scanningRef.current = false
      setMode('complete')
      onScanComplete?.()
    } else if (e.record.status === 'FAILED') {
      scanningRef.current = false
      setMode('error')
      onScanComplete?.()
    }
  })

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(EXTRACTION_PROMPT)
    setCopied(true)
    toast({ title: 'Prompt copiado!' })
    setTimeout(() => setCopied(false), 2000)
  }

  const validateJson = (input: string): { valid: boolean; errors: string[]; data?: any } => {
    const errors: string[] = []
    if (!input.trim()) {
      return { valid: false, errors: ['O campo não pode estar vazio.'] }
    }
    let parsed: any
    try {
      parsed = JSON.parse(input)
    } catch (err) {
      return { valid: false, errors: ['JSON inválido: ' + (err as Error).message] }
    }
    if (!parsed.entities || !Array.isArray(parsed.entities) || parsed.entities.length === 0) {
      errors.push('O campo "entities" é obrigatório e deve ser um array não vazio.')
      return { valid: false, errors }
    }
    const slugSet = new Set<string>()
    parsed.entities.forEach((ent: any, i: number) => {
      if (!ent.type || !VALID_ENTITY_TYPES.includes(ent.type)) {
        errors.push(
          `Entidade ${i} (${ent.name || 'sem nome'}): tipo inválido "${ent.type || 'ausente'}". Válidos: ${VALID_ENTITY_TYPES.join(', ')}`,
        )
      }
      if (!ent.name) {
        errors.push(`Entidade ${i}: campo "name" é obrigatório.`)
      }
      if (ent.slug) slugSet.add(ent.slug)
    })
    if (parsed.relationships && Array.isArray(parsed.relationships)) {
      parsed.relationships.forEach((rel: any, i: number) => {
        if (!rel.type || !VALID_REL_TYPES.includes(rel.type)) {
          errors.push(
            `Relacionamento ${i}: tipo inválido "${rel.type || 'ausente'}". Válidos: ${VALID_REL_TYPES.join(', ')}`,
          )
        }
        if (!rel.sourceSlug || !slugSet.has(rel.sourceSlug)) {
          errors.push(
            `Relacionamento ${i}: sourceSlug "${rel.sourceSlug || 'ausente'}" não encontrado nas entidades.`,
          )
        }
        if (!rel.targetSlug || !slugSet.has(rel.targetSlug)) {
          errors.push(
            `Relacionamento ${i}: targetSlug "${rel.targetSlug || 'ausente'}" não encontrado nas entidades.`,
          )
        }
      })
    }
    return { valid: errors.length === 0, errors, data: parsed }
  }

  const handleSubmit = async () => {
    const { valid, errors, data } = validateJson(jsonInput)
    if (!valid) {
      setValidationErrors(errors)
      return
    }
    setValidationErrors([])
    setSubmitting(true)
    setMode('scanning')
    scanningRef.current = true
    try {
      await submitManualScan(projectId, data)
    } catch (err: any) {
      scanningRef.current = false
      const errMsg = err?.response?.data?.error || err?.message || 'Erro ao processar dados'
      const errDetails = err?.response?.data?.details
      if (Array.isArray(errDetails) && errDetails.length > 0) {
        setValidationErrors(errDetails)
      } else {
        toast({ title: errMsg, variant: 'destructive' })
      }
      setMode('input')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setMode('input')
    setJsonInput('')
    setValidationErrors([])
    setScanData(null)
    scanningRef.current = false
  }

  if (mode === 'scanning' || (mode === 'complete' && scanData) || (mode === 'error' && scanData)) {
    return (
      <div className="space-y-4">
        <ScanProgress scan={scanData} />
        {(mode === 'complete' || mode === 'error') && (
          <div className="flex gap-3">
            {mode === 'complete' && (
              <Button onClick={handleReset} className="gap-2 rounded-xl">
                <ClipboardPaste size={16} /> Nova Importação
              </Button>
            )}
            {mode === 'error' && (
              <Button onClick={handleReset} variant="secondary" className="gap-2 rounded-xl">
                <ClipboardPaste size={16} /> Tentar Novamente
              </Button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-[2rem] p-8 border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              1
            </div>
            <h3 className="text-xl font-bold">Copie o Prompt de Extração</h3>
          </div>
          <Button
            variant="secondary"
            onClick={handleCopyPrompt}
            className="gap-2 bg-white/10 hover:bg-white/20 rounded-xl"
          >
            {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
            {copied ? 'Copiado!' : 'Copiar Prompt'}
          </Button>
        </div>
        <p className="text-muted-foreground text-sm mb-4">
          Cole este prompt no seu LLM preferido (ChatGPT, Claude, etc.) junto com o código-fonte da
          sua aplicação. O LLM irá analisar e gerar o mapa semântico em formato JSON.
        </p>
        <ScrollArea className="h-64 rounded-xl bg-black/30 border border-white/5">
          <pre className="p-4 text-xs text-muted-foreground font-mono whitespace-pre-wrap">
            {EXTRACTION_PROMPT}
          </pre>
        </ScrollArea>
      </div>

      <div className="glass-panel rounded-[2rem] p-8 border-white/5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
            2
          </div>
          <h3 className="text-xl font-bold">Cole o Resultado da Análise (JSON)</h3>
        </div>
        <p className="text-muted-foreground text-sm mb-4">
          Cole aqui o JSON gerado pelo LLM. O sistema irá validar e importar as entidades e
          relacionamentos para o mapa semântico.
        </p>
        <Textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder='{"entities": [...], "relationships": [...]}'
          className="bg-black/30 border-white/10 min-h-[300px] rounded-xl font-mono text-sm"
        />
        {validationErrors.length > 0 && (
          <div className="mt-4 space-y-2">
            {validationErrors.map((err, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{err}</span>
              </div>
            ))}
          </div>
        )}
        <Button
          onClick={handleSubmit}
          disabled={submitting || !jsonInput.trim()}
          className="w-full mt-4 h-12 text-lg rounded-xl font-bold gap-2"
        >
          {submitting ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Processando...
            </>
          ) : (
            <>
              <FileJson size={18} /> Importar Mapa Semântico
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
