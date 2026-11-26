import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { BotConfig, Command, Snapshot } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Con la clave ANÓNIMA + RLS (supabase/schema.sql): solo tu usuario ve y cambia datos.
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null

export interface DataSource {
  demo: boolean
  load(): Promise<Snapshot>
  send(command: Command, payload?: Record<string, unknown>): Promise<string>
  subscribe(onChange: () => void): () => void
}

type Tables = Record<string, Record<string, unknown>[]>

const byDesc = (k: string) => (a: Record<string, unknown>, b: Record<string, unknown>) =>
  String(b[k] ?? '').localeCompare(String(a[k] ?? ''))

export function fromTables(t: Tables, note?: string, generatedAt?: string): Snapshot {
  const get = (name: string) => (t[name] ?? []).slice()
  const stateRow = get('bot_state')[0] as { data?: Record<string, unknown> } | undefined
  return {
    config: (get('bot_config')[0] as unknown as BotConfig) ?? null,
    state: (stateRow?.data ?? {}) as Snapshot['state'],
    cycles: get('cycles').sort(byDesc('id')) as unknown as Snapshot['cycles'],
    recommendations: get('recommendations').sort(byDesc('created_at')) as unknown as Snapshot['recommendations'],
    holdings: get('holdings').filter((h) => Number(h.qty) > 0) as unknown as Snapshot['holdings'],
    trades: get('trades').sort(byDesc('closed_at')) as unknown as Snapshot['trades'],
    equity: get('equity_snapshots').sort(byDesc('ts')).reverse() as unknown as Snapshot['equity'],
    bars: get('market_bars').sort(byDesc('ts')).reverse() as unknown as Snapshot['bars'],
    events: get('events').sort(byDesc('ts')) as unknown as Snapshot['events'],
    heartbeats: get('heartbeats') as unknown as Snapshot['heartbeats'],
    backtests: get('backtests').sort(byDesc('created_at')) as unknown as Snapshot['backtests'],
    models: get('models').sort(byDesc('created_at')) as unknown as Snapshot['models'],
    note,
    generatedAt,
  }
}

/** Modo demo: datos de ejemplo generados por `cryptobot demo` (sin conexión a nada). */
export class DemoSource implements DataSource {
  demo = true
  private snap: Snapshot | null = null

  async load(): Promise<Snapshot> {
    if (!this.snap) {
      const res = await fetch(`${import.meta.env.BASE_URL}demo-data.json`)
      if (!res.ok) throw new Error('No se encontró demo-data.json (genera uno con `cryptobot demo`).')
      const j = await res.json()
      this.snap = fromTables(j.tables, j.note, j.generated_at)
    }
    return structuredClone(this.snap)
  }

  async send(command: Command, payload: Record<string, unknown> = {}): Promise<string> {
    const s = this.snap
    if (!s) return 'Sin datos'
    const recId = payload.rec_id as string | undefined
    const rec = recId ? s.recommendations.find((r) => r.id === recId) : undefined
    switch (command) {
      case 'mark_executed':
        if (rec) {
          rec.status = 'ejecutada'
          rec.executed_price = (payload.price as number) ?? rec.ref_price
          rec.executed_at = new Date().toISOString()
        }
        break
      case 'mark_skipped':
        if (rec) rec.status = 'no_ejecutada'
        break
      case 'pause':
      case 'resume':
      case 'kill':
        if (s.config) s.config.paused = command !== 'resume'
        break
      case 'update_config':
        if (s.config) Object.assign(s.config, payload)
        break
      case 'set_capital':
        if (s.config) s.config.capital_usd = Number(payload.capital_usd)
        break
      default:
        break
    }
    return 'Modo demo: el cambio solo se ve en esta pantalla (no hay bot conectado).'
  }

  subscribe(): () => void {
    return () => {}
  }
}

/** Modo real: lee de Supabase y escribe comandos que el motor aplica. */
export class SupabaseSource implements DataSource {
  demo = false
  constructor(private sb: SupabaseClient) {}

  async load(): Promise<Snapshot> {
    const sb = this.sb
    const q = async (p: PromiseLike<{ data: unknown; error: unknown }>) => {
      const { data, error } = await p
      if (error) throw new Error(String((error as { message?: string }).message ?? error))
      return (data ?? []) as Record<string, unknown>[]
    }
    const [config, state, cycles, recs, holdings, trades, equity, events, heartbeats, backtests, models] = await Promise.all([
      q(sb.from('bot_config').select('*').limit(1)),
      q(sb.from('bot_state').select('*').limit(1)),
      q(sb.from('cycles').select('*').order('ts', { ascending: false }).limit(150)),
      q(sb.from('recommendations').select('*').order('created_at', { ascending: false }).limit(300)),
      q(sb.from('holdings').select('*')),
      q(sb.from('trades').select('*').order('closed_at', { ascending: false }).limit(500)),
      q(sb.from('equity_snapshots').select('*').order('ts', { ascending: false }).limit(3000)),
      q(sb.from('events').select('*').order('ts', { ascending: false }).limit(100)),
      q(sb.from('heartbeats').select('*')),
      q(sb.from('backtests').select('*').order('created_at', { ascending: false }).limit(3)),
      q(sb.from('models').select('*').order('created_at', { ascending: false }).limit(20)),
    ])
    const symbols = ((config[0]?.watchlist as string[]) ?? []).slice(0, 12)
    const bars = (
      await Promise.all(
        symbols.map((s) => q(sb.from('market_bars').select('*').eq('symbol', s).order('ts', { ascending: false }).limit(504))),
      )
    ).flat()
    return fromTables({
      bot_config: config,
      bot_state: state,
      cycles,
      recommendations: recs,
      holdings,
      trades,
      equity_snapshots: equity,
      market_bars: bars,
      events,
      heartbeats,
      backtests,
      models,
    })
  }

  async send(command: Command, payload: Record<string, unknown> = {}): Promise<string> {
    const { error } = await this.sb.from('bot_commands').insert({ command, payload })
    if (error) throw new Error(error.message)
    return 'Enviado: el bot lo aplicará en unos segundos.'
  }

  subscribe(onChange: () => void): () => void {
    let timer: ReturnType<typeof setTimeout> | undefined
    const bump = () => {
      clearTimeout(timer)
      timer = setTimeout(onChange, 800)
    }
    const ch = this.sb.channel('panel')
    for (const table of ['recommendations', 'cycles', 'holdings', 'events', 'bot_commands', 'heartbeats']) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, bump)
    }
    ch.subscribe()
    return () => {
      clearTimeout(timer)
      void this.sb.removeChannel(ch)
    }
  }
}

export const dataSource: DataSource = supabase ? new SupabaseSource(supabase) : new DemoSource()
