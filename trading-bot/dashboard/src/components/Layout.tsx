import clsx from 'clsx'
import {
  Activity,
  Bot,
  Briefcase,
  FlaskConical,
  History,
  LineChart as LineIcon,
  LogOut,
  Moon,
  Octagon,
  Pause,
  Play,
  Settings,
  Sun,
  Sunrise,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { ago, MODE_LABEL } from '../lib/format'
import type { Command, Snapshot } from '../lib/types'
import { Button, Dialog, StatusPill } from './ui'

export type PageId = 'hoy' | 'cartera' | 'historial' | 'mercado' | 'config' | 'backtests' | 'modelos'

export const PAGES: { id: PageId; label: string; icon: ReactNode }[] = [
  { id: 'hoy', label: 'Hoy', icon: <Sunrise size={18} /> },
  { id: 'cartera', label: 'Cartera', icon: <Briefcase size={18} /> },
  { id: 'historial', label: 'Historial', icon: <History size={18} /> },
  { id: 'mercado', label: 'Mercado', icon: <LineIcon size={18} /> },
  { id: 'config', label: 'Ajustes', icon: <Settings size={18} /> },
  { id: 'backtests', label: 'Backtests', icon: <FlaskConical size={18} /> },
  { id: 'modelos', label: 'Modelos', icon: <Activity size={18} /> },
]

function useTheme() {
  const [theme, setTheme] = useState<string | null>(() => {
    try {
      return localStorage.getItem('theme')
    } catch {
      return null
    }
  })
  const apply = (t: string | null) => {
    setTheme(t)
    if (t) document.documentElement.setAttribute('data-theme', t)
    else document.documentElement.removeAttribute('data-theme')
    try {
      if (t) localStorage.setItem('theme', t)
      else localStorage.removeItem('theme')
    } catch {
      /* almacenamiento no disponible */
    }
  }
  return { theme, apply }
}

export function Layout({ page, onPage, snap, demo, onSend, onSignOut, children }: {
  page: PageId
  onPage: (p: PageId) => void
  snap: Snapshot | null
  demo: boolean
  onSend: (c: Command, p?: Record<string, unknown>) => void
  onSignOut?: () => void
  children: ReactNode
}) {
  const { theme, apply } = useTheme()
  const [killOpen, setKillOpen] = useState(false)
  const paused = snap?.config?.paused ?? false
  const hb = snap?.heartbeats.find((h) => h.component === 'engine')
  const lastCycle = snap?.cycles[0]
  const lastSeen = hb?.ts ?? lastCycle?.finished_at
  const stale = lastSeen ? Date.now() - new Date(lastSeen).getTime() > 45 * 60_000 : true
  const isDark = theme === 'dark' || (!theme && window.matchMedia?.('(prefers-color-scheme: dark)').matches)

  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-[var(--border)] bg-surface p-3 lg:flex">
        <div className="mb-6 flex items-center gap-2 px-2 pt-1">
          <Bot size={22} className="text-accent" aria-hidden />
          <span className="font-semibold">Cryptobot</span>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Secciones">
          {PAGES.map((p) => (
            <button
              key={p.id}
              onClick={() => onPage(p.id)}
              aria-current={page === p.id ? 'page' : undefined}
              className={clsx(
                'flex min-h-[40px] items-center gap-2.5 rounded-lg px-3 text-sm',
                page === p.id ? 'bg-[var(--hairline)] font-semibold' : 'text-muted hover:bg-[var(--hairline)] hover:text-ink',
              )}
            >
              {p.icon}
              {p.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto space-y-1 px-1 text-xs text-muted">
          {demo && <p>Modo demo · datos de ejemplo</p>}
          {snap?.note && <p>{snap.note}</p>}
        </div>
      </aside>

      <div className="lg:pl-56">
        <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2.5">
            <div className="flex items-center gap-2 lg:hidden">
              <Bot size={20} className="text-accent" aria-hidden />
              <span className="font-semibold">Cryptobot</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {paused ? (
                <StatusPill tone="warning" icon={<Pause size={12} />}>En pausa</StatusPill>
              ) : stale ? (
                <StatusPill tone="critical">Sin señal del bot</StatusPill>
              ) : (
                <StatusPill tone="good">Activo</StatusPill>
              )}
              {snap?.config && <span className="hidden text-xs text-muted sm:inline">{MODE_LABEL[snap.config.mode]}</span>}
              {lastSeen && <span className="hidden text-xs text-muted md:inline">· último ciclo {ago(lastSeen)}</span>}
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              {paused ? (
                <Button onClick={() => onSend('resume')} title="Reanudar" ariaLabel="Reanudar">
                  <Play size={16} /> <span className="hidden sm:inline">Reanudar</span>
                </Button>
              ) : (
                <Button onClick={() => onSend('pause')} title="Pausar compras nuevas" ariaLabel="Pausar compras nuevas">
                  <Pause size={16} /> <span className="hidden sm:inline">Pausar</span>
                </Button>
              )}
              <Button variant="danger" onClick={() => setKillOpen(true)} title="Botón de emergencia" ariaLabel="Botón de emergencia">
                <Octagon size={16} /> <span className="hidden sm:inline">Emergencia</span>
              </Button>
              <Button variant="ghost" onClick={() => apply(isDark ? 'light' : 'dark')} title="Cambiar tema" className="px-2.5">
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
                <span className="sr-only">Cambiar tema</span>
              </Button>
              {onSignOut && (
                <Button variant="ghost" onClick={onSignOut} title="Cerrar sesión" className="px-2.5">
                  <LogOut size={16} />
                  <span className="sr-only">Cerrar sesión</span>
                </Button>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[var(--border)] bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Secciones">
        {PAGES.filter((p) => ['hoy', 'cartera', 'historial', 'mercado', 'config'].includes(p.id)).map((p) => (
          <button
            key={p.id}
            onClick={() => onPage(p.id)}
            aria-current={page === p.id ? 'page' : undefined}
            className={clsx('flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px]', page === p.id ? 'font-semibold text-ink' : 'text-muted')}
          >
            {p.icon}
            {p.label}
          </button>
        ))}
      </nav>

      <Dialog open={killOpen} title="Botón de emergencia" onClose={() => setKillOpen(false)}>
        <p className="text-sm">
          Pausa el bot y genera recomendaciones de <strong>vender todas tus posiciones</strong>. En modo API automático, vende de inmediato.
          Úsalo si algo no se ve bien o el mercado colapsa.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setKillOpen(false)}>Cancelar</Button>
          <Button
            variant="danger"
            onClick={() => {
              onSend('kill')
              setKillOpen(false)
            }}
          >
            <Octagon size={16} /> Pausar y vender todo
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
