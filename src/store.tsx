import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { buildSampleQuotes } from './lib/seed'
import { DEFAULT_SETTINGS, loadStore, nextQuoteNumber, saveStore, type StoreData } from './lib/storage'
import type { Quote, Settings } from './lib/types'

interface StoreApi {
  quotes: Quote[]
  settings: Settings
  saveQuote: (q: Quote) => void
  deleteQuote: (id: string) => void
  updateSettings: (s: Settings) => void
  loadSamples: () => void
  clearSamples: () => void
  resetAll: () => void
  nextNumber: () => string
}

const StoreContext = createContext<StoreApi | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<StoreData>(() => loadStore())

  useEffect(() => saveStore(data), [data])

  const saveQuote = useCallback((q: Quote) => {
    setData((d) => {
      const exists = d.quotes.some((x) => x.id === q.id)
      return { ...d, quotes: exists ? d.quotes.map((x) => (x.id === q.id ? q : x)) : [q, ...d.quotes] }
    })
  }, [])

  const api = useMemo<StoreApi>(
    () => ({
      quotes: data.quotes,
      settings: data.settings,
      saveQuote,
      deleteQuote: (id) => setData((d) => ({ ...d, quotes: d.quotes.filter((q) => q.id !== id) })),
      updateSettings: (settings) => setData((d) => ({ ...d, settings })),
      loadSamples: () =>
        setData((d) => ({
          ...d,
          quotes: [...d.quotes.filter((q) => !q.isSample), ...buildSampleQuotes(d.settings.rates)],
        })),
      clearSamples: () => setData((d) => ({ ...d, quotes: d.quotes.filter((q) => !q.isSample) })),
      resetAll: () => setData({ quotes: [], settings: DEFAULT_SETTINGS }),
      nextNumber: () => nextQuoteNumber(data.quotes),
    }),
    [data, saveQuote],
  )

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore(): StoreApi {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
