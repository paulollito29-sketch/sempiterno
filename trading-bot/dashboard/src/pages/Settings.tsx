import { Calculator, Plus, Save, ShieldCheck, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Banner, Button, Card, Field, inputClass } from '../components/ui'
import { supabase } from '../lib/data'
import { coin, MODE_LABEL, pct, price } from '../lib/format'
import type { Command, Mode, RiskLimits, Snapshot } from '../lib/types'

const PROFILES: Record<string, { label: string; perSide: number }> = {
  lemon: { label: 'Lemon (~0.5% + spread, ejecución manual)', perSide: 0.0065 },
  binance: { label: 'Binance vía API (0.1%)', perSide: 0.0013 },
  binance_bnb: { label: 'Binance pagando con BNB (0.075%)', perSide: 0.00105 },
}

const RISK_FIELDS: { key: keyof RiskLimits; label: string; hint: string; pct: boolean; min: number; max: number; step: number }[] = [
  { key: 'risk_per_trade', label: 'Riesgo por operación', hint: 'Cuánto del capital pierdes si toca el stop', pct: true, min: 0.1, max: 3, step: 0.1 },
  { key: 'max_position', label: 'Máximo por cripto', hint: 'Del capital total', pct: true, min: 1, max: 50, step: 1 },
  { key: 'max_total_exposure', label: 'Máximo invertido', hint: 'El resto queda en USDT', pct: true, min: 5, max: 100, step: 5 },
  { key: 'max_drawdown', label: 'Caída máxima tolerada', hint: 'Al superarla, modo defensivo', pct: true, min: 2, max: 50, step: 1 },
  { key: 'daily_loss_limit', label: 'Pérdida diaria máxima', hint: 'Pausa las compras hasta mañana', pct: true, min: 0.5, max: 20, step: 0.5 },
  { key: 'max_trades_per_week', label: 'Compras por semana (máx.)', hint: 'Controla los costos', pct: false, min: 1, max: 20, step: 1 },
]

const DEFAULTS: RiskLimits = {
  risk_per_trade: 0.01,
  max_position: 0.25,
  max_total_exposure: 0.8,
  vol_target_annual: 0.4,
  kelly_fraction: 0.5,
  max_trades_per_week: 4,
  daily_loss_limit: 0.03,
  max_drawdown: 0.15,
  min_trade_usd: 10,
}

function LemonCalculator({ market }: { market?: number }) {
  const [buy, setBuy] = useState('')
  const [sell, setSell] = useState('')
  const [mkt, setMkt] = useState(market ? String(market) : '')
  const [fee, setFee] = useState('0.5')
  const b = Number(buy)
  const s = Number(sell)
  const m = Number(mkt)
  const f = Number(fee) / 100
  const ok = b > 0 && s > 0 && m > 0
  const buyCost = ok ? b / m - 1 + f : null // lo que pagas por encima del mercado al comprar
  const sellCost = ok ? 1 - s / m + f : null // lo que dejas al vender
  const roundTrip = ok ? (buyCost as number) + (sellCost as number) : null
  return (
    <Card title={<span className="inline-flex items-center gap-2"><Calculator size={17} /> Calculadora de costo real de Lemon</span>} subtitle="Mira en la app el precio de compra y de venta al mismo tiempo que el precio de mercado (por ejemplo, el de Binance).">
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Precio de compra en Lemon">
          <input className={inputClass} inputMode="decimal" value={buy} onChange={(e) => setBuy(e.target.value)} />
        </Field>
        <Field label="Precio de venta en Lemon">
          <input className={inputClass} inputMode="decimal" value={sell} onChange={(e) => setSell(e.target.value)} />
        </Field>
        <Field label="Precio de mercado">
          <input className={inputClass} inputMode="decimal" value={mkt} onChange={(e) => setMkt(e.target.value)} />
        </Field>
        <Field label="Comisión explícita (%)">
          <input className={inputClass} inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
        </Field>
      </div>
      <p className="mt-3 text-sm">
        {ok ? (
          <>
            Costo al comprar: <strong>{pct(buyCost, false, 2)}</strong> · al vender: <strong>{pct(sellCost, false, 2)}</strong> · ida y vuelta:{' '}
            <strong>{pct(roundTrip, false, 2)}</strong>. El bot asume {pct(PROFILES.lemon.perSide * 2, false, 2)} para Lemon.
            {roundTrip !== null && roundTrip > PROFILES.lemon.perSide * 2 * 1.2 && ' ⚠️ Tu costo real es mayor: conviene recomendaciones aún más espaciadas.'}
          </>
        ) : (
          <span className="text-muted">Completa los tres precios para estimar tu costo real por operación.</span>
        )}
      </p>
    </Card>
  )
}

function MfaSetup() {
  const [qr, setQr] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  if (!supabase) return null
  const enroll = async () => {
    const { data, error } = await supabase!.auth.mfa.enroll({ factorType: 'totp' })
    if (error) return setMsg(error.message)
    setQr(data.totp.qr_code)
    setFactorId(data.id)
  }
  const verify = async () => {
    if (!factorId) return
    const ch = await supabase!.auth.mfa.challenge({ factorId })
    if (ch.error) return setMsg(ch.error.message)
    const v = await supabase!.auth.mfa.verify({ factorId, challengeId: ch.data.id, code })
    setMsg(v.error ? v.error.message : 'Verificación en dos pasos activada ✅')
    if (!v.error) setQr(null)
  }
  return (
    <Card title={<span className="inline-flex items-center gap-2"><ShieldCheck size={17} /> Verificación en dos pasos</span>} subtitle="Recomendado: protege el panel con un código de tu app autenticadora.">
      {qr ? (
        <div className="space-y-3">
          <img src={qr} alt="Código QR para la app autenticadora" className="h-44 w-44 rounded-lg bg-white p-2" />
          <Field label="Código de 6 dígitos">
            <input className={inputClass} inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Button variant="primary" onClick={verify}>Confirmar</Button>
        </div>
      ) : (
        <Button onClick={enroll}>Activar</Button>
      )}
      {msg && <p className="mt-2 text-sm">{msg}</p>}
    </Card>
  )
}

