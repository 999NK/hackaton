import { useEffect, useRef } from 'react'
import { getAllScans } from '@/services/scans'

export interface RealtimePayload<TRecord> {
  action: 'update'
  record: TRecord
}

export function useRealtime<TRecord extends { id: string } = any>(
  collectionName: string,
  callback: (data: RealtimePayload<TRecord>) => void,
  enabled: boolean = true,
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return
    if (collectionName !== 'scans') return

    let cancelled = false
    const tick = async () => {
      try {
        const scans = await getAllScans()
        if (cancelled) return
        scans.forEach((record) => callbackRef.current({ action: 'update', record: record as TRecord }))
      } catch {
        // Polling is best effort; callers still load data directly on mount/actions.
      }
    }
    const interval = window.setInterval(tick, 3000)
    tick()

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [collectionName, enabled])
}

export default useRealtime
