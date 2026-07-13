import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, BookOpen, CheckCircle2, ChevronRight, CircleHelp, Command, Compass,
  Eye, Focus, Settings, Highlighter, History, Mic, MicOff, MousePointerClick,
  Navigation, Pause, RotateCcw, Settings2, Sparkles, Volume2, X,
} from 'lucide-react'

type View = 'home' | 'voice' | 'actions' | 'shortcuts' | 'highlight' | 'guided' | 'reading' | 'navigate' | 'display' | 'settings' | 'history' | 'help'
type Item = { label: string; element: HTMLElement }

const menus: Array<{ id: View; label: string; icon: React.ReactNode }> = [
  { id: 'voice', label: 'Voz', icon: <Mic /> }, { id: 'actions', label: 'Ações', icon: <MousePointerClick /> },
  { id: 'shortcuts', label: 'Atalhos', icon: <Command /> }, { id: 'guided', label: 'Guiado', icon: <Sparkles /> },
  { id: 'highlight', label: 'Destaque', icon: <Highlighter /> },
  { id: 'reading', label: 'Leitura', icon: <Volume2 /> }, { id: 'navigate', label: 'Navegar', icon: <Navigation /> },
  { id: 'display', label: 'Tela', icon: <Eye /> }, { id: 'settings', label: 'Config', icon: <Settings /> },
  { id: 'history', label: 'Histórico', icon: <History /> }, { id: 'help', label: 'Ajuda', icon: <CircleHelp /> },
]

