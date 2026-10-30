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
    paintByCustomer: !q.job.paintIncluded,
  }
}

export const STATUS_LABEL: Record<Quote['status'], string> = {
  draft: 'Draft',
  sent: 'Open',
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

/** "just now", "5 min ago", "3 hours ago", "2 days ago", or a date. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const s = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.floor(h / 24)
  if (d < 14) return `${d} day${d === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
