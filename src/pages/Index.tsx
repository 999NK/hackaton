import { Link } from 'react-router-dom'
import { Brain, Layers, Mic, LayoutTemplate } from 'lucide-react'

export default function Index() {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-primary/20 blur-[120px] -z-10 rounded-full w-[600px] h-[600px] top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-50" />

      <section className="container mx-auto px-4 pt-32 pb-20 text-center animate-fade-in-up">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 max-w-4xl mx-auto leading-tight">
          A Camada Semântica para{' '}
          <span className="text-primary drop-shadow-[0_0_20px_rgba(89,34,242,0.4)]">
            Acessibilidade Web
          </span>
        </h1>
        <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
          Transforme código estruturado em mapas semânticos compreensíveis por humanos e IA.
          Habilite navegação por voz e atalhos inteligentes em minutos.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link
            to="/register"
            className="px-8 py-4 bg-primary text-white rounded-full font-bold text-lg hover:bg-primary/90 hover:scale-105 transition-all shadow-[0_0_40px_rgba(89,34,242,0.4)]"
          >
            Começar Grátis
          </Link>
          <a
            href="#demo"
            className="px-8 py-4 glass-panel rounded-full font-bold text-lg hover:bg-white/10 transition-all border border-white/10"
          >
            Ver Demonstração
          </a>
        </div>
      </section>

      <section id="features" className="container mx-auto px-4 py-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard
            icon={<Layers />}
            title="Scanning Automático"
            desc="Mapeia rotas, APIs e componentes do seu código sem alterá-lo com MCP local."
          />
          <FeatureCard
            icon={<Brain />}
            title="Enriquecimento por IA"
            desc="Gera labels semânticos e dicas contextuais usando Skip AI Gateway avançado."
          />
          <FeatureCard
            icon={<Mic />}
            title="Navegação por Voz"
            desc="Permite que usuários controlem a aplicação falando comandos naturalmente."
          />
          <FeatureCard
            icon={<LayoutTemplate />}
            title="UI AssistiveTouch"
            desc="Widget injetável de altíssima acessibilidade, flutuante, intuitivo e responsivo."
          />
        </div>
      </section>

      <section id="demo" className="container mx-auto px-4 py-20 mb-20">
        <div className="glass-panel rounded-[2rem] p-2 md:p-6 max-w-6xl mx-auto border-white/5 overflow-hidden shadow-2xl relative">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none rounded-[2rem]" />
          <img
            src="https://img.usecurling.com/p/1200/700?q=developer%20dashboard%20dark&color=purple&dpr=2"
            alt="Mockup do Dashboard"
            className="rounded-2xl w-full object-cover opacity-70 mix-blend-screen"
          />
        </div>
      </section>
    </div>
  )
}

function FeatureCard({ icon, title, desc }: any) {
  return (
    <div className="glass-panel p-8 rounded-3xl hover:-translate-y-2 transition-all duration-300 group border-white/5 bg-gradient-to-br from-white/5 to-transparent">
      <div className="w-14 h-14 rounded-2xl bg-primary/20 text-primary flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all shadow-inner border border-primary/20">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-4">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  )
}
