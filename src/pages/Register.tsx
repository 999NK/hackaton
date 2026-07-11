import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/use-auth'
import { toast } from '@/hooks/use-toast'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await signUp(email, password)
    if (error) {
      toast({ title: 'Erro ao criar conta', variant: 'destructive' })
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative pb-20">
      <div className="absolute inset-0 bg-primary/10 blur-[100px] -z-10 rounded-full w-[400px] h-[400px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      <div className="glass-panel p-10 rounded-[2rem] w-full max-w-md border-white/10 shadow-2xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold mb-3 tracking-tight">Crie sua conta</h1>
          <p className="text-muted-foreground">Comece a mapear suas aplicações hoje</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-white/80 ml-1">E-mail corporativo</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-black/30 border-white/10 h-12 rounded-xl focus:border-primary/50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/80 ml-1">Crie uma senha</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-black/30 border-white/10 h-12 rounded-xl focus:border-primary/50"
            />
          </div>
          <Button
            type="submit"
            className="w-full h-12 text-lg rounded-xl font-bold shadow-[0_0_20px_rgba(89,34,242,0.3)] hover:shadow-[0_0_30px_rgba(89,34,242,0.5)] transition-all"
          >
            Começar Grátis
          </Button>
        </form>
        <p className="text-center mt-8 text-sm text-muted-foreground font-medium">
          Já tem uma conta?{' '}
          <Link to="/login" className="text-primary hover:text-primary/80 transition-colors ml-1">
            Faça login
          </Link>
        </p>
      </div>
    </div>
  )
}
