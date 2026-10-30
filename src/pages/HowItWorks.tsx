import { Link } from 'react-router-dom'

const PIPELINE = [
  { title: 'Record', who: 'Browser', body: "The painter talks through the job. The browser's built-in speech recognition turns it into text. Typing works too." },
  { title: 'Read', who: 'AI', body: 'Gemini reads the note and returns structured JSON: rooms, sizes, surfaces, prep, coats. Anything not said is left empty. Without a key, a rule-based parser does this step.' },
  { title: 'Fill gaps', who: 'Code', body: 'Missing details get sensible defaults (8 ft ceilings, 2 coats, typical room sizes). Each one is listed as an assumption for the painter to check.' },
  { title: 'Price', who: 'Code', body: "Plain code calculates wall area, ceiling area and trim length, then applies the painter's own rate card. The AI never sets a price." },
  { title: 'Review & send', who: 'Painter', body: 'The painter edits anything, finalizes, and sends a link the customer can open on any phone. Edits are tracked to measure AI quality.' },
]

export function HowItWorks() {
  return (
    <div className="page narrow prose">
      <h1>How QuoteVoice works</h1>
      <p className="lede">
        House painters walk through a job, then type the quote at night and send it a day or two later. By then a faster
        competitor has often won the work. QuoteVoice lets a painter say the job out loud in the van and send an itemized,
        professional estimate in a few minutes.
      </p>

      <h2>The pipeline</h2>
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
        A wrong price on a signed estimate costs the painter real money. Language models are good at understanding messy
        speech but can make up numbers. So the model's only job is turning speech into structured facts. Arithmetic and
        rates are handled by tested code, and every guess the system makes is shown to the painter before anything is sent.
      </p>

      <h2>How quality is measured</h2>
      <ul>
        <li>
          <strong>AI lines kept as-is:</strong> the share of line items from the AI's first draft that the painter sends
          without changing. Target: 80%.
        </li>
        <li>
          <strong>Totals changed by over 10%:</strong> how often the painter significantly overrides the draft. Target: under
          20%.
        </li>
        <li>
          <strong>Time to quote:</strong> from the first word recorded to the quote being finalized. Target: under 3
          minutes.
        </li>
        <li>
          <strong>Offline eval:</strong> a hand-labeled set of voice notes is scored field by field (room count, sizes,
          surfaces, prep). Run <code>npm run eval</code> in the repo.
        </li>
      </ul>

      <h2>What it costs to run</h2>
      <p>
        Nothing. Speech recognition is built into the browser, Gemini has a free tier, data is stored in the browser, and the
        site is hosted on GitHub Pages.
      </p>

      <h2>Known limits of this version</h2>
      <ul>
        <li>Interior painting only. Exterior, cabinets and specialty finishes are noted but not priced.</li>
        <li>Quotes are saved in one browser; there are no accounts or sync between devices.</li>
        <li>Voice input works in Chrome, Edge and Safari, not Firefox.</li>
      </ul>

      <p>
        <Link className="btn primary" to="/new">
          Try it with a sample note
        </Link>
      </p>
    </div>
  )
}
