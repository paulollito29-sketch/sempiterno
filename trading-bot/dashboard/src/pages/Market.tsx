import { useMemo, useState } from 'react'
import { LineChart, type Band, type Level, type Marker } from '../components/LineChart'
import { Card, RegimeBadge } from '../components/ui'
import { coin, pct, price } from '../lib/format'
import type { Snapshot } from '../lib/types'

export function Market({ snap }: { snap: Snapshot }) {
  const symbols = snap.config?.watchlist ?? Array.from(new Set(snap.bars.map((b) => b.symbol)))
  const [sym, setSym] = useState(symbols[0] ?? 'BTCUSDT')
  const bars = useMemo(() => snap.bars.filter((b) => b.symbol === sym), [snap.bars, sym])
  const holding = snap.holdings.find((h) => h.symbol === sym)
  const last = snap.cycles[0]?.symbols?.[sym]

  const series = useMemo(() => [{ id: sym, name: `Precio de ${coin(sym)}`, color: 'var(--s1)', points: bars.map((b) => [new Date(b.ts).getTime(), b.close] as [number, number]) }], [bars, sym])
  const t0 = bars.length ? new Date(bars[0].ts).getTime() : 0
  const markers: Marker[] = snap.recommendations
    .filter((r) => r.symbol === sym && ['COMPRAR', 'VENDER', 'REDUCIR'].includes(r.action) && new Date(r.created_at).getTime() >= t0)
    .map((r) => ({
      t: new Date(r.created_at).getTime(),
      v: r.ref_price,
      kind: r.action === 'COMPRAR' ? 'buy' : 'sell',
      label: `${r.action === 'COMPRAR' ? 'Compra' : 'Venta'} recomendada · ${price(r.ref_price)}`,
    }))
  const levels: Level[] = holding
    ? [
        ...(holding.stop_price ? [{ v: holding.stop_price, label: `Stop ${price(holding.stop_price)}` }] : []),
        ...(holding.target_price ? [{ v: holding.target_price, label: `Objetivo ${price(holding.target_price)}` }] : []),
        { v: holding.avg_price, label: `Tu compra ${price(holding.avg_price)}` },
      ]
    : []
  const bands: Band[] = []
  for (const b of bars) {
    const t = new Date(b.ts).getTime()
    if (b.regime === 'estres') {
      const lastBand = bands[bands.length - 1]
      if (lastBand && t - lastBand.to <= 20 * 60_000 + 1) lastBand.to = t + 20 * 60_000
      else bands.push({ from: t, to: t + 20 * 60_000 })
    }
  }
  const change = bars.length > 1 ? bars[bars.length - 1].close / bars[0].close - 1 : null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Cripto">
        {symbols.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={s === sym}
            onClick={() => setSym(s)}
            className={s === sym ? 'card min-h-[40px] px-4 text-sm font-semibold' : 'min-h-[40px] rounded-[14px] px-4 text-sm text-muted hover:text-ink'}
          >
            {coin(s)}
          </button>
        ))}
      </div>
      <Card
        title={`${coin(sym)} · últimos 7 días (barras de 20 min)`}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            {price(bars.at(-1)?.close)} · {change === null ? '—' : pct(change)} en el período <RegimeBadge regime={last?.regime ?? bars.at(-1)?.regime} />
          </span>
        }
      >
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Leyenda">
          <li className="inline-flex items-center gap-1.5">
            <svg width="12" height="12" aria-hidden><path d="M6,1L11,10L1,10Z" fill="var(--s3)" /></svg> Compra recomendada
          </li>
          <li className="inline-flex items-center gap-1.5">
            <svg width="12" height="12" aria-hidden><path d="M6,11L11,2L1,2Z" fill="var(--s2)" /></svg> Venta recomendada
          </li>
          {bands.length > 0 && (
            <li className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: 'var(--critical)', opacity: 0.15 }} aria-hidden /> Régimen de estrés
            </li>
          )}
          {levels.length > 0 && <li>Líneas punteadas: tu compra, stop y objetivo</li>}
        </ul>
        <LineChart series={series} markers={markers} levels={levels} bands={bands} height={320} ariaLabel={`Precio de ${coin(sym)} con recomendaciones`} yFormat={(v) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('es') : price(v))} />
      </Card>
    </div>
  )
}
