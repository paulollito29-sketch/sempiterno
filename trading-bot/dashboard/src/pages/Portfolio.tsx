import { Download, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { LineChart } from '../components/LineChart'
import { Button, Card, Dialog, Empty, Field, inputClass, StatTile, Table, Td } from '../components/ui'
import { coin, date, download, pct, price, qty, REASON_LABEL, toCSV, usd } from '../lib/format'
import type { Command, Holding, Snapshot } from '../lib/types'

export function Portfolio({ snap, onSend }: { snap: Snapshot; onSend: (c: Command, p?: Record<string, unknown>) => void }) {
  const last = snap.cycles[0]
  const priceOf = (s: string) => last?.symbols[s]?.close ?? snap.bars.filter((b) => b.symbol === s).at(-1)?.close
  const [edit, setEdit] = useState<Partial<Holding> | null>(null)
  const [capOpen, setCapOpen] = useState(false)
  const [cap, setCap] = useState(String(snap.config?.capital_usd ?? ''))

  const rows = snap.holdings.map((h) => {
    const px = priceOf(h.symbol) ?? h.avg_price
    const value = h.qty * px
    return { h, px, value, pnl: value - h.cost_usd, pnlPct: value / h.cost_usd - 1 }
  })
  const invested = rows.reduce((a, r) => a + r.value, 0)
  const realized = snap.trades.reduce((a, t) => a + t.pnl_usd, 0)
  const equitySeries = useMemo(
    () => [{ id: 'eq', name: 'Capital', color: 'var(--s1)', area: true, points: snap.equity.map((p) => [new Date(p.ts).getTime(), p.equity] as [number, number]) }],
    [snap.equity],
  )

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Invertido ahora" value={usd(invested)} hint={`${rows.length} posiciones`} />
        <StatTile label="Resultado no realizado" value={usd(rows.reduce((a, r) => a + r.pnl, 0))} />
        <StatTile label="Resultado realizado" value={usd(realized)} hint={`${snap.trades.length} operaciones cerradas`} />
      </div>

      <Card
        title="Mi cartera en Lemon"
        subtitle="Se actualiza cuando tocas “La ejecuté”. Si operaste por fuera del bot, cárgalo aquí."
        actions={
          <div className="flex gap-2">
            <Button onClick={() => setCapOpen(true)}>Capital: {usd(snap.config?.capital_usd)}</Button>
            <Button variant="primary" onClick={() => setEdit({ symbol: snap.config?.watchlist?.[0] ?? 'BTCUSDT' })}>
              <Plus size={16} /> Agregar
            </Button>
          </div>
        }
      >
        <Table head={['Cripto', 'Cantidad', 'Precio de compra', 'Precio actual', 'Resultado', 'Stop', 'Objetivo', 'Hasta', '']} empty={!rows.length}>
          {rows.map(({ h, px, pnl, pnlPct }) => (
            <tr key={h.symbol}>
              <Td className="font-medium">{coin(h.symbol)}</Td>
              <Td>{qty(h.qty)}</Td>
              <Td>{price(h.avg_price)}</Td>
              <Td>{price(px)}</Td>
              <Td className={pnl >= 0 ? 'text-good-ink' : 'text-critical-ink'}>
                {pct(pnlPct)} · {usd(pnl)}
              </Td>
              <Td>{price(h.stop_price)}</Td>
              <Td>{price(h.target_price)}</Td>
              <Td>{date(h.horizon_end)}</Td>
              <Td>
                <div className="flex gap-1">
                  <Button variant="ghost" className="px-2" title="Editar" onClick={() => setEdit(h)}>
                    <Pencil size={15} />
                    <span className="sr-only">Editar</span>
                  </Button>
                  <Button variant="ghost" className="px-2" title="Quitar" onClick={() => onSend('remove_holding', { symbol: h.symbol })}>
                    <Trash2 size={15} />
                    <span className="sr-only">Quitar</span>
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Evolución del capital" subtitle="Valor de la cartera + USDT, en cada ciclo">
        <LineChart series={equitySeries} ariaLabel="Evolución del capital total" yFormat={(v) => `${Math.round(v).toLocaleString('es')}`} />
      </Card>

      <Card
        title="Operaciones cerradas"
        subtitle="Para tu registro e impuestos"
        actions={
          <Button onClick={() => download('operaciones.csv', toCSV(snap.trades as unknown as Record<string, unknown>[]))} disabled={!snap.trades.length}>
            <Download size={16} /> Exportar CSV
          </Button>
        }
      >
        {snap.trades.length ? (
          <Table head={['Cripto', 'Apertura', 'Cierre', 'Cantidad', 'Entrada', 'Salida', 'Resultado', 'Motivo']}>
            {snap.trades.slice(0, 100).map((t) => (
              <tr key={t.id}>
                <Td className="font-medium">{coin(t.symbol)}</Td>
                <Td>{date(t.opened_at)}</Td>
                <Td>{date(t.closed_at)}</Td>
                <Td>{qty(t.qty)}</Td>
                <Td>{price(t.entry_price)}</Td>
                <Td>{price(t.exit_price)}</Td>
                <Td className={t.pnl_usd >= 0 ? 'text-good-ink' : 'text-critical-ink'}>
                  {pct(t.pnl_pct)} · {usd(t.pnl_usd)}
                </Td>
                <Td>{REASON_LABEL[t.reason] ?? t.reason}</Td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>Todavía no hay operaciones cerradas.</Empty>
        )}
      </Card>

      <Dialog open={!!edit} title={edit?.avg_price ? `Editar ${coin(edit.symbol ?? '')}` : 'Agregar a la cartera'} onClose={() => setEdit(null)}>
        {edit && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              const f = new FormData(e.currentTarget)
              onSend('set_holding', {
                symbol: String(f.get('symbol')),
                qty: Number(f.get('qty')),
                avg_price: Number(f.get('avg_price')),
                stop_price: f.get('stop_price') ? Number(f.get('stop_price')) : null,
                target_price: f.get('target_price') ? Number(f.get('target_price')) : null,
              })
              setEdit(null)
            }}
          >
            <Field label="Cripto">
              <select name="symbol" defaultValue={edit.symbol} className={inputClass}>
                {(snap.config?.watchlist ?? []).map((s) => (
                  <option key={s} value={s}>
                    {coin(s)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cantidad">
              <input name="qty" className={inputClass} inputMode="decimal" defaultValue={edit.qty ?? ''} required />
            </Field>
            <Field label="Precio promedio de compra (USD)">
              <input name="avg_price" className={inputClass} inputMode="decimal" defaultValue={edit.avg_price ?? ''} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Stop (opcional)">
                <input name="stop_price" className={inputClass} inputMode="decimal" defaultValue={edit.stop_price ?? ''} />
              </Field>
              <Field label="Objetivo (opcional)">
                <input name="target_price" className={inputClass} inputMode="decimal" defaultValue={edit.target_price ?? ''} />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button onClick={() => setEdit(null)}>Cancelar</Button>
              <Button variant="primary" type="submit">Guardar</Button>
            </div>
          </form>
        )}
      </Dialog>

      <Dialog open={capOpen} title="Capital que dedicas al bot" onClose={() => setCapOpen(false)}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            onSend('set_capital', { capital_usd: Number(cap) })
            setCapOpen(false)
          }}
        >
          <Field label="Capital (USD)" hint="El tamaño de cada recomendación se calcula sobre este monto (riesgo de 1% por operación).">
            <input className={inputClass} inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} required />
          </Field>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setCapOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit">Guardar</Button>
          </div>
        </form>
      </Dialog>
      {!snap.config && <Empty>Sin configuración.</Empty>}
    </div>
  )
}
