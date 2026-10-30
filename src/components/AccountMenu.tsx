import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../store'

const SYNC_LABEL = { local: '', loading: 'Loading…', synced: 'All changes saved', saving: 'Saving…', error: "Last change didn't save" }

/** Signed-in painter's menu in the top bar: who's signed in, sync status, and Sign out. */
export function AccountMenu() {
  const { user, sync, retrySync, signOut } = useStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  if (!user) return null
  const initial = (user.email[0] ?? '?').toUpperCase()

  return (
    <div className="account-wrap" ref={wrapRef}>
      <button
        type="button"
        className="account-btn"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${user.email}`}
      >
        <span className="avatar" aria-hidden="true">
          {initial}
        </span>
        <span className={`sync-dot ${sync}`} aria-hidden="true" title={SYNC_LABEL[sync]} />
      </button>
      {open && (
        <div className="account-panel" role="menu">
          <div className="account-who">
            <span className="small muted">Signed in as</span>
            <strong>{user.email}</strong>
            <span className={`account-sync ${sync}`}>
              <span className={`sync-dot ${sync}`} aria-hidden="true" /> {SYNC_LABEL[sync]}
              {sync === 'error' && (
                <button className="link-btn" onClick={retrySync}>
                  Try again
                </button>
              )}
            </span>
          </div>
          <Link to="/account" role="menuitem" onClick={() => setOpen(false)}>
            Account
          </Link>
          <Link to="/settings" role="menuitem" onClick={() => setOpen(false)}>
            Business details & rates
          </Link>
          <button
            type="button"
            role="menuitem"
            className="signout"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await signOut()
              setBusy(false)
              setOpen(false)
              navigate('/')
            }}
          >
            {busy ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  )
}
