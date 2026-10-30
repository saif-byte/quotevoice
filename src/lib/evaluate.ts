import type { JobSpec, Prep, RoomType } from './types'

/**
 * Scoring for the extraction step: how many fields did the extractor get right
 * compared with a hand-labeled answer? Used by `npm run eval`.
 */

export interface ExpectedRoom {
  type: RoomType
  lengthFt?: number
  widthFt?: number
  heightFt?: number
  walls?: boolean
  ceiling?: boolean
  trim?: boolean
  doors?: number
  windows?: number
  prep?: Prep
  wallpaper?: boolean
  wallpaperBorder?: boolean
  colorChange?: boolean
  coats?: number
}

export interface EvalCase {
  id: string
  note: string
  customerName?: string
  paintIncluded?: boolean
  rooms: ExpectedRoom[]
}

export interface CaseScore {
  id: string
  correct: number
  total: number
  misses: string[]
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.51

export function scoreCase(c: EvalCase, job: JobSpec): CaseScore {
  let correct = 0
  let total = 0
  const misses: string[] = []
  const check = (label: string, ok: boolean, got: unknown, want: unknown) => {
    total += 1
    if (ok) correct += 1
    else misses.push(`${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
  }

  check('room count', job.rooms.length === c.rooms.length, job.rooms.length, c.rooms.length)
  if (c.customerName !== undefined) {
    check('customerName', job.customerName.toLowerCase() === c.customerName.toLowerCase(), job.customerName, c.customerName)
  }
  if (c.paintIncluded !== undefined) check('paintIncluded', job.paintIncluded === c.paintIncluded, job.paintIncluded, c.paintIncluded)

  c.rooms.forEach((want, i) => {
    const got = job.rooms[i]
    const p = `room ${i + 1}`
    if (!got) {
      const fields = Object.keys(want).length
      total += fields
      misses.push(`${p}: missing (${fields} fields)`)
      return
    }
    for (const [key, value] of Object.entries(want) as [keyof ExpectedRoom, unknown][]) {
      const actual = got[key as keyof typeof got]
      const ok = typeof value === 'number' ? typeof actual === 'number' && near(actual, value) : actual === value
      check(`${p}.${key}`, ok, actual, value)
    }
  })
  return { id: c.id, correct, total, misses }
}
