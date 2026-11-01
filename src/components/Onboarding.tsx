import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { normalizeJob } from '../lib/normalize'
import { formatMoney, priceJob, totals } from '../lib/pricing'
import type { BusinessInfo, RateCard } from '../lib/types'
import { useStore } from '../store'

/**
 * First-sign-in walkthrough. It sets things up for real as it goes (business details and
 * prices are saved to the account), then hands the painter straight to their first quote.
 * Shows once per account; it can be reopened from the account menu ("Setup guide").
 */

const STEPS = ['Welcome', 'Your business', 'Your prices', 'Recording', 'Sending', 'Ready'] as const

const RATE_FIELDS: { key: keyof RateCard; label: string; unit: string; step: number }[] = [
  { key: 'wallPerSqFt', label: 'Walls', unit: '$ / sq ft', step: 0.05 },
  { key: 'ceilingPerSqFt', label: 'Ceilings', unit: '$ / sq ft', step: 0.05 },
  { key: 'trimPerLinFt', label: 'Baseboards & trim', unit: '$ / linear ft', step: 0.05 },
  { key: 'doorEach', label: 'Doors & frames', unit: '$ each', step: 1 },
  { key: 'minimumJob', label: 'Minimum job', unit: '$', step: 10 },
  { key: 'taxPct', label: 'Sales tax', unit: '%', step: 0.25 },
]

// One 12×14 ft bedroom, 8 ft ceilings, walls + ceiling + trim, one door: priced by the real engine.
const EXAMPLE_ROOM = normalizeJob({
  rooms: [{ name: 'Bedroom', type: 'bedroom', lengthFt: 14, widthFt: 12, heightFt: 8, walls: true, ceiling: true, trim: true, doors: 1, windows: 0, prep: 'none' }],
})

