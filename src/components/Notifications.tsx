import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { eventText, eventsFrom, unreadCount, type QuoteEvent } from '../lib/notifications'
import { timeAgo } from '../lib/quoteHelpers'
import { useStore } from '../store'

/** Bell in the top bar: unread count, recent accepts and opens, and device alerts. */
export function NotificationBell() {
  const { user, quotes, settings, notificationsSeenAt, markNotificationsSeen } = useStore()
  const [open, setOpen] = useState(false)
  const [seenWhenOpened, setSeenWhenOpened] = useState<string | null>(null)
  const [permission, setPermission] = useState(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission))
  const wrapRef = useRef<HTMLDivElement>(null)
  const events = useMemo(() => eventsFrom(quotes, settings.rates.taxPct), [quotes, settings.rates.taxPct])
  const unread = unreadCount(events, notificationsSeenAt)

  // "(2) QuoteVoice" in the browser tab, so a background tab still shows news.
  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) QuoteVoice` : 'QuoteVoice'
  }, [unread])

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

  const toggle = () => {
    if (!open) {
      setSeenWhenOpened(notificationsSeenAt) // keep today's news highlighted while the panel is open
      if (unread > 0) markNotificationsSeen()
    }
    setOpen(!open)
  }

  return (
    <div className="bell-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`bell ${unread > 0 ? 'has-unread' : ''}`}
        onClick={toggle}
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} new` : 'Notifications'}
      >
        <BellIcon />
        {unread > 0 && <span className="bell-count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="bell-panel" role="dialog" aria-label="Notifications">
          <div className="bell-head">
            <strong>Notifications</strong>
          </div>
          {events.length === 0 ? (
            <p className="bell-empty">
              When a customer opens or accepts a quote you sent with a short link, it shows up here.
            </p>
          ) : (
            <ul className="bell-list">
              {events.map((e) => {
                const { title, detail } = eventText(e)
                const isNew = !seenWhenOpened || e.at > seenWhenOpened
                return (
                  <li key={e.id} className={`${e.kind} ${isNew ? 'new' : ''}`}>
                    <Link to={`/quotes/${e.quoteId}`} onClick={() => setOpen(false)}>
                      <span className="ev-dot" aria-hidden="true" />
                      <span className="ev-text">
                        <span className="ev-title">{title}</span>
                        <span className="ev-detail">
                          {detail} · {timeAgo(e.at)}
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
          {permission === 'default' && (
            <button
              type="button"
              className="bell-permission"
              onClick={async () => setPermission(await Notification.requestPermission())}
            >
              Also alert me on this device when QuoteVoice is in the background
            </button>
          )}
          {permission === 'denied' && <p className="bell-note">Device alerts are blocked in this browser's settings.</p>}
        </div>
      )}
    </div>
  )
}

/** Live pop-ups the moment a customer accepts (stays until closed) or opens a quote (fades after a while). */
export function LiveAlerts() {
  const { alerts, dismissAlert } = useStore()
  const navigate = useNavigate()

  useEffect(() => {
    const timers = alerts.filter((a) => a.kind === 'opened').map((a) => window.setTimeout(() => dismissAlert(a.id), 10_000))
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [alerts, dismissAlert])

  if (alerts.length === 0) return null
  return (
    <div className="live-alerts" aria-live="polite">
      {alerts.map((a: QuoteEvent) => {
        const { title, detail } = eventText(a)
        return (
          <div key={a.id} className={`live-alert ${a.kind}`} role="status">
            <div className="la-text">
              <strong>{a.kind === 'accepted' ? `Quote accepted: ${title.replace(/ accepted .*/, '')}` : title}</strong>
              <span>{a.kind === 'accepted' ? `${a.number} · ${detail}` : detail}</span>
            </div>
            <div className="la-actions">
              <button
                className="btn"
                onClick={() => {
                  dismissAlert(a.id)
                  navigate(`/quotes/${a.quoteId}`)
                }}
              >
                View quote
              </button>
              <button className="icon-btn" aria-label="Dismiss" onClick={() => dismissAlert(a.id)}>
                ×
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
