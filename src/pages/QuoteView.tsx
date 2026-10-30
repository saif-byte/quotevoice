import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { QuoteDocument } from '../components/QuoteDocument'
import { editStats, minutesToQuote, wasOverridden } from '../lib/metrics'
import { describeDiscount, formatMoney, totals } from '../lib/pricing'
import { STATUS_LABEL, formatMinutes, toShared } from '../lib/quoteHelpers'
import { shareUrl } from '../lib/share'
import type { QuoteStatus } from '../lib/types'
import { useStore } from '../store'

export function QuoteView() {
  const { id } = useParams()
  const { quotes, settings, saveQuote, deleteQuote } = useStore()
  const navigate = useNavigate()
  const [copied, setCopied] = useState<'copied' | 'manual' | null>(null)
  const [link, setLink] = useState<string | null>(null)
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

  // Always show the link on screen; copying to the clipboard is a bonus that some browsers block.
  async function copyLink() {
    const url = shareUrl(shared)
    setLink(url)
    let ok = false
    try {
      await Promise.race([
        navigator.clipboard.writeText(url).then(() => (ok = true)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500)),
      ])
    } catch {
      ok = false
    }
    setCopied(ok ? 'copied' : 'manual')
  }

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
            <button className="btn primary" onClick={() => setStatus('sent')} disabled={final.total <= 0}>
              Finish quote
            </button>
          ) : (
            <>
              <button className="btn primary" onClick={copyLink}>
                {copied === 'copied' ? 'Link copied' : 'Copy customer link'}
              </button>
              <button className="btn" onClick={() => window.print()}>
                Print or save PDF
              </button>
            </>
          )}
        </div>
      </div>

      {!settings.business.name && (
        <div className="callout warn no-print">
          This quote has no business name yet. <Link to="/settings">Add your business details</Link> before sending it.
        </div>
      )}

      {link && (
        <div className={`callout share-box no-print ${copied === 'copied' ? 'ok' : ''}`} role="status">
          <strong>
            {copied === 'copied'
              ? 'Link copied. Paste it into a text or email to your customer.'
              : "Your browser didn't allow copying. Select the link below and copy it."}
          </strong>
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Customer link" />
          <a href={link} target="_blank" rel="noreferrer" className="small">
            Preview what the customer sees
          </a>
        </div>
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
