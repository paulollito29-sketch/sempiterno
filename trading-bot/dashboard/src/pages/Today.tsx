import { useEffect, useState } from 'react'
import { RecommendationCard } from '../components/RecommendationCard'
import { ActionBadge, Banner, Card, Empty, RegimeBadge, StatTile, Table, Td } from '../components/ui'
import { ago, coin, num, pct, price, usd } from '../lib/format'
import type { Command, Snapshot } from '../lib/types'

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

export function Today({ snap, onSend }: { snap: Snapshot; onSend: (c: Command, p?: Record<string, unknown>) => void }) {
  const now = useNow()
  const cfg = snap.config
  const last = snap.cycles[0]
  const eqPts = snap.equity
  const equity = last?.equity ?? eqPts[eqPts.length - 1]?.equity
  const dayAgo = eqPts.length ? eqPts[Math.max(0, eqPts.findIndex((p) => new Date(p.ts).getTime() >= new Date(eqPts[eqPts.length - 1].ts).getTime() - 86_400_000))] : undefined
  const d24 = equity && dayAgo ? equity / dayAgo.equity - 1 : undefined
  const latest = eqPts[eqPts.length - 1]
  const pending = snap.recommendations.filter((r) => r.status === 'pendiente')
  const notices = snap.recommendations.filter((r) => r.status === 'informativa').slice(0, 5)
  const nextCycle = last ? new Date(last.decision_time).getTime() + 20 * 60_000 + 5_000 : null
  const left = nextCycle ? Math.max(0, nextCycle - now) : null
  const overdue = nextCycle !== null && now - nextCycle > 2 * 60_000
  const mmss =
    left === null ? '—' : overdue ? 'atrasado' : left === 0 ? 'en curso…' : `${String(Math.floor(left / 60_000)).padStart(2, '0')}:${String(Math.floor((left % 60_000) / 1000)).padStart(2, '0')}`
  const symbols = last ? Object.entries(last.symbols) : []

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr] lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div className="card p-4 sm:row-span-1">
          <p className="text-sm text-muted">Capital total</p>
          <p className="mt-1 text-5xl font-semibold leading-none tracking-tight">{usd(equity)}</p>
          {d24 !== undefined && (
            <p className={d24 >= 0 ? 'mt-2 text-sm font-medium text-good-ink' : 'mt-2 text-sm font-medium text-critical-ink'}>
              {pct(d24)} en 24 h
            </p>
          )}
        </div>
        <StatTile label="En USDT (libre)" value={usd(latest?.cash ?? snap.state.cash_usd)} hint={latest && equity ? `${pct((latest.exposure ?? 0) / equity, false, 0)} invertido` : undefined} />
        <StatTile label="Caída desde el máximo" value={pct(latest?.drawdown ?? 0, true)} hint={`Límite: ${pct(-(cfg?.risk?.max_drawdown ?? 0.15), true, 0)}`} />
        <StatTile label="Próximo análisis" value={<span className="tabular">{mmss}</span>} hint={last ? `Último: ${ago(last.finished_at ?? last.decision_time, now)}` : 'Esperando el primer ciclo'} />
      </div>

      {last && !last.approved_model && (
        <Banner tone="warning">
          <strong>Modo práctica.</strong> El modelo todavía no pasó la puerta de calidad (Deflated Sharpe, PBO y comparación con
          baselines). Toma las recomendaciones como práctica, no como señales para dinero real. Detalle en <em>Backtests</em>.
        </Banner>
      )}
      {last?.defensive && (
        <Banner tone="critical">
          <strong>Modo defensivo:</strong> {last.defensive}. No se recomendarán compras nuevas.
        </Banner>
      )}

      <section aria-labelledby="pend">
        <h2 id="pend" className="mb-2 text-[15px] font-semibold">Recomendaciones pendientes</h2>
        {pending.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {pending.map((r) => (
              <RecommendationCard key={r.id} rec={r} mode={cfg?.mode ?? 'manual'} onSend={onSend} />
            ))}
          </div>
        ) : (
          <div className="card">
            <Empty>Sin recomendaciones nuevas. El bot revisa el mercado cada 20 minutos y te avisa por Telegram.</Empty>
          </div>
        )}
      </section>

      <Card title="Cómo está el mercado" subtitle="Último análisis por cripto: régimen, decisión y por qué">
        {symbols.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {symbols.map(([sym, s]) => (
              <div key={sym} className="rounded-xl border border-[var(--hairline)] p-3.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{coin(sym)}</span>
                  <span className="text-sm tabular text-muted">{price(s.close)}</span>
                  <span className="ml-auto">
                    <RegimeBadge regime={s.regime} />
                  </span>
                </div>
                {s.error ? (
                  <p className="mt-2 text-sm text-muted">{s.error}</p>
                ) : (
                  <>
                    <div className="mt-2 flex items-center gap-2">
                      {s.action && <ActionBadge action={s.action} />}
                      {s.prob !== null && s.prob !== undefined && <span className="text-xs text-muted">prob. {pct(s.prob, false, 0)}</span>}
                    </div>
                    {s.reasons && s.reasons.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-xs text-muted">
                        {s.reasons.slice(0, 3).map((r) => (
                          <li key={r}>• {r}</li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-2 text-xs text-muted">
                      Fear &amp; Greed {s.fng ?? '—'} · funding {s.funding_z !== null && s.funding_z !== undefined ? `${num(s.funding_z, 1)} σ` : '—'}
                      {s.euphoria ? ' · euforia' : ''}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Empty>El bot aún no completó su primer ciclo.</Empty>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Ranking de oportunidades" subtitle="Fuerza de tendencia 7 y 30 días ajustada por volatilidad">
          <Table head={['#', 'Cripto', 'Puntaje', 'Régimen', 'Decisión']} empty={!last?.ranking?.length}>
            {(last?.ranking ?? []).map((r, i) => (
              <tr key={r.symbol}>
                <Td>{i + 1}</Td>
                <Td className="font-medium">{coin(r.symbol)}</Td>
                <Td>{r.score === null ? '—' : num(r.score, 2)}</Td>
                <Td>
                  <RegimeBadge regime={r.regime} />
                </Td>
                <Td>{r.action && <ActionBadge action={r.action} />}</Td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Avisos de mercado" subtitle="Cambios de régimen confirmados (~3 h)">
          {notices.length ? (
            <ul className="divide-y divide-[var(--hairline)]">
              {notices.map((n) => (
                <li key={n.id} className="py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{coin(n.symbol)}</span>
                    <ActionBadge action={n.action} />
                    <span className="ml-auto text-xs text-muted">{ago(n.created_at, now)}</span>
                  </div>
                  <p className="mt-1 text-muted">{n.reasons.join(' · ')}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Sin cambios de régimen recientes.</Empty>
          )}
        </Card>
      </div>
    </div>
  )
}
