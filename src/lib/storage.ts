import { DEFAULT_GEMINI_MODEL } from './gemini'
import { DEFAULT_RATES } from './pricing'
import type { Quote, Settings } from './types'

/**
 * All data lives in the browser's localStorage. No server, no database, no cost.
 * Trade-off: data stays on one device. A shared database is the natural next step.
 */

const KEY = 'quotevoice:v1'

/** Where to keep data in this browser: the shared local key, or a per-account cache when signed in. */
export function storageKey(userId?: string | null): string {
  return userId ? `${KEY}:user:${userId}` : KEY
}

export interface StoreData {
  quotes: Quote[]
  settings: Settings
}

export const DEFAULT_SETTINGS: Settings = {
  // Blank on purpose: a painter must never send a quote with someone else's details.
  business: { name: '', phone: '', email: '', license: '', validDays: 30 },
  rates: DEFAULT_RATES,
  ai: { geminiApiKey: '', geminiModel: DEFAULT_GEMINI_MODEL },
}

export function loadStore(key: string = KEY): StoreData {
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoreData>
      // Earlier versions pre-filled an example company. Clear it if it was never changed.
      if (parsed.settings?.business?.license === 'Lic. #PC-104233' && parsed.settings.business.name === 'Brightline Painting Co.') {
        parsed.settings.business = { ...DEFAULT_SETTINGS.business }
      }
      return {
        quotes: Array.isArray(parsed.quotes) ? parsed.quotes : [],
        settings: {
          business: { ...DEFAULT_SETTINGS.business, ...parsed.settings?.business },
          rates: { ...DEFAULT_SETTINGS.rates, ...parsed.settings?.rates },
          ai: { ...DEFAULT_SETTINGS.ai, ...parsed.settings?.ai },
        },
      }
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return { quotes: [], settings: DEFAULT_SETTINGS }
}

export function saveStore(data: StoreData, key: string = KEY): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    /* storage full or blocked: keep working in memory */
  }
}

export function nextQuoteNumber(quotes: Quote[]): string {
  const max = quotes.reduce((m, q) => {
    const n = Number(q.number.replace(/\D/g, ''))
    return Number.isFinite(n) ? Math.max(m, n) : m
  }, 1000)
  return `Q-${max + 1}`
}