export function AssistiveWidget() {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('home')
  const [fontScale, setFontScale] = useState(100)
  const [contrast, setContrast] = useState(false)
  const [highlight, setHighlight] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [reading, setReading] = useState(false)
  const [listening, setListening] = useState(false)
  const [message, setMessage] = useState('')
  const [historyItems, setHistoryItems] = useState<string[]>([])
  const [position, setPosition] = useState({ x: Math.max(12, window.innerWidth - 76), y: Math.max(12, window.innerHeight - 76) })
  const drag = useRef<{ dx: number; dy: number; moved: boolean } | null>(null)
  const recognition = useRef<any>(null)

  const interactive = open ? collectInteractive() : []
  const links = interactive.filter((item) => item.element.matches('a[href]'))

  const record = (text: string) => { setHistoryItems((items) => [text, ...items].slice(0, 12)); setMessage(text) }

  useEffect(() => {
    const style = document.createElement('style')
    style.dataset.skipInternal = 'true'
    style.textContent = `.skip-internal-highlight a[href],.skip-internal-highlight button:not([disabled]),.skip-internal-highlight input:not([type=hidden]),.skip-internal-highlight textarea,.skip-internal-highlight select,.skip-internal-highlight [role=button],.skip-internal-highlight [role=link],.skip-internal-highlight [role=combobox],.skip-internal-highlight [contenteditable=true],.skip-internal-highlight summary,.skip-internal-highlight [tabindex]:not([tabindex="-1"]){outline:3px solid #2563eb!important;outline-offset:3px!important}.skip-reduced-motion *{animation-duration:.01ms!important;transition-duration:.01ms!important;scroll-behavior:auto!important}`
    document.head.appendChild(style)
    return () => { style.remove(); window.speechSynthesis?.cancel(); recognition.current?.stop?.() }
  }, [])

  useEffect(() => { document.documentElement.style.fontSize = `${fontScale}%` }, [fontScale])
  useEffect(() => { document.documentElement.classList.toggle('skip-internal-highlight', highlight) }, [highlight])
  useEffect(() => { document.documentElement.classList.toggle('skip-reduced-motion', reducedMotion) }, [reducedMotion])
  useEffect(() => { document.documentElement.style.filter = contrast ? 'contrast(1.25) saturate(1.08)' : '' }, [contrast])
  useEffect(() => {
    const clamp = () => setPosition((p) => ({ x: Math.max(8, Math.min(p.x, window.innerWidth - 64)), y: Math.max(8, Math.min(p.y, window.innerHeight - 64)) }))
    window.addEventListener('resize', clamp); return () => window.removeEventListener('resize', clamp)
  }, [])

  const speak = (text?: string) => {
    if (!('speechSynthesis' in window)) return record('Leitura não disponível neste navegador')
    if (reading) { window.speechSynthesis.cancel(); setReading(false); return record('Leitura pausada') }
    const content = text || document.querySelector('main')?.textContent || document.body.innerText
    const utterance = new SpeechSynthesisUtterance(content.replace(/\s+/g, ' ').slice(0, 8000))
    utterance.lang = 'pt-BR'; utterance.rate = 0.95
    // Seleciona voz pt-BR explicitamente para evitar fallback p/ ingles.
    try {
      const voices = window.speechSynthesis.getVoices() || []
      const match = voices.find((v) => String(v.lang || '').toLowerCase().startsWith('pt'))
      if (match) utterance.voice = match
    } catch { /* noop */ }
    utterance.onend = () => setReading(false)
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance); setReading(true); record('Leitura da página iniciada')
  }

  const runVoice = () => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Recognition) return record('Reconhecimento de voz não disponível')
    if (listening) { recognition.current?.stop(); setListening(false); return }
    const instance = new Recognition(); recognition.current = instance; instance.lang = 'pt-BR'; instance.interimResults = false
    instance.onstart = () => { setListening(true); setMessage('Ouvindo… diga o nome de um botão ou página') }
    instance.onend = () => setListening(false)
    instance.onerror = () => record('Não consegui ouvir. Tente novamente.')
    instance.onresult = (event: any) => executeVoice(String(event.results[0][0].transcript || ''))
    instance.start()
  }

  const executeVoice = async (command: string) => {
    const normalized = command.toLowerCase().trim(); record(`Voz: “${command}”`)
    // Comandos simples locais (resposta imediata).
    if (normalized.includes('aumentar fonte')) return setFontScale((v) => Math.min(140, v + 10))
    if (normalized.includes('diminuir fonte')) return setFontScale((v) => Math.max(80, v - 10))
    if (normalized.includes('ler página') || normalized.includes('leia a página')) return speak()
    if (normalized.includes('contraste')) return setContrast((v) => !v)
    // Demais comandos: usa o motor NLU do servidor (fonte de verdade).
    try {
      const res = await fetch('/backend/v1/widget/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: command, path: window.location.pathname, url: window.location.href }),
      })
      const data = await res.json()
      if (data.action === 'READ') { speak(); return }
      if (data.action === 'SETTINGS' && /contraste/.test(normalized)) { setContrast((v) => !v); return }
      const best = (data.matches || []).sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0))[0]
      if (best) {
        const el = findElementForMatch(best)
        if (el) { activateElement(el); record(`Aberto: ${best.name}`) ; return }
      }
      // Fallback local no DOM atual.
      const target = collectInteractive().find((item) => normalized.includes(item.label.toLowerCase()) || item.label.toLowerCase().includes(normalized))
      if (target) { target.element.click(); target.element.focus(); record(`Aberto: ${target.label}`) }
      else if ((data.suggestions || []).length) setMessage(`Não encontrei. Você quis dizer: ${(data.suggestions || []).map((s: any) => s.name).join(', ')}?`)
      else setMessage(`Não encontrei “${command}” nesta tela`)
    } catch {
      // Servidor indisponível: mantém o comportamento local.
      const target = collectInteractive().find((item) => normalized.includes(item.label.toLowerCase()) || item.label.toLowerCase().includes(normalized))
      if (target) { target.element.click(); target.element.focus(); record(`Aberto: ${target.label}`) }
      else setMessage(`Não encontrei “${command}” nesta tela`)
    }
  }

  const activate = (item: Item) => { item.element.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' }); item.element.focus(); window.setTimeout(() => activateElement(item.element), 180); record(`Ação executada: ${item.label}`) }
  const reset = () => { setFontScale(100); setContrast(false); setHighlight(false); setReducedMotion(false); window.speechSynthesis.cancel(); setReading(false); record('Preferências restauradas') }

  const onPointerDown = (event: React.PointerEvent) => { drag.current = { dx: event.clientX - position.x, dy: event.clientY - position.y, moved: false }; event.currentTarget.setPointerCapture(event.pointerId) }
  const onPointerMove = (event: React.PointerEvent) => { if (!drag.current || event.buttons !== 1) return; drag.current.moved = true; setPosition({ x: Math.max(8, Math.min(event.clientX - drag.current.dx, window.innerWidth - 64)), y: Math.max(8, Math.min(event.clientY - drag.current.dy, window.innerHeight - 64)) }) }
  const onPointerUp = (event: React.PointerEvent) => { event.currentTarget.releasePointerCapture(event.pointerId); if (!drag.current?.moved) setOpen(true); drag.current = null }

  const panelLeft = position.x > window.innerWidth / 2 ? undefined : Math.max(12, position.x)
  const panelRight = position.x > window.innerWidth / 2 ? Math.max(12, window.innerWidth - position.x - 56) : undefined

  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); setView('home') }
      if (!event.altKey) return
      if (event.key.toLowerCase() === 'a') { event.preventDefault(); setOpen((value) => !value) }
      if (event.key.toLowerCase() === 'v') { event.preventDefault(); setOpen(true); setView('voice'); runVoice() }
      if (event.key.toLowerCase() === 'l') { event.preventDefault(); setOpen(true); setView('reading'); speak() }
    }
    document.addEventListener('keydown', shortcuts)
    return () => document.removeEventListener('keydown', shortcuts)
  })

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      {open && <section role="dialog" aria-label="Menu de acessibilidade" className="pointer-events-auto absolute flex w-[min(342px,calc(100vw-24px))] flex-col overflow-hidden rounded-[26px] border border-slate-300/80 bg-white/95 shadow-[0_24px_70px_rgba(15,23,42,.22)] backdrop-blur-2xl" style={{ left: panelLeft, right: panelRight, top: 12, maxHeight: 'calc(100dvh - 24px)' }}>
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200/80 px-5 py-4"><div className="flex min-w-0 items-center gap-3">{view !== 'home' && <button aria-label="Voltar" onClick={() => { setView('home'); setMessage('') }} className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"><ArrowLeft size={16} /></button>}<div><p className="truncate text-sm font-semibold text-slate-900">{view === 'home' ? 'Acessibilidade' : menus.find((item) => item.id === view)?.label}</p><p className="text-[11px] text-slate-400">Skip Assistive</p></div></div><button aria-label="Fechar" onClick={() => { setOpen(false); setView('home') }} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"><X size={16} /></button></header>
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/80 p-3.5">
          {view === 'home' ? <div className="grid grid-cols-3 gap-2.5">{menus.map((item) => <button key={item.id} onClick={() => { setView(item.id); setMessage('') }} className="group flex min-h-[82px] flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md active:scale-[.98]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600 [&>svg]:h-[18px] [&>svg]:w-[18px]">{item.icon}</span><span className="text-[11px] font-semibold">{item.label}</span></button>)}</div> : <WidgetView view={view} interactive={interactive} links={links} message={message} listening={listening} reading={reading} fontScale={fontScale} contrast={contrast} highlight={highlight} reducedMotion={reducedMotion} historyItems={historyItems} onVoice={runVoice} onSpeak={speak} onActivate={activate} onFont={setFontScale} onContrast={setContrast} onHighlight={setHighlight} onMotion={setReducedMotion} onReset={reset} />}
        </div>
      </section>}
      {!open && <button aria-label="Abrir menu de acessibilidade" className="pointer-events-auto absolute grid h-14 w-14 cursor-grab place-items-center rounded-2xl border border-blue-300/70 bg-white/95 text-blue-600 shadow-[0_12px_30px_rgba(37,99,235,.25)] backdrop-blur-xl transition hover:scale-105 active:cursor-grabbing" style={{ left: position.x, top: position.y }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}><Compass size={23} /></button>}
    </div>
  )
}

