import { useState, useMemo } from 'react'
import { Search, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

const TYPE_BADGES: Record<string, string> = {
  ROUTE: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  COMPONENT: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  API: 'bg-green-500/20 text-green-400 border-green-500/30',
  FLOW: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  BUSINESS_RULE: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
}

const TYPES = ['ROUTE', 'COMPONENT', 'API', 'FLOW', 'BUSINESS_RULE']

export function EntityExplorer({ entities }: { entities: any[] }) {
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    return entities.filter((e) => {
      if (typeFilter !== 'ALL' && e.type !== typeFilter) return false
      if (search && !e.name?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [entities, typeFilter, search])

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={16}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar entidades..."
            className="pl-10 bg-black/30 border-white/10 h-11 rounded-xl"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-48 bg-black/30 border-white/10 h-11 rounded-xl">
            <Filter size={14} className="mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os tipos</SelectItem>
            {TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden border-white/5 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="p-4">Tipo</TableHead>
              <TableHead className="p-4">Nome</TableHead>
              <TableHead className="p-4">Caminho</TableHead>
              <TableHead className="p-4 hidden md:table-cell">Descrição</TableHead>
              <TableHead className="p-4 hidden lg:table-cell">Acessibilidade</TableHead>
              <TableHead className="p-4 min-w-[120px]">Confiança</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((e) => (
              <TableRow key={e.id} className="border-white/5 hover:bg-white/[0.03]">
                <TableCell className="p-4">
                  <span
                    className={cn(
                      'px-2 py-1 rounded-md text-xs font-bold border',
                      TYPE_BADGES[e.type] || 'bg-gray-500/20 text-gray-400 border-gray-500/30',
                    )}
                  >
                    {e.type}
                  </span>
                </TableCell>
                <TableCell className="p-4 font-medium">{e.name}</TableCell>
                <TableCell className="p-4 text-sm text-muted-foreground font-mono">
                  {e.path || '—'}
                </TableCell>
                <TableCell className="p-4 text-sm text-muted-foreground hidden md:table-cell max-w-xs truncate">
                  {e.description || '—'}
                </TableCell>
                <TableCell className="p-4 text-sm text-muted-foreground hidden lg:table-cell max-w-xs truncate">
                  {e.accessibilityHint || '—'}
                </TableCell>
                <TableCell className="p-4">
                  <div className="flex items-center gap-2">
                    <Progress value={(e.confidence || 0) * 100} className="w-16 h-2" />
                    <span className="text-xs font-bold">
                      {((e.confidence || 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="p-8 text-center text-muted-foreground">
                  Nenhuma entidade encontrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
