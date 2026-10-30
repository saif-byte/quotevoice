import { Link } from 'react-router-dom'

const PIPELINE = [
  {
    title: 'Record',
    who: 'Browser',
    body: "The painter talks through the job in the van after the walkthrough. The browser's built-in speech recognition turns it into text. Typing works too.",
  },
  {
    title: 'Read',
    who: 'AI',
    body: "An AI model (Google Gemini) turns the note into a list of rooms with sizes, surfaces, prep and coats. Anything the painter didn't say is left blank, never guessed. It understands how painters talk: corrections (\"twelve by fourteen, no wait, twelve by twelve\"), past work (\"we did their kitchen last year\") and \"the ceiling's staying as is\".",
  },
  {
    title: 'Fill gaps',
    who: 'Code',
    body: 'Missing details get sensible defaults (8 ft ceilings, 2 coats, typical room sizes). Every one is listed in yellow for the painter to check before pricing.',
  },
  {
    title: 'Price',
    who: 'Code',
    body: "Plain code works out wall area, ceiling area and trim length, then applies the painter's own rate card, any discount, and tax. The AI never sets a price.",
  },
  {
    title: 'Review & send',
    who: 'Painter',
    body: "The painter changes anything, finishes the quote, and taps Text it or Email it: the phone's own Messages or Mail app opens with the message and link filled in. Every edit is recorded, which is how the quality of the AI is measured.",
  },
  {
    title: 'Accept',
    who: 'Customer',
    body: "The homeowner opens the link on any phone, types their name and clicks Accept. The painter gets a live alert and a bell notification, sees when the link was opened, and the quote turns to Won.",
  },
]

const READERS = [
  { name: 'Shared AI reader', when: 'Default', how: 'Runs on the server, so no key is needed in the browser.' },
  { name: "Painter's own AI key", when: 'If added in Settings', how: 'Goes straight from the browser to Google; the key never leaves that device.' },
  { name: 'Built-in reader', when: 'If AI is off or unreachable', how: 'Rule-based, runs in the browser, works offline. Nothing breaks without AI.' },
]

const STORAGE = [
  { place: 'Not signed in', what: 'Quotes and rates stay in this browser only.' },
  { place: 'Signed in', what: 'Quotes and rates sync to the account, so they appear on the phone and the laptop. A copy is kept on the device so the app opens instantly.' },
  { place: 'Customer link', what: 'A random 16-character code. It shows only the customer copy of a finished quote, never drafts or other quotes.' },
]

export function HowItWorks() {
  return (
    <div className="page narrow prose">
      <h1>How QuoteVoice works</h1>
      <p className="lede">
        House painters walk through a job, then type the quote at night and send it a day or two later. By then a faster
        competitor has often won the work. QuoteVoice lets a painter say the job out loud in the van, send an itemized
        estimate in a few minutes, and get it accepted online.
      </p>

      <h2>From voice note to accepted quote</h2>
      <ol className="pipeline">
        {PIPELINE.map((p) => (
          <li key={p.title}>
            <div className="pipe-top">
              <strong>{p.title}</strong>
              <span className={`who ${p.who.toLowerCase()}`}>{p.who}</span>
            </div>
            <p>{p.body}</p>
          </li>
        ))}
      </ol>

      <h2>Why the AI only reads, and never prices</h2>
      <p>
        A wrong price on an accepted estimate costs the painter real money. Language models are good at understanding messy
        speech but can make up numbers. So the model's only job is turning speech into facts. Arithmetic and rates are
        handled by tested code, and every guess the system makes is shown to the painter before anything is sent.
      </p>

      <h2>Who reads the note</h2>
      <p>The app picks the first one available, so a quote can always be built.</p>
      <table className="how-table">
        <thead>
          <tr>
            <th>Reader</th>
            <th>Used</th>
            <th>How it works</th>
          </tr>
        </thead>
        <tbody>
          {READERS.map((r) => (
            <tr key={r.name}>
              <td>
                <strong>{r.name}</strong>
              </td>
              <td>{r.when}</td>
              <td>{r.how}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Where quotes are kept</h2>
      <p>Signing in is optional. Each painter can only ever see their own quotes; the database enforces this, not just the app.</p>
      <table className="how-table">
        <tbody>
          {STORAGE.map((s) => (
            <tr key={s.place}>
              <td>
                <strong>{s.place}</strong>
              </td>
              <td>{s.what}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>How quality is measured</h2>
      <ul>
        <li>
          <strong>Lines kept as heard:</strong> the share of line items from the first draft that the painter sends
          unchanged. Goal: 80% or more.
        </li>
        <li>
          <strong>Totals adjusted:</strong> how often the painter moves the first draft's total by over 10%. Discounts don't
          count, since they're a sales decision. Goal: under 20%.
        </li>
        <li>
          <strong>Time to quote:</strong> from the first word recorded to the finished quote. Goal: under 3 minutes.
        </li>
        <li>
          <strong>Test notes:</strong> labeled voice notes are checked field by field (rooms, sizes, surfaces, prep) on every
          update. A field test with a simulated painter found misreads that scored 73%; after fixes, those notes score 100%,
          and a separate set of reworded notes the reader was never tuned on scores 97%.
        </li>
      </ul>

      <h2>What it costs to run</h2>
      <p>
        Nothing. Speech recognition is built into the browser, the AI and the database use free tiers (Google Gemini and
        Supabase), and the site is hosted on GitHub Pages. A small daily check keeps the free database from going to sleep.
      </p>

      <h2>Known limits of this version</h2>
      <ul>
        <li>Interior painting only. Exterior, cabinets and specialty finishes are noted but not priced.</li>
        <li>Texts and emails go out from the painter's own phone. Alerts arrive while QuoteVoice is open (even in a background tab), not when it's fully closed.</li>
        <li>Voice input works in Chrome, Edge and Safari, not Firefox.</li>
        <li>Default rates are examples. Each painter sets their own in Settings.</li>
      </ul>

      <p>
        <Link className="btn primary" to="/new">
          Try it with a sample note
        </Link>
      </p>
    </div>
  )
}
