import { ROOMS } from './rooms'
import type { Discount, JobSpec, LineItem, RateCard, Room } from './types'

/**
 * Pricing engine: plain, deterministic code. The AI never sets a price.
 *
 * Rates are "per sq ft for 2 coats". Each coat above or below 2 changes
 * the paint labor by 30%. A dark-to-light color change adds one coat to the
 * walls only (ceilings are almost always white). Lines with nothing to
 * price (0 sq ft, 0 doors) are left out.
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
  wallpaperBorderPerLinFt: 2,
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

/** Coats on the walls: one more when going from a dark or bold color. */
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

function coatsLabel(coats: number, colorChange = false): string {
  return `${coats} coat${coats === 1 ? '' : 's'}${colorChange ? ' (covering a darker color)' : ''}`
}

export function priceJob(job: JobSpec, rates: RateCard): LineItem[] {
  const items: LineItem[] = []
  let paintSqFt = 0
  let needsTrimPaint = false

  for (const room of job.rooms) {
    const k = room.id
    const wallCoats = effectiveCoats(room)
    if (room.lengthFt <= 0 || room.widthFt <= 0 || room.heightFt <= 0) continue

    if (room.prep !== 'none') {
      const rate = room.prep === 'heavy' ? rates.prepHeavyPerRoom : rates.prepLightPerRoom
      const what = room.prep === 'heavy' ? 'drywall repair & surface prep' : 'patch holes & surface prep'
      items.push(line(`${k}:prep`, `${room.name}: ${what}`, 1, 'room', rate))
    }
    if (room.wallpaper && wallArea(room) > 0) {
      items.push(line(`${k}:wallpaper`, `${room.name}: wallpaper removal`, wallArea(room), 'sq ft', rates.wallpaperPerSqFt))
    }
    if (room.wallpaperBorder && !room.wallpaper) {
      items.push(line(`${k}:border`, `${room.name}: wallpaper border removal`, trimLength(room), 'lin ft', rates.wallpaperBorderPerLinFt))
    }
    if (room.walls && wallArea(room) > 0) {
      const area = wallArea(room)
      paintSqFt += area * wallCoats
      items.push(line(`${k}:walls`, `${room.name}: paint walls, ${coatsLabel(wallCoats, room.colorChange)}`, area, 'sq ft', rates.wallPerSqFt * coatFactor(wallCoats)))
    }
    if (room.ceiling && ceilingArea(room) > 0) {
      const area = ceilingArea(room)
      paintSqFt += area * room.coats
      items.push(line(`${k}:ceiling`, `${room.name}: paint ceiling, ${coatsLabel(room.coats)}`, area, 'sq ft', rates.ceilingPerSqFt * coatFactor(room.coats)))
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
    items.push(line('job:minimum', 'Small-job minimum (setup, travel & cleanup)', 1, 'job', rates.minimumJob - subtotal))
  }
  return items
}

export interface Totals {
  subtotal: number
  /** Money taken off (always >= 0). */
  discount: number
  tax: number
  total: number
}

/** Discount in dollars, capped so the price can never go below zero. */
export function discountAmount(subtotal: number, discount: Discount | undefined): number {
  if (!discount || !(discount.value > 0) || subtotal <= 0) return 0
  const raw = discount.type === 'percent' ? (subtotal * Math.min(discount.value, 100)) / 100 : discount.value
  return roundMoney(Math.min(raw, subtotal))
}

export function describeDiscount(discount: Discount): string {
  const size = discount.type === 'percent' ? `${discount.value}%` : formatMoney(discount.value)
  return discount.reason.trim() ? `Discount (${size}, ${discount.reason.trim()})` : `Discount (${size})`
}

/** Subtotal → minus discount → plus tax on the discounted price → total. */
export function totals(items: { amount: number }[], taxPct: number, discount?: Discount): Totals {
  const subtotal = roundMoney(items.reduce((s, i) => s + i.amount, 0))
  const off = discountAmount(subtotal, discount)
  const tax = roundMoney(((subtotal - off) * taxPct) / 100)
  return { subtotal, discount: off, tax, total: roundMoney(subtotal - off + tax) }
}

export function formatMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}
