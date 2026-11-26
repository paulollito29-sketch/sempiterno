import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

// Gráfico de líneas en SVG siguiendo la guía de visualización:
// líneas de 2 px, grilla en hairline sólida, cruz + tooltip con TODAS las series en esa fecha,
// leyenda para 2+ series (y etiquetas directas al final cuando son <= 4 y no chocan),
// y una vista de tabla equivalente.

export type Point = [number, number]
export interface Series {
  id: string
  name: string
  color: string // variable CSS de la paleta, p. ej. 'var(--s1)'
  points: Point[]
  area?: boolean
}
export interface Marker {
  t: number
  v: number
  kind: 'buy' | 'sell'
  label: string
}
export interface Level {
  v: number
  label: string
}
export interface Band {
  from: number
  to: number
}

interface Props {
  series: Series[]
  height?: number
  yFormat?: (v: number) => string
  xFormat?: (t: number) => string
  markers?: Marker[]
  levels?: Level[]
  bands?: Band[]
  bandLabel?: string
  ariaLabel: string
  baseline?: number
}

const M = { top: 12, right: 16, bottom: 30 }

function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return []
  if (min === max) return [min]
  const span = max - min
  const step0 = span / count
  const mag = 10 ** Math.floor(Math.log10(step0))
  const err = step0 / mag
  const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(+v.toPrecision(12))
  return out
}

function nearestIndex(points: Point[], t: number): number {
  let lo = 0
  let hi = points.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (points[mid][0] < t) lo = mid + 1
    else hi = mid
  }
  if (lo > 0 && Math.abs(points[lo - 1][0] - t) < Math.abs(points[lo][0] - t)) return lo - 1
  return lo
}


