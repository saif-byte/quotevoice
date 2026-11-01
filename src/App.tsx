import { NavLink, Outlet, RouterProvider, createHashRouter, useParams } from 'react-router-dom'
import { AccountMenu } from './components/AccountMenu'
import { Onboarding } from './components/Onboarding'
import { LiveAlerts, NotificationBell } from './components/Notifications'
import { Account } from './pages/Account'
import { Dashboard } from './pages/Dashboard'
import { HowItWorks } from './pages/HowItWorks'
import { Recruiters } from './pages/Recruiters'
import { CONTACT, isDemoEmail } from './lib/demo'
import { NewQuote } from './pages/NewQuote'
import { QuoteView } from './pages/QuoteView'
import { Settings } from './pages/Settings'
import { PublicQuote } from './pages/PublicQuote'
import { SharedView } from './pages/SharedView'
import { StoreProvider, useStore } from './store'

/** Each quote being edited gets its own fresh screen, so state never leaks between quotes. */
function EditQuote() {
  const { id } = useParams()
  return <NewQuote key={`edit-${id}`} />
}

// Hash URLs (#/path) work on GitHub Pages, which can't rewrite URLs to index.html.
// A "data router" is used so the quote screen can warn before unsaved work is lost.
const router = createHashRouter([
  { path: '/view/:data', element: <SharedView /> },
  { path: '/q/:token', element: <PublicQuote /> },
  {
    element: <Shell />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/new', element: <NewQuote key="new" /> },
      { path: '/quotes/:id', element: <QuoteView /> },
      { path: '/quotes/:id/edit', element: <EditQuote /> },
      { path: '/settings', element: <Settings /> },
      { path: '/how', element: <HowItWorks /> },
      { path: '/recruiters', element: <Recruiters /> },
      { path: '/account', element: <Account /> },
      { path: '*', element: <Dashboard /> },
    ],
  },
])

export default function App() {
  return (
    <StoreProvider>
      <RouterProvider router={router} />
    </StoreProvider>
  )
}

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/new', label: 'New quote', end: false },
  { to: '/how', label: 'How it works', end: false },
  { to: '/settings', label: 'Settings', end: false },
  { to: '/recruiters', label: 'For recruiters', end: false },
]

function AccountLink() {
  // Signed out: a "Sign in" link. Signed in: the account menu on the right takes over.
  const { cloudEnabled, user, authReady } = useStore()
  if (!cloudEnabled || !authReady || user) return null
  return (
    <NavLink to="/account" className={({ isActive }) => `account-link ${isActive ? 'active' : ''}`}>
      Sign in
    </NavLink>
  )
}

function DemoBanner() {
  // Shown while someone is inside the shared recruiter demo account.
  const { user } = useStore()
  if (!isDemoEmail(user?.email)) return null
  return (
    <div className="demo-banner" role="status">
      <span>
        <b>You're in the demo account.</b> Try anything: it resets itself 30 minutes after the last change.
      </span>
      <span>
        Built by {CONTACT.name} · <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> ·{' '}
        <NavLink to="/recruiters">Recruiter page</NavLink>
      </span>
    </div>
  )
}

function DeviceQuotesBanner() {
  const { deviceQuotes, importDeviceQuotes, dismissDeviceQuotes } = useStore()
  if (deviceQuotes.length === 0) return null
  const n = deviceQuotes.length
  return (
    <div className="callout device-banner" role="status">
      {n} quote{n > 1 ? 's' : ''} saved on this device {n > 1 ? "aren't" : "isn't"} in your account yet.
      <button className="btn primary" onClick={importDeviceQuotes}>
        Add {n > 1 ? 'them' : 'it'} to my account
      </button>
      <button className="link-btn" onClick={dismissDeviceQuotes}>
        Not now
      </button>
    </div>
  )
}

function Shell() {
  return (
    <div className="app">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="topbar no-print">
        <NavLink to="/" className="brand" aria-label="QuoteVoice home">
          <Logo />
          <span>QuoteVoice</span>
        </NavLink>
        <nav aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {n.label}
            </NavLink>
          ))}
          <AccountLink />
        </nav>
        <div className="top-actions">
          <NotificationBell />
          <AccountMenu />
        </div>
      </header>
      <main id="main">
        <DemoBanner />
        <DeviceQuotesBanner />
        <Outlet />
      </main>
      <LiveAlerts />
      <Onboarding />
    </div>
  )
}

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="var(--ink)" />
      <rect x="5" y="9" width="22" height="7" rx="2" fill="var(--tape)" transform="rotate(-8 16 12)" />
      <path d="M9 21h14M9 25h9" stroke="var(--primer)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}