function collectInteractive(): Item[] {
  return Array.from(document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="combobox"], summary')).filter((el) => !el.closest('[role="dialog"]') && el.offsetParent !== null).map((element, index) => ({ element, label: (element.getAttribute('aria-label') || element.textContent || element.getAttribute('placeholder') || element.getAttribute('name') || `Elemento ${index + 1}`).trim().replace(/\s+/g, ' ').slice(0, 70) }))
}

// Localiza um elemento do DOM a partir de uma entidade retornada pelo motor NLU
// (cssSelector, anchorId, inputName, targetRoute ou nome).
function findElementForMatch(match: any): HTMLElement | null {
  const meta = match?.metadata || {}
  const selectors: string[] = []
  if (meta.cssSelector) selectors.push(meta.cssSelector)
  if (meta.anchorId) selectors.push(`#${CSS.escape(meta.anchorId)}`, `[data-skip-anchor="${CSS.escape(meta.anchorId)}"]`)
  if (meta.inputName) selectors.push(`[name="${CSS.escape(meta.inputName)}"]`)
  if (meta.targetRoute) selectors.push(`a[href="${CSS.escape(meta.targetRoute)}"]`)
  for (const sel of selectors) {
    try {
      const found = document.querySelector<HTMLElement>(sel)
      if (found) return found
    } catch { /* invalid selector */ }
  }
  const label = String(meta.label || match?.name || '').toLowerCase().trim()
  if (!label) return null
  const candidates = document.querySelectorAll<HTMLElement>('button,a,[role="button"],input,textarea,select,[aria-label]')
  for (const el of Array.from(candidates)) {
    const text = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').toLowerCase()
    if (text === label || text.includes(label)) return el
  }
  return null
}

