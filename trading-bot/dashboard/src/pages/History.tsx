import { useMemo, useState } from 'react'
import { ActionBadge, Card, Empty, RecStatusBadge, StatTile, Table, Td } from '../components/ui'
import { coin, dateTime, pct, price, REASON_LABEL } from '../lib/format'
import type { Recommendation, Snapshot } from '../lib/types'

function stats(recs: Recommendation[]) {
  const buys = recs.filter((r) => r.action === 'COMPRAR' && r.status !== 'informativa')
  const closed = buys.filter((r) => r.outcome_status === 'cerrada' && r.outcome_return !== null)
  const rets = closed.map((r) => r.outcome_return as number)
  const wins = rets.filter((x) => x > 0)
  const losses = rets.filter((x) => x <= 0)
  const followed = closed.reduce((acc, r) => acc * (1 + (r.size_frac ?? 0) * (r.outcome_return ?? 0)), 1) - 1
  const withP = closed.filter((r) => r.probability !== null)
  const edges = [0, 0.35, 0.45, 0.55, 1.01]
  const bins = edges.slice(0, -1).map((lo, i) => {
    const hi = edges[i + 1]
    const sel = withP.filter((r) => (r.probability as number) >= lo && (r.probability as number) < hi)
    const n = sel.length
    return {
      lo,
      n,
      p: n ? sel.reduce((a, r) => a + (r.probability as number), 0) / n : 0,
      hit: n ? sel.filter((r) => (r.outcome_return as number) > 0).length / n : 0,
    }
  })
  return {
    buys: buys.length,
    closed: closed.length,
    open: buys.length - closed.length,
    hit: rets.length ? wins.length / rets.length : null,
    avgWin: wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : null,
    avgLoss: losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : null,
    followed: closed.length ? followed : null,
    bins: bins.filter((b) => b.n > 0),
  }
}

export function HistoryPage({ snap }: { snap: Snapshot }) {
  const [filter, setFilter] = useState<'todas' | 'compras' | 'ventas' | 'avisos'>('todas')
  const s = useMemo(() => stats(snap.recommendations), [snap.recommendations])
  const list = snap.recommendations.filter((r) =>
    filter === 'compras' ? r.action === 'COMPRAR' : filter === 'ventas' ? ['VENDER', 'REDUCIR'].includes(r.action) : filter === 'avisos' ? r.status === 'informativa' : true,
  )

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Compras recomendadas" value={s.buys} hint={`${s.closed} cerradas · ${s.open} abiertas`} />
        <StatTile label="Aciertos (netos de costos)" value={s.hit === null ? '—' : pct(s.hit, false, 0)} hint="Cerradas con ganancia tras comisiones" />
        <StatTile label="Ganancia / pérdida media" value={<span className="text-xl">{pct(s.avgWin)} / {pct(s.avgLoss)}</span>} />
        <StatTile label="Si las seguías todas" value={s.followed === null ? '—' : pct(s.followed)} hint="Con el tamaño sugerido de cada una" />
      </div>

      <Card title="¿La probabilidad dice la verdad?" subtitle="Calibración: probabilidad que dio el modelo vs. lo que pasó realmente (compras cerradas)">
        {s.bins.length ? (
          <Table head={['Probabilidad dada', 'Aciertos reales', 'Compras']}>
            {s.bins.map((b) => (
              <tr key={b.lo}>
                <Td>{pct(b.p, false, 0)}</Td>
                <Td>{pct(b.hit, false, 0)}</Td>
                <Td>{b.n}</Td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>Aparecerá cuando haya compras cerradas con probabilidad del modelo.</Empty>
        )}
      </Card>

      <Card
        title="Todas las recomendaciones"
        actions={
          <div className="flex rounded-lg border border-[var(--border)] p-0.5 text-sm" role="tablist">
            {(['todas', 'compras', 'ventas', 'avisos'] as const).map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={filter === f ? 'rounded-md bg-[var(--hairline)] px-3 py-1 font-medium' : 'px-3 py-1 text-muted'}
              >
                {f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        }
      >
        <Table head={['Fecha', 'Cripto', 'Acción', 'Estado', 'Precio', 'Prob.', 'Resultado si la seguías', 'Motivo']} empty={!list.length}>
          {list.slice(0, 200).map((r) => (
            <tr key={r.id}>
              <Td>{dateTime(r.created_at)}</Td>
              <Td className="font-medium">{coin(r.symbol)}</Td>
              <Td>
                <ActionBadge action={r.action} />
              </Td>
              <Td>
                <RecStatusBadge status={r.status} />
              </Td>
              <Td>{price(r.ref_price)}</Td>
              <Td>{r.probability === null ? '—' : pct(r.probability, false, 0)}</Td>
              <Td className={r.outcome_return === null ? '' : r.outcome_return > 0 ? 'text-good-ink' : 'text-critical-ink'}>
                {r.outcome_return === null ? '—' : `${pct(r.outcome_return)} (${r.outcome_status === 'cerrada' ? r.outcome_reason : 'en curso'})`}
              </Td>
              <Td className="text-muted">{REASON_LABEL[r.reason_code] ?? r.reason_code}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  )
}
