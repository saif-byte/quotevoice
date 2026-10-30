import { callGemini, DEFAULT_GEMINI_MODEL } from './geminiCore'
import type { RawJob } from './types'

/**
 * AI extractor: sends the painter's note to Google Gemini (free tier) and asks
 * for structured JSON that matches RawJob. The model only *reads* the note.
 * It does not price anything; pricing.ts does that with the painter's rates.
 *
 * Two ways to reach Gemini:
 *  - the painter's own key, stored only in their browser, straight to Google;
 *  - otherwise the shared "read-note" Supabase Edge Function, which holds the key on the server.
 */

export { buildPrompt, DEFAULT_GEMINI_MODEL, GeminiError, RESPONSE_SCHEMA } from './geminiCore'

export async function extractWithGemini(
  note: string,
  apiKey: string,
  model: string = DEFAULT_GEMINI_MODEL,
  fetchImpl: typeof fetch = fetch,
): Promise<RawJob> {
  return (await callGemini(note, apiKey, model, fetchImpl)) as unknown as RawJob
}
