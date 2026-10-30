import { describe, expect, it } from 'vitest'
import { parseLocally } from './extract'
import { computeMetrics, editStats } from './metrics'
import { normalizeJob } from './normalize'
import { coatFactor, DEFAULT_RATES, discountAmount, priceJob, totals, wallArea } from './pricing'
import { buildSampleQuotes } from './seed'
import { decodeShared, encodeShared } from './share'
import { applyCorrections, extractPhone, parseNote, wordsToNumbers } from './parser'
import { buildMessage, formatPhone, isValidPhone, mailtoHref, smsHref } from './send'
import { timeAgo } from './quoteHelpers'
import { eventsFrom, newEvents, unreadCount } from './notifications'

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

describe('sending', () => {
  it('reads a spoken phone number and keeps it out of the room details', () => {
    const { raw } = parseNote('Quote for Sarah Lee, her number is six one four, five five five, oh one eight two. Bedroom 12 by 12 walls, 2 doors.')
    expect(raw.customerPhone).toBe('(614) 555-0182')
    expect(raw.rooms[0].doors).toBe(2)
    expect(raw.rooms[0].lengthFt).toBe(12)
  })
  it('reads a typed phone number', () => {
    expect(extractPhone('call her at 614-555-0182').phone).toBe('(614) 555-0182')
    expect(extractPhone('bedroom 12 by 14').phone).toBeNull()
  })
  it('builds the message and links', () => {
    const msg = buildMessage({ customerName: 'Sarah Johnson', businessName: 'Brightline', link: 'https://x/#/q/abc', total: 1234.5, canAcceptOnline: true })
    expect(msg).toContain('Hi Sarah,')
    expect(msg).toContain('$1,234.50')
    expect(msg).toContain('accept it right from the link')
    expect(smsHref('(614) 555-0182', 'hi there')).toBe('sms:+16145550182?&body=hi%20there')
    expect(mailtoHref('a@b.com', 'Subj', 'Body')).toBe('mailto:a@b.com?subject=Subj&body=Body')
    expect(isValidPhone('614 555 0182')).toBe(true)
    expect(isValidPhone('555 0182')).toBe(false)
    expect(formatPhone('16145550182')).toBe('(614) 555-0182')
  })
  it('describes time since an event', () => {
    const now = new Date('2026-10-30T12:00:00Z')
    expect(timeAgo('2026-10-30T11:59:30Z', now)).toBe('just now')
    expect(timeAgo('2026-10-30T09:00:00Z', now)).toBe('3 hours ago')
    expect(timeAgo('2026-10-28T12:00:00Z', now)).toBe('2 days ago')
  })
})

describe('notifications', () => {
  const [base] = buildSampleQuotes(DEFAULT_RATES)
  const q = { ...base, isSample: false, status: 'sent' as const }

  it('creates accepted and opened events from quotes, newest first', () => {
    const accepted = { ...q, firstViewedAt: '2026-10-30T10:00:00Z', acceptedAt: '2026-10-30T11:00:00Z', acceptedName: 'Jane Doe' }
    const events = eventsFrom([accepted], 0)
    expect(events.map((e) => e.kind)).toEqual(['accepted', 'opened'])
    expect(events[0].customer).toBe('Jane Doe')
  })

  it('counts unread since the bell was last opened', () => {
    const events = eventsFrom([{ ...q, firstViewedAt: '2026-10-30T10:00:00Z', acceptedAt: '2026-10-30T11:00:00Z' }], 0)
    expect(unreadCount(events, null)).toBe(2)
    expect(unreadCount(events, '2026-10-30T10:30:00Z')).toBe(1)
    expect(unreadCount(events, '2026-10-30T12:00:00Z')).toBe(0)
  })

  it('only raises a live alert for something new', () => {
    const before = [q]
    const after = [{ ...q, acceptedAt: '2026-10-30T11:00:00Z' }]
    expect(newEvents(before, after, 0).map((e) => e.kind)).toEqual(['accepted'])
    expect(newEvents(after, after, 0)).toEqual([])
  })

  it('ignores sample quotes', () => {
    expect(eventsFrom([{ ...q, isSample: true, acceptedAt: '2026-10-30T11:00:00Z' }], 0)).toEqual([])
  })
})

describe('untrusted share data', () => {
  it('drops wrong types and junk fields from a crafted link', async () => {
    const { cleanShared, decodeShared, encodeShared } = await import('./share')
    const crafted = {
      v: 1, number: 'Q-1', date: 'not a date', customerName: { evil: true }, address: 'x'.repeat(5000),
      business: { name: 'Fake Co', email: 'javascript:alert(1)', phone: 'call me', validDays: 99999, extra: '<script>' },
      lineItems: [{ description: 'Walls', qty: '5', unit: 'sq ft', rate: 2, amount: 1e99 }],
      taxPct: 900, notes: 'not an array', discount: { type: 'bogus', value: 500, reason: 'r' },
    }
    const q = decodeShared(encodeShared(crafted as never))!
    expect(q.customerName).toBe('')
    expect(q.address.length).toBe(300)
    expect(q.business.validDays).toBe(365)
    expect(q.lineItems[0]).toEqual({ description: 'Walls', qty: 0, unit: 'sq ft', rate: 2, amount: 1e8 })
    expect(q.taxPct).toBe(100)
    expect(q.notes).toEqual([])
    expect(q.discount).toEqual({ type: 'percent', value: 100, reason: 'r' })
    expect('extra' in q.business).toBe(false)
    expect(cleanShared({ v: 2, lineItems: [] })).toBeNull()
    expect(cleanShared(null)).toBeNull()
  })

  it('only turns real emails and phone numbers into links', async () => {
    const { isEmail, telHref } = await import('./share')
    expect(isEmail('mike@brightline.com')).toBe(true)
    expect(isEmail('javascript:alert(1)')).toBe(false)
    expect(isEmail('a@b.com?bcc=all@x.com')).toBe(false)
    expect(isEmail('"x"@y.com')).toBe(false)
    expect(telHref('(555) 201-7788')).toBe('tel:5552017788')
    expect(telHref('+1 555 201 7788')).toBe('tel:+15552017788')
    expect(telHref('call me')).toBe('')
  })
})
