import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Project } from '@/services/projects'
import { toast } from '@/hooks/use-toast'

interface Props {
  onCreate: (data: { name: string }) => Promise<Project>
}

export function NewProjectDialog({ onCreate }: Props) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const project = await onCreate({ name })
      setOpen(false)
      setName('')
      navigate(`/dashboard/${project.id}`)
    } catch {
      toast({ title: 'Erro ao criar projeto', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setOpen(false)
    setTimeout(() => setName(''), 200)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose()
        else setOpen(v)
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2 h-12 px-6 rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all">
          <Plus size={18} /> Criar novo projeto
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-panel border-white/10 text-white rounded-3xl p-8 max-w-lg">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-2xl font-bold">Criar Novo Projeto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label className="ml-1 text-white/80">Nome do projeto *</Label>
            <Input
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-black/30 border-white/10 h-12 rounded-xl focus:border-primary/50"
              placeholder="Ex: Meu ERP Corporativo"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 text-lg rounded-xl font-bold"
          >
            {loading ? 'Criando...' : 'Criar Projeto'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
