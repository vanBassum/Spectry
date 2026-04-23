import { useEffect, useState } from "react"
import { backend, type SpectrumReading } from "@/lib/backend"
import { useConnectionStatus } from "@/hooks/use-connection-status"

const POLL_INTERVAL_MS = 1000

export function useSpectrum() {
  const [reading, setReading] = useState<SpectrumReading | null>(null)
  const connection = useConnectionStatus()

  useEffect(() => {
    if (connection !== "connected") return

    let cancelled = false
    const poll = () => {
      backend.getSpectrum()
        .then((r) => { if (!cancelled) setReading(r) })
        .catch(() => {})
    }

    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [connection])

  return reading
}
