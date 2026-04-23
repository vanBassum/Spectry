import { useEffect, useState } from "react"
import { backend, type SpectrumReading } from "@/lib/backend"
import { useConnectionStatus } from "@/hooks/use-connection-status"

const POLL_INTERVAL_MS = 1000
const MAX_HISTORY = 60

export function useSpectrum() {
  const [history, setHistory] = useState<SpectrumReading[]>([])
  const connection = useConnectionStatus()

  useEffect(() => {
    if (connection !== "connected") return

    let cancelled = false
    const poll = () => {
      backend.getSpectrum()
        .then((r) => {
          if (cancelled || !r.ok) return
          setHistory((prev) => {
            const next = [...prev, r]
            return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next
          })
        })
        .catch(() => {})
    }

    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [connection])

  const latest = history.length > 0 ? history[history.length - 1] : null
  return { latest, history }
}
