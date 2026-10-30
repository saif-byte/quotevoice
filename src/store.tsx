import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { deleteQuoteRemote, fetchAccount, newShareToken, saveProfileRemote, saveQuotesRemote } from './lib/cloud'
import { buildSampleQuotes } from './lib/seed'
import { DEFAULT_SETTINGS, loadStore, nextQuoteNumber, saveStore, storageKey, type StoreData } from './lib/storage'
import { supabase } from './lib/supabase'
import type { Quote, Settings } from './lib/types'

/**
 * App state. Two modes:
 *  - Not signed in: everything stays in this browser (localStorage), like v1.
 *  - Signed in: quotes and settings sync to Supabase, with a per-account copy cached
 *    in the browser so the app opens instantly and still shows data when offline.
 */

export type SyncState = 'local' | 'loading' | 'synced' | 'saving' | 'error'

export interface AccountUser {
  id: string
  email: string
}

interface StoreApi {
  quotes: Quote[]
  settings: Settings
  saveQuote: (q: Quote) => Quote
  deleteQuote: (id: string) => void
  updateSettings: (s: Settings) => void
  loadSamples: () => void
  clearSamples: () => void
  resetAll: () => void
  nextNumber: () => string
  // account
  cloudEnabled: boolean
  user: AccountUser | null
  authReady: boolean
  sync: SyncState
  syncError: string | null
  retrySync: () => void
  refresh: () => void
  deviceQuotes: Quote[]
  importDeviceQuotes: () => void
  dismissDeviceQuotes: () => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>
  signOut: () => Promise<void>
}

const StoreContext = createContext<StoreApi | null>(null)

