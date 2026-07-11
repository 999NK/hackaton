import { Link, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, BookOpen, Key, Settings, Bell, Search, Menu } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { AssistiveWidget } from '@/components/Widget'

export default function Layout() {
  const { user, signOut } = useAuth()
  const location = useLocation()

  const isPublic = ['/', '/login', '/register'].includes(location.pathname)

  if (isPublic) {
    return (
      <main className="flex flex-col min-h-screen bg-background text-foreground overflow-x-hidden">
        <header className="fixed top-0 w-full glass-panel z-40 px-6 py-4 flex items-center justify-between border-b border-white/5">
          <Link to="/" className="text-xl font-bold text-primary flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">
              AI
            </div>
            AccessLayer
          </Link>
          <nav className="hidden md:flex gap-6 font-medium text-sm text-white/80">
            <Link to="#features" className="hover:text-primary transition-colors">
              Recursos
            </Link>
            <Link to="#demo" className="hover:text-primary transition-colors">
              Demonstração
            </Link>
          </nav>
          <div className="flex gap-4 items-center">
            {user ? (
              <Link
                to="/dashboard"
                className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium hover:text-primary transition-all"
                >
                  Entrar
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                  Começar Grátis
                </Link>
              </>
            )}
          </div>
        </header>
        <div className="pt-20">
          <Outlet />
        </div>
      </main>
    )
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <aside className="w-64 glass-panel border-r border-white/5 hidden md:flex flex-col z-20">
        <div className="p-6">
          <Link to="/" className="text-xl font-bold text-primary flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">
              AI
            </div>
            AccessLayer
          </Link>
        </div>
        <nav className="flex-1 px-4 py-6 flex flex-col gap-2">
          <Link
            to="/dashboard"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium ${location.pathname === '/dashboard' ? 'bg-primary/20 text-primary' : 'hover:bg-white/5 text-muted-foreground'}`}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </Link>
          <a
            href="#"
            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-muted-foreground font-medium"
          >
            <BookOpen size={20} />
            Documentação
          </a>
          <a
            href="#"
            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-muted-foreground font-medium"
          >
            <Key size={20} />
            API Keys
          </a>
          <a
            href="#"
            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-muted-foreground font-medium"
          >
            <Settings size={20} />
            Configurações
          </a>
        </nav>
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-black/20">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary border border-primary/30">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <button
                onClick={signOut}
                className="text-xs text-muted-foreground hover:text-white transition-colors"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full relative overflow-hidden z-10">
        <header className="h-20 glass-panel border-b border-white/5 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <button className="md:hidden text-muted-foreground hover:text-white transition-colors">
              <Menu size={24} />
            </button>
            <div className="relative hidden md:block">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={16}
              />
              <input
                type="text"
                placeholder="Buscar projetos..."
                className="pl-12 pr-4 py-2.5 bg-black/20 border border-white/10 rounded-full text-sm focus:outline-none focus:border-primary/50 w-72 transition-all shadow-inner"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2.5 rounded-full bg-black/20 hover:bg-white/10 transition-colors border border-white/5">
              <Bell size={18} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full shadow-[0_0_8px_#5922f2]"></span>
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto overflow-x-hidden animate-fade-in-up">
          <Outlet />
        </div>
        <AssistiveWidget />
      </main>
    </div>
  )
}
