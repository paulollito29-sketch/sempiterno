import { Bot } from 'lucide-react'
import { useState } from 'react'
import { Button, Field, inputClass } from '../components/ui'
import { supabase } from '../lib/data'

export function Login({ needMfa, onDone }: { needMfa: boolean; onDone: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const signIn = async () => {
    if (!supabase) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setError('No se pudo entrar: revisa el correo y la contraseña.')
    else onDone()
  }

  const verify = async () => {
    if (!supabase) return
    setBusy(true)
    setError(null)
    const factors = await supabase.auth.mfa.listFactors()
    const totp = factors.data?.totp?.[0]
    if (!totp) {
      setBusy(false)
      return onDone()
    }
    const ch = await supabase.auth.mfa.challenge({ factorId: totp.id })
    if (ch.error) {
      setBusy(false)
      return setError(ch.error.message)
    }
    const v = await supabase.auth.mfa.verify({ factorId: totp.id, challengeId: ch.data.id, code })
    setBusy(false)
    if (v.error) setError('Código incorrecto.')
    else onDone()
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-5 flex items-center gap-2">
          <Bot className="text-accent" aria-hidden />
          <h1 className="text-lg font-semibold">Cryptobot</h1>
        </div>
        {needMfa ? (
          <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), void verify())}>
            <Field label="Código de tu app autenticadora">
              <input className={inputClass} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required />
            </Field>
            <Button variant="primary" type="submit" disabled={busy} className="w-full">Verificar</Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), void signIn())}>
            <Field label="Correo">
              <input className={inputClass} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Contraseña">
              <input className={inputClass} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            <Button variant="primary" type="submit" disabled={busy} className="w-full">Entrar</Button>
          </form>
        )}
        {error && <p className="mt-3 text-sm text-critical-ink" role="alert">{error}</p>}
        <p className="mt-4 text-xs text-muted">Solo los usuarios registrados como dueños en la base de datos pueden ver el panel.</p>
      </div>
    </div>
  )
}