export function LineChart({ series, height = 260, yFormat = (v) => v.toLocaleString('es'), xFormat, markers = [], levels = [], bands = [], bandLabel, ariaLabel, baseline }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [hover, setHover] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const live = series.filter((s) => s.points.length > 0)
  const timeline = live[0]?.points ?? []
  const directLabels = live.length >= 2 && live.length <= 4
  const longestName = Math.max(0, ...live.map((s) => s.name.length))
  const right = M.right + (directLabels ? Math.min(180, Math.round(longestName * 6.6) + 18) : 0)
  // Margen izquierdo medido: la etiqueta más larga del eje Y nunca se corta.
  const allV = live.flatMap((s) => s.points.map((p) => p[1]))
  const longest = allV.length ? Math.max(yFormat(Math.max(...allV)).length, yFormat(Math.min(...allV)).length) : 4
  const left = Math.max(40, Math.round(longest * 6.8) + 14)

  const geo = useMemo(() => {
    const ts = live.flatMap((s) => [s.points[0][0], s.points[s.points.length - 1][0]])
    const vs = [...live.flatMap((s) => s.points.map((p) => p[1])), ...levels.map((l) => l.v), ...markers.map((m) => m.v)]
    if (baseline !== undefined) vs.push(baseline)
    const t0 = Math.min(...ts)
    const t1 = Math.max(...ts)
    let v0 = Math.min(...vs)
    let v1 = Math.max(...vs)
    const pad = (v1 - v0) * 0.06 || Math.abs(v1) * 0.02 || 1
    v0 -= pad
    v1 += pad
    const iw = width - left - right
    const ih = height - M.top - M.bottom
    const x = (t: number) => left + ((t - t0) / (t1 - t0 || 1)) * iw
    const y = (v: number) => M.top + (1 - (v - v0) / (v1 - v0 || 1)) * ih
    const yt = niceTicks(v0, v1, 5).filter((v) => v >= v0 && v <= v1)
    const nx = Math.max(2, Math.min(6, Math.floor(iw / 110)))
    const xt = Array.from({ length: nx }, (_, i) => t0 + ((t1 - t0) * i) / (nx - 1))
    // Etiquetas de fecha: con año cuando el período supera ~10 meses (nunca parecer "un año").
    const longSpan = t1 - t0 > 300 * 86_400_000
    const fmt =
      xFormat ??
      ((t: number) =>
        new Date(t).toLocaleDateString('es', longSpan ? { month: 'short', year: 'numeric' } : { day: '2-digit', month: 'short' }))
    return { x, y, yt, xt, iw, ih, t0, t1, fmt }
  }, [live, levels, markers, width, height, right, baseline, left, xFormat])

  if (!live.length) {
    return <p className="py-10 text-center text-sm text-muted">Sin datos para graficar todavía.</p>
  }

  const path = (pts: Point[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${geo.x(p[0]).toFixed(1)},${geo.y(p[1]).toFixed(1)}`).join('')
  const ends = live.map((s) => ({ s, y: geo.y(s.points[s.points.length - 1][1]) }))
  const collide = ends.some((a, i) => ends.some((b, j) => i < j && Math.abs(a.y - b.y) < 15))

  const hoverT = hover !== null ? timeline[hover]?.[0] : null
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * width
    const t = geo.t0 + ((px - left) / geo.iw) * (geo.t1 - geo.t0)
    setHover(nearestIndex(timeline, t))
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') setHover((h) => Math.min(timeline.length - 1, (h ?? -1) + 1))
    if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? timeline.length) - 1))
    if (e.key === 'Escape') setHover(null)
  }

  const tipX = hoverT !== null && hoverT !== undefined ? geo.x(hoverT) : 0
  const tipLeft = tipX > width * 0.6

  const rows = timeline.length > 160 ? timeline.filter((_, i) => i % Math.ceil(timeline.length / 160) === 0 || i === timeline.length - 1) : timeline

  return (
    <div>
      {live.length >= 2 && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Leyenda">
          {live.map((s) => (
            <li key={s.id} className="inline-flex items-center gap-1.5">
              <svg width="16" height="8" aria-hidden><line x1="1" y1="4" x2="15" y2="4" stroke={s.color} strokeWidth="2" strokeLinecap="round" /></svg>
              {s.name}
            </li>
          ))}
          {bands.length > 0 && bandLabel && (
            <li className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: 'var(--critical)', opacity: 0.12 }} aria-hidden />
              {bandLabel}
            </li>
          )}
        </ul>
      )}
      <div
        ref={wrap}
        className="relative w-full outline-none"
        tabIndex={0}
        role="img"
        aria-label={ariaLabel}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block max-w-full touch-pan-y" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          {bands.map((b, i) => (
            <rect key={i} x={geo.x(Math.max(b.from, geo.t0))} y={M.top} width={Math.max(1, geo.x(Math.min(b.to, geo.t1)) - geo.x(Math.max(b.from, geo.t0)))} height={geo.ih} fill="var(--critical)" opacity={0.08} />
          ))}
          {geo.yt.map((v) => (
            <g key={v}>
              <line x1={left} x2={width - right} y1={geo.y(v)} y2={geo.y(v)} stroke="var(--hairline)" strokeWidth={1} />
              <text x={left - 8} y={geo.y(v)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--muted)" className="tabular">
                {yFormat(v)}
              </text>
            </g>
          ))}
          <line x1={left} x2={width - right} y1={M.top + geo.ih} y2={M.top + geo.ih} stroke="var(--axis)" strokeWidth={1} />
          {geo.xt.map((t, i) => (
            <text key={i} x={geo.x(t)} y={height - 8} textAnchor={i === 0 ? 'start' : i === geo.xt.length - 1 ? 'end' : 'middle'} fontSize="11" fill="var(--muted)">
              {geo.fmt(t)}
            </text>
          ))}
          {baseline !== undefined && <line x1={left} x2={width - right} y1={geo.y(baseline)} y2={geo.y(baseline)} stroke="var(--axis)" strokeWidth={1} />}
          {levels.map((l) => (
            <g key={l.label}>
              <line x1={left} x2={width - right} y1={geo.y(l.v)} y2={geo.y(l.v)} stroke="var(--muted)" strokeWidth={1} strokeDasharray="4 3" />
              <text x={width - right - 4} y={geo.y(l.v) - 4} textAnchor="end" fontSize="11" fill="var(--muted)">
                {l.label}
              </text>
            </g>
          ))}
          {live.map((s) => (
            <g key={s.id}>
              {s.area && (
                <path d={`${path(s.points)}L${geo.x(s.points[s.points.length - 1][0])},${M.top + geo.ih}L${geo.x(s.points[0][0])},${M.top + geo.ih}Z`} fill={s.color} opacity={0.1} />
              )}
              <path d={path(s.points)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          ))}
          {markers.map((m, i) => {
            const cx = geo.x(m.t)
            const cy = geo.y(m.v)
            const d = m.kind === 'buy' ? `M${cx},${cy - 7}L${cx + 6},${cy + 4}L${cx - 6},${cy + 4}Z` : `M${cx},${cy + 7}L${cx + 6},${cy - 4}L${cx - 6},${cy - 4}Z`
            return (
              <path key={i} d={d} fill={m.kind === 'buy' ? 'var(--s3)' : 'var(--s2)'} stroke="var(--surface)" strokeWidth={2}>
                <title>{m.label}</title>
              </path>
            )
          })}
          {directLabels && !collide &&
            ends.map(({ s, y }) => (
              <g key={s.id}>
                <circle cx={width - right} cy={y} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                <text x={width - right + 8} y={y} dy="0.32em" fontSize="11" fill="var(--ink)">
                  {s.name}
                </text>
              </g>
            ))}
          {hoverT !== null && hoverT !== undefined && (
            <g pointerEvents="none">
              <line x1={tipX} x2={tipX} y1={M.top} y2={M.top + geo.ih} stroke="var(--axis)" strokeWidth={1} />
              {live.map((s) => {
                const p = s.points[nearestIndex(s.points, hoverT)]
                return <circle key={s.id} cx={geo.x(p[0])} cy={geo.y(p[1])} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
              })}
            </g>
          )}
        </svg>
        {hoverT !== null && hoverT !== undefined && (
          <div
            className="card pointer-events-none absolute top-2 z-10 min-w-[150px] px-3 py-2 text-xs shadow-md"
            style={tipLeft ? { right: Math.max(8, width - tipX + 12) } : { left: Math.min(tipX + 12, width - 160) }}
          >
            <p className="mb-1 text-muted">{new Date(hoverT).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
            {live.map((s) => {
              const p = s.points[nearestIndex(s.points, hoverT)]
              return (
                <p key={s.id} className="flex items-center gap-2 tabular">
                  <svg width="12" height="6" aria-hidden><line x1="1" y1="3" x2="11" y2="3" stroke={s.color} strokeWidth="2" strokeLinecap="round" /></svg>
                  <span className="font-semibold text-ink">{yFormat(p[1])}</span>
                  <span className="text-muted">{s.name}</span>
                </p>
              )
            })}
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-end">
        <button className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable}>
          {showTable ? 'Ocultar tabla' : 'Ver como tabla'}
        </button>
      </div>
      {showTable && (
        <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-[var(--hairline)]">
          <table className="w-full text-left text-xs tabular">
            <thead className="sticky top-0 bg-surface text-muted">
              <tr>
                <th className="px-3 py-1.5 font-medium">Fecha</th>
                {live.map((s) => (
                  <th key={s.id} className="px-3 py-1.5 font-medium">{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p[0]} className="border-t border-[var(--hairline)]">
                  <td className="px-3 py-1">{new Date(p[0]).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  {live.map((s) => (
                    <td key={s.id} className="px-3 py-1">{yFormat(s.points[nearestIndex(s.points, p[0])][1])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
