import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/use-auth'
import { toast } from '@/hooks/use-toast'

export default function Login() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [loading, setLoading] = useState(false)
  const { signIn } = useAuth(); const navigate = useNavigate()
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setLoading(true); const { error } = await signIn(email, password); setLoading(false); if (error) toast({ title: 'Erro ao fazer login', variant: 'destructive' }); else navigate('/dashboard') }
  return <AuthLayout title="Bem-vindo de volta" text="Acesse seus projetos, acompanhe scores e continue evoluindo a acessibilidade."><form onSubmit={submit} className="space-y-5"><Field label="E-mail corporativo"><Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="auth-input" placeholder="voce@empresa.com" /></Field><Field label="Senha"><Input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required className="auth-input" placeholder="Sua senha" /></Field><Button type="submit" disabled={loading} className="h-12 w-full gap-2 rounded-full bg-violet-600 font-bold text-white shadow-lg shadow-violet-200 hover:bg-violet-700">{loading ? 'Entrando…' : <>Entrar no Skip <ArrowRight size={16} /></>}</Button></form><p className="mt-7 text-center text-sm text-slate-500">Ainda não tem conta? <Link to="/register" className="font-bold text-violet-600 hover:underline">Comece gratuitamente</Link></p></AuthLayout>
}

function Field({ label, children }: any) { return <div className="space-y-2"><Label className="text-sm font-semibold text-slate-700">{label}</Label>{children}</div> }
export function AuthLayout({ title, text, children }: any) { return <div className="relative grid min-h-[calc(100vh-72px)] overflow-hidden bg-[#f4f1ff] lg:grid-cols-2"><div className="marketing-grid absolute inset-0 opacity-30" /><div className="relative hidden items-center justify-center p-12 lg:flex"><div className="max-w-lg"><span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/70 px-4 py-2 text-xs font-bold text-violet-700"><ShieldCheck size={14} /> Skip AI Accessibility Layer</span><h2 className="mt-7 text-5xl font-semibold leading-[1.05] tracking-[-.05em] text-[#171521]">Acessibilidade clara, contínua e conectada ao seu código.</h2><div className="mt-9 space-y-4">{['Auditoria WCAG estruturada', 'Mapa semântico para voz e navegação', 'Código-fonte processado localmente'].map((item) => <p key={item} className="flex items-center gap-3 text-sm font-medium text-slate-600"><CheckCircle2 size={18} className="text-violet-600" />{item}</p>)}</div></div></div><div className="relative flex items-center justify-center p-5 sm:p-10"><div className="w-full max-w-md rounded-[32px] border border-white bg-white/90 p-7 shadow-[0_35px_90px_rgba(72,50,140,.16)] backdrop-blur-2xl sm:p-10"><h1 className="text-3xl font-semibold tracking-[-.035em] text-slate-950">{title}</h1><p className="mt-3 text-sm leading-6 text-slate-500">{text}</p><div className="mt-8">{children}</div></div></div></div> }
