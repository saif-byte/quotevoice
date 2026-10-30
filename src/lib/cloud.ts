import { toShared } from './quoteHelpers'
import type { SharedQuote } from './share'
import { supabase } from './supabase'
import type { BusinessInfo, Quote, RateCard, Settings } from './types'

/**
 * Everything that talks to the Supabase database lives here, so the rest of the
 * app only deals with plain Quote and Settings objects.
 */

interface QuoteRow {
  id: string
  number: string
  status: Quote['status']
  data: Quote
  shared: SharedQuote | null
  share_token: string | null
  accepted_name: string | null
  accepted_at: string | null
}

const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** 16 random characters: about 92 bits, so share links can't be guessed. */
export function newShareToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

function client() {
  if (!supabase) throw new Error('Cloud sync is not configured.')
  return supabase
}

export function rowFromQuote(q: Quote, settings: Settings): Omit<QuoteRow, 'accepted_name' | 'accepted_at'> {
  return {
    id: q.id,
    number: q.number,
    status: q.status,
    data: q,
    shared: q.status === 'draft' ? null : toShared(q, settings),
    share_token: q.shareToken ?? null,
  }
}

/** The database is the source of truth for status and acceptance (a homeowner can change them). */
export function quoteFromRow(row: QuoteRow): Quote {
  return {
    ...row.data,
    status: row.status,
    shareToken: row.share_token ?? undefined,
    acceptedName: row.accepted_name ?? undefined,
    acceptedAt: row.accepted_at ?? undefined,
    decidedAt: row.data.decidedAt ?? row.accepted_at ?? undefined,
  }
}

export interface CloudData {
  quotes: Quote[]
  business: Partial<BusinessInfo> | null
  rates: Partial<RateCard> | null
}

export async function fetchAccount(): Promise<CloudData> {
  const db = client()
  const [quotesRes, profileRes] = await Promise.all([
    db.from('quotes').select('id, number, status, data, shared, share_token, accepted_name, accepted_at').order('created_at', { ascending: false }),
    db.from('profiles').select('business, rates').maybeSingle(),
  ])
  if (quotesRes.error) throw quotesRes.error
  if (profileRes.error) throw profileRes.error
  const hasBusiness = profileRes.data && Object.keys(profileRes.data.business ?? {}).length > 0
  const hasRates = profileRes.data && Object.keys(profileRes.data.rates ?? {}).length > 0
  return {
    quotes: (quotesRes.data as QuoteRow[]).map(quoteFromRow),
    business: hasBusiness ? (profileRes.data!.business as Partial<BusinessInfo>) : null,
    rates: hasRates ? (profileRes.data!.rates as Partial<RateCard>) : null,
  }
}

export async function saveQuotesRemote(quotes: Quote[], settings: Settings): Promise<void> {
  if (quotes.length === 0) return
  const { error } = await client().from('quotes').upsert(quotes.map((q) => rowFromQuote(q, settings)))
  if (error) throw error
}

export async function deleteQuoteRemote(id: string): Promise<void> {
  const { error } = await client().from('quotes').delete().eq('id', id)
  if (error) throw error
}

export async function saveProfileRemote(userId: string, settings: Settings): Promise<void> {
  // The AI key is personal and stays in this browser; it is never uploaded.
  const { error } = await client()
    .from('profiles')
    .upsert({ user_id: userId, business: settings.business, rates: settings.rates, updated_at: new Date().toISOString() })
  if (error) throw error
}

// ---------- public, no login: what the homeowner uses ----------

export interface PublicQuote {
  quote: SharedQuote
  status: Quote['status']
  acceptedName: string | null
  acceptedAt: string | null
}

export async function fetchSharedQuote(token: string): Promise<PublicQuote | null> {
  const { data, error } = await client().rpc('get_shared_quote', { p_token: token })
  if (error) throw error
  return (data as PublicQuote | null) ?? null
}

export async function acceptSharedQuote(token: string, name: string): Promise<{ acceptedName: string; acceptedAt: string }> {
  const { data, error } = await client().rpc('accept_quote', { p_token: token, p_name: name })
  if (error) throw new Error(error.message)
  return data as { acceptedName: string; acceptedAt: string }
}
