import { ROOM_TYPES } from './rooms'
import type { RawJob } from './types'

/**
 * AI extractor: sends the painter's note to Google Gemini (free tier) and asks
 * for structured JSON that matches RawJob. The model only *reads* the note.
 * It does not price anything; pricing.ts does that with the painter's rates.
 *
 * The API key is stored only in the user's own browser (localStorage) and the
 * request goes straight from their browser to Google.
 */

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'

const nullable = (type: string, extra: Record<string, unknown> = {}) => ({ type, nullable: true, ...extra })

export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    customerName: nullable('STRING'),
    address: nullable('STRING'),
    coats: nullable('INTEGER', { description: 'Coats for the whole job, if stated once for everything' }),
    heightFt: nullable('NUMBER', { description: 'Ceiling height for the whole job, if stated once for everything' }),
    paintIncluded: nullable('BOOLEAN', { description: 'false if the customer supplies the paint, true if the painter does, null if not said' }),
    notes: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Anything mentioned that is not interior wall/ceiling/trim painting, e.g. cabinets, exterior, furniture' },
    rooms: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', description: 'Short name, e.g. "Master bedroom", "Bedroom 2", "Upstairs bathroom"' },
          type: { type: 'STRING', enum: ROOM_TYPES },
          lengthFt: nullable('NUMBER'),
          widthFt: nullable('NUMBER'),
          heightFt: nullable('NUMBER'),
          walls: nullable('BOOLEAN'),
          ceiling: nullable('BOOLEAN'),
          trim: nullable('BOOLEAN', { description: 'Baseboards, trim, crown, casings' }),
          doors: nullable('INTEGER', { description: 'Number of doors to paint' }),
          windows: nullable('INTEGER', { description: 'Number of window casings to paint' }),
          prep: nullable('STRING', { enum: ['none', 'light', 'heavy'], description: 'light = nail holes, small cracks, caulking. heavy = water damage, drywall repair, skim coat, lots of patching' }),
          wallpaper: nullable('BOOLEAN', { description: 'Full wallpaper on the walls needs removing' }),
          wallpaperBorder: nullable('BOOLEAN', { description: 'Only a wallpaper border/strip needs removing' }),
          colorChange: nullable('BOOLEAN', { description: 'Walls going from a dark or bold color to lighter, needing an extra coat. Not for similar light colors (beige to gray).' }),
          coats: nullable('INTEGER'),
        },
        required: ['name', 'type'],
      },
    },
  },
  required: ['rooms'],
}

export function buildPrompt(note: string): string {
  return [
    'You read voice notes that house painters record after walking through an interior painting job.',
    'Extract the job as JSON matching the schema.',
    'Rules:',
    '- Only record what the painter actually said. If something is not mentioned, use null. Never guess sizes, counts or heights.',
    '- One entry per room. "Two bedrooms" means two entries ("Bedroom 1", "Bedroom 2") sharing the details given.',
    '- Dimensions: "12 by 14" means lengthFt 14, widthFt 12. "9 foot ceilings" is heightFt, not a surface to paint.',
    '- A surface is only true if the painter says it gets painted; "ceiling is fine" or "skip the ceiling" means false.',
    '- Put coats/heightFt at the top level only when stated for the whole job; per room when stated for that room.',
    '- Only include rooms that are part of THIS job. Leave out rooms mentioned as past work ("we did their kitchen last year"), turned-down requests ("she asked about the garage but…"), exterior items, or landmarks ("the powder room off the kitchen" is one room: the powder room).',
    '- Speakers correct themselves: "fourteen by twelve no wait twelve by twelve" means 12 by 12. Use the corrected value.',
    '- "Ceiling and trim are staying as is" means ceiling false and trim false.',
    '- A statement for the whole house ("the whole house needs light patching", "ceilings are 8 foot throughout") applies to every room unless a room says otherwise.',
    '- Speech-to-text may contain errors; read it as a painter would.',
    '',
    'Voice note:',
    '"""',
    note,
    '"""',
  ].join('\n')
}

export class GeminiError extends Error {}

export async function extractWithGemini(
  note: string,
  apiKey: string,
  model: string = DEFAULT_GEMINI_MODEL,
  fetchImpl: typeof fetch = fetch,
): Promise<RawJob> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildPrompt(note) }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  })
  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      detail = body?.error?.message ?? ''
    } catch {
      /* ignore */
    }
    throw new GeminiError(`Gemini returned ${res.status}${detail ? `: ${detail}` : ''}`)
  }
  const body = await res.json()
  const text: string | undefined = body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('')
  if (!text) throw new GeminiError('Gemini returned an empty response')
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new GeminiError('Gemini returned something that is not JSON')
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as RawJob).rooms)) {
    throw new GeminiError('Gemini response is missing the rooms list')
  }
  return parsed as RawJob
}
