// Generates supabase/demo/seed.json: the recruiter demo account's quotes.
// Every quote is made by running a real voice note through the real pipeline (parser + pricing).
// Run: npx vitest run --config scripts/vitest.gen.config.ts
import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { CASES, FIELD_CASES, HELD_OUT_CASES } from '../eval/cases'
import { parseLocally } from '../src/lib/extract'
import { priceJob } from '../src/lib/pricing'
import { toShared } from '../src/lib/quoteHelpers'
import { DEFAULT_SETTINGS } from '../src/lib/storage'
import type { Quote, Settings } from '../src/lib/types'

const T0 = Date.parse('2026-11-01T10:00:00Z') // dates are shifted to "now" on every reset
const H = 3600e3
const settings: Settings = {
  ...DEFAULT_SETTINGS,
  business: { name: 'Brightline Painting (Demo)', phone: '(555) 010-0142', email: 'demo@example.com', license: 'DEMO-0001', validDays: 30 },
}

type Plan = {
  note: string // a word that picks the voice note (customer name)
  address?: string
  status: Quote['status']
  ago: number // hours before T0 the quote was finished
  mins: number // minutes from first word to finished quote
  token?: string
  views?: [number, number, number] // first view (h ago), last view (h ago), count
  accepted?: number // h ago
  decided?: number // h ago
  discount?: Quote['discount']
  bump?: boolean // painter raised one line
}

const plans: Plan[] = [
  { note: 'sarah johnson', status: 'won', ago: 40 * 24, mins: 2.4, decided: 37 * 24 },
  { note: 'tom baker', status: 'lost', ago: 36 * 24, mins: 3.1, decided: 30 * 24 },
  { note: 'linda park', status: 'won', ago: 31 * 24, mins: 1.8, decided: 29 * 24, bump: true },
  { note: 'dave ross', status: 'won', ago: 27 * 24, mins: 2.2, decided: 25 * 24 },
  { note: 'nguyen', status: 'lost', ago: 22 * 24, mins: 2.9, decided: 18 * 24 },
  { note: 'robert king', status: 'won', ago: 18 * 24, mins: 3.4, decided: 16 * 24, discount: { type: 'percent', value: 5, reason: 'Returning customer' } },
  { note: 'emily stone', status: 'won', ago: 13 * 24, mins: 2.0, decided: 12 * 24 },
  { note: 'henderson', address: '72 Oak Ridge Dr', status: 'sent', ago: 5 * 24, mins: 2.6, token: 'DemoHenderson5d8', views: [4 * 24, 4 * 24, 1] },
  { note: 'mike chen', status: 'won', ago: 30, mins: 1.6, token: 'DemoAccepted7Kq2', views: [20, 6, 3], accepted: 5 },
  { note: 'dan miller', status: 'sent', ago: 26, mins: 1.4, token: 'DemoMiller4Fh9Lx', views: [2, 2, 1] },
  { note: 'tina ruiz', status: 'sent', ago: 3, mins: 1.9, token: 'DemoRuizTry2Acpt' },
  { note: 'karen walsh', status: 'draft', ago: 1, mins: 0.8 },
]

const ALL = [...CASES, ...FIELD_CASES, ...HELD_OUT_CASES]
const iso = (hAgo: number) => new Date(T0 - hAgo * H).toISOString()

it('builds the demo seed', () => {
  const quotes = plans.map((p, i) => {
    const found = ALL.find((c) => c.note.toLowerCase().includes(p.note))
    if (!found) throw new Error(`no note for ${p.note}`)
    const note = found.note
    const { job, extractor } = parseLocally(note)
    if (p.address && !job.address) job.address = p.address
    const aiLineItems = priceJob(job, settings.rates)
    const lineItems = aiLineItems.map((l) => ({ ...l }))
    if (p.bump && lineItems.length > 1) {
      const l = lineItems[0]
      l.rate = Math.round(l.rate * 1.15 * 100) / 100
      l.amount = Math.round(l.qty * l.rate * 100) / 100
    }
    const fin = T0 - p.ago * H
    const start = fin - p.mins * 60e3
    const q: Quote = {
      id: `demo-${String(i + 1).padStart(2, '0')}`,
      number: `Q-${1001 + i}`,
      createdAt: new Date(start).toISOString(),
      status: p.status,
      transcript: note,
      extractor,
      job,
      aiLineItems,
      lineItems,
      captureStartedAt: new Date(start).toISOString(),
      finalizedAt: p.status === 'draft' ? undefined : new Date(fin).toISOString(),
      decidedAt: p.decided !== undefined ? iso(p.decided) : p.accepted !== undefined ? iso(p.accepted) : undefined,
      discount: p.discount,
      shareToken: p.token,
    }
    return {
      id: q.id,
      number: q.number,
      status: q.status,
      data: q,
      shared: q.status === 'draft' ? null : toShared(q, settings),
      share_token: p.token ?? null,
      accepted_name: p.accepted !== undefined ? job.customerName || 'Customer' : null,
      accepted_at: p.accepted !== undefined ? iso(p.accepted) : null,
      first_viewed_at: p.views ? iso(p.views[0]) : null,
      last_viewed_at: p.views ? iso(p.views[1]) : null,
      view_count: p.views ? p.views[2] : 0,
    }
  })
  writeFileSync(
    'supabase/demo/seed.json',
    JSON.stringify({ t0: new Date(T0).toISOString(), business: settings.business, rates: settings.rates, quotes }, null, 1),
  )
  for (const r of quotes) {
    const total = r.data.lineItems.reduce((s, l) => s + l.amount, 0)
    console.log(r.number, r.status, r.data.job.customerName, r.data.job.rooms.length, Math.round(total), r.share_token ?? '')
  }
})
