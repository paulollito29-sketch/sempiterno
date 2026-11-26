import clsx from 'clsx'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  CircleDollarSign,
  MinusCircle,
  PauseCircle,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { ACTION_LABEL, REGIME_LABEL, STATUS_LABEL } from '../lib/format'
import type { Action, Regime, RecStatus } from '../lib/types'

export function Card({ children, className, title, subtitle, actions }: {
  children: ReactNode
  className?: string
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <section className={clsx('card min-w-0 p-4 sm:p-5', className)}>
      {(title || actions) && (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}

export function Button({ children, onClick, variant = 'secondary', disabled, type = 'button', className, title, ariaLabel }: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
  title?: string
  ariaLabel?: string
}) {
  return (
    <button
      type={type}
      title={title}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-accent text-accent-ink hover:brightness-110',
        variant === 'secondary' && 'border border-[var(--border)] bg-raised hover:bg-[var(--hairline)]',
        variant === 'danger' && 'bg-critical text-white hover:brightness-110',
        variant === 'ghost' && 'hover:bg-[var(--hairline)]',
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Estado con ícono + etiqueta (nunca solo color). */
export function StatusPill({ tone, icon, children }: { tone: 'good' | 'warning' | 'serious' | 'critical' | 'neutral' | 'accent'; icon?: ReactNode; children: ReactNode }) {
  const dot = {
    good: 'text-good',
    warning: 'text-warning',
    serious: 'text-serious',
    critical: 'text-critical',
    neutral: 'text-muted',
    accent: 'text-accent',
  }[tone]
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--border)] bg-raised px-2.5 py-0.5 text-xs font-medium text-ink">
      <span className={clsx('inline-flex', dot)} aria-hidden>
        {icon ?? <Circle size={10} fill="currentColor" />}
      </span>
      {children}
    </span>
  )
}

export function RegimeBadge({ regime }: { regime?: Regime | null }) {
  if (!regime) return <StatusPill tone="neutral">Sin datos</StatusPill>
  if (regime === 'alcista') return <StatusPill tone="good" icon={<TrendingUp size={13} />}>{REGIME_LABEL[regime]}</StatusPill>
  if (regime === 'estres') return <StatusPill tone="critical" icon={<AlertTriangle size={13} />}>{REGIME_LABEL[regime]}</StatusPill>
  return <StatusPill tone="neutral" icon={<MinusCircle size={13} />}>{REGIME_LABEL[regime]}</StatusPill>
}

export function ActionBadge({ action }: { action: Action }) {
  const map: Record<string, { tone: 'good' | 'critical' | 'warning' | 'neutral' | 'accent'; icon: ReactNode }> = {
    COMPRAR: { tone: 'accent', icon: <ArrowUpRight size={13} /> },
    VENDER: { tone: 'serious' as 'warning', icon: <ArrowDownRight size={13} /> },
    REDUCIR: { tone: 'warning', icon: <TrendingDown size={13} /> },
    MANTENER: { tone: 'neutral', icon: <PauseCircle size={13} /> },
    QUEDATE_EN_USDT: { tone: 'neutral', icon: <CircleDollarSign size={13} /> },
    SIN_CAMBIOS: { tone: 'neutral', icon: <MinusCircle size={13} /> },
  }
  const m = map[action] ?? map.SIN_CAMBIOS
  return <StatusPill tone={m.tone} icon={m.icon}>{ACTION_LABEL[action] ?? action}</StatusPill>
}

export function RecStatusBadge({ status }: { status: RecStatus }) {
  const tone = status === 'ejecutada' ? 'good' : status === 'pendiente' ? 'accent' : 'neutral'
  const icon = status === 'ejecutada' ? <CheckCircle2 size={13} /> : status === 'pendiente' ? <Circle size={10} fill="currentColor" /> : <MinusCircle size={13} />
  return <StatusPill tone={tone} icon={icon}>{STATUS_LABEL[status] ?? status}</StatusPill>
}

export function StatTile({ label, value, hint, delta, deltaGood }: {
  label: string
  value: ReactNode
  hint?: ReactNode
  delta?: string
  deltaGood?: boolean
}) {
  return (
    <div className="card p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold leading-tight">{value}</p>
      {delta && (
        <p className={clsx('mt-1 text-sm font-medium', deltaGood === undefined ? 'text-muted' : deltaGood ? 'text-good-ink' : 'text-critical-ink')}>
          {delta}
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

export function Banner({ tone, children }: { tone: 'warning' | 'critical' | 'info'; children: ReactNode }) {
  const icon = tone === 'info' ? <ShieldAlert size={18} className="text-accent" /> : <AlertTriangle size={18} className={tone === 'critical' ? 'text-critical' : 'text-warning'} />
  return (
    <div className="card flex items-start gap-3 p-3.5 text-sm" role={tone === 'critical' ? 'alert' : 'status'}>
      <span className="mt-0.5 shrink-0" aria-hidden>{icon}</span>
      <div>{children}</div>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted">{children}</p>
}

export function Toast({ message, onClose }: { message: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onClose, 4500)
    return () => clearTimeout(t)
  }, [message, onClose])
  if (!message) return null
  return (
    <div role="status" className="fixed bottom-20 left-1/2 z-50 w-[min(92vw,460px)] -translate-x-1/2 sm:bottom-6">
      <div className="card flex items-start gap-3 p-3.5 text-sm shadow-lg">
        <p className="flex-1">{message}</p>
        <button onClick={onClose} aria-label="Cerrar" className="text-muted hover:text-ink">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

export function Dialog({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card max-h-[90vh] w-full overflow-y-auto rounded-b-none p-5 sm:max-w-md sm:rounded-b-[14px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      <span className="mt-1.5 block">{children}</span>
    </label>
  )
}

export const inputClass =
  'w-full min-h-[40px] rounded-lg border border-[var(--border)] bg-raised px-3 text-sm text-ink placeholder:text-muted tabular'

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--hairline)] text-xs text-muted">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-3 py-2 font-medium first:pl-4 sm:first:pl-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular">{children}</tbody>
      </table>
      {empty && <Empty>Sin datos todavía.</Empty>}
    </div>
  )
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={clsx('whitespace-nowrap border-b border-[var(--hairline)] px-3 py-2 first:pl-4 sm:first:pl-3', className)}>{children}</td>
}
