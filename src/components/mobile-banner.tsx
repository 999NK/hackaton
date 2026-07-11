import { useIsMobile } from '@/hooks/use-mobile'

export function MobileBanner() {
  const isMobile = useIsMobile()
  if (!isMobile) return null
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-[9998] bg-primary text-white text-center py-3 px-4 text-sm font-medium shadow-2xl">
      Acesse pelo desktop para a melhor experiência
    </div>
  )
}
