import { HistoryEntry } from '@/types'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export function ScoreHistoryChart({ history }: { history?: HistoryEntry[] }) {
  const safeHistory = Array.isArray(history) ? history : []
  const data = safeHistory.map((item) => ({
    ...item,
    date: new Date(item.scannedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
  }))

  return (
    <section className="surface-card p-6 sm:p-8">
      <div className="mb-5">
        <p className="eyebrow">Evolução</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">Histórico do score</h2>
      </div>
      {data.length ? (
        /* min-w-0 is critical — without it, ResponsiveContainer may measure -1 in flex containers */
        <div className="h-[220px] w-full min-w-0" role="img" aria-label="Gráfico da evolução do score de acessibilidade">
          <ResponsiveContainer width="100%" height="100%" debounce={200}>
            <LineChart data={data} margin={{ top: 8, right: 12, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl">
                      <p className="font-semibold text-slate-800">{label}</p>
                      <p className="mt-1 text-emerald-600">Score: {payload[0].payload.score}</p>
                      <p className="text-slate-500">Violações: {payload[0].payload.violations}</p>
                    </div>
                  ) : null
                }
              />
              <Line type="monotone" dataKey="score" stroke="#16a34a" strokeWidth={3} dot={{ r: 4, fill: '#16a34a', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="grid h-[220px] place-items-center rounded-2xl bg-slate-50 text-center">
          <p className="max-w-sm text-sm text-slate-500">Rode o scanner novamente para acompanhar a evolução.</p>
        </div>
      )}
    </section>
  )
}

