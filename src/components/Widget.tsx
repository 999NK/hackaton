import { useState, useRef, useEffect } from 'react'
import { Mic, MousePointerClick, Command, Highlighter, Volume2, Navigation, X } from 'lucide-react'

export function AssistiveWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({
    x: window.innerWidth - 80,
    y: window.innerHeight - 80,
  })
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => ({
        x: Math.min(prev.x, window.innerWidth - 60),
        y: Math.min(prev.y, window.innerHeight - 60),
      }))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = false
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.buttons !== 1) return
    isDragging.current = true
    const newX = Math.max(0, Math.min(e.clientX - dragStart.current.x, window.innerWidth - 56))
    const newY = Math.max(0, Math.min(e.clientY - dragStart.current.y, window.innerHeight - 56))
    setPosition({ x: newX, y: newY })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    if (!isDragging.current) {
      setIsOpen(!isOpen)
    }
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      {isOpen && (
        <div
          className="absolute glass-panel rounded-3xl w-[280px] h-[280px] pointer-events-auto p-4 flex flex-col gap-2 animate-spotlight shadow-2xl"
          style={{
            left: Math.min(position.x, window.innerWidth - 290),
            top: Math.min(position.y, window.innerHeight - 290),
          }}
        >
          <div className="flex justify-between items-center px-2 mb-2">
            <span className="text-sm font-semibold text-white/80">AccessLayer</span>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 flex-1">
            <WidgetButton icon={<Mic />} label="Voz" onClick={() => alert('Voz ativada')} />
            <WidgetButton
              icon={<MousePointerClick />}
              label="Ações"
              onClick={() => alert('Menu de ações')}
            />
            <WidgetButton icon={<Command />} label="Atalhos" onClick={() => alert('Atalhos')} />
            <WidgetButton
              icon={<Highlighter />}
              label="Destaque"
              onClick={() => alert('Destaque ativo')}
            />
            <WidgetButton
              icon={<Volume2 />}
              label="Leitura"
              onClick={() => alert('Lendo página...')}
            />
            <WidgetButton
              icon={<Navigation />}
              label="Navegar"
              onClick={() => alert('Navegar ativado')}
            />
          </div>
        </div>
      )}

      {!isOpen && (
        <div
          className="absolute w-14 h-14 rounded-full glass-panel pointer-events-auto flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-105 transition-transform shadow-2xl"
          style={{ left: position.x, top: position.y }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/50 text-primary">
            <Mic size={20} />
          </div>
        </div>
      )}
    </div>
  )
}

function WidgetButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 p-2 rounded-2xl hover:bg-white/10 transition-colors active:scale-95 bg-black/20"
    >
      <div className="text-primary">{icon}</div>
      <span className="text-xs font-medium text-white/80">{label}</span>
    </button>
  )
}
