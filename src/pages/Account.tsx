import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../store'

export function Account() {
  const { cloudEnabled, user, signIn, signUp, signOut, sync, syncError, retrySync, quotes } = useStore()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  if (!cloudEnabled) {
    return (
      <div className="page narrow">
        <h1>Account</h1>
        <p className="lede">Accounts aren't set up for this copy of the app. Quotes are saved in this browser.</p>
      </div>
    )
  }

  if (user) {
    const saved = quotes.filter((q) => !q.isSample).length
    return (
      <div className="page narrow">
        <div className="page-head">
          <h1>Your account</h1>
        </div>
        <section className="panel">
          <dl className="facts wide">
            <dt>Signed in as</dt>
            <dd>{user.email}</dd>
            <dt>Quotes in your account</dt>
            <dd>{saved}</dd>
            <dt>Sync</dt>
            <dd>
              {sync === 'synced' && 'Up to date'}
              {sync === 'saving' && 'Saving…'}
              {sync === 'loading' && 'Loading…'}
              {sync === 'error' && 'Not saved'}
            </dd>
          </dl>
          {sync === 'error' && (
            <div className="callout warn">
              Your last change didn't reach the server ({syncError}). It's kept on this device.{' '}
              <button className="link-btn" onClick={retrySync}>
                Try again
              </button>
            </div>
          )}
          <p className="small muted">Your quotes and rates sync to every device where you sign in. A personal AI key stays only on this device.</p>
          <div className="row-actions">
            <Link className="btn primary" to="/">
              Go to dashboard
            </Link>
            <button
              className="btn"
              onClick={async () => {
                await signOut()
                navigate('/')
              }}
            >
              Sign out
            </button>
          </div>
        </section>
      </div>
    )
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (password.length < 8) {
      setError('Use a password of at least 8 characters.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password)
        navigate('/')
      } else {
        const { needsConfirmation } = await signUp(email.trim(), password)
        if (needsConfirmation) setInfo('Account created. Check your email to confirm it, then sign in.')
        else navigate('/')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page narrow">
      <div className="page-head">
        <h1>{mode === 'signin' ? 'Sign in' : 'Create your account'}</h1>
      </div>
      <section className="panel auth">
        <p className="lede small-lede">
          With an account, your quotes sync between your phone and computer, customers get a short link, and they can accept
          the quote online. Without one, everything stays in this browser.
        </p>
        <form onSubmit={submit} className="auth-form">
          <label className="field">
            <span>Email</span>
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <div className="callout warn" role="alert">{error}</div>}
          {info && <div className="callout" role="status">{info}</div>}
          <button className="btn primary big" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <p className="small">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            className="link-btn"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setError(null)
              setInfo(null)
            }}
          >
            {mode === 'signin' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </section>
    </div>
  )
}
