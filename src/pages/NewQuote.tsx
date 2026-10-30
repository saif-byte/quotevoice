import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { useSpeech } from '../hooks/useSpeech'
import { extractJob } from '../lib/extract'
import { newId } from '../lib/normalize'
import { describeDiscount, formatMoney, priceJob, roundMoney, totals } from '../lib/pricing'
import { ROOMS, ROOM_TYPES } from '../lib/rooms'
import { SAMPLE_NOTES } from '../lib/samples'
import type { Discount, ExtractorName, JobSpec, LineItem, Prep, Quote, Room } from '../lib/types'
import { useStore } from '../store'

type Step = 'capture' | 'job' | 'price'

const STEPS: { id: Step; label: string }[] = [
  { id: 'capture', label: 'Record the job' },
  { id: 'job', label: 'Check what was heard' },
  { id: 'price', label: 'Check the price' },
]

export function NewQuote() {
  const { id } = useParams()
  const { quotes, settings, saveQuote, nextNumber } = useStore()
  const navigate = useNavigate()
  const existing = id ? quotes.find((q) => q.id === id) : undefined

  const [step, setStep] = useState<Step>(existing ? 'price' : 'capture')
  const [transcript, setTranscript] = useState(existing?.transcript ?? '')
  const [startedAt, setStartedAt] = useState<string | null>(existing?.captureStartedAt ?? null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [extractor, setExtractor] = useState<ExtractorName>(existing?.extractor ?? 'parser')
  const [job, setJob] = useState<JobSpec | null>(existing?.job ?? null)
  const [aiLines, setAiLines] = useState<LineItem[]>(existing?.aiLineItems ?? [])
  const [lines, setLines] = useState<LineItem[]>(existing?.lineItems ?? [])
  const [discount, setDiscount] = useState<Discount | undefined>(existing?.discount)
  const [quoteId] = useState(existing?.id ?? newId('q'))
  const [number] = useState(existing?.number ?? nextNumber())

  const markStarted = () => setStartedAt((s) => s ?? new Date().toISOString())

  // ---- unsaved-work protection ----
  const snapshot = JSON.stringify({ transcript, job, lines, discount })
  const [initialSnapshot] = useState(snapshot)
  const savedRef = useRef(false)
  const dirty = snapshot !== initialSnapshot && !savedRef.current
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !savedRef.current && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const speech = useSpeech((text) => {
    if (!text) return
    setTranscript((t) => (t ? `${t.trimEnd()} ${text}` : text))
  })

  useEffect(() => {
    if (id && !existing) navigate('/', { replace: true })
  }, [id, existing, navigate])

  const aiOn = settings.ai.geminiApiKey.trim().length > 0

  async function buildFromNote() {
    if (!transcript.trim()) return
    speech.stop()
    setBusy(true)
    setNotice(null)
    const result = await extractJob(transcript, settings.ai)
    setBusy(false)
    setExtractor(result.extractor)
    if (result.fallbackReason) {
      setNotice(`The AI couldn't read this note (${result.fallbackReason}). The offline parser was used instead.`)
    }
    setJob(result.job)
    // Snapshot of the AI's draft, before any human edits. Used for the edit-free metric.
    setAiLines(priceJob(result.job, settings.rates))
    setStep('job')
  }

  function goToPrice() {
    if (!job) return
    const priced = priceJob(job, settings.rates)
    const manual = lines.filter((l) => l.key.startsWith('manual:'))
    setLines([...priced, ...manual])
    setStep('price')
  }

  function buildQuote(status: Quote['status']): Quote {
    const now = new Date().toISOString()
    return {
      id: quoteId,
      number,
      createdAt: existing?.createdAt ?? now,
      status,
      transcript,
      extractor,
      job: job!,
      aiLineItems: aiLines,
      lineItems: lines,
      discount: discount && discount.value > 0 ? discount : undefined,
      captureStartedAt: startedAt ?? now,
      finalizedAt: status === 'draft' ? undefined : (existing?.finalizedAt ?? now),
      decidedAt: existing?.decidedAt,
      isSample: existing?.isSample,
    }
  }

  function save(finalize: boolean) {
    if (!job) return
    // Editing a finished quote keeps its status (Open, Won or Lost); it never turns back into a draft.
    const status = existing && existing.status !== 'draft' ? existing.status : finalize ? 'sent' : 'draft'
    saveQuote(buildQuote(status))
    savedRef.current = true
    navigate(`/quotes/${quoteId}`)
  }

  const isFinished = !!existing && existing.status !== 'draft'

  const stepIndex = STEPS.findIndex((s) => s.id === step)

  return (
    <div className="page narrow">
      <div className="page-head">
        <h1>{existing ? `Edit ${existing.number}` : 'New quote'}</h1>
        <Link to="/" className="btn ghost">
          Cancel
        </Link>
      </div>

      <ol className="stepper" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s.id} className={i === stepIndex ? 'current' : i < stepIndex ? 'done' : ''} aria-current={i === stepIndex ? 'step' : undefined}>
            <span className="step-num">{i + 1}</span>
            <span className="step-label">{s.label}</span>
          </li>
        ))}
      </ol>

      {notice && <div className="callout warn" role="status">{notice}</div>}

      {blocker.state === 'blocked' && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="leave-title">
            <h2 id="leave-title">Leave without saving?</h2>
            <p>{isFinished ? `Your changes to ${number} haven't been saved.` : "This quote hasn't been saved yet. If you leave now, it will be lost."}</p>
            <div className="modal-actions">
              <button className="btn" onClick={() => blocker.reset?.()} autoFocus>
                Keep editing
              </button>
              {job && !isFinished && (
                <button
                  className="btn"
                  onClick={() => {
                    saveQuote(buildQuote('draft'))
                    savedRef.current = true
                    blocker.proceed?.()
                  }}
                >
                  Save as draft and leave
                </button>
              )}
              <button className="btn danger" onClick={() => blocker.proceed?.()}>
                Leave without saving
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'capture' && (
        <section className="panel capture">
          <p className="lede">
            Walk through the job out loud, the way you'd leave a voice note for a helper: rooms, sizes, what gets painted,
            prep, and who supplies paint.
          </p>

          <div className="mic-row">
            {speech.supported ? (
              <button
                type="button"
                className={`mic ${speech.listening ? 'on' : ''}`}
                onClick={() => {
                  if (speech.listening) speech.stop()
                  else {
                    markStarted()
                    speech.start()
                  }
                }}
                aria-pressed={speech.listening}
              >
                <MicIcon />
                <span>{speech.listening ? 'Stop recording' : transcript ? 'Keep recording' : 'Start recording'}</span>
              </button>
            ) : (
              <div className="callout">Voice input needs Chrome, Edge or Safari. You can type or paste the note below.</div>
            )}
            {speech.listening && <span className="live-dot">Listening</span>}
          </div>
          {speech.error && <div className="callout warn">{speech.error}</div>}

          <label className="field">
            <span>Job note</span>
            <textarea
              rows={8}
              value={transcript + (speech.interim ? ` ${speech.interim}` : '')}
              onChange={(e) => {
                markStarted()
                setTranscript(e.target.value)
              }}
              placeholder="e.g. Quote for Sarah Johnson. Living room 16 by 20, walls and ceiling, two coats, some nail holes to patch…"
            />
          </label>

          <div className="samples">
            <span className="muted">No job handy? Try a sample note:</span>
            {SAMPLE_NOTES.map((s) => (
              <button
                key={s.title}
                type="button"
                className="chip"
                onClick={() => {
                  markStarted()
                  setTranscript(s.text)
                }}
              >
                {s.title}
              </button>
            ))}
          </div>

          <div className="actions">
            <span className="muted small">
              {aiOn ? 'Your note will be read by AI.' : 'Your note will be read by the built-in reader.'}{' '}
              <Link to="/settings">{aiOn ? 'AI settings' : 'Turn on AI reading'}</Link>
            </span>
            <button type="button" className="btn primary" disabled={!transcript.trim() || busy} onClick={buildFromNote}>
              {busy ? 'Reading the note…' : 'Build quote'}
            </button>
          </div>
        </section>
      )}

      {step === 'job' && job && (
        <JobStep job={job} setJob={setJob} extractor={extractor} onBack={() => setStep('capture')} onNext={goToPrice} />
      )}

      {step === 'price' && job && (
        <PriceStep
          lines={lines}
          setLines={setLines}
          taxPct={settings.rates.taxPct}
          discount={discount}
          setDiscount={setDiscount}
          onBack={() => setStep('job')}
          onDraft={() => save(false)}
          onFinalize={() => save(true)}
          finished={isFinished}
        />
      )}
    </div>
  )
}

