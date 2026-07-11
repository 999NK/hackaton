import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { ScanStatusBadge } from '@/components/scan-status-badge'
import { Scan } from '@/services/scans'

interface Props {
  scan: Scan | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ScanDetailSheet({ scan, open, onOpenChange }: Props) {
  if (!scan) return null

  const report = scan.report || {}
  const briefing = report.briefing || 'Nenhum briefing disponível.'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-violet-100 bg-white text-slate-950 sm:max-w-2xl">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-2xl font-bold flex items-center gap-3">
            Detalhes do Scan <ScanStatusBadge status={scan.status} />
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              Data/Hora
            </h4>
            <p className="text-slate-800">{new Date(scan.created).toLocaleString('pt-BR')}</p>
          </div>

          {scan.errorMessage && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <h4 className="text-sm font-bold text-red-400 mb-1">Erro</h4>
              <p className="text-red-300 text-sm">{scan.errorMessage}</p>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              Briefing
            </h4>
            <pre className="whitespace-pre-wrap break-words rounded-2xl border border-slate-800 bg-[#171521] p-4 font-mono text-sm text-violet-200">
              {briefing}
            </pre>
          </div>

          <Accordion type="single" collapsible>
            <AccordionItem value="json" className="border-violet-100">
              <AccordionTrigger className="text-sm font-semibold text-muted-foreground uppercase tracking-wider hover:no-underline">
                Raw JSON Report
              </AccordionTrigger>
              <AccordionContent>
                <ScrollArea className="h-[400px] w-full rounded-2xl border border-slate-800 bg-[#171521]">
                  <pre className="whitespace-pre-wrap break-words p-4 font-mono text-xs text-slate-300">
                    {JSON.stringify(report, null, 2)}
                  </pre>
                </ScrollArea>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </SheetContent>
    </Sheet>
  )
}
