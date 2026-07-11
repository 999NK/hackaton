import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, FolderPlus, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Project } from '@/services/projects'
import { toast } from '@/hooks/use-toast'

interface Props { onCreate: (data: { name: string }) => Promise<Project> }

export function NewProjectDialog({ onCreate }: Props) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')

  useEffect(() => { if (open) window.setTimeout(() => inputRef.current?.focus(), 100) }, [open])
  const cleanName = name.trim()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (cleanName.length < 2) return
    setLoading(true)
    try {
      const project = await onCreate({ name: cleanName })
      setOpen(false); setName('')
      navigate(`/dashboard/${project.id}`)
    } catch { toast({ title: 'Não foi possível criar o projeto', variant: 'destructive' }) }
    finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!loading) { setOpen(next); if (!next) setName('') } }}>
      <DialogTrigger asChild><Button className="h-11 gap-2 rounded-xl bg-blue-600 px-5 font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700"><Plus size={17} /> Novo projeto</Button></DialogTrigger>
      <DialogContent className="overflow-hidden rounded-[26px] border-slate-200 bg-white p-0 text-slate-950 shadow-2xl sm:max-w-[500px]">
        <div className="border-b border-slate-100 bg-gradient-to-b from-blue-50/80 to-white px-7 pb-6 pt-8 sm:px-8">
          <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200"><FolderPlus size={23} /></div>
          <DialogHeader className="text-left"><DialogTitle className="text-2xl font-semibold tracking-tight text-slate-950">Criar novo projeto</DialogTitle><DialogDescription className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Crie o espaço onde você acompanhará o score WCAG, o mapa semântico e os scans.</DialogDescription></DialogHeader>
        </div>
        <form onSubmit={handleSubmit} className="px-7 pb-7 pt-6 sm:px-8 sm:pb-8">
          <div className="space-y-2"><Label htmlFor="project-name" className="text-sm font-semibold text-slate-700">Nome do projeto</Label><Input ref={inputRef} id="project-name" name="name" autoComplete="off" maxLength={80} required value={name} onChange={(event) => setName(event.target.value)} className="h-12 rounded-xl border-slate-200 bg-white px-4 text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:border-blue-400 focus-visible:ring-4 focus-visible:ring-blue-50" placeholder="Ex.: Portal do cliente" /><div className="flex items-center justify-between text-xs"><span className={name.length > 0 && cleanName.length < 2 ? 'text-red-500' : 'text-slate-400'}>{name.length > 0 && cleanName.length < 2 ? 'Digite pelo menos 2 caracteres' : 'Você poderá configurar a URL depois.'}</span><span className="text-slate-300">{name.length}/80</span></div></div>
          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" disabled={loading} onClick={() => setOpen(false)} className="h-11 rounded-xl px-5 text-slate-500 hover:bg-slate-100 hover:text-slate-900">Cancelar</Button><Button type="submit" disabled={loading || cleanName.length < 2} className="h-11 gap-2 rounded-xl bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400">{loading ? <><Loader2 size={17} className="animate-spin" /> Criando...</> : <>Criar projeto <ArrowRight size={17} /></>}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