// ---------------- Step 2: the job as heard ----------------

function JobStep(props: {
  job: JobSpec
  setJob: (j: JobSpec) => void
  extractor: ExtractorName
  onBack: () => void
  onNext: () => void
}) {
  const { job, setJob } = props
  const updateRoom = (rid: string, patch: Partial<Room>) =>
    setJob({ ...job, rooms: job.rooms.map((r) => (r.id === rid ? { ...r, ...patch } : r)) })

  const addRoom = () => {
    const n = job.rooms.length + 1
    const room: Room = {
      id: `r${Date.now().toString(36)}`, name: `Room ${n}`, type: 'other', lengthFt: 12, widthFt: 12, heightFt: 8,
      walls: true, ceiling: false, trim: false, doors: 0, windows: 0, prep: 'none', wallpaper: false, wallpaperBorder: false, colorChange: false, coats: 2,
    }
    setJob({ ...job, rooms: [...job.rooms, room] })
  }

  const badRooms = job.rooms.filter((r) => !(r.lengthFt > 0 && r.widthFt > 0 && r.heightFt > 0))

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Here's what was heard</h2>
        <span className={`badge ${props.extractor}`}>{props.extractor === 'gemini' ? 'Read by AI' : 'Read by built-in reader'}</span>
      </div>

      {job.assumptions.length > 0 && (
        <div className="assumptions">
          <h3>Check these: not in the note, so they were filled in</h3>
          <ul>
            {job.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid2">
        <label className="field">
          <span>Customer</span>
          <input value={job.customerName} onChange={(e) => setJob({ ...job, customerName: e.target.value })} placeholder="Customer name" />
        </label>
        <label className="field">
          <span>Address</span>
          <input value={job.address} onChange={(e) => setJob({ ...job, address: e.target.value })} placeholder="Job address" />
        </label>
        <label className="field">
          <span>Customer mobile (for texting the quote)</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={job.customerPhone ?? ''}
            onChange={(e) => setJob({ ...job, customerPhone: e.target.value })}
            placeholder="(555) 123-4567"
          />
        </label>
        <label className="field">
          <span>Customer email (optional)</span>
          <input
            type="email"
            autoComplete="off"
            value={job.customerEmail ?? ''}
            onChange={(e) => setJob({ ...job, customerEmail: e.target.value })}
            placeholder="name@example.com"
          />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={job.paintIncluded} onChange={(e) => setJob({ ...job, paintIncluded: e.target.checked })} />
        I'm supplying the paint
      </label>

      <div className="rooms">
        {job.rooms.map((r) => (
          <RoomCard
            key={r.id}
            room={r}
            onChange={(p) => updateRoom(r.id, p)}
            onRemove={() =>
              setJob({
                ...job,
                rooms: job.rooms.filter((x) => x.id !== r.id),
                // Drop the warnings that belonged to the removed room.
                assumptions: job.assumptions.filter((a) => !a.startsWith(`${r.name}:`)),
              })
            }
          />
        ))}
      </div>
      <button type="button" className="btn ghost" onClick={addRoom}>
        Add a room
      </button>

      {job.notes.length > 0 && (
        <div className="callout">
          <strong>Mentioned but not priced:</strong>
          <ul>
            {job.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {badRooms.length > 0 && (
        <div className="callout warn" role="status">
          {badRooms.map((r) => r.name).join(', ')}: length, width and height must be more than 0.
        </div>
      )}

      <div className="actions">
        <button type="button" className="btn ghost" onClick={props.onBack}>
          Back to note
        </button>
        <button type="button" className="btn primary" onClick={props.onNext} disabled={job.rooms.length === 0 || badRooms.length > 0}>
          Price this job
        </button>
      </div>
    </section>
  )
}

function NumberInput(props: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; suffix?: string }) {
  return (
    <label className="field compact">
      <span>{props.label}</span>
      <div className="with-suffix">
        <input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(props.value) ? props.value : ''}
          step={props.step ?? 1}
          min={props.min ?? 0}
          onChange={(e) => props.onChange(e.target.value === '' ? 0 : Math.max(props.min ?? 0, Number(e.target.value) || 0))}
        />
        {props.suffix && <span className="suffix">{props.suffix}</span>}
      </div>
    </label>
  )
}

function RoomCard({ room, onChange, onRemove }: { room: Room; onChange: (p: Partial<Room>) => void; onRemove: () => void }) {
  return (
    <div className="room">
      <div className="room-head">
        <input className="room-name" value={room.name} onChange={(e) => onChange({ name: e.target.value })} aria-label="Room name" />
        <select value={room.type} onChange={(e) => onChange({ type: e.target.value as Room['type'] })} aria-label="Room type">
          {ROOM_TYPES.map((t) => (
            <option key={t} value={t}>
              {t === 'other' ? 'Other room' : ROOMS[t].label}
            </option>
          ))}
        </select>
        <button type="button" className="icon-btn" onClick={onRemove} aria-label={`Remove ${room.name}`}>
          ×
        </button>
      </div>
      <div className="room-grid">
        <NumberInput label="Length" value={room.lengthFt} suffix="ft" onChange={(v) => onChange({ lengthFt: v })} step={0.5} />
        <NumberInput label="Width" value={room.widthFt} suffix="ft" onChange={(v) => onChange({ widthFt: v })} step={0.5} />
        <NumberInput label="Height" value={room.heightFt} suffix="ft" onChange={(v) => onChange({ heightFt: v })} step={0.5} />
        <NumberInput label="Coats" value={room.coats} onChange={(v) => onChange({ coats: Math.max(1, Math.min(4, Math.round(v))) })} min={1} />
        <NumberInput label="Doors" value={room.doors} onChange={(v) => onChange({ doors: Math.round(v) })} />
        <NumberInput label="Windows" value={room.windows} onChange={(v) => onChange({ windows: Math.round(v) })} />
        <label className="field compact">
          <span>Prep</span>
          <select value={room.prep} onChange={(e) => onChange({ prep: e.target.value as Prep })}>
            <option value="none">None</option>
            <option value="light">Light</option>
            <option value="heavy">Heavy</option>
          </select>
        </label>
      </div>
      <div className="toggles">
        {(
          [
            ['walls', 'Walls'],
            ['ceiling', 'Ceiling'],
            ['trim', 'Trim'],
            ['colorChange', 'Covering a dark color (+1 coat on walls)'],
            ['wallpaper', 'Wallpaper removal'],
            ['wallpaperBorder', 'Wallpaper border'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className={`toggle ${room[key] ? "on" : ""}`}>
            <input type="checkbox" checked={!!room[key]} onChange={(e) => onChange({ [key]: e.target.checked })} />
            {label}
          </label>
        ))}
      </div>
    </div>
  )
}

// ---------------- Step 3: price ----------------

function PriceStep(props: {
  lines: LineItem[]
  setLines: (l: LineItem[]) => void
  taxPct: number
  discount: Discount | undefined
  setDiscount: (d: Discount | undefined) => void
  onBack: () => void
  onDraft: () => void
  onFinalize: () => void
  finished: boolean
}) {
  const { lines, setLines, discount, setDiscount } = props
  const t = useMemo(() => totals(lines, props.taxPct, discount), [lines, props.taxPct, discount])
  const negative = lines.some((l) => l.qty < 0 || l.rate < 0)
  const zeroLines = lines.filter((l) => l.amount === 0).length
  const canFinish = lines.length > 0 && !negative && t.total > 0
  const discountTooBig = !!discount && discount.value > 0 && (discount.type === 'percent' ? discount.value > 100 : discount.value > t.subtotal)

  const update = (i: number, patch: Partial<LineItem>) => {
    setLines(
      lines.map((l, idx) => {
        if (idx !== i) return l
        const next = { ...l, ...patch }
        next.qty = Math.max(0, next.qty)
        next.rate = Math.max(0, next.rate)
        next.amount = roundMoney(next.qty * next.rate)
        return next
      }),
    )
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Priced with your rates</h2>
        <Link to="/settings" className="small">
          Edit rates
        </Link>
      </div>
      <p className="muted small">The AI only reads the note. Every number below comes from your rate card, so you can change any line.</p>

      <div className="lines">
        <div className="line line-head" aria-hidden="true">
          <span>Description</span>
          <span>Qty</span>
          <span>Unit</span>
          <span>Rate</span>
          <span className="num">Amount</span>
          <span />
        </div>
        {lines.map((l, i) => (
          <div className="line" key={l.key}>
            <input aria-label="Description" value={l.description} onChange={(e) => update(i, { description: e.target.value })} />
            <label className="cell">
              <span className="m-label">Qty</span>
              <input aria-label="Quantity" type="number" inputMode="decimal" min={0} value={l.qty} onChange={(e) => update(i, { qty: Number(e.target.value) || 0 })} />
            </label>
            <label className="cell">
              <span className="m-label">Unit</span>
              <input aria-label="Unit" value={l.unit} onChange={(e) => update(i, { unit: e.target.value })} />
            </label>
            <label className="cell">
              <span className="m-label">Rate $</span>
              <input aria-label="Rate" type="number" inputMode="decimal" min={0} step="0.01" value={l.rate} onChange={(e) => update(i, { rate: Number(e.target.value) || 0 })} />
            </label>
            <span className="num amount">{formatMoney(l.amount)}</span>
            <button type="button" className="icon-btn" aria-label={`Remove ${l.description}`} onClick={() => setLines(lines.filter((_, idx) => idx !== i))}>
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn ghost"
        onClick={() => setLines([...lines, { key: `manual:${Date.now().toString(36)}`, description: 'Extra item', qty: 1, unit: 'each', rate: 0, amount: 0 }])}
      >
        Add a line
      </button>

      <div className="discount">
        {!discount ? (
          <button type="button" className="btn ghost" onClick={() => setDiscount({ type: 'percent', value: 10, reason: '' })}>
            Add a discount
          </button>
        ) : (
          <fieldset className="discount-box">
            <legend>Discount</legend>
            <div className="discount-row">
              <div className="seg seg-sm" role="group" aria-label="Discount type">
                <button type="button" className={discount.type === 'percent' ? 'on' : ''} aria-pressed={discount.type === 'percent'} onClick={() => setDiscount({ ...discount, type: 'percent' })}>
                  % off
                </button>
                <button type="button" className={discount.type === 'amount' ? 'on' : ''} aria-pressed={discount.type === 'amount'} onClick={() => setDiscount({ ...discount, type: 'amount' })}>
                  $ off
                </button>
              </div>
              <label className="field compact discount-value">
                <span>{discount.type === 'percent' ? 'Percent' : 'Amount'}</span>
                <div className="with-suffix">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={discount.type === 'percent' ? 1 : 5}
                    value={discount.value}
                    onChange={(e) => setDiscount({ ...discount, value: Math.max(0, Number(e.target.value) || 0) })}
                  />
                  <span className="suffix">{discount.type === 'percent' ? '%' : '$'}</span>
                </div>
              </label>
              <label className="field compact discount-reason">
                <span>Reason shown to customer (optional)</span>
                <input value={discount.reason} placeholder="e.g. Returning customer" onChange={(e) => setDiscount({ ...discount, reason: e.target.value })} />
              </label>
              <button type="button" className="icon-btn" aria-label="Remove discount" onClick={() => setDiscount(undefined)}>
                ×
              </button>
            </div>
            {discountTooBig && <p className="small warn-text">That's more than the subtotal, so the discount is capped at {formatMoney(t.subtotal)}.</p>}
          </fieldset>
        )}
      </div>

      <dl className="totals">
        <dt>Subtotal</dt>
        <dd>{formatMoney(t.subtotal)}</dd>
        {t.discount > 0 && discount && (
          <>
            <dt>{describeDiscount(discount)}</dt>
            <dd className="minus">−{formatMoney(t.discount)}</dd>
          </>
        )}
        {props.taxPct > 0 && (
          <>
            <dt>Tax ({props.taxPct}%)</dt>
            <dd>{formatMoney(t.tax)}</dd>
          </>
        )}
        <dt className="grand">Total</dt>
        <dd className="grand">{formatMoney(t.total)}</dd>
      </dl>

      {t.total <= 0 && lines.length > 0 && <p className="small warn-text">The total is $0. Check the quantities and rates before finishing.</p>}
      {zeroLines > 0 && t.total > 0 && (
        <p className="small muted">
          {zeroLines} line{zeroLines > 1 ? 's are' : ' is'} $0.00 and will show on the quote that way. Remove {zeroLines > 1 ? 'them' : 'it'} if not needed.
        </p>
      )}

      <div className="actions">
        <button type="button" className="btn ghost" onClick={props.onBack}>
          Back to job
        </button>
        <span className="spacer" />
        {!props.finished && (
          <button type="button" className="btn" onClick={props.onDraft} disabled={lines.length === 0}>
            Save draft
          </button>
        )}
        <button type="button" className="btn primary" onClick={props.onFinalize} disabled={!canFinish}>
          {props.finished ? 'Save changes' : 'Finish quote'}
        </button>
      </div>
    </section>
  )
}

function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
