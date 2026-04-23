import type { SpectrumReading } from "@/lib/backend"

type ChannelKey = keyof Omit<SpectrumReading, "ok">

export const channels: { key: ChannelKey; label: string; color: string }[] = [
  { key: "f1",    label: "F1",    color: "#8a2be2" },
  { key: "f2",    label: "F2",    color: "#4b00ff" },
  { key: "f3",    label: "F3",    color: "#0080ff" },
  { key: "f4",    label: "F4",    color: "#00c0a0" },
  { key: "f5",    label: "F5",    color: "#35d442" },
  { key: "f6",    label: "F6",    color: "#d4c820" },
  { key: "f7",    label: "F7",    color: "#ff8800" },
  { key: "f8",    label: "F8",    color: "#e02020" },
  { key: "clear", label: "Clr",   color: "#888888" },
  { key: "nir",   label: "NIR",   color: "#5a0f0f" },
]

function niceMax(v: number): number {
  if (v <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / exp
  const r = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return r * exp
}

// ── Bar chart: current spectrum ────────────────────────────────

export function SpectrumBarChart({ reading }: { reading: SpectrumReading }) {
  const values = channels.map((c) => reading[c.key])
  const max = niceMax(Math.max(1, ...values))

  const W = 400, H = 180
  const padL = 32, padR = 8, padT = 8, padB = 28
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const gap = 4
  const barW = (plotW - gap * (channels.length - 1)) / channels.length

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full text-muted-foreground">
      {/* y-axis line */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="currentColor" strokeOpacity="0.3" />
      {/* x-axis line */}
      <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="currentColor" strokeOpacity="0.3" />
      {/* max label */}
      <text x={padL - 4} y={padT + 4} textAnchor="end" fontSize="9" fill="currentColor">{max}</text>
      <text x={padL - 4} y={padT + plotH} textAnchor="end" fontSize="9" fill="currentColor">0</text>

      {channels.map((c, i) => {
        const v = reading[c.key]
        const h = (v / max) * plotH
        const x = padL + i * (barW + gap)
        const y = padT + plotH - h
        return (
          <g key={c.key}>
            <rect x={x} y={y} width={barW} height={h} fill={c.color} />
            <text
              x={x + barW / 2}
              y={padT + plotH + 12}
              textAnchor="middle"
              fontSize="10"
              fill="currentColor"
            >
              {c.label}
            </text>
            <text
              x={x + barW / 2}
              y={padT + plotH + 22}
              textAnchor="middle"
              fontSize="8"
              fill="currentColor"
              fillOpacity="0.7"
            >
              {v}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Time series: per-channel history ───────────────────────────

export function SpectrumTimeSeriesChart({ history }: { history: SpectrumReading[] }) {
  const W = 400, H = 200
  const padL = 36, padR = 8, padT = 8, padB = 20
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  if (history.length === 0) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full text-muted-foreground">
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="11" fill="currentColor">
          Waiting for data...
        </text>
      </svg>
    )
  }

  const flat: number[] = []
  for (const r of history) for (const c of channels) flat.push(r[c.key])
  const max = niceMax(Math.max(1, ...flat))

  const n = history.length
  const xFor = (i: number) =>
    padL + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2)
  const yFor = (v: number) =>
    padT + (1 - v / max) * plotH

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full text-muted-foreground">
      {/* y-axis */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="currentColor" strokeOpacity="0.3" />
      <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="currentColor" strokeOpacity="0.3" />
      {/* grid midline */}
      <line
        x1={padL} y1={padT + plotH / 2}
        x2={padL + plotW} y2={padT + plotH / 2}
        stroke="currentColor" strokeOpacity="0.1" strokeDasharray="2 3"
      />
      <text x={padL - 4} y={padT + 4} textAnchor="end" fontSize="9" fill="currentColor">{max}</text>
      <text x={padL - 4} y={padT + plotH / 2 + 3} textAnchor="end" fontSize="9" fill="currentColor">{max / 2}</text>
      <text x={padL - 4} y={padT + plotH} textAnchor="end" fontSize="9" fill="currentColor">0</text>
      {/* x-axis label: seconds ago */}
      <text x={padL} y={H - 4} textAnchor="start" fontSize="9" fill="currentColor">
        −{n - 1}s
      </text>
      <text x={padL + plotW} y={H - 4} textAnchor="end" fontSize="9" fill="currentColor">now</text>

      {channels.map((c) => {
        const points = history
          .map((r, i) => `${xFor(i).toFixed(1)},${yFor(r[c.key]).toFixed(1)}`)
          .join(" ")
        return (
          <polyline
            key={c.key}
            fill="none"
            stroke={c.color}
            strokeWidth="1.3"
            strokeLinejoin="round"
            points={points}
          />
        )
      })}
    </svg>
  )
}
