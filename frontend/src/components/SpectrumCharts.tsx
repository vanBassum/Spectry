import type { SpectrumReading } from "@/lib/backend"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Customized,
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

// Peak-hold horizontal caps drawn above each bar via recharts' internal axis scales.
function PeakMarkers(props: {
  xAxisMap?: Record<string, { scale: (v: unknown) => number }>
  yAxisMap?: Record<string, { scale: (v: number) => number }>
  data: { name: string; peak: number; fill: string }[]
}) {
  const xAxis = props.xAxisMap && Object.values(props.xAxisMap)[0]
  const yAxis = props.yAxisMap && Object.values(props.yAxisMap)[0]
  if (!xAxis?.scale || !yAxis?.scale) return null

  const bw = (xAxis.scale as unknown as { bandwidth?: () => number }).bandwidth?.() ?? 10

  return (
    <g>
      {props.data.map((d) => {
        if (d.peak <= 0) return null
        const x = xAxis.scale(d.name) as number
        if (Number.isNaN(x)) return null
        const y = yAxis.scale(d.peak)
        if (Number.isNaN(y)) return null
        return (
          <line
            key={d.name}
            x1={x + 2}
            x2={x + bw - 2}
            y1={y}
            y2={y}
            stroke={d.fill}
            strokeWidth={2.5}
            strokeLinecap="round"
            opacity={0.9}
          />
        )
      })}
    </g>
  )
}

// ── Bar chart: current spectrum + peak-hold markers ────────────

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

  return (
    <ChartContainer config={chartConfig} className="aspect-[16/7] w-full">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={40}
          scale={logScale ? "log" : "linear"}
          domain={logScale ? [1, "auto"] : [0, "auto"]}
          allowDataOverflow={false}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.fill} />
          ))}
        </Bar>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Customized component={(inner: any) => <PeakMarkers data={data} {...inner} />} />
      </BarChart>
    </ChartContainer>
  )
}

// ── Area chart: history over time ──────────────────────────────

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

  return (
    <ChartContainer config={chartConfig} className="aspect-[16/7] w-full">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
        <defs>
          {channels.map((c) => (
            <linearGradient key={c.key} id={`grad-${c.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={`var(--color-${c.key})`} stopOpacity={0.35} />
              <stop offset="95%" stopColor={`var(--color-${c.key})`} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
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
          domain={logScale ? [1, "auto"] : [0, "auto"]}
          allowDataOverflow={false}
        />
        <ChartTooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={<ChartTooltipContent labelFormatter={(v) => `${v}s`} />}
        />
        {channels.map((c) => (
          <Area
            key={c.key}
            type="monotone"
            dataKey={c.key}
            stroke={`var(--color-${c.key})`}
            strokeWidth={1.5}
            fill={`url(#grad-${c.key})`}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  )
}
