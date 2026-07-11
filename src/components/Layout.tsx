import { Link, Outlet, useLocation } from 'react-router-dom'
import { Bell, ChevronDown, LayoutGrid, LogOut, Menu, Search, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { AssistiveWidget } from '@/components/Widget'

export default function Layout() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const isPublic = ['/', '/login', '/register'].includes(location.pathname)

  if (isPublic) {
    return (
      <main className="min-h-screen bg-white text-slate-950">
        <header className="fixed inset-x-0 top-0 z-40 border-b border-violet-200/50 bg-[#f7f5ff]/80 backdrop-blur-2xl">
          <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
            <Brand />
            <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex">
              <a href="/#features" className="transition hover:text-slate-950">Recursos</a>
              <a href="/#demo" className="transition hover:text-slate-950">Como funciona</a>
            </nav>
            <div className="flex items-center gap-2">
              {user ? <Link to="/dashboard" className="app-button-primary">Abrir dashboard</Link> : <><Link to="/login" className="hidden px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-950 sm:block">Entrar</Link><Link to="/register" className="app-button-primary">Começar grátis</Link></>}
            </div>
          </div>
        </header>
        <div className="pt-[72px]"><Outlet /></div>
      </main>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#f7f6fb] text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-white/5 bg-[#171521] text-white lg:flex">
        <div className="flex h-20 items-center px-7"><Brand /></div>
        <nav className="flex-1 px-4 py-4">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">Workspace</p>
          <Link to="/dashboard" className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${location.pathname.startsWith('/dashboard') ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><LayoutGrid size={18} /> Projetos</Link>
        </nav>
        <div className="border-t border-white/5 p-4">
          <div className="flex items-center gap-3 rounded-2xl p-2.5 hover:bg-white/5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-600 text-sm font-semibold text-white">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{user?.name || 'Usuário'}</p><p className="truncate text-xs text-slate-500">Administrador</p></div>
            <button onClick={signOut} aria-label="Sair" className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-violet-100 bg-white/85 px-5 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3">
            <button aria-label="Abrir menu" className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 lg:hidden"><Menu size={20} /></button>
            <div className="relative hidden sm:block"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input type="search" placeholder="Buscar projetos e scans" className="h-10 w-72 rounded-full border border-violet-100 bg-[#f7f6fb] pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-50" /></div>
          </div>
          <div className="flex items-center gap-2">
            <button aria-label="Notificações" className="relative rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100"><Bell size={19} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-blue-600 ring-2 ring-white" /></button>
            <button className="flex items-center gap-2 rounded-xl p-1.5 pl-2 transition hover:bg-violet-50"><div className="grid h-8 w-8 place-items-center rounded-lg bg-violet-600 text-xs font-semibold text-white">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</div><ChevronDown size={14} className="text-slate-400" /></button>
          </div>
        </header>
        <div><Outlet /></div>
        <AssistiveWidget />
      </main>
    </div>
  )
}

function Brand() {
  return <Link to="/" className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-300/30"><ShieldCheck size={19} strokeWidth={2.4} /></span><span className="text-[17px] font-semibold tracking-[-0.02em] text-current">Skip<span className="text-violet-500">.</span></span></Link>
}
