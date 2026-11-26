import { CheckCircle2, XCircle } from 'lucide-react'
import { useMemo } from 'react'
import { LineChart, type Series } from '../components/LineChart'
import { Banner, Card, Empty, StatTile, Table, Td } from '../components/ui'
import { date, num, pct } from '../lib/format'
import type { Metrics, Snapshot } from '../lib/types'

// Color fijo por estrategia (sigue a la entidad, no al ranking).
const CURVES: { key: string; name: string; color: string }[] = [
  { key: 'bot_meta', name: 'Bot (regla + modelo)', color: 'var(--s1)' },
  { key: 'bot_regla', name: 'Bot (solo regla)', color: 'var(--s2)' },
  { key: 'comprar_y_mantener', name: 'Comprar y mantener', color: 'var(--s3)' },
  { key: 'vol_targeting', name: 'Comprar y mantener + vol targeting', color: 'var(--s4)' },
  { key: 'cruce_medias_20_100', name: 'Cruce de medias 20/100', color: 'var(--s5)' },
  { key: 'dca_semanal', name: 'DCA semanal', color: 'var(--s6)' },
]

const VERDICT: Record<string, string> = {
  meta: 'Aprobado: se usa la regla de tendencia + meta-modelo.',
  regla: 'Aprobada solo la regla de tendencia (el modelo de ML no aportó lo suficiente).',
  ninguno: 'Ninguna variante pasó la puerta de calidad: el bot queda en modo práctica. NO operar con dinero real.',
}

function row(name: string, m: Metrics) {
  return (
    <tr key={name}>
      <Td className="font-medium">{name}</Td>
      <Td>{pct(m.total_return)}</Td>
      <Td>{pct(m.cagr)}</Td>
      <Td>{num(m.sharpe)}</Td>
      <Td>{pct(m.max_drawdown)}</Td>
      <Td>{m.n_trades ?? '—'}</Td>
      <Td>{m.win_rate === undefined ? '—' : pct(m.win_rate, false, 0)}</Td>
    </tr>
  )
}

export function Backtests({ snap }: { snap: Snapshot }) {
  const bt = snap.backtests[0]
  const series: Series[] = useMemo(
    () =>
      bt
        ? CURVES.filter((c) => bt.curves[c.key]?.length).map((c) => ({
            id: c.key,
            name: c.name,
            color: c.color,
            points: bt.curves[c.key].map(([d, v]) => [new Date(d).getTime(), v] as [number, number]),
          }))
        : [],
    [bt],
  )
  if (!bt) {
    return (
      <Card title="Backtests">
        <Empty>Todavía no hay una investigación. En el servidor corre: cryptobot research --profile lemon</Empty>
      </Card>
    )
  }
  const stats = bt.statistics
  const pbo = (stats.pbo as { pbo?: number } | undefined)?.pbo
  return (
    <div className="space-y-5">
      <Banner tone={bt.champion === 'ninguno' ? 'critical' : 'info'}>
        <strong>Veredicto:</strong> {VERDICT[bt.champion]} Perfil de costos <strong>{bt.profile}</strong>, criptos: {bt.symbols.join(', ')}. Fuera de
        muestra desde {date(bt.period.oos_start)} hasta {date(bt.period.data_end)}.
      </Banner>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Configuraciones probadas" value={stats.n_trials ?? '—'} hint="Todas cuentan para deflactar el Sharpe" />
        <StatTile label="Deflated Sharpe (modelo)" value={num(stats.dsr_meta as number)} hint="Se exige ≥ 0.95" />
        <StatTile label="Deflated Sharpe (regla)" value={num(stats.dsr_regla as number)} hint="Se exige ≥ 0.95" />
        <StatTile label="Prob. de sobreajuste (PBO)" value={pbo === undefined ? '—' : pct(pbo, false, 0)} hint="Se exige ≤ 20%" />
      </div>

      <Card title="Capital fuera de muestra (neto de costos)" subtitle="Cada curva empieza en 1.0. Mismo período y mismos costos para todas.">
        <LineChart series={series} ariaLabel="Curvas de capital del bot y de las estrategias de referencia" yFormat={(v) => num(v, 2)} baseline={1} />
      </Card>

      <Card title="Detalle del bot" subtitle="Las mismas dos curvas del bot, con su propia escala (empiezan en 1.0)">
        <LineChart series={series.filter((s) => s.id.startsWith('bot_'))} ariaLabel="Curvas de capital del bot" yFormat={(v) => num(v, 3)} baseline={1} height={220} />
      </Card>

      <Card title="Resultados" subtitle="Retorno ajustado por riesgo: el bot tiene que ganarle a las referencias tras costos">
        <Table head={['Estrategia', 'Retorno total', 'Anual', 'Sharpe', 'Caída máx.', 'Operaciones', 'Aciertos']}>
          {row('Bot (regla + modelo)', bt.selected.meta)}
          {row('Bot (solo regla)', bt.selected.regla)}
          {Object.entries(bt.baselines).map(([k, m]) => row(CURVES.find((c) => c.key === k)?.name ?? k, m))}
        </Table>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {Object.entries(bt.gate).map(([label, g]) => (
          <Card key={label} title={`Puerta de calidad · ${label === 'meta' ? 'regla + modelo' : 'solo regla'}`} subtitle={g.passed ? 'Aprobada' : 'No aprobada'}>
            <ul className="space-y-1.5 text-sm">
              {g.checks.map((c) => (
                <li key={c.check} className="flex items-start gap-2">
                  {c.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-good" aria-label="cumple" /> : <XCircle size={16} className="mt-0.5 shrink-0 text-critical" aria-label="no cumple" />}
                  <span className="flex-1">{c.check}</span>
                  <span className="tabular text-muted">{c.value === null ? '—' : num(c.value, 2)}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {bt.calibration?.length > 0 && (
        <Card title="Calibración del modelo (fuera de muestra)">
          <Table head={['Probabilidad media', 'Aciertos reales', 'Eventos']}>
            {bt.calibration.map((c, i) => (
              <tr key={i}>
                <Td>{pct(c.p_mean, false, 0)}</Td>
                <Td>{pct(c.hit_rate, false, 0)}</Td>
                <Td>{c.n}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  )
}
