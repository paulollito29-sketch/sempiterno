import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { useState } from 'react'
import { coin, dateTime, pct, price, qty, usd } from '../lib/format'
import type { Command, Mode, Recommendation } from '../lib/types'
import { ActionBadge, Button, Dialog, Field, inputClass, RecStatusBadge, RegimeBadge } from './ui'

function ProbabilityMeter({ p, threshold }: { p: number; threshold: number | null }) {
  // Medidor: relleno = probabilidad; marca = mínimo exigido por costos.
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted">Probabilidad de ganar tras costos</span>
        <span className="font-semibold">{pct(p, false, 0)}</span>
      </div>
      <div className="relative mt-1.5 h-2 rounded-full" style={{ background: 'color-mix(in srgb, var(--s1) 18%, transparent)' }}>
        <div className="h-2 rounded-full" style={{ width: `${Math.min(100, p * 100)}%`, background: 'var(--s1)' }} />
        {threshold !== null && (
          <div className="absolute -top-1 h-4 w-0.5 rounded bg-[var(--ink)]" style={{ left: `${Math.min(100, threshold * 100)}%` }} aria-hidden />
        )}
      </div>
      {threshold !== null && <p className="mt-1 text-xs text-muted">Mínimo exigido por los costos: {pct(threshold, false, 0)} (marca negra)</p>}
    </div>
  )
}

export function RecommendationCard({ rec, mode, onSend, venue = 'Lemon' }: {
  rec: Recommendation
  mode: Mode
  onSend: (c: Command, p?: Record<string, unknown>) => void
  venue?: string
}) {
  const [open, setOpen] = useState(false)
  const [px, setPx] = useState(String(rec.ref_price))
  const [q, setQ] = useState('')
  const pending = rec.status === 'pendiente'
  const isBuy = rec.action === 'COMPRAR'
  const actionable = pending && ['COMPRAR', 'VENDER', 'REDUCIR'].includes(rec.action)

  return (
    <article className="card p-4 sm:p-5" aria-label={`Recomendación ${rec.action} ${coin(rec.symbol)}`}>
      <header className="flex flex-wrap items-center gap-2">
        <ActionBadge action={rec.action} />
        <h3 className="text-lg font-semibold">{coin(rec.symbol)}</h3>
        <RecStatusBadge status={rec.status} />
        {rec.regime && <RegimeBadge regime={rec.regime} />}
        <span className="ml-auto text-xs text-muted">{dateTime(rec.created_at)}</span>
      </header>

      {isBuy && rec.probability !== null && (
        <div className="mt-4">
          <ProbabilityMeter p={rec.probability} threshold={rec.threshold} />
        </div>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted">Precio de referencia</dt>
          <dd className="font-medium tabular">{price(rec.ref_price)}</dd>
        </div>
        {isBuy ? (
          <>
            <div>
              <dt className="text-muted">Tamaño</dt>
              <dd className="font-medium">{pct(rec.size_frac, false, 0)} · {usd(rec.size_usd)}</dd>
            </div>
            <div>
              <dt className="text-muted">Stop</dt>
              <dd className="font-medium tabular">{price(rec.stop_price)} <span className="text-muted">({pct(rec.stop_pct)})</span></dd>
            </div>
            <div>
              <dt className="text-muted">Objetivo</dt>
              <dd className="font-medium tabular">{price(rec.target_price)} <span className="text-muted">({pct(rec.target_pct)})</span></dd>
            </div>
            <div>
              <dt className="text-muted">Comprar hasta</dt>
              <dd className="font-medium tabular">{price(rec.entry_max_price)}</dd>
            </div>
            <div>
              <dt className="text-muted">Horizonte</dt>
              <dd className="font-medium">{rec.horizon_end ? new Date(rec.horizon_end).toLocaleDateString('es', { day: '2-digit', month: 'short' }) : '—'}</dd>
            </div>
          </>
        ) : (
          rec.qty !== null && (
            <div>
              <dt className="text-muted">Cantidad</dt>
              <dd className="font-medium tabular">{qty(rec.qty)} {coin(rec.symbol)}</dd>
            </div>
          )
        )}
      </dl>

      {rec.reasons?.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium">Por qué</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted">
            {rec.reasons.slice(0, 6).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {!rec.approved_model && pending && (
        <p className="mt-3 text-xs text-muted">⚠️ Modelo no aprobado por la puerta de calidad: tómalo como práctica.</p>
      )}

      {actionable && (
        <footer className="mt-4 flex flex-wrap items-center gap-2">
          {mode === 'manual' && (
            <>
              <Button variant="primary" onClick={() => setOpen(true)}>
                <CheckCircle2 size={16} /> La ejecuté en {venue}
              </Button>
              <Button onClick={() => onSend('mark_skipped', { rec_id: rec.id })}>
                <XCircle size={16} /> No la ejecuté
              </Button>
            </>
          )}
          {rec.expires_at && (
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <Clock size={13} /> válida hasta {new Date(rec.expires_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </footer>
      )}

      {rec.outcome_status && isBuy && (
        <p className="mt-3 text-sm">
          <span className="text-muted">Si la seguías: </span>
          <span className={rec.outcome_return !== null && rec.outcome_return > 0 ? 'font-semibold text-good-ink' : 'font-semibold text-critical-ink'}>
            {pct(rec.outcome_return)}
          </span>{' '}
          <span className="text-muted">({rec.outcome_status === 'cerrada' ? rec.outcome_reason : 'en curso'})</span>
        </p>
      )}

      <Dialog open={open} title={`Registrar ejecución · ${coin(rec.symbol)}`} onClose={() => setOpen(false)}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            onSend('mark_executed', { rec_id: rec.id, price: Number(px) || null, qty: q ? Number(q) : null })
            setOpen(false)
          }}
        >
          <Field label={`Precio real en ${venue}`} hint="El que te mostró la app (incluye su spread). El stop y el objetivo se recalculan desde aquí.">
            <input className={inputClass} inputMode="decimal" value={px} onChange={(e) => setPx(e.target.value)} required />
          </Field>
          <Field label={`Cantidad de ${coin(rec.symbol)} (opcional)`} hint={isBuy ? `Si la dejas vacía se usa el tamaño sugerido (${usd(rec.size_usd)}).` : 'Vacía = toda la posición indicada.'}>
            <input className={inputClass} inputMode="decimal" value={q} onChange={(e) => setQ(e.target.value)} placeholder={isBuy ? '' : String(rec.qty ?? '')} />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit">Guardar</Button>
          </div>
        </form>
      </Dialog>
    </article>
  )
}
