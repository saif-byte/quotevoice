import { useEffect, useState, type FormEvent } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { QuoteDocument } from '../components/QuoteDocument'
import { acceptSharedQuote, fetchSharedQuote, markQuoteViewed, type PublicQuote as PublicQuoteData } from '../lib/cloud'
import { supabase } from '../lib/supabase'
import { formatMoney, totals } from '../lib/pricing'

/** What the homeowner sees from a short link (#/q/<code>): the estimate and an Accept button. */
export function PublicQuote() {
  const { token = '' } = useParams()
  const [search] = useSearchParams()
  const isPreview = search.get('preview') === '1'
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [data, setData] = useState<PublicQuoteData | null>(null)
  const [name, setName] = useState('')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchSharedQuote(token)
      .then(async (d) => {
        if (cancelled) return
        setData(d)
        setState(d ? 'ready' : 'missing')
        // Count the homeowner's visit, but not the painter checking their own link.
        const painterSignedIn = Boolean((await supabase?.auth.getSession())?.data.session)
        if (d && !isPreview && !painterSignedIn) void markQuoteViewed(token)
      })
      .catch(() => !cancelled && setState('error'))
    return () => {
      cancelled = true
    }
  }, [token, isPreview])

  if (state === 'loading') {
    return (
      <div className="shared">
        <p className="muted">Loading your estimate…</p>
      </div>
    )
  }
  if (state !== 'ready' || !data) {
    return (
      <div className="shared">
        <div className="empty">
          <h1>{state === 'missing' ? "This estimate isn't available" : "We couldn't load this estimate"}</h1>
          <p>
            {state === 'missing'
              ? 'The link may be incomplete, or the estimate was withdrawn. Ask your painter to send it again.'
              : 'Check your internet connection and reload the page.'}
          </p>
        </div>
      </div>
    )
  }

  const q = data.quote
  const total = totals(q.lineItems, q.taxPct, q.discount).total
  const accepted = Boolean(data.acceptedAt)

  async function accept(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await acceptSharedQuote(token, name)
      setData((d) => (d ? { ...d, status: 'won', acceptedName: res.acceptedName, acceptedAt: res.acceptedAt } : d))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="shared">
      {isPreview && <div className="callout no-print">Preview: this is what your customer sees. Opening it here isn't counted as a view.</div>}
      {accepted && (
        <div className="callout accepted" role="status">
          <strong>Accepted</strong> by {data.acceptedName} on{' '}
          {new Date(data.acceptedAt!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.{' '}
          {q.business.name || 'Your painter'} has been notified in their dashboard.
        </div>
      )}

      <QuoteDocument q={q} />

      {!accepted && data.status === 'sent' && (
        <form className="accept no-print" onSubmit={accept}>
          <h2>Accept this estimate</h2>
          <p className="small">
            Type your name to accept the work described above for {formatMoney(total)}. {q.business.name || 'Your painter'} will
            contact you to schedule.
          </p>
          <label className="field">
            <span>Your full name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} maxLength={120} />
          </label>
          <label className="check">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} required />I accept this estimate
            and its terms.
          </label>
          {error && <div className="callout warn" role="alert">{error}</div>}
          <button className="btn primary big" type="submit" disabled={busy || !agree || name.trim().length < 2}>
            {busy ? 'Accepting…' : `Accept estimate (${formatMoney(total)})`}
          </button>
        </form>
      )}

      {!accepted && data.status !== 'sent' && (
        <div className="callout no-print">This estimate is no longer open for acceptance. Contact your painter with any questions.</div>
      )}

      <div className="shared-actions no-print">
        <button className="btn" onClick={() => window.print()}>
          Print or save PDF
        </button>
        <span className="muted small">Made with QuoteVoice</span>
      </div>
    </div>
  )
}
