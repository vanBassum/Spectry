import { PaletteIcon } from "lucide-react"

const channels = [
  { name: "F1",    wavelength: "415 nm" },
  { name: "F2",    wavelength: "445 nm" },
  { name: "F3",    wavelength: "480 nm" },
  { name: "F4",    wavelength: "515 nm" },
  { name: "F5",    wavelength: "555 nm" },
  { name: "F6",    wavelength: "590 nm" },
  { name: "F7",    wavelength: "630 nm" },
  { name: "F8",    wavelength: "680 nm" },
  { name: "Clear", wavelength: "visible" },
  { name: "NIR",   wavelength: "~910 nm" },
] as const

export default function SpectrumPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Spectrum</h1>

      <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <PaletteIcon className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">AS7341 Channels</h2>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          {channels.map((ch) => (
            <div key={ch.name} className="flex justify-between">
              <span className="text-muted-foreground">
                {ch.name} <span className="text-xs">({ch.wavelength})</span>
              </span>
              <span className="font-mono">—</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
