import { useState } from 'react'
import { DEFAULT_RATES } from '../lib/pricing'
import { DEFAULT_SETTINGS } from '../lib/storage'
import type { RateCard, Settings as SettingsT } from '../lib/types'
import { useStore } from '../store'

const RATE_FIELDS: { key: keyof RateCard; label: string; unit: string; step: number }[] = [
  { key: 'wallPerSqFt', label: 'Walls', unit: '$ per sq ft (2 coats)', step: 0.05 },
  { key: 'ceilingPerSqFt', label: 'Ceilings', unit: '$ per sq ft (2 coats)', step: 0.05 },
  { key: 'trimPerLinFt', label: 'Baseboards & trim', unit: '$ per linear ft', step: 0.05 },
  { key: 'doorEach', label: 'Doors & frames', unit: '$ each', step: 1 },
  { key: 'windowEach', label: 'Window casings', unit: '$ each', step: 1 },
  { key: 'prepLightPerRoom', label: 'Light prep', unit: '$ per room', step: 5 },
  { key: 'prepHeavyPerRoom', label: 'Heavy prep', unit: '$ per room', step: 5 },
  { key: 'wallpaperPerSqFt', label: 'Wallpaper removal', unit: '$ per sq ft', step: 0.05 },
  { key: 'paintPerGallon', label: 'Paint & materials', unit: '$ per gallon', step: 1 },
  { key: 'coverageSqFtPerGallon', label: 'Paint coverage', unit: 'sq ft per gallon per coat', step: 10 },
  { key: 'minimumJob', label: 'Minimum job', unit: '$', step: 10 },
  { key: 'taxPct', label: 'Sales tax', unit: '%', step: 0.25 },
]

export function Settings() {
  const { settings, updateSettings, loadSamples, clearSamples, resetAll, quotes } = useStore()
  const [draft, setDraft] = useState<SettingsT>(settings)
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings)

  const save = () => {
    updateSettings(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="page narrow">
      <div className="page-head">
        <h1>Settings</h1>
        <button className="btn primary" disabled={!dirty} onClick={save}>
          {saved ? 'Saved' : 'Save settings'}
        </button>
      </div>

      <section className="panel">
        <h2>Your business</h2>
        <p className="muted small">Shown at the top of every quote your customers see.</p>
        <div className="grid2">
          {(
            [
              ['name', 'Business name'],
              ['phone', 'Phone'],
              ['email', 'Email'],
              ['license', 'License number'],
            ] as const
          ).map(([key, label]) => (
            <label className="field" key={key}>
              <span>{label}</span>
              <input value={draft.business[key]} onChange={(e) => setDraft({ ...draft, business: { ...draft.business, [key]: e.target.value } })} />
            </label>
          ))}
          <label className="field">
            <span>Quotes valid for</span>
            <div className="with-suffix">
              <input
                type="number"
                min={1}
                value={draft.business.validDays}
                onChange={(e) => setDraft({ ...draft, business: { ...draft.business, validDays: Number(e.target.value) || 30 } })}
              />
              <span className="suffix">days</span>
            </div>
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Your rates</h2>
          <button className="link-btn" onClick={() => setDraft({ ...draft, rates: DEFAULT_RATES })}>
            Reset to examples
          </button>
        </div>
        <p className="muted small">
          Every price on a quote comes from these numbers. The defaults are examples only; set them to what you charge.
        </p>
        <div className="rate-grid">
          {RATE_FIELDS.map((f) => (
            <label className="field" key={f.key}>
              <span>{f.label}</span>
              <div className="with-suffix">
                <input
                  type="number"
                  step={f.step}
                  min={0}
                  value={draft.rates[f.key]}
                  onChange={(e) => setDraft({ ...draft, rates: { ...draft.rates, [f.key]: Number(e.target.value) || 0 } })}
                />
                <span className="suffix">{f.unit}</span>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>AI reading (optional, free)</h2>
        <p className="small">
          Without a key, notes are read by a built-in offline parser. With a free Google Gemini key, an AI model reads the
          note instead and handles messier speech better. Get a key at{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            aistudio.google.com/apikey
          </a>
          .
        </p>
        <div className="grid2">
          <label className="field">
            <span>Gemini API key</span>
            <div className="with-suffix">
              <input
                type={showKey ? 'text' : 'password'}
                autoComplete="off"
                value={draft.ai.geminiApiKey}
                placeholder="Paste your key"
                onChange={(e) => setDraft({ ...draft, ai: { ...draft.ai, geminiApiKey: e.target.value } })}
              />
              <button type="button" className="suffix-btn" onClick={() => setShowKey((s) => !s)}>
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>
          <label className="field">
            <span>Model</span>
            <input value={draft.ai.geminiModel} onChange={(e) => setDraft({ ...draft, ai: { ...draft.ai, geminiModel: e.target.value } })} />
          </label>
        </div>
        <p className="muted small">
          The key is saved only in this browser and sent only to Google. On the free tier, Google may use requests to improve
          its models, so avoid real customer details while testing.
        </p>
      </section>

      <section className="panel">
        <h2>Data</h2>
        <p className="muted small">
          Quotes are stored in this browser only ({quotes.length} saved). Clearing your browser data removes them.
        </p>
        <div className="row-actions">
          <button className="btn" onClick={loadSamples}>
            Load sample data
          </button>
          <button className="btn" onClick={clearSamples}>
            Clear sample data
          </button>
          <button
            className="btn danger"
            onClick={() => {
              if (window.confirm('Delete all quotes and reset settings? This cannot be undone.')) {
                resetAll()
                setDraft(DEFAULT_SETTINGS)
              }
            }}
          >
            Delete everything
          </button>
        </div>
      </section>
    </div>
  )
}
