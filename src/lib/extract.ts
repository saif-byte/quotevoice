import { extractWithGemini } from './gemini'
import { normalizeJob } from './normalize'
import { parseNote } from './parser'
import type { AiSettings, ExtractorName, JobSpec } from './types'

export interface ExtractionResult {
  job: JobSpec
  extractor: ExtractorName
  /** Set when the AI was tried but failed and the offline parser was used instead. */
  fallbackReason?: string
}

/**
 * Step 2 of the pipeline: voice note → structured job.
 * Uses Gemini when a key is set, otherwise (or if Gemini fails) the offline parser.
 */
export async function extractJob(note: string, ai: AiSettings): Promise<ExtractionResult> {
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
