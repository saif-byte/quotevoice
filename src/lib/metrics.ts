import { totals } from './pricing'
import type { LineItem, Quote } from './types'

/**
 * Dashboard metrics. These map directly to the metrics in the project plan:
 *  - quotes sent (north star), time to quote, AI edit-free line items, override rate.
 */

function sameLine(a: LineItem, b: LineItem): boolean {
  return a.description === b.description && a.qty === b.qty && a.rate === b.rate
}

/** How many of the AI's line items were sent without any change. */
export function editStats(q: Quote): { unchanged: number; total: number } {
  let unchanged = 0
  for (const ai of q.aiLineItems) {
    const final = q.lineItems.find((l) => l.key === ai.key)
    if (final && sameLine(ai, final)) unchanged += 1
  }
  return { unchanged, total: q.aiLineItems.length }
}

export function quoteTotal(q: Quote, taxPct: number): number {
  return totals(q.lineItems, taxPct).total
}

/** True if the painter moved the total by more than 10% from the AI's first draft. */
export function wasOverridden(q: Quote, taxPct: number): boolean {
  const ai = totals(q.aiLineItems, taxPct).total
  const final = totals(q.lineItems, taxPct).total
  if (ai === 0) return final !== 0
  return Math.abs(final - ai) / ai > 0.1
}

export function minutesToQuote(q: Quote): number | null {
  if (!q.finalizedAt) return null
  const ms = new Date(q.finalizedAt).getTime() - new Date(q.captureStartedAt).getTime()
  return ms >= 0 ? ms / 60000 : null
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export interface DashboardMetrics {
  sentCount: number
  openValue: number
  wonValue: number
  winRate: number | null
  decided: number
  medianMinutes: number | null
  editFreeRate: number | null
  overrideRate: number | null
  draftCount: number
}

export function computeMetrics(quotes: Quote[], taxPct: number): DashboardMetrics {
  const finalized = quotes.filter((q) => q.status !== 'draft')
  const won = quotes.filter((q) => q.status === 'won')
  const lost = quotes.filter((q) => q.status === 'lost')
  const decided = won.length + lost.length

  let unchanged = 0
  let aiTotal = 0
  for (const q of finalized) {
    const s = editStats(q)
    unchanged += s.unchanged
    aiTotal += s.total
  }

  return {
    sentCount: finalized.length,
    openValue: quotes.filter((q) => q.status === 'sent').reduce((s, q) => s + quoteTotal(q, taxPct), 0),
    wonValue: won.reduce((s, q) => s + quoteTotal(q, taxPct), 0),
    winRate: decided ? won.length / decided : null,
    decided,
    medianMinutes: median(finalized.map(minutesToQuote).filter((m): m is number => m !== null)),
    editFreeRate: aiTotal ? unchanged / aiTotal : null,
    overrideRate: finalized.length ? finalized.filter((q) => wasOverridden(q, taxPct)).length / finalized.length : null,
    draftCount: quotes.filter((q) => q.status === 'draft').length,
  }
}

export interface WeekBucket {
  label: string
  start: Date
  count: number
  value: number
}

/** Quotes sent per week for the last `weeks` weeks (weeks start on Monday). */
export function weeklySent(quotes: Quote[], taxPct: number, weeks = 8, now = new Date()): WeekBucket[] {
  const monday = new Date(now)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const buckets: WeekBucket[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(monday)
    start.setDate(monday.getDate() - i * 7)
    buckets.push({
      label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      start,
      count: 0,
      value: 0,
    })
  }
  for (const q of quotes) {
    if (!q.finalizedAt) continue
    const t = new Date(q.finalizedAt).getTime()
    for (let i = buckets.length - 1; i >= 0; i--) {
      if (t >= buckets[i].start.getTime()) {
        const end = buckets[i].start.getTime() + 7 * 86400000
        if (t < end) {
          buckets[i].count += 1
          buckets[i].value += quoteTotal(q, taxPct)
        }
        break
      }
    }
  }
  return buckets
}
