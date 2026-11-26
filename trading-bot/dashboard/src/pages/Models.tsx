import { Card, Empty, StatusPill, Table, Td } from '../components/ui'
import { ago, dateTime, num } from '../lib/format'
import type { Snapshot } from '../lib/types'

const FEATURE_LABELS: Record<string, string> = {
  mom_z_4h: 'Impulso 4 h',
  mom_z_1d: 'Tendencia 1 día',
  mom_z_3d: 'Tendencia 3 días',
  mom_z_7d: 'Tendencia 7 días',
  mom_z_30d: 'Tendencia 30 días',
  trend_vote: 'Acuerdo de horizontes',
  px_sma_7d: 'Precio vs. media 7 d',
  px_sma_30d: 'Precio vs. media 30 d',
  ema_slope_7d: 'Pendiente media 7 d',
  donchian_7d: 'Posición en rango 7 d',
  dist_high_30d: 'Distancia al máximo 30 d',
  vol_ann: 'Volatilidad',
  vol_ratio_1d_7d: 'Vol. hoy vs. semana',
  vol_ratio_7d_30d: 'Vol. semana vs. mes',
  vol_z_1y: 'Vol. vs. último año',
  park_ratio_1d: 'Rango intradía',
  taker_imb_4h: 'Compras agresivas 4 h',
  taker_imb_1d: 'Compras agresivas 1 d',
  rel_volume_1d: 'Volumen relativo',
  vwap_dev_1d: 'Precio vs. VWAP',
  funding_rate: 'Funding',
  funding_z_30d: 'Apalancamiento (funding)',
  fng_level: 'Fear & Greed',
  fng_chg_7d: 'Cambio de sentimiento',
  event_side: 'Subida o retroceso',
}

function Importance({ values }: { values: Record<string, number> }) {
  const top = Object.entries(values).sort((a, b) => b[1] - a[1]).slice(0, 10)
  if (!top.length) return <Empty>Sin meta-modelo (se usa la regla de tendencia).</Empty>
  const max = top[0][1] || 1
  return (
    <ul className="space-y-2" aria-label="Importancia de las variables">
      {top.map(([k, v]) => (
        <li key={k} className="grid grid-cols-[minmax(120px,180px)_1fr_48px] items-center gap-3 text-sm">
          <span className="truncate text-muted" title={k}>{FEATURE_LABELS[k] ?? k}</span>
          <span className="h-3 overflow-visible">
            <span className="block h-3 rounded-r" style={{ width: `${(v / max) * 100}%`, background: 'var(--s1)' }} />
          </span>
          <span className="tabular text-right">{num(v * 100, 1)}%</span>
        </li>
      ))}
    </ul>
  )
}

export function Models({ snap }: { snap: Snapshot }) {
  const profile = snap.config?.cost_profile
  const champion = snap.models.find((m) => m.status === 'champion' && m.cost_profile === profile) ?? snap.models.find((m) => m.status === 'champion') ?? snap.models[0]
  return (
    <div className="space-y-5">
      <Card title="Modelos" subtitle="Hay un campeón por perfil de costos: el de tu perfil genera las recomendaciones; un retador solo lo reemplaza si aprueba la puerta.">
        <Table head={['Versión', 'Perfil', 'Estado', 'Puerta', 'Usa ML', 'Sharpe OOS', 'Creado']} empty={!snap.models.length}>
          {snap.models.map((m) => (
            <tr key={m.version}>
              <Td className="font-medium">{m.version}</Td>
              <Td>{m.cost_profile}</Td>
              <Td>{m.status === 'champion' ? 'campeón' : m.status === 'challenger' ? 'retador' : m.status}</Td>
              <Td>{m.gate?.passed ? <StatusPill tone="good">Aprobada</StatusPill> : <StatusPill tone="critical">No aprobada</StatusPill>}</Td>
              <Td>{m.uses_meta ? 'Sí' : 'No (regla)'}</Td>
              <Td>{num(m.oos_metrics?.sharpe)}</Td>
              <Td>{dateTime(m.created_at)}</Td>
            </tr>
          ))}
        </Table>
      </Card>
      {champion && (
        <Card title="Qué mira más el modelo" subtitle={`Importancia de las variables · ${champion.version}`}>
          <Importance values={champion.feature_importance ?? {}} />
        </Card>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Registro de eventos">
          {snap.events.length ? (
            <ul className="divide-y divide-[var(--hairline)] text-sm">
              {snap.events.slice(0, 30).map((e) => (
                <li key={e.id} className="flex items-start gap-2 py-2">
                  <StatusPill tone={e.level === 'error' ? 'critical' : e.level === 'warning' ? 'warning' : 'neutral'}>{e.level}</StatusPill>
                  <span className="flex-1">{e.message}</span>
                  <span className="whitespace-nowrap text-xs text-muted">{ago(e.ts)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Sin eventos.</Empty>
          )}
        </Card>
        <Card title="Salud del sistema">
          {snap.heartbeats.length ? (
            <ul className="space-y-2 text-sm">
              {snap.heartbeats.map((h) => (
                <li key={h.component} className="flex items-center gap-2">
                  <span className="font-medium">{h.component}</span>
                  <span className="text-muted">último latido {ago(h.ts)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Sin latidos todavía.</Empty>
          )}
        </Card>
      </div>
    </div>
  )
}
