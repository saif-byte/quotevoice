import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DemoVideo } from '../components/DemoVideo'
import { WeeklyChart } from '../components/WeeklyChart'
import { computeMetrics, editStats, weeklySent } from '../lib/metrics'
import { formatMoney, totals } from '../lib/pricing'
import { eventsFrom } from '../lib/notifications'
import { STATUS_LABEL, formatMinutes, shortDate, timeAgo } from '../lib/quoteHelpers'
import type { QuoteStatus } from '../lib/types'
import { useStore } from '../store'

export function Dashboard() {
  const { quotes, settings, saveQuote, loadSamples, clearSamples, user, notificationsSeenAt, markNotificationsSeen } = useStore()
  const navigate = useNavigate()
  const tax = settings.rates.taxPct
  const m = useMemo(() => computeMetrics(quotes, tax), [quotes, tax])
  const weeks = useMemo(() => weeklySent(quotes, tax), [quotes, tax])
  const hasSamples = quotes.some((q) => q.isSample)
  const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`)

  if (quotes.length === 0) {
    return (
      <div className="page">
        <div className="hero-empty">
          <h1>Quote the job before you leave the driveway.</h1>
          <p>
            Talk through the walkthrough, check what was heard, and send an itemized estimate priced with your own rates. Most
            quotes take under three minutes.
          </p>
          <div className="hero-actions">
            <Link className="btn primary big" to="/new">
              Record your first quote
            </Link>
            <button className="btn big" onClick={loadSamples}>
              Explore with sample data
            </button>
          </div>
        </div>
        <DemoVideo className="hero-video" />
      </div>
    )
  }

  const openQuotes = quotes.filter((q) => q.status === 'sent')
  // The painter's numbers: money, not software metrics.
  const kpis: { label: string; value: string; note: string }[] = [
    { label: 'Waiting on an answer', value: formatMoney(m.openValue), note: `${openQuotes.length} open quote${openQuotes.length === 1 ? '' : 's'}` },
    { label: 'Won', value: formatMoney(m.wonValue), note: m.decided ? `You won ${pct(m.winRate)} of ${m.decided} decided quotes` : 'No answers yet' },
    { label: 'Quotes sent', value: String(m.sentCount), note: m.draftCount ? `${m.draftCount} draft${m.draftCount > 1 ? 's' : ''} not finished` : 'No unfinished drafts' },
  ]
  const newlyAccepted = user
    ? eventsFrom(quotes, tax).filter((e) => e.kind === 'accepted' && (!notificationsSeenAt || e.at > notificationsSeenAt))
    : []
  const DAY = 86400000
  const followUps = openQuotes
    .map((q) => ({ q, days: Math.floor((Date.now() - new Date(q.finalizedAt ?? q.createdAt).getTime()) / DAY) }))
    .filter((x) => x.days >= 3)
    // Opened-but-not-accepted first: they're interested. Then oldest first.
    .sort((a, b) => Number(Boolean(b.q.firstViewedAt)) - Number(Boolean(a.q.firstViewedAt)) || b.days - a.days)
    .slice(0, 5)
  const quality = [
    { label: 'Time to quote', value: formatMinutes(m.medianMinutes), note: 'Typical time from first word to finished quote', target: 'Goal: under 3 min' },
    { label: 'Lines kept as heard', value: pct(m.editFreeRate), note: 'Line items you sent without changing', target: 'Goal: 80% or more' },
    { label: 'Totals you adjusted', value: pct(m.overrideRate), note: 'Quotes where you moved the first draft by over 10%', target: 'Goal: under 20%' },
  ]

  return (
    <div className="page">
      <div className="page-head">
        <h1>Dashboard</h1>
        <Link className="btn primary" to="/new">
          New quote
        </Link>
      </div>

      {!settings.business.name && (
        <div className="callout warn">
          Your quotes don't show a business name yet. <Link to="/settings">Add your business details</Link> before sending
          quotes to customers.
        </div>
      )}

      {hasSamples && (
        <div className="callout sample-banner">
          You're looking at sample quotes made from example voice notes.
          <button className="link-btn" onClick={clearSamples}>
            Clear sample data
          </button>
        </div>
      )}

      {newlyAccepted.length > 0 && (
        <section className="won-card" aria-label="Newly accepted quotes">
          <div className="won-head">
            <h2>
              {newlyAccepted.length === 1 ? 'A customer accepted your quote' : `${newlyAccepted.length} customers accepted your quotes`}
            </h2>
            <button className="link-btn" onClick={markNotificationsSeen}>
              Mark as seen
            </button>
          </div>
          <ul>
            {newlyAccepted.map((e) => (
              <li key={e.id}>
                <Link to={`/quotes/${e.quoteId}`}>
                  <strong>{e.customer}</strong> accepted {e.number} for {formatMoney(e.total)}
                </Link>
                <span className="muted small"> {timeAgo(e.at)}. Call to schedule the job.</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="kpis" aria-label="Key numbers">
        {kpis.map((k) => (
          <div className="kpi" key={k.label}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
            <div className="kpi-note">{k.note}</div>
          </div>
        ))}
      </section>

      {followUps.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            <h2>Time to follow up</h2>
            <span className="muted small">Open quotes finished 3+ days ago; opened ones are warmest</span>
          </div>
          <ul className="follow-ups">
            {followUps.map(({ q, days }) => (
              <li key={q.id}>
                <Link to={`/quotes/${q.id}`}>
                  <span className="fu-name">{q.job.customerName || q.number}</span>
                  <span className="fu-meta">
                    {q.number} · finished {days} days ago ·{' '}
                    {q.firstViewedAt ? (
                      <span className="fu-opened">opened {timeAgo(q.lastViewedAt ?? q.firstViewedAt)}</span>
                    ) : q.shareToken && user ? (
                      <span className="fu-unopened">not opened yet</span>
                    ) : q.sentAt ? (
                      `sent ${timeAgo(q.sentAt)}`
                    ) : (
                      <span className="fu-unopened">not sent from the app</span>
                    )}
                  </span>
                  <span className="fu-total">{formatMoney(totals(q.lineItems, tax, q.discount).total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2>Value of quotes sent per week</h2>
          <span className="muted small">Last 8 weeks</span>
        </div>
        <WeeklyChart weeks={weeks} />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>All quotes</h2>
          <span className="muted small">{quotes.length} total</span>
        </div>
        <div className="table-wrap">
          <table className="quotes">
            <thead>
              <tr>
                <th>Quote</th>
                <th>Customer</th>
                <th className="hide-sm">Rooms</th>
                <th className="num">Total</th>
                <th className="hide-sm">Lines kept</th>
                <th className="hide-sm">Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const s = editStats(q)
                return (
                  <tr key={q.id} onClick={() => navigate(`/quotes/${q.id}`)} className="clickable">
                    <td>
                      <Link to={`/quotes/${q.id}`} onClick={(e) => e.stopPropagation()}>
                        {q.number}
                      </Link>
                    </td>
                    <td>{q.job.customerName || <span className="muted">No name</span>}</td>
                    <td className="hide-sm">{q.job.rooms.length}</td>
                    <td className="num">{formatMoney(totals(q.lineItems, tax, q.discount).total)}</td>
                    <td className="hide-sm">
                      {s.unchanged}/{s.total}
                    </td>
                    <td className="hide-sm">{shortDate(q.finalizedAt ?? q.createdAt)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select
                        className={`pill-select ${q.status}`}
                        value={q.status}
                        aria-label={`Status of ${q.number}`}
                        onChange={(e) => {
                          const status = e.target.value as QuoteStatus
                          saveQuote({
                            ...q,
                            status,
                            finalizedAt: status === 'draft' ? undefined : (q.finalizedAt ?? new Date().toISOString()),
                            decidedAt: status === 'won' || status === 'lost' ? new Date().toISOString() : undefined,
                          })
                        }}
                      >
                        {(Object.keys(STATUS_LABEL) as QuoteStatus[]).map((st) => (
                          <option key={st} value={st}>
                            {STATUS_LABEL[st]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel quality" aria-label="Note reading quality">
        <div className="panel-head">
          <h2>How well your notes are being read</h2>
          <span className="muted small">Helps tune the app, not your business</span>
        </div>
        <div className="quality-grid">
          {quality.map((k) => (
            <div key={k.label}>
              <div className="kpi-label">{k.label}</div>
              <div className="q-value">{k.value}</div>
              <div className="kpi-note">{k.note}</div>
              <div className="kpi-target">{k.target}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
