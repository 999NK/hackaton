import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/use-auth'
import { toast } from '@/hooks/use-toast'
import { AuthLayout } from './Login'

export default function Register() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [loading, setLoading] = useState(false)
  const { signUp } = useAuth(); const navigate = useNavigate()
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setLoading(true); const { error } = await signUp(email, password); setLoading(false); if (error) toast({ title: 'Erro ao criar conta', variant: 'destructive' }); else navigate('/dashboard') }
  return <AuthLayout title="Crie seu workspace" text="Comece com um projeto e receba seu primeiro diagnóstico de acessibilidade."><form onSubmit={submit} className="space-y-5"><div className="space-y-2"><Label className="text-sm font-semibold text-slate-700">E-mail corporativo</Label><Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="auth-input" placeholder="voce@empresa.com" /></div><div className="space-y-2"><Label className="text-sm font-semibold text-slate-700">Crie uma senha</Label><Input type="password" autoComplete="new-password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required className="auth-input" placeholder="Mínimo de 6 caracteres" /></div><Button type="submit" disabled={loading} className="h-12 w-full gap-2 rounded-full bg-violet-600 font-bold text-white shadow-lg shadow-violet-200 hover:bg-violet-700">{loading ? 'Criando conta…' : <>Criar conta grátis <ArrowRight size={16} /></>}</Button></form><p className="mt-7 text-center text-sm text-slate-500">Já possui uma conta? <Link to="/login" className="font-bold text-violet-600 hover:underline">Entrar</Link></p></AuthLayout>
}
