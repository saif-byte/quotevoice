import { formatMoney, totals } from '../lib/pricing'
import type { SharedQuote } from '../lib/share'

/** The customer-facing quote. Used inside the app, on share links, and for printing. */
export function QuoteDocument({ q }: { q: SharedQuote }) {
  const t = totals(q.lineItems, q.taxPct)
  const date = new Date(q.date)
  const validUntil = new Date(date.getTime() + q.business.validDays * 86400000)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <article className="doc">
      <header className="doc-head">
        <div>
          <div className="doc-business">{q.business.name}</div>
          <div className="doc-contact">
            {[q.business.phone, q.business.email, q.business.license].filter(Boolean).map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
        </div>
        <div className="doc-title">
          <h1>Painting estimate</h1>
          <dl>
            <dt>Estimate</dt>
            <dd>{q.number}</dd>
            <dt>Date</dt>
            <dd>{fmt(date)}</dd>
            <dt>Valid until</dt>
            <dd>{fmt(validUntil)}</dd>
          </dl>
        </div>
      </header>

      <section className="doc-for">
        <div className="doc-label">Prepared for</div>
        <div className="doc-customer">{q.customerName || 'Customer'}</div>
        {q.address && <div>{q.address}</div>}
      </section>

      <table className="doc-lines">
        <thead>
          <tr>
            <th>Description</th>
            <th className="num">Qty</th>
            <th className="num">Rate</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {q.lineItems.map((l, i) => (
            <tr key={i}>
              <td>{l.description}</td>
              <td className="num">
                {l.qty.toLocaleString('en-US')} <span className="unit">{l.unit}</span>
              </td>
              <td className="num">{formatMoney(l.rate)}</td>
              <td className="num">{formatMoney(l.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>Subtotal</td>
            <td className="num">{formatMoney(t.subtotal)}</td>
          </tr>
          {q.taxPct > 0 && (
            <tr>
              <td colSpan={3}>Tax ({q.taxPct}%)</td>
              <td className="num">{formatMoney(t.tax)}</td>
            </tr>
          )}
          <tr className="doc-total">
            <td colSpan={3}>Total</td>
            <td className="num">{formatMoney(t.total)}</td>
          </tr>
        </tfoot>
      </table>

      {q.notes.length > 0 && (
        <section className="doc-notes">
          <div className="doc-label">Notes</div>
          <ul>
            {q.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      )}

      <footer className="doc-foot">
        Price covers labor and materials as listed. Furniture moving and repairs beyond those listed are quoted
        separately. To accept, reply to this estimate or call {q.business.phone || 'us'}.
      </footer>
    </article>
  )
}
