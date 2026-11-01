import { toShared } from './quoteHelpers'
import { cleanShared, type SharedQuote } from './share'
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
  first_viewed_at: string | null
  last_viewed_at: string | null
  view_count: number | null
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

type WritableRow = Omit<QuoteRow, 'accepted_name' | 'accepted_at' | 'first_viewed_at' | 'last_viewed_at' | 'view_count'>

export function rowFromQuote(q: Quote, settings: Settings): WritableRow {
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
    firstViewedAt: row.first_viewed_at ?? undefined,
    lastViewedAt: row.last_viewed_at ?? undefined,
    viewCount: row.view_count ?? 0,
    decidedAt: row.data.decidedAt ?? row.accepted_at ?? undefined,
  }
}

export interface CloudData {
  quotes: Quote[]
  business: Partial<BusinessInfo> | null
  rates: Partial<RateCard> | null
  notificationsSeenAt: string | null
  /** When the first-sign-in walkthrough was finished or skipped. null = not yet. */
  onboardedAt: string | null
}

export async function fetchAccount(): Promise<CloudData> {
  const db = client()
  const [quotesRes, profileRes] = await Promise.all([
    db.from('quotes').select('id, number, status, data, shared, share_token, accepted_name, accepted_at, first_viewed_at, last_viewed_at, view_count').order('created_at', { ascending: false }),
    db.from('profiles').select('business, rates, notifications_seen_at, onboarded_at').maybeSingle(),
  ])
  if (quotesRes.error) throw quotesRes.error
  if (profileRes.error) throw profileRes.error
  const hasBusiness = profileRes.data && Object.keys(profileRes.data.business ?? {}).length > 0
  const hasRates = profileRes.data && Object.keys(profileRes.data.rates ?? {}).length > 0
  return {
    quotes: (quotesRes.data as QuoteRow[]).map(quoteFromRow),
    business: hasBusiness ? (profileRes.data!.business as Partial<BusinessInfo>) : null,
    rates: hasRates ? (profileRes.data!.rates as Partial<RateCard>) : null,
    notificationsSeenAt: (profileRes.data?.notifications_seen_at as string | null) ?? null,
    onboardedAt: (profileRes.data?.onboarded_at as string | null) ?? null,
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

export async function markOnboardedRemote(userId: string, at: string | null): Promise<void> {
  const { error } = await client().from('profiles').update({ onboarded_at: at }).eq('user_id', userId)
  if (error) throw error
}

export async function markNotificationsSeenRemote(userId: string, seenAt: string): Promise<void> {
  const { error } = await client().from('profiles').update({ notifications_seen_at: seenAt }).eq('user_id', userId)
  if (error) throw error
}

/**
 * Live updates: calls `onChange` whenever one of this painter's quotes changes in the
 * database (e.g. a homeowner opens or accepts it). Returns a function that stops listening.
 */
export function subscribeToQuotes(userId: string, onChange: (q: Quote) => void, onStatus?: (live: boolean) => void): () => void {
  const db = client()
  const channel = db
    .channel(`quotes-${userId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'quotes', filter: `user_id=eq.${userId}` }, (payload) => {
      onChange(quoteFromRow(payload.new as QuoteRow))
    })
    .subscribe((status) => onStatus?.(status === 'SUBSCRIBED'))
  return () => {
    void db.removeChannel(channel)
  }
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
  const row = data as PublicQuote | null
  const quote = row ? cleanShared(row.quote) : null
  return row && quote ? { ...row, quote } : null
}

/** Tells the painter the homeowner opened the estimate. Failures are ignored: it's a nice-to-have. */
export async function markQuoteViewed(token: string): Promise<void> {
  try {
    await client().rpc('mark_quote_viewed', { p_token: token })
  } catch {
    /* ignore */
  }
}

export async function acceptSharedQuote(token: string, name: string): Promise<{ acceptedName: string; acceptedAt: string }> {
  const { data, error } = await client().rpc('accept_quote', { p_token: token, p_name: name })
  if (error) throw new Error(error.message)
  return data as { acceptedName: string; acceptedAt: string }
}
