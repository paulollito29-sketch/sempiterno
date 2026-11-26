import { useCallback, useEffect, useState } from 'react'
import { Layout, PAGES, type PageId } from './components/Layout'
import { Banner, Toast } from './components/ui'
import { useDashboard } from './hooks/useDashboard'
import { supabase } from './lib/data'
import { Backtests } from './pages/Backtests'
import { HistoryPage } from './pages/History'
import { Login } from './pages/Login'
import { Market } from './pages/Market'
import { Models } from './pages/Models'
import { Portfolio } from './pages/Portfolio'
import { SettingsPage } from './pages/Settings'
import { Today } from './pages/Today'

function usePage(): [PageId, (p: PageId) => void] {
  const read = () => {
    const h = window.location.hash.replace('#', '') as PageId
    return PAGES.some((p) => p.id === h) ? h : 'hoy'
  }
  const [page, setPage] = useState<PageId>(read)
  useEffect(() => {
    const on = () => setPage(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return [page, (p) => (window.location.hash = p)]
}

type Auth = 'checking' | 'out' | 'mfa' | 'in'

function useAuth(): [Auth, () => void, () => void] {
  const [auth, setAuth] = useState<Auth>(supabase ? 'checking' : 'in')
  const check = useCallback(async () => {
    if (!supabase) return setAuth('in')
    const { data } = await supabase.auth.getSession()
    if (!data.session) return setAuth('out')
    const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    setAuth(aal.data && aal.data.nextLevel === 'aal2' && aal.data.currentLevel !== 'aal2' ? 'mfa' : 'in')
  }, [])
  useEffect(() => {
    void check()
    const sub = supabase?.auth.onAuthStateChange(() => void check())
    return () => sub?.data.subscription.unsubscribe()
  }, [check])
  const signOut = () => {
    void supabase?.auth.signOut().then(check)
  }
  return [auth, check, signOut]
}

export default function App() {
  const [auth, recheck, signOut] = useAuth()
  const [page, setPage] = usePage()
  const { snap, loading, error, send, toast, clearToast, demo } = useDashboard(auth === 'in')

  if (auth === 'checking') return null
  if (auth === 'out' || auth === 'mfa') return <Login needMfa={auth === 'mfa'} onDone={recheck} />

  return (
    <Layout page={page} onPage={setPage} snap={snap} demo={demo} onSend={send} onSignOut={supabase ? signOut : undefined}>
      {demo && (
        <div className="mb-4">
          <Banner tone="info">
            <strong>Modo demo:</strong> {snap?.note ?? 'datos de ejemplo'}. Para ver tu bot real, configura <code>VITE_SUPABASE_URL</code> y{' '}
            <code>VITE_SUPABASE_ANON_KEY</code>.
          </Banner>
        </div>
      )}
      {error && !snap && <Banner tone="critical">No se pudieron cargar los datos: {error}</Banner>}
      {snap && (
        <div className={loading ? 'opacity-90 transition-opacity' : 'transition-opacity'}>
          {page === 'hoy' && <Today snap={snap} onSend={send} />}
          {page === 'cartera' && <Portfolio snap={snap} onSend={send} />}
          {page === 'historial' && <HistoryPage snap={snap} />}
          {page === 'mercado' && <Market snap={snap} />}
          {page === 'config' && <SettingsPage snap={snap} onSend={send} />}
          {page === 'backtests' && <Backtests snap={snap} />}
          {page === 'modelos' && <Models snap={snap} />}
        </div>
      )}
      <Toast message={toast} onClose={clearToast} />
    </Layout>
  )
}
