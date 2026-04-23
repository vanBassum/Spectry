import { useCallback, useEffect, useState } from "react"
import { PaletteIcon, LineChartIcon, RotateCcwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSpectrum } from "@/hooks/use-spectrum"
import type { SpectrumReading } from "@/lib/backend"
import {
  SpectrumBarChart,
  SpectrumTimeSeriesChart,
  type ChannelValues,
} from "@/components/SpectrumCharts"

const channelKeys: (keyof ChannelValues)[] = [
  "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "clear", "nir",
]

function toValues(r: SpectrumReading | null): ChannelValues | null {
  if (!r) return null
  const out = {} as ChannelValues
  for (const k of channelKeys) out[k] = r[k]
  return out
}

export default function SpectrumPage() {
  const { latest, history } = useSpectrum()
  const [peaks, setPeaks] = useState<ChannelValues | null>(null)
  const [logScale, setLogScale] = useState(false)

  useEffect(() => {
    if (!latest) return
    setPeaks((prev) => {
      const v = toValues(latest)!
      if (!prev) return v
      const next = {} as ChannelValues
      for (const k of channelKeys) next[k] = Math.max(prev[k], v[k])
      return next
    })
  }, [latest])

  const resetPeaks = useCallback(() => {
    setPeaks(toValues(latest))
  }, [latest])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Spectrum</h1>
        <Button
          variant={logScale ? "default" : "outline"}
          size="sm"
          onClick={() => setLogScale((v) => !v)}
        >
          {logScale ? "Log scale" : "Linear scale"}
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PaletteIcon className="size-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Current</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={resetPeaks}
            disabled={!latest}
          >
            <RotateCcwIcon /> Reset peaks
          </Button>
        </div>
        {latest ? (
          <SpectrumBarChart reading={latest} peaks={peaks} logScale={logScale} />
        ) : (
          <p className="text-sm text-muted-foreground">Waiting for sensor...</p>
        )}
      </div>

      <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <LineChartIcon className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">
            History{" "}
            <span className="text-sm font-normal text-muted-foreground">
              (last {history.length}s)
            </span>
          </h2>
        </div>
        <SpectrumTimeSeriesChart history={history} logScale={logScale} />
      </div>
    </div>
  )
}
