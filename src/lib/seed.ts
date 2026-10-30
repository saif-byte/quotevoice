import { parseLocally } from './extract'
import { priceJob } from './pricing'
import { CASES } from '../../eval/cases'
import type { Quote, QuoteStatus, RateCard } from './types'

/**
 * Sample data so the dashboard isn't empty in a demo. Every sample quote is
 * created by running a real note through the real pipeline, then applying
 * the kind of edits a painter might make. Sample quotes are labeled in the UI
 * and can be cleared in one click.
 */

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export function buildSampleQuotes(rates: RateCard, now = new Date()): Quote[] {
  const rand = rng(42)
  const notes = CASES.map((c) => c.note)
  const quotes: Quote[] = []
  const count = 18
  for (let i = 0; i < count; i++) {
    const note = notes[i % notes.length]
    const { job, extractor } = parseLocally(note)
    if (!job.customerName) job.customerName = ['Alex Rivera', 'Jordan Lee', 'Pat Morgan', 'Chris Diaz'][i % 4]
    const aiLineItems = priceJob(job, rates)
    const lineItems = aiLineItems.map((l) => ({ ...l }))

    // About 1 in 4 quotes gets a line edited (e.g. painter bumps prep or a rate).
    if (rand() < 0.28 && lineItems.length > 1) {
      const idx = Math.floor(rand() * lineItems.length)
      const l = lineItems[idx]
      l.rate = Math.round(l.rate * (1.1 + rand() * 0.2) * 100) / 100
      l.amount = Math.round(l.qty * l.rate * 100) / 100
    }

    const daysAgo = Math.floor((count - i) * 3 + rand() * 2)
    const finalized = new Date(now.getTime() - daysAgo * 86400000 - rand() * 6 * 3600000)
    const minutes = 1.2 + rand() * 3.5
    const started = new Date(finalized.getTime() - minutes * 60000)

    let status: QuoteStatus = 'sent'
    if (daysAgo > 10) status = rand() < 0.55 ? 'won' : 'lost'
    else if (daysAgo > 5 && rand() < 0.4) status = 'won'
    if (i === count - 1) status = 'draft'

    quotes.push({
      id: `sample-${i}`,
      number: `Q-${1001 + i}`,
      createdAt: started.toISOString(),
      status,
      transcript: note,
      extractor,
      job,
      aiLineItems,
      lineItems,
      captureStartedAt: started.toISOString(),
      finalizedAt: status === 'draft' ? undefined : finalized.toISOString(),
      decidedAt: status === 'won' || status === 'lost' ? new Date(finalized.getTime() + 3 * 86400000).toISOString() : undefined,
      isSample: true,
    })
  }
  return quotes.reverse()
}