function message(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
  return String(err)
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AccountUser | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [data, setData] = useState<StoreData>(() => loadStore())
  const [sync, setSync] = useState<SyncState>('local')
  const [syncError, setSyncError] = useState<string | null>(null)
  const [deviceQuotes, setDeviceQuotes] = useState<Quote[]>([])
  const keyRef = useRef(storageKey(null))
  const dataRef = useRef(data)
  dataRef.current = data

  // ---- who is signed in ----
  useEffect(() => {
    if (!supabase) return
    const toUser = (u: { id: string; email?: string } | null | undefined) => (u ? { id: u.id, email: u.email ?? '' } : null)
    supabase.auth.getSession().then(({ data: s }) => {
      setUser(toUser(s.session?.user))
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser((prev) => {
        const next = toUser(session?.user)
        return prev?.id === next?.id ? prev : next
      })
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // ---- load the right data when the account changes ----
  const loadAccount = useCallback(async (u: AccountUser, firstLoad: boolean) => {
    if (firstLoad) setSync('loading')
    try {
      const device = loadStore(storageKey(null))
      const remote = await fetchAccount()
      const samples = dataRef.current.quotes.filter((q) => q.isSample)
      const settings: Settings = {
        business: { ...DEFAULT_SETTINGS.business, ...(remote.business ?? device.settings.business) },
        rates: { ...DEFAULT_SETTINGS.rates, ...(remote.rates ?? device.settings.rates) },
        ai: device.settings.ai, // the personal AI key never leaves this browser
      }
      setData({ quotes: [...remote.quotes, ...samples], settings })
      if (!remote.business && !remote.rates) await saveProfileRemote(u.id, settings)
      if (firstLoad) {
        const remoteIds = new Set(remote.quotes.map((q) => q.id))
        setDeviceQuotes(device.quotes.filter((q) => !q.isSample && !remoteIds.has(q.id)))
      }
      setSync('synced')
      setSyncError(null)
    } catch (err) {
      setSync('error')
      setSyncError(message(err))
    }
  }, [])

  useEffect(() => {
    const key = storageKey(user?.id)
    keyRef.current = key
    if (!user) {
      setData(loadStore(key))
      setSync('local')
      setSyncError(null)
      setDeviceQuotes([])
      return
    }
    setData(loadStore(key)) // cached copy first, so the app opens instantly
    void loadAccount(user, true)
  }, [user, loadAccount])

  // Pick up changes made elsewhere (another device, or a homeowner accepting a quote).
  useEffect(() => {
    if (!user) return
    const onFocus = () => {
      if (document.visibilityState === 'visible') void loadAccount(user, false)
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [user, loadAccount])

  useEffect(() => saveStore(data, keyRef.current), [data])

  // ---- remote writes ----
  const remote = useCallback(
    (op: () => Promise<void>) => {
      if (!user) return
      setSync('saving')
      op()
        .then(() => {
          setSync('synced')
          setSyncError(null)
        })
        .catch((err) => {
          setSync('error')
          setSyncError(message(err))
        })
    },
    [user],
  )

  const saveQuote = useCallback(
    (input: Quote): Quote => {
      let q = input
      // Finished quotes get a short-link code once you're signed in.
      if (user && q.status !== 'draft' && !q.shareToken && !q.isSample) q = { ...q, shareToken: newShareToken() }
      setData((d) => {
        const exists = d.quotes.some((x) => x.id === q.id)
        return { ...d, quotes: exists ? d.quotes.map((x) => (x.id === q.id ? q : x)) : [q, ...d.quotes] }
      })
      if (!q.isSample) remote(() => saveQuotesRemote([q], dataRef.current.settings))
      return q
    },
    [user, remote],
  )

  const retrySync = useCallback(() => {
    if (!user) return
    const { quotes, settings } = dataRef.current
    remote(async () => {
      await saveProfileRemote(user.id, settings)
      await saveQuotesRemote(
        quotes.filter((q) => !q.isSample),
        settings,
      )
    })
  }, [user, remote])

  const api = useMemo<StoreApi>(
    () => ({
      quotes: data.quotes,
      settings: data.settings,
      saveQuote,
      deleteQuote: (id) => {
        const target = data.quotes.find((q) => q.id === id)
        setData((d) => ({ ...d, quotes: d.quotes.filter((q) => q.id !== id) }))
        if (target && !target.isSample) remote(() => deleteQuoteRemote(id))
      },
      updateSettings: (settings) => {
        setData((d) => ({ ...d, settings }))
        if (user) remote(() => saveProfileRemote(user.id, settings))
      },
      loadSamples: () =>
        setData((d) => ({
          ...d,
          quotes: [...d.quotes.filter((q) => !q.isSample), ...buildSampleQuotes(d.settings.rates)],
        })),
      clearSamples: () => setData((d) => ({ ...d, quotes: d.quotes.filter((q) => !q.isSample) })),
      resetAll: () => {
        // Signed in: clears this device's copy only. Quotes in the account stay safe.
        setData({ quotes: [], settings: { ...DEFAULT_SETTINGS, ai: data.settings.ai } })
      },
      nextNumber: () => nextQuoteNumber(data.quotes),
      cloudEnabled: Boolean(supabase),
      user,
      authReady,
      sync,
      syncError,
      retrySync,
      refresh: () => {
        if (user) void loadAccount(user, false)
      },
      deviceQuotes,
      importDeviceQuotes: () => {
        const toImport = deviceQuotes.map((q) => (q.status !== 'draft' && !q.shareToken ? { ...q, shareToken: newShareToken() } : q))
        setData((d) => ({ ...d, quotes: [...toImport, ...d.quotes.filter((q) => !toImport.some((t) => t.id === q.id))] }))
        setDeviceQuotes([])
        remote(() => saveQuotesRemote(toImport, dataRef.current.settings))
      },
      dismissDeviceQuotes: () => setDeviceQuotes([]),
      signIn: async (email, password) => {
        if (!supabase) throw new Error('Accounts are not available.')
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw new Error(error.message)
      },
      signUp: async (email, password) => {
        if (!supabase) throw new Error('Accounts are not available.')
        const { data: res, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.href.split('#')[0].split('?')[0] },
        })
        if (error) throw new Error(error.message)
        return { needsConfirmation: !res.session }
      },
      signOut: async () => {
        await supabase?.auth.signOut()
      },
    }),
    [data, saveQuote, remote, user, authReady, sync, syncError, retrySync, deviceQuotes, loadAccount],
  )

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore(): StoreApi {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
