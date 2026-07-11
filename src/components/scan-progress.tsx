import {
  Compass,
  Search,
  Lightbulb,
  Share2,
  FileCheck,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Scan } from '@/services/scans'
import { cn } from '@/lib/utils'

const PHASES = [
  {
    key: 'Discovery',
    label: 'Discovery',
    desc: 'Identificando arquitetura e frameworks',
    icon: Compass,
  },
  {
    key: 'Exploration',
    label: 'Exploration & Understanding',
    desc: 'Extraindo entidades semânticas com evidências',
    icon: Search,
  },
  {
    key: 'Generation',
    label: 'Correlation & Generation',
    desc: 'Cruzando evidências e gerando SAM',
    icon: Share2,
  },
  {
    key: 'Complete',
    label: 'Complete',
    desc: 'Mapa semântico gerado com sucesso',
    icon: CheckCircle,
  },
  { key: 'Failed', label: 'Failed', desc: 'Falha no processamento', icon: AlertCircle },
]

function getPhaseIndex(phase: string | undefined): number {
  if (!phase) return 0
  const idx = PHASES.findIndex((p) => p.key === phase)
  return idx >= 0 ? idx : 0
}

export function ScanProgress({ scan }: { scan: Scan | null }) {
  if (!scan) return null

  const currentIdx = getPhaseIndex(scan.phase)
  const isComplete = scan.status === 'COMPLETED'
  const isFailed = scan.status === 'FAILED'
  const tokenPercent = scan.tokenBudget
    ? Math.min((scan.tokenUsed / scan.tokenBudget) * 100, 100)
    : 0
  const tokenWarning = tokenPercent > 80

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-[2rem] p-8 border-white/5">
        <div className="flex items-center gap-3 mb-6">
          {isFailed ? (
            <AlertCircle size={28} className="text-red-400" />
          ) : isComplete ? (
            <CheckCircle size={28} className="text-emerald-400" />
          ) : (
            <Loader2 size={28} className="text-primary animate-spin" />
          )}
          <div>
            <h3 className="text-xl font-bold">
              {isFailed ? 'Scan Falhou' : isComplete ? 'Scan Concluído' : 'Processando Scan...'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {scan.phaseDetail || scan.phase || 'Iniciando...'}
            </p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {PHASES.map((phase, idx) => {
            const isCurrent = idx === currentIdx && !isComplete && !isFailed
            const isPassed = idx < currentIdx || isComplete
            const isFailedPhase = isFailed && idx === currentIdx
            const Icon = phase.icon

            return (
              <div
                key={phase.key}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl transition-all',
                  isCurrent && 'bg-primary/10 border border-primary/30',
                  isPassed && 'opacity-60',
                  isFailedPhase && 'bg-red-500/10 border border-red-500/30',
                  !isCurrent && !isPassed && !isFailedPhase && 'opacity-40',
                )}
              >
                <div
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                    isCurrent && 'bg-primary/20 text-primary',
                    isPassed && 'bg-emerald-500/20 text-emerald-400',
                    isFailedPhase && 'bg-red-500/20 text-red-400',
                    !isCurrent && !isPassed && !isFailedPhase && 'bg-white/5 text-muted-foreground',
                  )}
                >
                  {isPassed ? (
                    <CheckCircle size={18} />
                  ) : isFailedPhase ? (
                    <AlertCircle size={18} />
                  ) : isCurrent ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Icon size={18} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className={cn('text-sm font-semibold', isCurrent && 'text-primary')}>
                    {phase.label}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{phase.desc}</p>
                </div>
              </div>
            )
          })}
        </div>

        {scan.tokenBudget && scan.tokenBudget > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Context Budget</span>
              <span
                className={cn(
                  'font-bold',
                  tokenWarning ? 'text-amber-400' : 'text-muted-foreground',
                )}
              >
                {(scan.tokenUsed || 0).toLocaleString()} / {scan.tokenBudget.toLocaleString()}{' '}
                tokens
              </span>
            </div>
            <Progress
              value={tokenPercent}
              className={cn('h-2', tokenWarning && '[&>div]:bg-amber-500')}
            />
            {tokenWarning && (
              <p className="text-xs text-amber-400 font-medium">
                ⚠ Aproximando do limite de contexto — priorizando entidades de alta confiança
              </p>
            )}
          </div>
        )}
      </div>

      {isFailed && scan.errorMessage && (
        <div className="glass-panel rounded-2xl p-6 border-red-500/20 bg-red-500/5">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-400 mb-1">Erro detalhado</p>
              <p className="text-sm text-muted-foreground">{scan.errorMessage}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