export function SettingsPage({ snap, onSend }: { snap: Snapshot; onSend: (c: Command, p?: Record<string, unknown>) => void }) {
  const cfg = snap.config
  const [watch, setWatch] = useState<string[]>(cfg?.watchlist ?? [])
  const [newSym, setNewSym] = useState('')
  const [mode, setMode] = useState<Mode>(cfg?.mode ?? 'manual')
  const [confirm, setConfirm] = useState('')
  const [profile, setProfile] = useState(cfg?.cost_profile ?? 'lemon')
  const [risk, setRisk] = useState<RiskLimits>({ ...DEFAULTS, ...(cfg?.risk ?? {}) })
  const [hour, setHour] = useState(cfg?.summary_hour_utc ?? 12)
  useEffect(() => {
    if (!cfg) return
    setWatch(cfg.watchlist)
    setMode(cfg.mode)
    setProfile(cfg.cost_profile)
    setRisk({ ...DEFAULTS, ...cfg.risk })
    setHour(cfg.summary_hour_utc)
  }, [cfg])

  const apiMode = mode === 'semi_auto_api' || mode === 'auto_api'
  const addSym = () => {
    const s = newSym.trim().toUpperCase()
    const full = /USDT$|USDC$/.test(s) ? s : `${s}USDT`
    if (/^[A-Z0-9]{2,15}$/.test(full) && !watch.includes(full)) setWatch([...watch, full])
    setNewSym('')
  }
  const save = () => {
    const payload: Record<string, unknown> = { watchlist: watch, cost_profile: profile, risk, summary_hour_utc: hour }
    if (mode !== cfg?.mode) {
      payload.mode = mode
      if (apiMode) payload.confirm = confirm
    }
    onSend('update_config', payload)
  }
  const localHour = (h: number) => {
    const d = new Date()
    d.setUTCHours(h, 0, 0, 0)
    return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-5">
      <Card title="Criptos que vigila el bot" subtitle="Usa las que puedes operar en Lemon. Solo criptos líquidas (mucho volumen falso en exchanges chicos).">
        <div className="flex flex-wrap gap-2">
          {watch.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-raised py-1 pl-3 pr-1.5 text-sm">
              {coin(s)}
              <button aria-label={`Quitar ${coin(s)}`} onClick={() => setWatch(watch.filter((x) => x !== s))} className="rounded-full p-0.5 text-muted hover:text-ink">
                <X size={14} />
              </button>
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <input className={`${inputClass} w-28`} placeholder="ej. ADA" value={newSym} onChange={(e) => setNewSym(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSym()} aria-label="Agregar cripto" />
            <Button onClick={addSym} className="px-2.5" title="Agregar">
              <Plus size={16} />
            </Button>
          </span>
        </div>
      </Card>

      <Card title="Cómo ejecutas">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Modo" hint="Manual: el bot recomienda y tú ejecutas en Lemon. Práctica: simula para medir el track record.">
            <select className={inputClass} value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
              {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
                <option key={m} value={m}>
                  {MODE_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Perfil de costos" hint="Define el horizonte y cuán exigente es el bot (más costo = menos operaciones).">
            <select className={inputClass} value={profile} onChange={(e) => setProfile(e.target.value)}>
              {Object.entries(PROFILES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {apiMode && (
          <div className="mt-4 space-y-3">
            <Banner tone="critical">
              El modo API opera con dinero real en un exchange. Requiere que el servidor tenga <code>CRYPTOBOT_ENABLE_LIVE_API=true</code>, claves con
              retiros desactivados y haber pasado testnet. Empieza con poco capital.
            </Banner>
            <Field label='Para confirmar, escribe exactamente: ACEPTO EL RIESGO'>
              <input className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
          </div>
        )}
      </Card>

      <Card title="Gestión de riesgo" subtitle="Reglas duras: el modelo nunca puede saltárselas.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RISK_FIELDS.map((f) => (
            <Field key={f.key} label={`${f.label}: ${f.pct ? pct(risk[f.key] as number, false, f.step < 1 ? 1 : 0) : risk[f.key]}`} hint={f.hint}>
              <input
                type="range"
                className="w-full accent-[var(--accent)]"
                min={f.min}
                max={f.max}
                step={f.step}
                value={f.pct ? (risk[f.key] as number) * 100 : (risk[f.key] as number)}
                onChange={(e) => setRisk({ ...risk, [f.key]: f.pct ? Number(e.target.value) / 100 : Number(e.target.value) })}
              />
            </Field>
          ))}
          <Field label={`Resumen diario: ${localHour(hour)} (tu hora)`} hint="Te llega por Telegram">
            <input type="range" className="w-full accent-[var(--accent)]" min={0} max={23} step={1} value={hour} onChange={(e) => setHour(Number(e.target.value))} />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button variant="primary" onClick={save} disabled={apiMode && confirm !== 'ACEPTO EL RIESGO'}>
          <Save size={16} /> Guardar cambios
        </Button>
      </div>

      <LemonCalculator market={snap.cycles[0]?.symbols?.[watch[0]]?.close} />
      <MfaSetup />
      <p className="text-xs text-muted">Precio de referencia actual de {coin(watch[0] ?? 'BTCUSDT')}: {price(snap.cycles[0]?.symbols?.[watch[0]]?.close)}</p>
    </div>
  )
}
