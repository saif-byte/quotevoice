import { extractWithGemini } from './gemini'
import { supabase } from './supabase'
import { normalizeJob } from './normalize'
import { parseNote } from './parser'
import type { AiSettings, ExtractorName, JobSpec, RawJob } from './types'

export interface ExtractionResult {
  job: JobSpec
  extractor: ExtractorName
  /** Set when the AI was tried but failed and the offline parser was used instead. */
  fallbackReason?: string
}

/** The shared AI reader on Supabase (Edge Function "read-note"). */
async function extractOnServer(note: string): Promise<RawJob> {
  if (!supabase) throw new Error('not configured')
  const { data, error } = await supabase.functions.invoke('read-note', { body: { note } })
  if (error) {
    let detail = error.message
    try {
      const body = await (error as { context?: Response }).context?.json()
      if (body?.error) detail = body.error
    } catch {
      /* keep the generic message */
    }
    throw new Error(detail)
  }
  if (!data?.job || !Array.isArray(data.job.rooms)) throw new Error('The AI returned an unexpected answer.')
  return data.job as RawJob
}

/**
 * Step 2 of the pipeline: voice note → structured job.
 *  1. The painter's own Gemini key, if they added one in Settings.
 *  2. Otherwise the shared AI reader on the server.
 *  3. If AI is unavailable or fails, the built-in offline parser.
 */
export async function extractJob(note: string, ai: AiSettings): Promise<ExtractionResult> {
  const signedIn = Boolean(supabase && (await supabase.auth.getSession()).data.session)
  if (!ai.geminiApiKey.trim() && signedIn) {
    try {
      return { job: normalizeJob(await extractOnServer(note)), extractor: 'gemini' }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      // "Not set up" is expected until a server key is added; don't alarm the painter about it.
      const quiet = /not set up|not configured|Failed to send|fetch|Sign in|limit/i.test(reason)
      return { ...parseLocally(note), fallbackReason: quiet ? undefined : reason }
    }
  }
  if (ai.geminiApiKey.trim()) {
    try {
      const raw = await extractWithGemini(note, ai.geminiApiKey.trim(), ai.geminiModel || undefined)
      return { job: normalizeJob(raw), extractor: 'gemini' }
    } catch (err) {
      const fallbackReason = err instanceof Error ? err.message : String(err)
      return { ...parseLocally(note), fallbackReason }
    }
  }
  return parseLocally(note)
}

export function parseLocally(note: string): ExtractionResult {
  const { raw, assumptions } = parseNote(note)
  const job = normalizeJob(raw)
  job.assumptions = [...assumptions, ...job.assumptions]
  return { job, extractor: 'parser' }
}
