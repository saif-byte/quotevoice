import { useState } from 'react'
import { Link } from 'react-router-dom'
import { buildMessage, formatPhone, isValidEmail, isValidPhone, mailtoHref, smsHref } from '../lib/send'
import type { Quote } from '../lib/types'

type Via = NonNullable<Quote['sentVia']>

interface Props {
  quote: Quote
  link: string
  total: number
  businessName: string
  canAcceptOnline: boolean
  signedIn: boolean
  syncError: boolean
  onSent: (via: Via, contact: { phone: string; email: string }) => void
}

/**
 * Sends the quote from the painter's own phone: opens Messages, Mail or the share
 * sheet with the message filled in. No paid SMS/email service, nothing to set up.
 */
export function SendPanel(props: Props) {
  const { quote } = props
  const [phone, setPhone] = useState(quote.job.customerPhone ? formatPhone(quote.job.customerPhone) : '')
  const [email, setEmail] = useState(quote.job.customerEmail ?? '')
  const [message, setMessage] = useState(() =>
    buildMessage({
      customerName: quote.job.customerName,
      businessName: props.businessName,
      link: props.link,
      total: props.total,
      canAcceptOnline: props.canAcceptOnline,
    }),
  )
  const [copied, setCopied] = useState<'copied' | 'manual' | null>(null)
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const phoneOk = isValidPhone(phone)
  const emailOk = isValidEmail(email)
  const subject = `Your painting estimate ${quote.number}${props.businessName ? ` from ${props.businessName}` : ''}`
  const contact = { phone: phoneOk ? formatPhone(phone) : phone, email: email.trim() }

  async function copy() {
    let ok = false
    try {
      await Promise.race([
        navigator.clipboard.writeText(message).then(() => (ok = true)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500)),
      ])
    } catch {
      ok = false
    }
    setCopied(ok ? 'copied' : 'manual')
    if (ok) props.onSent('copy', contact)
  }

  async function share() {
    try {
      await navigator.share({ title: subject, text: message })
      props.onSent('share', contact)
    } catch {
      /* the painter closed the share sheet */
    }
  }

  return (
    <section className="send no-print" aria-labelledby="send-title">
      <div className="send-head">
        <h2 id="send-title">Send to customer</h2>
        {quote.sentAt && (
          <span className="small muted">
            Last sent {new Date(quote.sentAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} by{' '}
            {quote.sentVia === 'copy' ? 'copied message' : quote.sentVia}
          </span>
        )}
      </div>

      <div className="grid2">
        <label className="field">
          <span>Customer mobile</span>
          <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
        </label>
        <label className="field">
          <span>Customer email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        </label>
      </div>

      <label className="field">
        <span>Message</span>
        <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>

      <div className="send-actions">
        <a
          className={`btn primary ${phoneOk ? '' : 'disabled'}`}
          href={phoneOk ? smsHref(phone, message) : undefined}
          aria-disabled={!phoneOk}
          onClick={(e) => (phoneOk ? props.onSent('text', contact) : e.preventDefault())}
        >
          Text it
        </a>
        <a
          className={`btn ${emailOk ? '' : 'disabled'}`}
          href={emailOk ? mailtoHref(email, subject, message) : undefined}
          aria-disabled={!emailOk}
          onClick={(e) => (emailOk ? props.onSent('email', contact) : e.preventDefault())}
        >
          Email it
        </a>
        {canShare && (
          <button type="button" className="btn" onClick={share}>
            Share…
          </button>
        )}
        <button type="button" className="btn ghost" onClick={copy}>
          {copied === 'copied' ? 'Message copied' : 'Copy message'}
        </button>
      </div>

      <p className="small muted">
        {!phoneOk && !emailOk
          ? 'Add a mobile number or email to send. '
          : 'Opens your Messages or Mail app with everything filled in, so you just tap send. '}
        Texting works best from your phone.
      </p>

      {copied === 'manual' && (
        <div className="callout warn">
          Your browser didn't allow copying. Select the link and copy it:
          <input className="copy-field" readOnly value={props.link} onFocus={(e) => e.currentTarget.select()} aria-label="Customer link" />
        </div>
      )}

      {props.signedIn && props.syncError && (
        <p className="small warn-text">This quote hasn't synced yet, so the link won't open for the customer until it does.</p>
      )}
      {!props.signedIn && (
        <p className="small muted">
          The link is long because the whole quote is inside it. <Link to="/account">Sign in</Link> to send a short link your
          customer can accept online and to see when they open it.
        </p>
      )}

      <a href={props.signedIn ? `${props.link}?preview=1` : props.link} target="_blank" rel="noreferrer" className="small">
        Preview what the customer sees
      </a>
    </section>
  )
}
