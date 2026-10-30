import { ROOMS } from './rooms'
import type { JobSpec, LineItem, RateCard, Room } from './types'

/**
 * Pricing engine: plain, deterministic code. The AI never sets a price.
 *
 * Rates are "per sq ft for 2 coats". Each coat above or below 2 changes
 * the paint labor by 30%. A dark-to-light color change adds one coat.
 */

const DOOR_SQFT = 21 // standard 3 × 7 ft door
const WINDOW_SQFT = 15 // typical 3 × 5 ft window

export const DEFAULT_RATES: RateCard = {
  wallPerSqFt: 1.15,
  ceilingPerSqFt: 1.0,
  trimPerLinFt: 1.5,
  doorEach: 65,
  windowEach: 45,
  prepLightPerRoom: 60,
  prepHeavyPerRoom: 180,
  wallpaperPerSqFt: 1.25,
  paintPerGallon: 48,
  coverageSqFtPerGallon: 350,
  minimumJob: 450,
  taxPct: 0,
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export function coatFactor(coats: number): number {
  return Math.max(0.7, 1 + 0.3 * (coats - 2))
}

export function effectiveCoats(room: Room): number {
  return room.coats + (room.colorChange ? 1 : 0)
}

export function wallArea(room: Room): number {
  const perimeter = 2 * (room.lengthFt + room.widthFt)
  const gross = perimeter * room.heightFt * ROOMS[room.type].wallFactor
  return Math.max(0, Math.round(gross - room.doors * DOOR_SQFT - room.windows * WINDOW_SQFT))
}

export function ceilingArea(room: Room): number {
  return Math.round(room.lengthFt * room.widthFt)
}

export function trimLength(room: Room): number {
  return Math.round(2 * (room.lengthFt + room.widthFt))
}

function line(key: string, description: string, qty: number, unit: string, rate: number): LineItem {
  const r = roundMoney(rate)
  return { key, description, qty, unit, rate: r, amount: roundMoney(qty * r) }
}

function coatsLabel(room: Room): string {
  const c = effectiveCoats(room)
  return `${c} coat${c === 1 ? '' : 's'}${room.colorChange ? ' (color change)' : ''}`
}

export function priceJob(job: JobSpec, rates: RateCard): LineItem[] {
  const items: LineItem[] = []
  let paintSqFt = 0
  let needsTrimPaint = false

  for (const room of job.rooms) {
    const k = room.id
    const factor = coatFactor(effectiveCoats(room))

    if (room.prep !== 'none') {
      const rate = room.prep === 'heavy' ? rates.prepHeavyPerRoom : rates.prepLightPerRoom
      items.push(line(`${k}:prep`, `${room.name}: patch & prep (${room.prep})`, 1, 'room', rate))
    }
    if (room.wallpaper) {
      const area = wallArea(room)
      items.push(line(`${k}:wallpaper`, `${room.name}: wallpaper removal`, area, 'sq ft', rates.wallpaperPerSqFt))
    }
    if (room.walls) {
      const area = wallArea(room)
      paintSqFt += area * effectiveCoats(room)
      items.push(line(`${k}:walls`, `${room.name}: paint walls, ${coatsLabel(room)}`, area, 'sq ft', rates.wallPerSqFt * factor))
    }
    if (room.ceiling) {
      const area = ceilingArea(room)
      paintSqFt += area * effectiveCoats(room)
      items.push(line(`${k}:ceiling`, `${room.name}: paint ceiling, ${coatsLabel(room)}`, area, 'sq ft', rates.ceilingPerSqFt * factor))
    }
    if (room.trim) {
      needsTrimPaint = true
      items.push(line(`${k}:trim`, `${room.name}: baseboards & trim`, trimLength(room), 'lin ft', rates.trimPerLinFt))
    }
    if (room.doors > 0) {
      needsTrimPaint = true
      items.push(line(`${k}:doors`, `${room.name}: doors & frames`, room.doors, 'door', rates.doorEach))
    }
    if (room.windows > 0) {
      needsTrimPaint = true
      items.push(line(`${k}:windows`, `${room.name}: window casings`, room.windows, 'window', rates.windowEach))
    }
  }

  if (job.paintIncluded && (paintSqFt > 0 || needsTrimPaint)) {
    const gallons = Math.ceil(paintSqFt / Math.max(1, rates.coverageSqFtPerGallon)) + (needsTrimPaint ? 1 : 0)
    items.push(line('job:paint', 'Paint & materials (premium interior paint, sundries)', gallons, 'gal', rates.paintPerGallon))
  }

  const subtotal = items.reduce((s, i) => s + i.amount, 0)
  if (items.length > 0 && subtotal < rates.minimumJob) {
    items.push(line('job:minimum', 'Minimum job charge adjustment', 1, 'job', rates.minimumJob - subtotal))
  }
  return items
}

export interface Totals {
  subtotal: number
  tax: number
  total: number
}

export function totals(items: { amount: number }[], taxPct: number): Totals {
  const subtotal = roundMoney(items.reduce((s, i) => s + i.amount, 0))
  const tax = roundMoney((subtotal * taxPct) / 100)
  return { subtotal, tax, total: roundMoney(subtotal + tax) }
}

export function formatMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}
