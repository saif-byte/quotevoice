import { DEFAULT_GEMINI_MODEL } from './gemini'
import { DEFAULT_RATES } from './pricing'
import type { Quote, Settings } from './types'

/**
 * All data lives in the browser's localStorage. No server, no database, no cost.
 * Trade-off: data stays on one device. A shared database is the natural next step.
 */

const KEY = 'quotevoice:v1'

export interface StoreData {
  quotes: Quote[]
  settings: Settings
}

export const DEFAULT_SETTINGS: Settings = {
  business: {
    name: 'Brightline Painting Co.',
    phone: '(555) 201-4477',
    email: 'quotes@brightlinepainting.example',
    license: 'Lic. #PC-104233',
    validDays: 30,
  },
  rates: DEFAULT_RATES,
  ai: { geminiApiKey: '', geminiModel: DEFAULT_GEMINI_MODEL },
}

export function loadStore(): StoreData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoreData>
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

export function saveStore(data: StoreData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
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
