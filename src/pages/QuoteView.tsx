import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { QuoteDocument } from '../components/QuoteDocument'
import { SendPanel } from '../components/SendPanel'
import { editStats, minutesToQuote, wasOverridden } from '../lib/metrics'
import { describeDiscount, formatMoney, totals } from '../lib/pricing'
import { STATUS_LABEL, formatMinutes, timeAgo, toShared } from '../lib/quoteHelpers'
import { shareUrl } from '../lib/share'
import type { QuoteStatus } from '../lib/types'
import { useStore } from '../store'

export function QuoteView() {
  const { id } = useParams()
  const { quotes, settings, saveQuote, deleteQuote, user, sync } = useStore()
  const navigate = useNavigate()
  const [justFinished, setJustFinished] = useState(false)
  const q = quotes.find((x) => x.id === id)

  if (!q) {
    return (
      <div className="page narrow">
        <div className="empty">
          <h1>Quote not found</h1>
          <p>It may have been deleted, or it was created on another device.</p>
          <Link className="btn primary" to="/">
            Go to dashboard
          </Link>
        </div>
      </div>
    )
  }

  const shared = toShared(q, settings)
  const shareToken = q.shareToken
  const stats = editStats(q)
  const aiTotal = totals(q.aiLineItems, settings.rates.taxPct).total
  const final = totals(q.lineItems, settings.rates.taxPct, q.discount)

  const setStatus = (status: QuoteStatus) =>
    saveQuote({
      ...q,
      status,
      finalizedAt: status === 'draft' ? undefined : (q.finalizedAt ?? new Date().toISOString()),
      decidedAt: status === 'won' || status === 'lost' ? new Date().toISOString() : undefined,
    })

  // Signed in: a short link served from the database, with Accept and view tracking.
  // Not signed in: the whole quote packed into a long link.
  const shortLink = Boolean(user && shareToken)
  const link = shortLink ? `${window.location.href.split('#')[0].split('?')[0]}#/q/${shareToken}` : shareUrl(shared)

  return (
    <div className="page">
      <div className="page-head no-print">
        <div>
          <Link to="/" className="back">
            Dashboard
          </Link>
          <h1>
            {q.number} <span className={`pill ${q.status}`}>{STATUS_LABEL[q.status]}</span>
          </h1>
        </div>
        <div className="head-actions">
          {q.status === 'draft' ? (
            <button
              className="btn primary"
              onClick={() => {
                setStatus('sent')
                setJustFinished(true)
              }}
              disabled={final.total <= 0}
            >
              Finish quote
            </button>
          ) : (
            <button className="btn" onClick={() => window.print()}>
              Print or save PDF
            </button>
          )}
        </div>
      </div>

      {!settings.business.name && (
        <div className="callout warn no-print">
          This quote has no business name yet. <Link to="/settings">Add your business details</Link> before sending it.
        </div>
      )}

      {q.acceptedAt && (
        <div className="callout accepted no-print" role="status">
          <strong>Accepted online</strong> by {q.acceptedName} on{' '}
          {new Date(q.acceptedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
        </div>
      )}

      {q.status !== 'draft' && (
        <SendPanel
          key={`${q.id}-${shortLink}-${justFinished}`}
          quote={q}
          link={link}
          total={final.total}
          businessName={settings.business.name}
          canAcceptOnline={shortLink}
          signedIn={Boolean(user)}
          syncError={sync === 'error'}
          onSent={(via, contact) =>
            saveQuote({
              ...q,
              sentAt: new Date().toISOString(),
              sentVia: via,
              job: { ...q.job, customerPhone: contact.phone, customerEmail: contact.email },
            })
          }
        />
      )}

      <div className="quote-layout">
        <QuoteDocument q={shared} />

        <aside className="side no-print">
          {q.status !== 'draft' && (
            <section className="side-block">
              <h2>Outcome</h2>
              <div className="seg">
                {(['sent', 'won', 'lost'] as const).map((s) => (
                  <button key={s} className={q.status === s ? 'on' : ''} onClick={() => setStatus(s)} aria-pressed={q.status === s}>
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </section>
          )}

          {q.status !== 'draft' && (
            <section className="side-block">
              <h2>Delivery</h2>
              <ul className="delivery">
                <li className={q.sentAt ? 'done' : ''}>
                  {q.sentAt ? `Sent ${timeAgo(q.sentAt)}${q.sentVia && q.sentVia !== 'copy' ? ` by ${q.sentVia}` : ''}` : 'Not sent from the app yet'}
                </li>
                {shortLink && (
                  <li className={q.firstViewedAt ? 'done' : ''}>
                    {q.firstViewedAt
                      ? `Opened by customer ${timeAgo(q.lastViewedAt ?? q.firstViewedAt)}${q.viewCount && q.viewCount > 1 ? ` (${q.viewCount} views)` : ''}`
                      : 'Not opened yet'}
                  </li>
                )}
                {shortLink && <li className={q.acceptedAt ? 'done' : ''}>{q.acceptedAt ? `Accepted ${timeAgo(q.acceptedAt)}` : 'Not accepted yet'}</li>}
              </ul>
            </section>
          )}

          <section className="side-block">
            <h2>Summary</h2>
            <dl className="facts">
              <dt>Subtotal</dt>
              <dd>{formatMoney(final.subtotal)}</dd>
              {final.discount > 0 && q.discount && (
                <>
                  <dt>Discount given</dt>
                  <dd>
                    −{formatMoney(final.discount)}
                    <span className="flag-quiet">{describeDiscount(q.discount).replace(/^Discount /, '')}</span>
                  </dd>
                </>
              )}
              <dt>Total</dt>
              <dd>{formatMoney(final.total)}</dd>
              <dt>Time to quote</dt>
              <dd>{formatMinutes(minutesToQuote(q))}</dd>
            </dl>
            <details className="ai-check">
              <summary>How the note was read</summary>
              <dl className="facts">
                <dt>Read by</dt>
                <dd>{q.extractor === 'gemini' ? 'AI (Gemini)' : 'Built-in reader'}</dd>
                <dt>Lines you kept unchanged</dt>
                <dd>
                  {stats.unchanged} of {stats.total}
                </dd>
                <dt>First draft total</dt>
                <dd>
                  {formatMoney(aiTotal)}
                  {wasOverridden(q, settings.rates.taxPct) && <span className="flag-quiet">You adjusted it by over 10%</span>}
                </dd>
              </dl>
            </details>
          </section>

          {q.job.assumptions.length > 0 && (
            <section className="side-block">
              <h2>Filled in by the system</h2>
              <ul className="small-list">
                {q.job.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="side-block">
            <h2>Original note</h2>
            <blockquote className="transcript">{q.transcript}</blockquote>
          </section>

          <section className="side-block row-actions">
            <Link className="btn ghost" to={`/quotes/${q.id}/edit`}>
              Edit quote
            </Link>
            <button
              className="btn ghost danger"
              onClick={() => {
                if (window.confirm(`Delete ${q.number}? This can't be undone.`)) {
                  deleteQuote(q.id)
                  navigate('/')
                }
              }}
            >
              Delete
            </button>
          </section>
        </aside>
      </div>
    </div>
  )
}
