import type { SharedQuote } from './share'
import type { Quote, Settings } from './types'

export function toShared(q: Quote, settings: Settings): SharedQuote {
  return {
    v: 1,
    number: q.number,
    date: q.finalizedAt ?? q.createdAt,
    business: settings.business,
    customerName: q.job.customerName,
    address: q.job.address,
    lineItems: q.lineItems.map(({ description, qty, unit, rate, amount }) => ({ description, qty, unit, rate, amount })),
    taxPct: settings.rates.taxPct,
    // Internal notes ("mentioned but not priced") stay in the app, not on the customer copy.
    notes: [],
    discount: q.discount && q.discount.value > 0 ? q.discount : undefined,
  }
}

export const STATUS_LABEL: Record<Quote['status'], string> = {
  draft: 'Draft',
  sent: 'Sent',
  won: 'Won',
  lost: 'Lost',
}

export function formatMinutes(m: number | null): string {
  if (m === null) return '—'
  if (m < 1) return `${Math.round(m * 60)} sec`
  if (m < 60) return `${m.toFixed(1)} min`
  const h = m / 60
  return h < 48 ? `${h.toFixed(1)} hr` : `${Math.round(h / 24)} days`
}

export function shortDate(iso: string | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
