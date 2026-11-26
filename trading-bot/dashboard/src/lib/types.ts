// Tipos que reflejan las tablas de supabase/schema.sql (las escribe el motor en Python).

export type Action = 'COMPRAR' | 'VENDER' | 'REDUCIR' | 'MANTENER' | 'QUEDATE_EN_USDT' | 'SIN_CAMBIOS'
export type RecStatus = 'pendiente' | 'ejecutada' | 'no_ejecutada' | 'vencida' | 'informativa'
export type Regime = 'alcista' | 'lateral' | 'estres'
export type Mode = 'manual' | 'paper' | 'semi_auto_api' | 'auto_api'

export interface RiskLimits {
  risk_per_trade: number
  max_position: number
  max_total_exposure: number
  vol_target_annual: number
  kelly_fraction: number
  max_trades_per_week: number
  daily_loss_limit: number
  max_drawdown: number
  min_trade_usd: number
}

export interface BotConfig {
  id: number
  watchlist: string[]
  mode: Mode
  cost_profile: string
  capital_usd: number
  risk: Partial<RiskLimits>
  summary_hour_utc: number
  paused: boolean
  updated_at?: string
}

export interface SymbolSummary {
  close?: number
  regime?: Regime | null
  p_stress?: number
  trend_vote?: number
  event?: number
  prob?: number | null
  score?: number | null
  action?: Action
  reason?: string
  reasons?: string[]
  euphoria?: boolean
  fng?: number | null
  funding_z?: number | null
  error?: string
}

export interface Cycle {
  id: string
  ts: string
  decision_time: string
  started_at?: string
  finished_at?: string
  status: string
  mode: Mode
  equity: number
  symbols: Record<string, SymbolSummary>
  ranking: { symbol: string; score: number | null; regime: Regime | null; action: Action }[]
  new_recommendations: string[]
  model_version: string | null
  approved_model: boolean
  defensive: string | null
  warnings: string[]
}

export interface Recommendation {
  id: string
  symbol: string
  action: Action
  cycle_ts: string
  ref_price: number
  created_at: string
  status: RecStatus
  mode: Mode
  entry_max_price: number | null
  size_frac: number | null
  size_usd: number | null
  qty: number | null
  stop_price: number | null
  target_price: number | null
  stop_pct: number | null
  target_pct: number | null
  horizon_end: string | null
  probability: number | null
  threshold: number | null
  base_rate: number | null
  expected_return: number | null
  regime: Regime | null
  reason_code: string
  reasons: string[]
  expires_at: string | null
  executed_at: string | null
  executed_price: number | null
  executed_qty: number | null
  outcome_status: 'abierta' | 'cerrada' | null
  outcome_return: number | null
  outcome_reason: string | null
  closed_at: string | null
  model_version: string | null
  approved_model: boolean
  message: string
}

export interface Holding {
  symbol: string
  qty: number
  avg_price: number
  cost_usd: number
  opened_at: string
  stop_price: number | null
  target_price: number | null
  horizon_end: string | null
  rec_id: string | null
  reduced: boolean
  source: string
}

export interface Trade {
  id: string
  symbol: string
  opened_at: string
  closed_at: string
  qty: number
  entry_price: number
  exit_price: number
  pnl_usd: number
  pnl_pct: number
  reason: string
  mode: string
}

export interface EquityPoint {
  ts: string
  equity: number
  cash: number
  exposure: number
  drawdown: number
}

export interface MarketBar {
  symbol: string
  ts: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  regime: Regime | null
  p_stress: number | null
  trend_vote: number | null
}

export interface BotEvent {
  id: string
  ts: string
  level: 'info' | 'warning' | 'error'
  kind: string
  symbol: string | null
  message: string
}

export interface Heartbeat {
  component: string
  ts: string
  info: Record<string, unknown>
}

export interface GateCheck {
  check: string
  value: number | null
  ok: boolean
}

export interface Metrics {
  total_return?: number
  cagr?: number
  ann_vol?: number
  sharpe?: number
  sortino?: number
  max_drawdown?: number
  calmar?: number
  psr?: number
  t_stat?: number
  n_trades?: number
  win_rate?: number
  avg_win?: number
  avg_loss?: number
  profit_factor?: number
  exposure?: number
  avg_hold_days?: number
  trades_per_month?: number
}

export interface Backtest {
  id: string
  created_at: string
  profile: string
  period: { data_start: string; data_end: string; oos_start: string | null }
  selected: { meta: Metrics; regla: Metrics }
  baselines: Record<string, Metrics>
  statistics: Record<string, unknown> & { n_trials?: number; pbo?: { pbo: number }; dsr_meta?: number; dsr_regla?: number }
  gate: Record<string, { passed: boolean; checks: GateCheck[] }>
  champion: 'meta' | 'regla' | 'ninguno'
  curves: Record<string, [string, number][]>
  calibration: { p_mean: number; hit_rate: number; n: number }[]
  symbols: string[]
}

export interface ModelRow {
  version: string
  created_at: string
  status: string
  uses_meta: boolean
  cost_profile: string
  gate: { passed: boolean; checks?: GateCheck[] }
  oos_metrics: Metrics
  feature_importance: Record<string, number>
  notes?: string
}

export interface BotState {
  cash_usd?: number
  capital_usd?: number
  risk?: { peak_equity?: number; paused?: boolean }
  regimes?: Record<string, Regime>
  last_cycle?: string
}

export interface Snapshot {
  config: BotConfig | null
  state: BotState
  cycles: Cycle[]
  recommendations: Recommendation[]
  holdings: Holding[]
  trades: Trade[]
  equity: EquityPoint[]
  bars: MarketBar[]
  events: BotEvent[]
  heartbeats: Heartbeat[]
  backtests: Backtest[]
  models: ModelRow[]
  note?: string
  generatedAt?: string
}

export type Command =
  | 'pause'
  | 'resume'
  | 'kill'
  | 'mark_executed'
  | 'mark_skipped'
  | 'set_capital'
  | 'set_holding'
  | 'remove_holding'
  | 'update_config'
  | 'run_cycle'
