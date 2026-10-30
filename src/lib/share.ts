import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { BusinessInfo, Discount, LineItem } from './types'

/**
 * Customer share links with no server: the quote itself is compressed into the
 * link (#/view/<data>). Anyone with the link can open it on any device.
 */

export interface SharedQuote {
  v: 1
  number: string
  date: string
  business: BusinessInfo
  customerName: string
  address: string
  lineItems: Pick<LineItem, 'description' | 'qty' | 'unit' | 'rate' | 'amount'>[]
  taxPct: number
  notes: string[]
  discount?: Discount
  paintByCustomer?: boolean
}

export function encodeShared(q: SharedQuote): string {
  return compressToEncodedURIComponent(JSON.stringify(q))
}

export function decodeShared(data: string): SharedQuote | null {
  try {
    if (data.length > 60_000) return null
    const json = decompressFromEncodedURIComponent(data)
    if (!json || json.length > 200_000) return null
    return cleanShared(JSON.parse(json))
  } catch {
    return null
  }
}

const str = (v: unknown, max = 300): string => (typeof v === 'string' ? v.slice(0, max) : '')
const num = (v: unknown, min = -1e9, max = 1e9): number => {
  const n = typeof v === 'number' ? v : Number.NaN
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 0
}
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

/**
 * Estimate data that comes from a link or the server is untrusted: anyone can craft it.
 * Keep only the expected fields, with the expected types and sane sizes, so a crafted
 * link can't break the page or slip in unexpected values.
 */
export function cleanShared(raw: unknown): SharedQuote | null {
  const r = obj(raw)
  if (r.v !== 1 || !Array.isArray(r.lineItems) || r.lineItems.length > 500) return null
  const b = obj(r.business)
  const d = r.discount ? obj(r.discount) : null
  const date = str(r.date, 40)
  return {
    v: 1,
    number: str(r.number, 32),
    date: Number.isNaN(Date.parse(date)) ? new Date(0).toISOString() : date,
    business: {
      name: str(b.name, 120),
      phone: str(b.phone, 40),
      email: str(b.email, 254),
      license: str(b.license, 80),
      validDays: Math.round(num(b.validDays, 1, 365)) || 30,
    },
    customerName: str(r.customerName, 120),
    address: str(r.address, 300),
    lineItems: r.lineItems.map((li) => {
      const l = obj(li)
      return { description: str(l.description, 300), qty: num(l.qty, 0, 1e6), unit: str(l.unit, 20), rate: num(l.rate, -1e6, 1e6), amount: num(l.amount, -1e8, 1e8) }
    }),
    taxPct: num(r.taxPct, 0, 100),
    notes: Array.isArray(r.notes) ? r.notes.slice(0, 50).map((n) => str(n, 500)) : [],
    discount: d ? { type: d.type === 'amount' ? 'amount' : 'percent', value: num(d.value, 0, d.type === 'amount' ? 1e8 : 100), reason: str(d.reason, 120) } : undefined,
    paintByCustomer: r.paintByCustomer === true,
  }
}

/** Only real-looking email addresses become mailto: links. */
export function isEmail(v: string): boolean {
  return /^[^\s@<>"'()\\,;:]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/.test(v)
}

/** Digits (and a leading +) for tel: links, or '' if there's no usable number. */
export function telHref(v: string): string {
  const digits = v.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '')
  return digits.replace(/\D/g, '').length >= 7 ? `tel:${digits}` : ''
}

export function shareUrl(q: SharedQuote): string {
  const base = window.location.href.split('#')[0]
  return `${base}#/view/${encodeShared(q)}`
}
