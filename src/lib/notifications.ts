import { formatMoney, totals } from './pricing'
import type { Quote } from './types'

/**
 * Notifications are worked out from the quotes themselves (no separate table):
 * a quote with acceptedAt is an "accepted" event, one with firstViewedAt an "opened" event.
 * "Unread" means the event happened after the painter last opened the bell.
 */

export type EventKind = 'accepted' | 'opened'

export interface QuoteEvent {
  id: string
  kind: EventKind
  quoteId: string
  number: string
  customer: string
  total: number
  at: string
}

function customerOf(q: Quote): string {
  return q.acceptedName || q.job.customerName || 'Your customer'
}

export function eventsFrom(quotes: Quote[], taxPct: number, limit = 20): QuoteEvent[] {
  const events: QuoteEvent[] = []
  for (const q of quotes) {
    if (q.isSample) continue
    const total = totals(q.lineItems, taxPct, q.discount).total
    if (q.acceptedAt) {
      events.push({ id: `${q.id}:accepted`, kind: 'accepted', quoteId: q.id, number: q.number, customer: customerOf(q), total, at: q.acceptedAt })
    }
    if (q.firstViewedAt) {
      events.push({ id: `${q.id}:opened`, kind: 'opened', quoteId: q.id, number: q.number, customer: q.job.customerName || 'Your customer', total, at: q.firstViewedAt })
    }
  }
  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit)
}

export function unreadCount(events: QuoteEvent[], seenAt: string | null): number {
  return events.filter((e) => !seenAt || e.at > seenAt).length
}

/** Events that are new in `next` compared with `prev` (used for live alerts). */
export function newEvents(prev: Quote[], next: Quote[], taxPct: number): QuoteEvent[] {
  const before = new Map(prev.map((q) => [q.id, q]))
  const fresh: QuoteEvent[] = []
  for (const e of eventsFrom(next, taxPct, 1000)) {
    const old = before.get(e.quoteId)
    const had = e.kind === 'accepted' ? old?.acceptedAt : old?.firstViewedAt
    if (old && !had) fresh.push(e)
  }
  return fresh
}

export function eventText(e: QuoteEvent): { title: string; detail: string } {
  return e.kind === 'accepted'
    ? { title: `${e.customer} accepted ${e.number}`, detail: `${formatMoney(e.total)} job won` }
    : { title: `${e.customer} opened ${e.number}`, detail: `${formatMoney(e.total)} estimate` }
}
