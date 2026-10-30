import { describe, expect, it } from 'vitest'
import { normalizeJob } from '../src/lib/normalize'
import { parseLocally } from '../src/lib/extract'
import { extractWithGemini } from '../src/lib/gemini'
import { scoreCase, type CaseScore } from '../src/lib/evaluate'
import { CASES, FIELD_CASES, HELD_OUT_CASES } from './cases'

/**
 * Extraction eval. Run with `npm run eval`.
 *   - Always scores the offline parser.
 *   - Also scores Gemini when GEMINI_API_KEY is set in the environment.
 */

function report(name: string, scores: CaseScore[]): number {
  const correct = scores.reduce((s, c) => s + c.correct, 0)
  const total = scores.reduce((s, c) => s + c.total, 0)
  const pct = Math.round((correct / total) * 1000) / 10
  console.log(`\n=== ${name}: ${correct}/${total} fields correct (${pct}%) ===`)
  for (const s of scores) {
    console.log(`  ${s.correct === s.total ? '✓' : '✗'} ${s.id.padEnd(22)} ${s.correct}/${s.total}`)
    for (const m of s.misses) console.log(`      - ${m}`)
  }
  return pct
}

describe('extraction eval', () => {
  it('offline parser', () => {
    const scores = CASES.map((c) => scoreCase(c, parseLocally(c.note).job))
    const pct = report('Offline parser: original cases', scores)
    expect(pct).toBeGreaterThanOrEqual(85)
    const field = FIELD_CASES.map((c) => scoreCase(c, parseLocally(c.note).job))
    report('Offline parser: field-test cases', field)
    const held = HELD_OUT_CASES.map((c) => scoreCase(c, parseLocally(c.note).job))
    report('Offline parser: held-out cases (not tuned on)', held)
  })

  const key = process.env.GEMINI_API_KEY
  it.skipIf(!key)('gemini', async () => {
    const scores: CaseScore[] = []
    for (const c of [...CASES, ...FIELD_CASES, ...HELD_OUT_CASES]) {
      const raw = await extractWithGemini(c.note, key!, process.env.GEMINI_MODEL || undefined)
      scores.push(scoreCase(c, normalizeJob(raw)))
    }
    report('Gemini', scores)
  }, 120_000)
})
