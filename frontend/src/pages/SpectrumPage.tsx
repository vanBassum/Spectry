import { PaletteIcon } from "lucide-react"
import { useSpectrum } from "@/hooks/use-spectrum"
import type { SpectrumReading } from "@/lib/backend"

type ChannelKey = keyof Omit<SpectrumReading, "ok">

const channels: { key: ChannelKey; name: string; wavelength: string }[] = [
  { key: "f1",    name: "F1",    wavelength: "415 nm" },
  { key: "f2",    name: "F2",    wavelength: "445 nm" },
  { key: "f3",    name: "F3",    wavelength: "480 nm" },
  { key: "f4",    name: "F4",    wavelength: "515 nm" },
  { key: "f5",    name: "F5",    wavelength: "555 nm" },
  { key: "f6",    name: "F6",    wavelength: "590 nm" },
  { key: "f7",    name: "F7",    wavelength: "630 nm" },
  { key: "f8",    name: "F8",    wavelength: "680 nm" },
  { key: "clear", name: "Clear", wavelength: "visible" },
  { key: "nir",   name: "NIR",   wavelength: "~910 nm" },
]

export default function SpectrumPage() {
  const reading = useSpectrum()
  const hasData = reading?.ok === true

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Spectrum</h1>

      <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <PaletteIcon className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">AS7341 Channels</h2>
        </div>

        {!reading ? (
          <p className="text-sm text-muted-foreground">Connecting...</p>
        ) : !hasData ? (
          <p className="text-sm text-muted-foreground">Sensor unavailable</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {channels.map((ch) => (
              <div key={ch.key} className="flex justify-between">
                <span className="text-muted-foreground">
                  {ch.name} <span className="text-xs">({ch.wavelength})</span>
                </span>
                <span className="font-mono">{reading[ch.key]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
