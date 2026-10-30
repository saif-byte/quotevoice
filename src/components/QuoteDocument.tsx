import { describeDiscount, formatMoney, totals } from '../lib/pricing'
import type { SharedQuote } from '../lib/share'

const PLURALS: Record<string, string> = { door: 'doors', window: 'windows', room: 'rooms', job: 'jobs', each: 'each' }
function unitLabel(unit: string, qty: number): string {
  return qty !== 1 && PLURALS[unit] ? PLURALS[unit] : unit
}

/** The customer-facing quote. Used inside the app, on share links, and for printing. */
export function QuoteDocument({ q }: { q: SharedQuote }) {
  const t = totals(q.lineItems, q.taxPct, q.discount)
  const date = new Date(q.date)
  const validUntil = new Date(date.getTime() + q.business.validDays * 86400000)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <article className="doc">
      <header className="doc-head">
        <div>
          <div className={`doc-business ${q.business.name ? '' : 'placeholder'}`}>{q.business.name || 'Your business name'}</div>
          <div className="doc-contact">
            {q.business.phone && <a href={`tel:${q.business.phone.replace(/[^\d+]/g, '')}`}>{q.business.phone}</a>}
            {q.business.email && <a href={`mailto:${q.business.email}`}>{q.business.email}</a>}
            {q.business.license && <span>{q.business.license}</span>}
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
                {l.qty.toLocaleString('en-US')} <span className="unit">{unitLabel(l.unit, l.qty)}</span>
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
          {t.discount > 0 && q.discount && (
            <tr className="doc-discount">
              <td colSpan={3}>{describeDiscount(q.discount)}</td>
              <td className="num">−{formatMoney(t.discount)}</td>
            </tr>
          )}
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
        {q.paintByCustomer
          ? 'Paint is supplied by the customer; this price covers labor and the items listed. '
          : 'Price covers labor, paint and materials as listed. '}
        Furniture moving and repairs beyond those listed are quoted separately. To accept this estimate,{' '}
        {q.business.phone ? (
          <>
            call or text <a href={`tel:${q.business.phone.replace(/[^\d+]/g, '')}`}>{q.business.phone}</a>
          </>
        ) : (
          'contact us'
        )}
        {q.business.email && (
          <>
            {' '}or email <a href={`mailto:${q.business.email}`}>{q.business.email}</a>
          </>
        )}
        .
      </footer>
    </article>
  )
}
