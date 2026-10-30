import { useEffect, useRef, useState } from 'react'
import { formatMoney } from '../lib/pricing'
import type { WeekBucket } from '../lib/metrics'

/**
 * Value of quotes sent per week. One series, so no legend: the title names it.
 * Bars have a hover/focus tooltip and a hidden table for screen readers.
 */
export function WeeklyChart({ weeks }: { weeks: WeekBucket[] }) {
  const [active, setActive] = useState<number | null>(null)
  // Draw at the container's real width so text stays at its true size on any screen.
  const wrapRef = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(640)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const H = 240
  const pad = { top: 16, right: 8, bottom: 28, left: 48 }
  const innerW = W - pad.left - pad.right
  const innerH = H - pad.top - pad.bottom
  const max = Math.max(1, ...weeks.map((w) => w.value))
  const niceMax = niceCeil(max)
  const ticks = [0, niceMax / 2, niceMax]
  const band = innerW / weeks.length
  const barW = Math.min(44, band * 0.6)
  const y = (v: number) => pad.top + innerH - (v / niceMax) * innerH
  const shortMoney = (v: number) => (v >= 1000 ? `$${Math.round(v / 100) / 10}k` : `$${Math.round(v)}`)

  return (
    <div className="chart" ref={wrapRef}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Value of quotes sent per week, last 8 weeks" onMouseLeave={() => setActive(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} className="grid" />
            <text x={pad.left - 8} y={y(t)} className="tick" textAnchor="end" dominantBaseline="middle">
              {shortMoney(t)}
            </text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const cx = pad.left + band * i + band / 2
          const h = Math.max(0, pad.top + innerH - y(w.value))
          const r = Math.min(4, h / 2, barW / 2)
          const x0 = cx - barW / 2
          const top = pad.top + innerH - h
          return (
            <g
              key={w.label}
              className={`bar-g ${active === i ? 'active' : ''}`}
              tabIndex={0}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              <rect x={pad.left + band * i} y={pad.top} width={band} height={innerH} className="hit" />
              {h > 0 && (
                <path
                  className="bar"
                  d={`M${x0},${pad.top + innerH} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${pad.top + innerH} Z`}
                />
              )}
              {(band >= 48 || i % 2 === weeks.length % 2) && (
                <text x={cx} y={H - 8} className="tick" textAnchor="middle">
                  {w.label}
                </text>
              )}
            </g>
          )
        })}
        <line x1={pad.left} x2={W - pad.right} y1={pad.top + innerH} y2={pad.top + innerH} className="axis" />
      </svg>
      {active !== null && (
        <div className="tooltip" style={{ left: `${((pad.left + band * active + band / 2) / W) * 100}%` }} role="status">
          <strong>Week of {weeks[active].label}</strong>
          <span>
            {weeks[active].count} quote{weeks[active].count === 1 ? '' : 's'} · {formatMoney(weeks[active].value)}
          </span>
        </div>
      )}
      <table className="sr-only">
        <caption>Quotes sent per week</caption>
        <thead>
          <tr>
            <th>Week of</th>
            <th>Quotes</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.label}>
              <td>{w.label}</td>
              <td>{w.count}</td>
              <td>{formatMoney(w.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function niceCeil(v: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(v)))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= v) return m * mag
  return 10 * mag
}
