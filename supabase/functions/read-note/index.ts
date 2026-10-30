// Supabase Edge Function: reads a painter's voice note with Gemini using a key
// kept on the server (secret GEMINI_API_KEY), so the browser never sees it.
//
// It only accepts { note } and always sends the fixed QuoteVoice prompt and schema,
// so it can't be used as a general-purpose AI proxy.
//
// Deployed from supabase/functions/read-note/. geminiCore.ts is a copy of
// src/lib/geminiCore.ts (kept in sync by `npm run sync:function`).

import { callGemini, DEFAULT_GEMINI_MODEL, GeminiError } from './geminiCore.ts'

const ALLOWED_ORIGINS = ['https://saif-byte.github.io', 'http://localhost:5173', 'http://localhost:4173']
const MAX_NOTE_CHARS = 4000

function cors(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json' } })
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) })
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405, origin)
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return json({ error: 'Origin not allowed.' }, 403, origin)

  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return json({ error: 'AI reading is not set up on the server yet.' }, 503, origin)

  let note = ''
  try {
    const body = await req.json()
    note = typeof body?.note === 'string' ? body.note.trim() : ''
  } catch {
    return json({ error: 'Send JSON like {"note": "..."}.' }, 400, origin)
  }
  if (!note) return json({ error: 'The note is empty.' }, 400, origin)
  if (note.length > MAX_NOTE_CHARS) return json({ error: `Keep notes under ${MAX_NOTE_CHARS} characters.` }, 413, origin)

  try {
    const job = await callGemini(note, key, Deno.env.get('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL)
    return json({ job }, 200, origin)
  } catch (err) {
    const message = err instanceof GeminiError ? err.message : 'The AI service failed.'
    return json({ error: message }, 502, origin)
  }
})
