import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  deleteQuoteRemote,
  fetchAccount,
  markNotificationsSeenRemote,
  markOnboardedRemote,
  newShareToken,
  saveProfileRemote,
  saveQuotesRemote,
  subscribeToQuotes,
} from './lib/cloud'
import { eventText, newEvents, type QuoteEvent } from './lib/notifications'
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
  // notifications
  notificationsSeenAt: string | null
  markNotificationsSeen: () => void
  alerts: QuoteEvent[]
  dismissAlert: (id: string) => void
  liveConnected: boolean
  // first-sign-in walkthrough
  showOnboarding: boolean
  finishOnboarding: () => void
  openOnboarding: () => void
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
  const [notificationsSeenAt, setNotificationsSeenAt] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<QuoteEvent[]>([])
  const [liveConnected, setLiveConnected] = useState(false)
  // undefined = not known yet (still loading); null = never done; string = done at
  const [onboardedAt, setOnboardedAt] = useState<string | null | undefined>(undefined)
  const [guideOpen, setGuideOpen] = useState(false)
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

  // ---- live alerts: on screen, plus a system notification when the app is in the background ----
  const pushAlerts = useCallback((events: QuoteEvent[]) => {
    if (events.length === 0) return
    setAlerts((a) => [...events.filter((e) => !a.some((x) => x.id === e.id)), ...a].slice(0, 4))
    if (typeof document !== 'undefined' && document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      for (const e of events) {
        const { title, detail } = eventText(e)
        try {
          new Notification(title, { body: detail, tag: e.id })
        } catch {
          /* some mobile browsers only allow notifications from a service worker */
        }
      }
    }
  }, [])

  // ---- load the right data when the account changes ----
  const loadAccount = useCallback(async (u: AccountUser, firstLoad: boolean) => {
    if (firstLoad) setSync('loading')
    try {
      const device = loadStore(storageKey(null))
      const remote = await fetchAccount()
      const samples = dataRef.current.quotes.filter((q) => q.isSample)
      // Anything accepted or opened since the last check pops up as a live alert.
      if (!firstLoad) pushAlerts(newEvents(dataRef.current.quotes, remote.quotes, dataRef.current.settings.rates.taxPct))
      setNotificationsSeenAt(remote.notificationsSeenAt)
      setOnboardedAt(remote.onboardedAt)
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
  }, [pushAlerts])

  useEffect(() => {
    const key = storageKey(user?.id)
    keyRef.current = key
    if (!user) {
      setData(loadStore(key))
      setSync('local')
      setSyncError(null)
      setDeviceQuotes([])
      setAlerts([])
      setNotificationsSeenAt(null)
      setOnboardedAt(undefined)
      setGuideOpen(false)
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

  // Live: the database tells the app the moment a homeowner opens or accepts a quote.
  useEffect(() => {
    if (!user || !supabase) return
    const stop = subscribeToQuotes(
      user.id,
      (remoteQuote) => {
        const prev = dataRef.current.quotes
        const local = prev.find((q) => q.id === remoteQuote.id)
        if (!local) return
        // Keep any unsynced local edits; take what only the homeowner can change from the database.
        const merged = {
          ...local,
          status: remoteQuote.status,
          acceptedName: remoteQuote.acceptedName,
          acceptedAt: remoteQuote.acceptedAt,
          firstViewedAt: remoteQuote.firstViewedAt,
          lastViewedAt: remoteQuote.lastViewedAt,
          viewCount: remoteQuote.viewCount,
        }
        const next = prev.map((q) => (q.id === merged.id ? merged : q))
        pushAlerts(newEvents(prev, next, dataRef.current.settings.rates.taxPct))
        setData((d) => ({ ...d, quotes: d.quotes.map((q) => (q.id === merged.id ? merged : q)) }))
      },
      setLiveConnected,
    )
    return () => {
      stop()
      setLiveConnected(false)
    }
  }, [user, pushAlerts])

  // Backup if live updates are blocked (some networks): check every minute while the app is open.
  useEffect(() => {
    if (!user || liveConnected) return
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadAccount(user, false)
    }, 60_000)
    return () => window.clearInterval(t)
  }, [user, liveConnected, loadAccount])

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
      notificationsSeenAt,
      markNotificationsSeen: () => {
        const now = new Date().toISOString()
        setNotificationsSeenAt(now)
        if (user) void markNotificationsSeenRemote(user.id, now).catch(() => undefined)
      },
      alerts,
      dismissAlert: (id) => setAlerts((a) => a.filter((x) => x.id !== id)),
      liveConnected,
      // Shown automatically the first time an account signs in (once the account has loaded),
      // and on request from the account menu.
      showOnboarding: Boolean(user) && (guideOpen || onboardedAt === null),
      finishOnboarding: () => {
        setGuideOpen(false)
        if (!user) return
        const now = new Date().toISOString()
        setOnboardedAt(now)
        void markOnboardedRemote(user.id, now).catch(() => undefined)
      },
      openOnboarding: () => setGuideOpen(true),
    }),
    [data, saveQuote, remote, user, authReady, sync, syncError, retrySync, deviceQuotes, loadAccount, notificationsSeenAt, alerts, liveConnected, onboardedAt, guideOpen],
  )

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore(): StoreApi {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
