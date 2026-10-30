import { describe, expect, it } from 'vitest'
import { parseLocally } from './extract'
import { computeMetrics, editStats } from './metrics'
import { normalizeJob } from './normalize'
import { coatFactor, DEFAULT_RATES, discountAmount, priceJob, totals, wallArea } from './pricing'
import { buildSampleQuotes } from './seed'
import { decodeShared, encodeShared } from './share'
import { applyCorrections, wordsToNumbers } from './parser'

describe('shared Gemini file', () => {
  it('lists the same room types as the app', async () => {
    const { ROOM_TYPE_KEYS } = await import('./geminiCore')
    const { ROOM_TYPES } = await import('./rooms')
    expect([...ROOM_TYPE_KEYS].sort()).toEqual([...ROOM_TYPES].sort())
  })
  it('is copied unchanged into the Supabase function', async () => {
    const { readFileSync } = await import('node:fs')
    expect(readFileSync('supabase/functions/read-note/geminiCore.ts', 'utf8')).toBe(readFileSync('src/lib/geminiCore.ts', 'utf8'))
  })
})

describe('wordsToNumbers', () => {
  it('converts spoken numbers', () => {
    expect(wordsToNumbers('twelve by fourteen, nine foot, twenty two')).toBe('12 by 14, 9 foot, 22')
    expect(wordsToNumbers('a couple of doors')).toBe('2 doors')
  })
})

describe('applyCorrections', () => {
  it('replaces the corrected words', () => {
    expect(applyCorrections('office is 14 by 12 no wait 12 by 12, walls')).toBe('office is 12 by 12, walls')
    expect(applyCorrections('2 doors actually 3 doors')).toBe('3 doors')
  })
  it('leaves non-numeric "actually" alone except the filler word', () => {
    expect(applyCorrections("it's actually pretty clean")).toBe("it's pretty clean")
  })
  it('converts halves', () => {
    expect(wordsToNumbers('three and a half by twenty')).toBe('3.5 by 20')
  })
})

describe('normalizeJob', () => {
  it('fills gaps and records each assumption', () => {
    const job = normalizeJob({ rooms: [{ name: 'Bedroom', type: 'bedroom' }] })
    const room = job.rooms[0]
    expect(room.lengthFt).toBe(12)
    expect(room.heightFt).toBe(8)
    expect(room.walls).toBe(true)
    expect(room.coats).toBe(2)
    expect(job.paintIncluded).toBe(true)
    expect(job.assumptions.length).toBeGreaterThanOrEqual(4)
  })

  it('rejects nonsense values from the AI', () => {
    const job = normalizeJob({ rooms: [{ name: 'X', type: 'nope' as never, lengthFt: -5, widthFt: 9999, heightFt: 2 }] })
    expect(job.rooms[0].type).toBe('other')
    expect(job.rooms[0].lengthFt).toBe(12)
    expect(job.rooms[0].heightFt).toBe(8)
  })
})

describe('pricing', () => {
  const job = normalizeJob({
    paintIncluded: true,
    coats: 2,
    heightFt: 8,
    rooms: [{ name: 'Bedroom', type: 'bedroom', lengthFt: 12, widthFt: 10, walls: true, ceiling: true, doors: 1, windows: 1 }],
  })

  it('computes wall area minus openings', () => {
    // perimeter 44 ft × 8 ft = 352, minus door 21 and window 15 = 316
    expect(wallArea(job.rooms[0])).toBe(316)
  })

  it('prices lines from the rate card, never from the AI', () => {
    const items = priceJob(job, DEFAULT_RATES)
    const walls = items.find((i) => i.key === 'r1:walls')!
    expect(walls.qty).toBe(316)
    expect(walls.amount).toBeCloseTo(316 * 1.15, 2)
    expect(items.some((i) => i.key === 'job:paint')).toBe(true)
  })

  it('adds the color-change coat to walls only', () => {
    const j = normalizeJob({ coats: 2, heightFt: 8, rooms: [{ name: 'Den', type: 'family_room', lengthFt: 12, widthFt: 10, walls: true, ceiling: true, colorChange: true }] })
    const items = priceJob(j, DEFAULT_RATES)
    expect(items.find((i) => i.key === 'r1:walls')!.description).toContain('3 coats')
    expect(items.find((i) => i.key === 'r1:ceiling')!.description).toContain('2 coats')
    expect(items.find((i) => i.key === 'r1:ceiling')!.rate).toBe(DEFAULT_RATES.ceilingPerSqFt)
  })

  it('prices a wallpaper border by the linear foot', () => {
    const j = normalizeJob({ heightFt: 8, rooms: [{ name: 'Kids room', type: 'kids_bedroom', lengthFt: 12, widthFt: 10, walls: true, wallpaperBorder: true }] })
    const border = priceJob(j, DEFAULT_RATES).find((i) => i.key === 'r1:border')!
    expect(border.qty).toBe(44)
    expect(border.unit).toBe('lin ft')
  })

  it('skips rooms with no size instead of pricing 0 sq ft', () => {
    const j = normalizeJob({ heightFt: 8, rooms: [{ name: 'X', type: 'bedroom', lengthFt: 12, widthFt: 10, walls: true }] })
    j.rooms[0].lengthFt = 0
    expect(priceJob(j, DEFAULT_RATES).some((i) => i.qty === 0)).toBe(false)
  })

  it('applies the minimum job charge', () => {
    const tiny = normalizeJob({ paintIncluded: false, coats: 2, heightFt: 8, rooms: [{ name: 'Powder room', type: 'powder_room', walls: true }] })
    const items = priceJob(tiny, DEFAULT_RATES)
    expect(totals(items, 0).total).toBeCloseTo(DEFAULT_RATES.minimumJob, 2)
  })

  it('scales labor with coats', () => {
    expect(coatFactor(1)).toBe(0.7)
    expect(coatFactor(2)).toBe(1)
    expect(coatFactor(3)).toBeCloseTo(1.3)
  })
})

