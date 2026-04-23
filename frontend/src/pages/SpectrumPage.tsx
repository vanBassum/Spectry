import { PaletteIcon, LineChartIcon } from "lucide-react"
import { useSpectrum } from "@/hooks/use-spectrum"
import { SpectrumBarChart, SpectrumTimeSeriesChart } from "@/components/SpectrumCharts"

export default function SpectrumPage() {
  const { latest, history } = useSpectrum()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Spectrum</h1>

      <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <PaletteIcon className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Current</h2>
        </div>
        {latest ? (
          <SpectrumBarChart reading={latest} />
        ) : (
          <p className="text-sm text-muted-foreground">Waiting for sensor...</p>
        )}
      </div>

      <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <LineChartIcon className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">
            History <span className="text-sm font-normal text-muted-foreground">(last {history.length}s)</span>
          </h2>
        </div>
        <SpectrumTimeSeriesChart history={history} />
      </div>
    </div>
  )
}
