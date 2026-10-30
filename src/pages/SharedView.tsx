import { useParams } from 'react-router-dom'
import { QuoteDocument } from '../components/QuoteDocument'
import { decodeShared } from '../lib/share'

/** What the homeowner sees when they open the link. No app chrome, no login. */
export function SharedView() {
  const { data } = useParams()
  const q = data ? decodeShared(data) : null

  if (!q) {
    return (
      <div className="shared">
        <div className="empty">
          <h1>This estimate link is incomplete</h1>
          <p>Part of the link may have been cut off when it was copied. Ask your painter to send it again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="shared">
      <QuoteDocument q={q} />
      <div className="shared-actions no-print">
        <button className="btn" onClick={() => window.print()}>
          Print or save PDF
        </button>
        <span className="muted small">Made with QuoteVoice</span>
      </div>
    </div>
  )
}
