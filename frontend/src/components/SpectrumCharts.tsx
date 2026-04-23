import type { SpectrumReading } from "@/lib/backend"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

// ── Bar chart: current spectrum ────────────────────────────────

export function SpectrumBarChart({ reading }: { reading: SpectrumReading }) {
  const data = channels.map((c) => ({
    name: c.short,
    value: reading[c.key],
    fill: c.color,
  }))

  return (
    <ChartContainer config={chartConfig} className="aspect-[16/7] w-full">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={40} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

// ── Area chart: history over time ──────────────────────────────

type TimeSlice = { t: number } & Partial<Record<ChannelKey, number>>

export function SpectrumTimeSeriesChart({ history }: { history: SpectrumReading[] }) {
  const n = history.length
  const data: TimeSlice[] = history.map((r, i) => {
    const slice: TimeSlice = { t: i - (n - 1) }
    for (const c of channels) slice[c.key] = r[c.key]
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
        <YAxis tickLine={false} axisLine={false} width={40} />
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
