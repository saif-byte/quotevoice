import { ROOMS, isRoomType } from './rooms'
import type { JobSpec, Prep, RawJob, Room } from './types'

const DEFAULT_HEIGHT = 8
const DEFAULT_COATS = 2

function num(value: unknown, min: number, max: number): number | undefined {
  const n = typeof value === 'string' ? Number(value) : value
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined
  if (n < min || n > max) return undefined
  return n
}

function bool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function prep(value: unknown): Prep | undefined {
  return value === 'none' || value === 'light' || value === 'heavy' ? value : undefined
}

let idCounter = 0
export function newId(prefix = 'id'): string {
  idCounter += 1
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Turns whatever the extractor heard (RawJob) into a complete JobSpec.
 *
 * This step is the same for the AI and the offline parser. Every time it has
 * to fill a gap, it records a plain-English assumption so the painter can
 * check it before the quote goes out. That is the main trust feature.
 */
export function normalizeJob(raw: RawJob): JobSpec {
  const assumptions: string[] = []
  const jobHeight = num(raw.heightFt, 6, 30)
  const jobCoats = num(raw.coats, 1, 4)
  const rawRooms = Array.isArray(raw.rooms) ? raw.rooms : []

  let heightAssumed = false
  let coatsAssumed = false

  const rooms: Room[] = rawRooms.map((r, index) => {
    const type = isRoomType(r?.type) ? r.type : 'other'
    const info = ROOMS[type]
    const name = (typeof r?.name === 'string' && r.name.trim()) || `${info.label} ${index + 1}`

    let lengthFt = num(r?.lengthFt, 2, 200)
    let widthFt = num(r?.widthFt, 2, 200)
    if (lengthFt === undefined || widthFt === undefined) {
      lengthFt = info.defaultLength
      widthFt = info.defaultWidth
      assumptions.push(`${name}: size not mentioned, assumed a typical ${lengthFt} × ${widthFt} ft.`)
    }

    let heightFt = num(r?.heightFt, 6, 30) ?? jobHeight
    if (heightFt === undefined) {
      heightFt = DEFAULT_HEIGHT
      heightAssumed = true
    }

    let walls = bool(r?.walls) ?? false
    const ceiling = bool(r?.ceiling) ?? false
    const trim = bool(r?.trim) ?? false
    if (!walls && !ceiling && !trim) {
      walls = true
      assumptions.push(`${name}: surfaces not stated, assumed walls only.`)
    }

    let coats = num(r?.coats, 1, 4) ?? jobCoats
    if (coats === undefined) {
      coats = DEFAULT_COATS
      coatsAssumed = true
    }

    if (info.wallFactor < 1 && walls) {
      assumptions.push(
        `${name}: only ${Math.round(info.wallFactor * 100)}% of wall area counted (cabinets, tile, fixtures).`,
      )
    }

    return {
      id: `r${index + 1}`,
      name,
      type,
      lengthFt,
      widthFt,
      heightFt,
      walls,
      ceiling,
      trim,
      doors: Math.round(num(r?.doors, 0, 40) ?? 0),
      windows: Math.round(num(r?.windows, 0, 40) ?? 0),
      prep: prep(r?.prep) ?? 'none',
      wallpaper: bool(r?.wallpaper) ?? false,
      wallpaperBorder: bool(r?.wallpaperBorder) ?? false,
      colorChange: bool(r?.colorChange) ?? false,
      coats: Math.round(coats),
    }
  })

  if (heightAssumed) assumptions.push(`Ceiling height not mentioned, assumed ${DEFAULT_HEIGHT} ft.`)
  if (coatsAssumed) assumptions.push(`Number of coats not mentioned, assumed ${DEFAULT_COATS}.`)

  let paintIncluded = bool(raw.paintIncluded)
  if (paintIncluded === undefined) {
    paintIncluded = true
    assumptions.push('Paint supply not mentioned, assumed you supply the paint.')
  }

  if (rooms.length === 0) {
    assumptions.push('No rooms recognized in the note. Add rooms below or rephrase the note.')
  }

  const notes = Array.isArray(raw.notes)
    ? raw.notes.filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
    : []

  return {
    customerName: (typeof raw.customerName === 'string' && raw.customerName.trim()) || '',
    address: (typeof raw.address === 'string' && raw.address.trim()) || '',
    customerPhone: (typeof raw.customerPhone === 'string' && raw.customerPhone.trim()) || '',
    customerEmail: '',
    rooms,
    paintIncluded,
    notes,
    assumptions,
  }
}
