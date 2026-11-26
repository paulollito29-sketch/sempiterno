import { useCallback, useEffect, useRef, useState } from 'react'
import { dataSource } from '../lib/data'
import type { Command, Snapshot } from '../lib/types'

export function useDashboard(enabled: boolean) {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(false) // al recargar se mantiene la vista anterior
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const alive = useRef(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const s = await dataSource.load()
      if (alive.current) {
        setSnap(s)
        setError(null)
      }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    alive.current = true
    if (!enabled) return
    void reload()
    const unsub = dataSource.subscribe(() => void reload())
    const poll = setInterval(() => void reload(), 60_000)
    return () => {
      alive.current = false
      unsub()
      clearInterval(poll)
    }
  }, [enabled, reload])

  const send = useCallback(
    async (command: Command, payload?: Record<string, unknown>) => {
      try {
        const msg = await dataSource.send(command, payload)
        setToast(msg)
        if (dataSource.demo) {
          const s = await dataSource.load()
          setSnap(s)
        }
      } catch (e) {
        setToast(`Error: ${e instanceof Error ? e.message : String(e)}`)
      }
    },
    [],
  )

  return { snap, loading, error, reload, send, toast, clearToast: () => setToast(null), demo: dataSource.demo }
}