export function Onboarding() {
  const { showOnboarding, finishOnboarding, settings, updateSettings, user, loadSamples, quotes } = useStore()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [business, setBusiness] = useState<BusinessInfo>(settings.business)
  const [rates, setRates] = useState<RateCard>(settings.rates)
  const [alerts, setAlerts] = useState(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission))
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Fresh copy of the saved settings each time the guide opens.
  useEffect(() => {
    if (!showOnboarding) return
    setStep(0)
    setBusiness({ ...settings.business, email: settings.business.email || user?.email || '' })
    setRates(settings.rates)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOnboarding])

  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    if (showOnboarding && !d.open) d.showModal()
    if (!showOnboarding && d.open) d.close()
  }, [showOnboarding])

  // Move focus to the step title so keyboard and screen-reader users follow along.
  useEffect(() => {
    if (showOnboarding) headingRef.current?.focus()
  }, [step, showOnboarding])

  const example = useMemo(() => {
    const items = priceJob(EXAMPLE_ROOM, rates)
    return totals(items, 0).total
  }, [rates])

  if (!showOnboarding) return <dialog ref={dialogRef} className="onboarding" aria-hidden="true" />

  const nameMissing = business.name.trim().length === 0
  const saveAndNext = () => {
    if (step === 1 || step === 2) updateSettings({ ...settings, business: { ...business, name: business.name.trim() }, rates })
    setStep(step + 1)
  }
  const done = (to?: string, samples = false) => {
    finishOnboarding()
    if (samples) loadSamples()
    if (to) navigate(to)
  }
  const setRate = (key: keyof RateCard, v: string) => setRates({ ...rates, [key]: Math.max(0, Number(v) || 0) })

  return (
    <dialog
      ref={dialogRef}
      className="onboarding"
      aria-labelledby="onb-title"
      onCancel={(e) => {
        e.preventDefault() // Esc = "Skip for now", same as the button
        done()
      }}
    >
      <div className="onb-top">
        <ol className="onb-progress" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <li key={s} className={i < step ? 'done' : i === step ? 'current' : ''} aria-current={i === step ? 'step' : undefined}>
              <span className="sr-only">{s}</span>
            </li>
          ))}
        </ol>
        {step < STEPS.length - 1 && (
          <button type="button" className="link-btn onb-skip" onClick={() => done()}>
            Skip for now
          </button>
        )}
      </div>

      <div className="onb-body">
        {step === 0 && (
          <>
            <p className="onb-kicker">Welcome to QuoteVoice</p>
            <h2 id="onb-title" ref={headingRef} tabIndex={-1}>
              Let's get you ready to quote your first job.
            </h2>
            <p>Four quick steps, about two minutes. Everything you enter is saved to your account and can be changed later in Settings.</p>
            <ul className="onb-list">
              <li><b>Your business</b> so customers know who the quote is from</li>
              <li><b>Your prices</b> so every quote uses what you charge</li>
              <li><b>How to record</b> a walkthrough note that reads well</li>
              <li><b>Sending</b> and getting the job accepted online</li>
            </ul>
          </>
        )}

        {step === 1 && (
          <>
            <p className="onb-kicker">Step 1 of 4</p>
            <h2 id="onb-title" ref={headingRef} tabIndex={-1}>
              Who are the quotes from?
            </h2>
            <p>This goes at the top of every quote your customers see.</p>
            <div className="grid2">
              <label className="field">
                <span>Business name *</span>
                <input autoFocus value={business.name} maxLength={120} placeholder="e.g. Brightline Painting" onChange={(e) => setBusiness({ ...business, name: e.target.value })} />
              </label>
              <label className="field">
                <span>Phone</span>
                <input type="tel" value={business.phone} maxLength={40} placeholder="(555) 201-7788" onChange={(e) => setBusiness({ ...business, phone: e.target.value })} />
              </label>
              <label className="field">
                <span>Email</span>
                <input type="email" value={business.email} maxLength={254} onChange={(e) => setBusiness({ ...business, email: e.target.value })} />
              </label>
              <label className="field">
                <span>License number (optional)</span>
                <input value={business.license} maxLength={80} onChange={(e) => setBusiness({ ...business, license: e.target.value })} />
              </label>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="onb-kicker">Step 2 of 4</p>
            <h2 id="onb-title" ref={headingRef} tabIndex={-1}>
              What do you charge?
            </h2>
            <p>
              The AI never makes up prices: every line on a quote comes from these numbers. They start as typical US examples, so
              set them to your own.
            </p>
            <div className="onb-rates">
              {RATE_FIELDS.map((f) => (
                <label className="field" key={f.key}>
                  <span>{f.label}</span>
                  <div className="with-suffix">
                    <input type="number" min={0} step={f.step} value={rates[f.key]} onChange={(e) => setRate(f.key, e.target.value)} />
                    <span className="suffix">{f.unit}</span>
                  </div>
                </label>
              ))}
            </div>
            <div className="onb-example" aria-live="polite">
              With these prices, a <b>12×14 bedroom</b> (walls, ceiling, trim and one door) comes to about{' '}
              <b className="onb-money">{formatMoney(example)}</b> before tax.
            </div>
            <p className="muted small">Paint cost, prep, wallpaper and the rest are in Settings.</p>
          </>
        )}

        {step === 3 && (
          <>
            <p className="onb-kicker">Step 3 of 4</p>
            <h2 id="onb-title" ref={headingRef} tabIndex={-1}>
              Record the job like you'd explain it on a call.
            </h2>
            <p>Tap the mic, walk through the rooms, and stop. Your browser asks to use the microphone the first time.</p>
            <div className="onb-say">
              <span className="onb-say-label">Try saying something like:</span>
              "Sarah Lee, 42 Maple Street. Living room fourteen by sixteen, nine foot ceilings, walls and ceiling. Master bedroom
              twelve by fourteen, walls and trim. Hallway needs light patching. Four doors."
            </div>
            <ul className="onb-list">
              <li><b>Say each room with its size</b> ("twelve by fourteen") and what gets painted.</li>
              <li><b>Mention prep</b> like patching, water damage or wallpaper.</li>
              <li><b>Missed something?</b> Anything you didn't say is filled with a sensible guess and listed under <span className="onb-flag">Check these</span> so you can fix it before sending.</li>
              <li>No mic, or somewhere noisy? You can type the note instead.</li>
            </ul>
          </>
        )}

        {step === 4 && (
          <>
            <p className="onb-kicker">Step 4 of 4</p>
            <h2 id="onb-title" ref={headingRef} tabIndex={-1}>
              Send it before you leave the driveway.
            </h2>
            <ul className="onb-list">
              <li><b>Text or email a link</b> from the quote. The customer opens it on their phone, no app or login needed.</li>
              <li><b>See when it's opened.</b> The bell at the top lights up the moment they look at it.</li>
              <li><b>They accept online</b> by typing their name, and the quote moves to Won by itself.</li>
              <li><b>Follow-ups:</b> quotes with no answer after 3 days show up on your dashboard to nudge.</li>
            </ul>
            {alerts === 'default' && (
              <button type="button" className="btn" onClick={async () => setAlerts(await Notification.requestPermission())}>
                🔔 Also alert me on this device
              </button>
            )}
            {alerts === 'granted' && <p className="onb-ok">✓ You'll get an alert on this device when a customer accepts.</p>}
            {alerts === 'denied' && <p className="muted small">Device alerts are blocked in this browser's settings. You'll still see them in the app.</p>}
          </>
        )}

        {step === 5 && (
          <>
            <p className="onb-kicker">All set{business.name.trim() ? `, ${business.name.trim()}` : ''}</p>
            <h2 id="onb-title" ref={headingRef} tabIndex={-1}>
              You're ready for your first quote.
            </h2>
            <p>Your details and prices are saved. Change them any time in Settings, or reopen this guide from the account menu.</p>
            <div className="onb-finish">
              <button type="button" className="btn primary big" onClick={() => done('/new')}>
                Record your first quote
              </button>
              {quotes.length === 0 ? (
                <button type="button" className="btn big" onClick={() => done('/', true)}>
                  Look around with sample quotes
                </button>
              ) : (
                <button type="button" className="btn big" onClick={() => done('/')}>
                  Go to my dashboard
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {step < STEPS.length - 1 && (
        <div className="onb-nav">
          {step > 0 ? (
            <button type="button" className="btn ghost" onClick={() => setStep(step - 1)}>
              Back
            </button>
          ) : (
            <span />
          )}
          <div className="onb-nav-right">
            {step === 1 && nameMissing && <span className="muted small">Add your business name to continue</span>}
            <button type="button" className="btn primary" disabled={step === 1 && nameMissing} onClick={saveAndNext}>
              {step === 0 ? "Let's go" : step === 1 || step === 2 ? 'Save and continue' : 'Next'}
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}
