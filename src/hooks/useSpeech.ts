import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Speech-to-text using the browser's built-in Web Speech API.
 * Free, no key, no server. Supported in Chrome, Edge and Safari; not in Firefox.
 */

interface SpeechResultLike {
  isFinal: boolean
  0: { transcript: string }
}
interface SpeechEventLike {
  resultIndex: number
  results: ArrayLike<SpeechResultLike>
}
interface RecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((e: SpeechEventLike) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

function getRecognitionClass(): (new () => RecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => RecognitionLike) | null
}

export function useSpeech(onFinalText: (text: string) => void) {
  const supported = typeof window !== 'undefined' && getRecognitionClass() !== null
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<RecognitionLike | null>(null)
  const wantRef = useRef(false)
  const onFinalRef = useRef(onFinalText)
  onFinalRef.current = onFinalText

  const stop = useCallback(() => {
    wantRef.current = false
    recRef.current?.stop()
    setListening(false)
    setInterim('')
  }, [])

  const start = useCallback(() => {
    const Rec = getRecognitionClass()
    if (!Rec) return
    setError(null)
    const rec = new Rec()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'
    rec.onresult = (e) => {
      let interimText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) onFinalRef.current(r[0].transcript.trim())
        else interimText += r[0].transcript
      }
      setInterim(interimText)
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Microphone access was blocked. Allow the microphone in your browser, or type the note instead.')
        wantRef.current = false
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setError(`Voice input stopped (${e.error}). You can keep typing or try again.`)
      }
    }
    // Browsers end recognition after a pause; restart while the user still wants it.
    rec.onend = () => {
      if (wantRef.current) {
        try {
          rec.start()
          return
        } catch {
          /* fall through */
        }
      }
      setListening(false)
      setInterim('')
    }
    recRef.current = rec
    wantRef.current = true
    try {
      rec.start()
      setListening(true)
    } catch {
      setError('Could not start the microphone. Try again or type the note.')
    }
  }, [])

  useEffect(() => () => {
    wantRef.current = false
    recRef.current?.stop()
  }, [])

  return { supported, listening, interim, error, start, stop }
}
