import type { SpectrumReading } from "@/lib/backend"
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

type ChannelKey = "f1" | "f2" | "f3" | "f4" | "f5" | "f6" | "f7" | "f8" | "clear" | "nir"
export type ChannelValues = Record<ChannelKey, number>

const channels: { key: ChannelKey; short: string; label: string; color: string }[] = [
  { key: "f1",    short: "F1",    label: "F1 (415 nm)",  color: "#8a2be2" },
  { key: "f2",    short: "F2",    label: "F2 (445 nm)",  color: "#4b00ff" },
  { key: "f3",    short: "F3",    label: "F3 (480 nm)",  color: "#0080ff" },
  { key: "f4",    short: "F4",    label: "F4 (515 nm)",  color: "#00c0a0" },
  { key: "f5",    short: "F5",    label: "F5 (555 nm)",  color: "#35d442" },
  { key: "f6",    short: "F6",    label: "F6 (590 nm)",  color: "#d4c820" },
  { key: "f7",    short: "F7",    label: "F7 (630 nm)",  color: "#ff8800" },
  { key: "f8",    short: "F8",    label: "F8 (680 nm)",  color: "#e02020" },
  { key: "clear", short: "Clr",   label: "Clear",        color: "#888888" },
  { key: "nir",   short: "NIR",   label: "NIR (~910)",   color: "#5a0f0f" },
]

const chartConfig: ChartConfig = Object.fromEntries(
  channels.map((c) => [c.key, { label: c.label, color: c.color }]),
)

function clampForLog(v: number, logScale: boolean) {
  return logScale ? Math.max(1, v) : v
}

// Next power of 10 at or above v. topPowerOfTen(999) = 1000; topPowerOfTen(1001) = 10000.
function topPowerOfTen(v: number): number {
  if (v <= 1) return 1
  return Math.pow(10, Math.max(1, Math.ceil(Math.log10(v))))
}

// Ticks at strict powers of 10. Linear includes 0; log starts at 1.
function powerOfTenTicks(max: number, logScale: boolean): number[] {
  const topExp = Math.log10(topPowerOfTen(max))
  const ticks: number[] = logScale ? [] : [0]
  for (let e = 0; e <= topExp; e++) ticks.push(Math.pow(10, e))
  return ticks
}

function formatTick(v: number): string {
  if (v >= 1_000_000) return `${v / 1_000_000}M`
  if (v >= 1_000)     return `${v / 1_000}k`
  return `${v}`
}

// ── Bar chart: current spectrum + peak-hold caps ──────────────
//
// Peaks are drawn as a Line series with a custom dot renderer — recharts
// positions each dot using the real y-scale, so this works for log & linear
// automatically. The invisible connecting line is hidden with stroke="none".

export function SpectrumBarChart({
  reading,
  peaks,
  logScale,
}: {
  reading: SpectrumReading
  peaks: ChannelValues | null
  logScale: boolean
}) {
  const data = channels.map((c) => {
    const raw = reading[c.key]
    const p = peaks ? peaks[c.key] : raw
    return {
      name: c.short,
      value: clampForLog(raw, logScale),
      peak: clampForLog(p, logScale),
      fill: c.color,
    }
  })

  const rawMax = Math.max(1, ...data.map((d) => Math.max(d.value, d.peak)))
  const logTicks = logScale ? powerOfTenTicks(rawMax, true) : undefined

  return (
    <ChartContainer config={chartConfig} className="aspect-[16/7] w-full">
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={40}
          scale={logScale ? "log" : "linear"}
          domain={logScale ? [logTicks![0], logTicks![logTicks!.length - 1]] : [0, "auto"]}
          ticks={logTicks}
          tickFormatter={formatTick}
          allowDataOverflow={false}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="value" radius={[3, 3, 0, 0]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.fill} />
          ))}
        </Bar>
        <Line
          dataKey="peak"
          stroke="none"
          isAnimationActive={false}
          activeDot={false}
          dot={(props) => {
            // recharts Line dot renderer props: cx, cy, payload, index, key
            const p = props as unknown as {
              cx: number
              cy: number
              payload: { peak: number; fill: string; name: string }
              index: number
            }
            if (!Number.isFinite(p.cx) || !Number.isFinite(p.cy)) {
              return <g key={`peak-${p.index}`} />
            }
            const capW = 22
            return (
              <line
                key={`peak-${p.index}`}
                x1={p.cx - capW / 2}
                x2={p.cx + capW / 2}
                y1={p.cy}
                y2={p.cy}
                stroke={p.payload.fill}
                strokeWidth={3}
                strokeLinecap="round"
              />
            )
          }}
        />
      </ComposedChart>
    </ChartContainer>
  )
}

// ── Line chart: history over time (strokes only, no fill) ─────

type TimeSlice = { t: number } & Partial<Record<ChannelKey, number>>

export function SpectrumTimeSeriesChart({
  history,
  logScale,
}: {
  history: SpectrumReading[]
  logScale: boolean
}) {
  const n = history.length
  const data: TimeSlice[] = history.map((r, i) => {
    const slice: TimeSlice = { t: i - (n - 1) }
    for (const c of channels) slice[c.key] = clampForLog(r[c.key], logScale)
    return slice
  })

  let rawMax = 1
  for (const r of history) for (const c of channels) {
    if (r[c.key] > rawMax) rawMax = r[c.key]
  }
  const logTicks = logScale ? powerOfTenTicks(rawMax, true) : undefined

  return (
    <ChartContainer config={chartConfig} className="aspect-[16/7] w-full">
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="t"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(v: number) => `${v}s`}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={40}
          scale={logScale ? "log" : "linear"}
          domain={logScale ? [logTicks![0], logTicks![logTicks!.length - 1]] : [0, "auto"]}
          ticks={logTicks}
          tickFormatter={formatTick}
          allowDataOverflow={false}
        />
        <ChartTooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={<ChartTooltipContent labelFormatter={(v) => `${v}s`} />}
        />
        {channels.map((c) => (
          <Line
            key={c.key}
            type="monotone"
            dataKey={c.key}
            stroke={`var(--color-${c.key})`}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  )
}
