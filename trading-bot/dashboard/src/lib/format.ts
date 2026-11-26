const nf = (opts: Intl.NumberFormatOptions) => new Intl.NumberFormat('es', opts)

export const coin = (symbol: string) => symbol.replace(/(USDT|USDC|FDUSD|BUSD)$/, '')

export function usd(x: number | null | undefined, compact = false): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—'
  if (compact && Math.abs(x) >= 10_000) return nf({ notation: 'compact', maximumFractionDigits: 1 }).format(x) + ' USD'
  return nf({ minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x) + ' USD'
}

export function price(x: number | null | undefined): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—'
  const digits = Math.abs(x) >= 100 ? 2 : Math.abs(x) >= 1 ? 4 : 6
  return nf({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(x)
}

export function pct(x: number | null | undefined, signed = true, digits = 1): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—'
  const s = nf({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(x * 100) + '%'
  return signed && x > 0 ? '+' + s : s
}

export function num(x: number | null | undefined, digits = 2): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—'
  return nf({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(x)
}

export function qty(x: number | null | undefined): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—'
  return nf({ maximumSignificantDigits: 6 }).format(x)
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function date(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—'
  const s = Math.round((now - new Date(iso).getTime()) / 1000)
  if (s < 60) return `hace ${s} s`
  if (s < 3600) return `hace ${Math.round(s / 60)} min`
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`
  return `hace ${Math.round(s / 86400)} d`
}

export const REGIME_LABEL: Record<string, string> = { alcista: 'Alcista', lateral: 'Lateral', estres: 'Estrés' }

export const ACTION_LABEL: Record<string, string> = {
  COMPRAR: 'Comprar',
  VENDER: 'Vender',
  REDUCIR: 'Reducir',
  MANTENER: 'Mantener',
  QUEDATE_EN_USDT: 'Quédate en USDT',
  SIN_CAMBIOS: 'Sin cambios',
}

export const STATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  ejecutada: 'Ejecutada',
  no_ejecutada: 'No ejecutada',
  vencida: 'Vencida',
  informativa: 'Informativa',
}

export const MODE_LABEL: Record<string, string> = {
  manual: 'Manual · Lemon',
  paper: 'Práctica (paper)',
  semi_auto_api: 'Semi-automático · API',
  auto_api: 'Automático · API',
}

export const REASON_LABEL: Record<string, string> = {
  entry: 'entrada',
  stop: 'stop',
  target: 'objetivo',
  time: 'horizonte',
  stress: 'estrés',
  trend_reversal: 'giro de tendencia',
  euphoria: 'euforia',
  kill: 'emergencia',
  regime_change: 'cambio de régimen',
  hold: 'mantener',
}

export function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}

export function download(filename: string, content: string, type = 'text/csv') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