describe('discounts', () => {
  const items = [{ amount: 1000 }]

  it('takes a percentage off before tax', () => {
    const t = totals(items, 10, { type: 'percent', value: 10, reason: '' })
    expect(t.discount).toBe(100)
    expect(t.tax).toBe(90)
    expect(t.total).toBe(990)
  })

  it('takes a fixed amount off', () => {
    expect(totals(items, 0, { type: 'amount', value: 150, reason: 'Returning customer' }).total).toBe(850)
  })

  it('never takes the price below zero', () => {
    expect(discountAmount(1000, { type: 'amount', value: 5000, reason: '' })).toBe(1000)
    expect(discountAmount(1000, { type: 'percent', value: 250, reason: '' })).toBe(1000)
    expect(discountAmount(1000, { type: 'percent', value: -5, reason: '' })).toBe(0)
  })

  it('is ignored by the AI-quality metric', () => {
    const [q] = buildSampleQuotes(DEFAULT_RATES)
    const discounted = { ...q, discount: { type: 'percent' as const, value: 50, reason: '' } }
    expect(editStats(discounted).unchanged).toBe(editStats(q).unchanged)
    expect(computeMetrics([discounted], 0).overrideRate).toBe(computeMetrics([q], 0).overrideRate)
  })
})

describe('metrics', () => {
  it('counts edit-free AI lines', () => {
    const [q] = buildSampleQuotes(DEFAULT_RATES)
    const edited = { ...q, lineItems: q.lineItems.map((l, i) => (i === 0 ? { ...l, rate: l.rate + 1 } : l)) }
    const s = editStats(edited)
    expect(s.total).toBe(q.aiLineItems.length)
    expect(s.unchanged).toBe(q.aiLineItems.length - 1)
  })

  it('computes dashboard numbers from sample data', () => {
    const m = computeMetrics(buildSampleQuotes(DEFAULT_RATES), 0)
    expect(m.sentCount).toBeGreaterThan(10)
    expect(m.editFreeRate).toBeGreaterThan(0.5)
    expect(m.winRate).not.toBeNull()
  })
})

describe('share links', () => {
  it('round-trips a quote through the URL', () => {
    const { job } = parseLocally('Quote for Ann Lee. Bedroom 12 by 12 walls.')
    const items = priceJob(job, DEFAULT_RATES)
    const data = encodeShared({
      v: 1, number: 'Q-1', date: '2026-10-30', customerName: 'Ann Lee', address: '', taxPct: 0, notes: [],
      business: { name: 'B', phone: '', email: '', license: '', validDays: 30 }, lineItems: items,
    })
    expect(decodeShared(data)?.customerName).toBe('Ann Lee')
    const withDiscount = encodeShared({ ...decodeShared(data)!, discount: { type: 'amount', value: 50, reason: 'Repeat job' } })
    expect(decodeShared(withDiscount)?.discount?.value).toBe(50)
    expect(decodeShared('garbage')).toBeNull()
  })
})
