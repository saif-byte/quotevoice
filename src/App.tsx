import { NavLink, Outlet, RouterProvider, createHashRouter, useParams } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'
import { HowItWorks } from './pages/HowItWorks'
import { NewQuote } from './pages/NewQuote'
import { QuoteView } from './pages/QuoteView'
import { Settings } from './pages/Settings'
import { SharedView } from './pages/SharedView'
import { StoreProvider } from './store'

/** Each quote being edited gets its own fresh screen, so state never leaks between quotes. */
function EditQuote() {
  const { id } = useParams()
  return <NewQuote key={`edit-${id}`} />
}

// Hash URLs (#/path) work on GitHub Pages, which can't rewrite URLs to index.html.
// A "data router" is used so the quote screen can warn before unsaved work is lost.
const router = createHashRouter([
  { path: '/view/:data', element: <SharedView /> },
  {
    element: <Shell />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/new', element: <NewQuote key="new" /> },
      { path: '/quotes/:id', element: <QuoteView /> },
      { path: '/quotes/:id/edit', element: <EditQuote /> },
      { path: '/settings', element: <Settings /> },
      { path: '/how', element: <HowItWorks /> },
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
]

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
        </nav>
      </header>
      <main id="main">
        <Outlet />
      </main>
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