function activateElement(el: HTMLElement) {
  try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }) } catch { /* noop */ }
  el.focus({ preventScroll: true })
  ;['pointerdown', 'mousedown', 'pointerup', 'mouseup'].forEach((type) => {
    try { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window })) } catch { /* noop */ }
  })
  const anchor = el.closest('a[href]') as HTMLAnchorElement | null
  const before = window.location.href
  el.click()
  if (anchor?.href && anchor.target !== '_blank') {
    window.setTimeout(() => { if (window.location.href === before) window.location.assign(anchor.href) }, 250)
  }
}

function WidgetView(props: any) {
  const { view, interactive, links, message } = props
  if (view === 'voice') return <div className="space-y-3 text-center"><div className={`mx-auto grid h-20 w-20 place-items-center rounded-full ${props.listening ? 'animate-pulse bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{props.listening ? <MicOff size={30} /> : <Mic size={30} />}</div><p className="text-sm font-semibold text-slate-800">{props.listening ? 'Estou ouvindo…' : 'Navegação por voz'}</p><p className="text-xs leading-5 text-slate-500">Diga “Projetos”, “aumentar fonte”, “contraste” ou o nome de um botão.</p><ActionButton onClick={props.onVoice}>{props.listening ? 'Parar de ouvir' : 'Ativar microfone'}</ActionButton>{message && <Feedback>{message}</Feedback>}</div>
  if (view === 'actions' || view === 'navigate') { const items = view === 'navigate' ? links : interactive; return <List title={view === 'navigate' ? 'Links desta página' : 'Elementos disponíveis'} items={items} onActivate={props.onActivate} empty="Nenhum elemento interativo encontrado." /> }
  if (view === 'shortcuts') return <div className="space-y-2"><Shortcut keys="Alt + A" label="Abrir ou fechar widget" /><Shortcut keys="Alt + V" label="Ativar voz" /><Shortcut keys="Alt + L" label="Ler a página" /><Shortcut keys="Esc" label="Fechar painel" /><p className="pt-2 text-xs leading-5 text-slate-500">Os atalhos ficam disponíveis enquanto o widget está carregado.</p></div>
  if (view === 'guided') return <div className="space-y-3"><Info icon={<Focus />} title="Navegação guiada" text={`Encontramos ${interactive.length} elementos nesta tela. Escolha o primeiro passo e o Skip moverá o foco e executará a ação.`} /><List items={interactive.slice(0, 8)} onActivate={props.onActivate} empty="Não há passos disponíveis." /></div>
  if (view === 'highlight') return <div className="space-y-3"><Info icon={<Highlighter />} title="Destaque de controles" text="Cria contornos visíveis em links, botões e campos para facilitar a identificação dos elementos interativos." /><Toggle label="Destacar elementos" active={props.highlight} onClick={() => props.onHighlight(!props.highlight)} icon={<Highlighter />} /></div>
  if (view === 'reading') return <div className="space-y-3 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-violet-100 text-violet-600">{props.reading ? <Pause size={27} /> : <BookOpen size={27} />}</div><p className="text-sm leading-6 text-slate-600">Leia em voz alta o conteúdo principal da página.</p><ActionButton onClick={() => props.onSpeak()}>{props.reading ? 'Pausar leitura' : 'Ler esta página'}</ActionButton>{message && <Feedback>{message}</Feedback>}</div>
  if (view === 'display' || view === 'settings') return <div className="space-y-3"><Control label="Tamanho do texto" value={`${props.fontScale}%`}><button onClick={() => props.onFont(Math.max(80, props.fontScale - 10))}>−</button><button onClick={() => props.onFont(Math.min(140, props.fontScale + 10))}>+</button></Control><Toggle label="Alto contraste" active={props.contrast} onClick={() => props.onContrast(!props.contrast)} icon={<Eye />} /><Toggle label="Destacar elementos" active={props.highlight} onClick={() => props.onHighlight(!props.highlight)} icon={<Highlighter />} /><Toggle label="Reduzir movimento" active={props.reducedMotion} onClick={() => props.onMotion(!props.reducedMotion)} icon={<Pause />} /><button onClick={props.onReset} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"><RotateCcw size={14} /> Restaurar preferências</button></div>
  if (view === 'history') return <div className="space-y-2">{props.historyItems.length ? props.historyItems.map((item: string, index: number) => <div key={`${item}-${index}`} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-500" /><p className="text-xs leading-5 text-slate-600">{item}</p></div>) : <Info icon={<History />} title="Histórico vazio" text="As ações executadas pelo widget aparecerão aqui." />}</div>
  return <div className="space-y-3"><Info icon={<CircleHelp />} title="Como usar" text="Escolha uma função na tela inicial. Voz encontra botões pelo nome; Ações lista controles; Leitura narra a página; Tela ajusta a visualização." /><Info icon={<Settings2 />} title="Dica" text="Você pode arrastar o botão flutuante para qualquer canto da tela. O painel sempre abrirá totalmente visível." /></div>
}

function ActionButton({ onClick, children }: any) { return <button onClick={onClick} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">{children}</button> }
function Feedback({ children }: any) { return <p className="rounded-xl bg-white p-3 text-xs leading-5 text-slate-600 shadow-sm">{children}</p> }
function List({ title, items, onActivate, empty }: any) { return <div><div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold text-slate-700">{title}</p><span className="text-[10px] text-slate-400">{items.length} itens</span></div><div className="space-y-1.5">{items.length ? items.slice(0, 12).map((item: Item, index: number) => <button key={`${item.label}-${index}`} onClick={() => onActivate(item)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left text-xs font-medium text-slate-700 hover:border-blue-200 hover:bg-blue-50"><span className="truncate">{item.label}</span><ChevronRight size={14} className="shrink-0 text-slate-400" /></button>) : <p className="rounded-xl bg-white p-4 text-center text-xs text-slate-400">{empty}</p>}</div></div> }
function Shortcut({ keys, label }: any) { return <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3"><span className="text-xs text-slate-600">{label}</span><kbd className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{keys}</kbd></div> }
function Info({ icon, title, text }: any) { return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-blue-600">{icon}<p className="text-xs font-semibold text-slate-800">{title}</p></div><p className="mt-2 text-xs leading-5 text-slate-500">{text}</p></div> }
function Toggle({ label, active, onClick, icon }: any) { return <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left"><span className="text-blue-600">{icon}</span><span className="flex-1 text-xs font-semibold text-slate-700">{label}</span><span className={`h-5 w-9 rounded-full p-0.5 transition ${active ? 'bg-blue-600' : 'bg-slate-200'}`}><span className={`block h-4 w-4 rounded-full bg-white shadow transition ${active ? 'translate-x-4' : ''}`} /></span></button> }
function Control({ label, value, children }: any) { return <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="mb-3 flex justify-between text-xs"><span className="font-semibold text-slate-700">{label}</span><span className="text-slate-400">{value}</span></div><div className="grid grid-cols-2 gap-2 [&>button]:rounded-lg [&>button]:bg-slate-100 [&>button]:py-2 [&>button]:text-lg [&>button]:font-semibold [&>button]:text-slate-700 hover:[&>button]:bg-blue-50">{children}</div></div> }
