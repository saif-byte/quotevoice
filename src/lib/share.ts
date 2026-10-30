import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { BusinessInfo, LineItem } from './types'

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
}

export function encodeShared(q: SharedQuote): string {
  return compressToEncodedURIComponent(JSON.stringify(q))
}

export function decodeShared(data: string): SharedQuote | null {
  try {
    const json = decompressFromEncodedURIComponent(data)
    if (!json) return null
    const parsed = JSON.parse(json) as SharedQuote
    return parsed?.v === 1 && Array.isArray(parsed.lineItems) ? parsed : null
  } catch {
    return null
  }
}

export function shareUrl(q: SharedQuote): string {
  const base = window.location.href.split('#')[0]
  return `${base}#/view/${encodeShared(q)}`
}
