import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DemoVideo } from '../components/DemoVideo'
import { CONTACT, DEMO_EMAIL, DEMO_PASSWORD, isDemoEmail } from '../lib/demo'
import { useStore } from '../store'

const BASE = import.meta.env.BASE_URL
const FILES = {
  mapPreview: `${BASE}recruiters/journey-map-preview.jpg`,
  mapPng: `${BASE}recruiters/QuoteVoice-Journey-Map.png`,
  mapPdf: `${BASE}recruiters/QuoteVoice-Journey-Map.pdf`,
  fullPdf: `${BASE}recruiters/QuoteVoice-Product-Journey.pdf`,
}

const FACTS = [
  { value: '~3 min', label: 'voice note to a quote ready to send' },
  { value: '97.4%', label: 'AI reading accuracy on notes it was never tuned on' },
  { value: '17 / 17', label: 'attack checks blocked on the live database' },
  { value: '$0', label: 'a month to run, on free tiers by design' },
]

const TOUR = [
  ['Dashboard', 'money waiting on answers, wins, and a fresh "quote accepted" in the bell.'],
  ['New quote → pick a sample note → Build quote', 'watch a voice note become rooms, with every guess flagged.'],
  ['Price this job', 'every line comes from the rate card; try adding a discount.'],
  ["Open Tina Ruiz's quote → Copy customer link", 'open it in a private window and accept it as the homeowner. The dashboard updates live.'],
]

/** A page for recruiters and hiring managers: who built it, how to try it, and the whole journey. */
export function Recruiters() {
  const { user, signIn, signOut, cloudEnabled } = useStore()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const inDemo = isDemoEmail(user?.email)
  const otherAccount = user && !inDemo ? user.email : null

  const openDemo = async () => {
    if (inDemo) {
      navigate('/')
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (otherAccount) await signOut()
      await signIn(DEMO_EMAIL, DEMO_PASSWORD)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the demo account. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT.email)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked: the address is visible on the page anyway */
    }
  }

  return (
    <div className="page recruiters">
      <section className="rec-hero">
        <p className="rec-kicker">For recruiters &amp; hiring managers</p>
        <h1>QuoteVoice, built end to end by {CONTACT.name}.</h1>
        <p className="rec-lede">
          A voice-to-quote AI product for house painters: from a problem found on Reddit, through validation, scope,
          architecture, security and testing, to a live app anyone can try. Every decision is written down below.
        </p>
        <div className="rec-contact">
          <a className="btn primary big" href={`mailto:${CONTACT.email}?subject=${encodeURI('About QuoteVoice')}`}>
            ✉ Email {CONTACT.name.split(' ')[0]}
          </a>
          <button type="button" className="btn big rec-email" onClick={copyEmail} aria-label={`Copy email address ${CONTACT.email}`}>
            {CONTACT.email} <span className="rec-copy">{copied ? 'Copied ✓' : 'Copy'}</span>
          </button>
          <a className="btn big" href={CONTACT.repo} target="_blank" rel="noreferrer">
            Code on GitHub ↗
          </a>
        </div>
      </section>

      <section className="rec-facts" aria-label="Key numbers">
        {FACTS.map((f) => (
          <div key={f.value} className="rec-fact">
            <strong>{f.value}</strong>
            <span>{f.label}</span>
          </div>
        ))}
      </section>

      <section className="rec-demo panel">
        <div>
          <h2>Try it yourself in 2 minutes</h2>
          <p className="muted">
            A shared demo painter account with realistic quotes. Change anything you like: it resets itself 30 minutes after
            the last change.
          </p>
          <div className="rec-demo-actions">
            {cloudEnabled ? (
              <button type="button" className="btn primary big" onClick={openDemo} disabled={busy}>
                {busy ? 'Opening the demo…' : inDemo ? "You're in the demo: go to the dashboard" : '▶ Try the demo account'}
              </button>
            ) : (
              <p className="muted">Accounts aren't available in this copy of the app.</p>
            )}
            {otherAccount && !busy && <p className="small muted">This signs you out of {otherAccount} first.</p>}
          </div>
          {error && (
            <p className="callout warn" role="alert">
              {error}
            </p>
          )}
          <dl className="rec-creds">
            <dt>Email</dt>
            <dd className="mono">{DEMO_EMAIL}</dd>
            <dt>Password</dt>
            <dd className="mono">{DEMO_PASSWORD}</dd>
          </dl>
        </div>
        <div>
          <h3>Suggested tour</h3>
          <ol className="rec-tour">
            {TOUR.map(([what, why]) => (
              <li key={what}>
                <b>{what}:</b> {why}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="rec-map">
        <div className="rec-section-head">
          <div>
            <h2>The whole journey at a glance</h2>
            <p className="muted">
              Ten stages, from problem discovery to shipping: what I did, the key decision, tools, output and one number of
              proof for each, plus why this tech stack and how it's kept secure.
            </p>
          </div>
          <div className="rec-downloads">
            <a className="btn" href={FILES.mapPdf} target="_blank" rel="noreferrer">
              Journey map (PDF)
            </a>
            <a className="btn primary" href={FILES.fullPdf} target="_blank" rel="noreferrer">
              Full case study (15-page PDF)
            </a>
          </div>
        </div>
        <a className="rec-map-img" href={FILES.mapPng} target="_blank" rel="noreferrer" aria-label="Open the journey map full size">
          <img
            src={FILES.mapPreview}
            alt="QuoteVoice product journey map: ten stages (discover, validate, scope, prioritize, architect, database, quality, add features, user test, ship), why this tech stack, and how it's kept secure"
            loading="lazy"
            width={1600}
            height={1413}
          />
          <span className="rec-zoom">Open full size ↗</span>
        </a>
      </section>

      <section className="rec-video">
        <h2>The product in one minute</h2>
        <DemoVideo />
      </section>

      <section className="rec-cta panel">
        <div>
          <h2>Let's talk</h2>
          <p className="muted">
            I'm {CONTACT.name}. I build AI products end to end: finding the problem, deciding what not to build, and
            shipping something people can use and trust.
          </p>
        </div>
        <a className="btn primary big" href={`mailto:${CONTACT.email}?subject=${encodeURI('About QuoteVoice')}`}>
          {CONTACT.email}
        </a>
      </section>
    </div>
  )
}
