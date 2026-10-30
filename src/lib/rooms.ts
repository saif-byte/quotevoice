import type { RoomType } from './types'

export interface RoomInfo {
  label: string
  /** Words a painter might say for this room (lowercase). Longest phrases are matched first. */
  aliases: string[]
  /** Typical size used when the note doesn't give one. */
  defaultLength: number
  defaultWidth: number
  /** Share of wall area that is actually painted (kitchens lose wall to cabinets). */
  wallFactor: number
}

export const ROOMS: Record<RoomType, RoomInfo> = {
  master_bedroom: { label: 'Master bedroom', aliases: ['master bedroom', 'primary bedroom', 'main bedroom', 'master suite'], defaultLength: 16, defaultWidth: 14, wallFactor: 1 },
  kids_bedroom: { label: "Kid's bedroom", aliases: ["kids bedroom", "kid's bedroom", 'kids room', "kid's room", "kids' bedroom", "kids' room"], defaultLength: 12, defaultWidth: 11, wallFactor: 1 },
  bedroom: { label: 'Bedroom', aliases: ['guest bedroom', 'guest room', 'spare bedroom', 'spare room', 'bedroom'], defaultLength: 12, defaultWidth: 12, wallFactor: 1 },
  nursery: { label: 'Nursery', aliases: ['nursery'], defaultLength: 11, defaultWidth: 10, wallFactor: 1 },
  living_room: { label: 'Living room', aliases: ['living room', 'lounge'], defaultLength: 20, defaultWidth: 16, wallFactor: 1 },
  family_room: { label: 'Family room', aliases: ['family room', 'great room', 'den'], defaultLength: 18, defaultWidth: 16, wallFactor: 1 },
  dining_room: { label: 'Dining room', aliases: ['dining room'], defaultLength: 14, defaultWidth: 12, wallFactor: 1 },
  kitchen: { label: 'Kitchen', aliases: ['kitchen'], defaultLength: 14, defaultWidth: 12, wallFactor: 0.6 },
  powder_room: { label: 'Powder room', aliases: ['powder room', 'half bath'], defaultLength: 6, defaultWidth: 5, wallFactor: 1 },
  bathroom: { label: 'Bathroom', aliases: ['bathroom', 'bath room', 'bath'], defaultLength: 10, defaultWidth: 8, wallFactor: 0.85 },
  hallway: { label: 'Hallway', aliases: ['hallway', 'hall way', 'hall', 'corridor'], defaultLength: 16, defaultWidth: 4, wallFactor: 1 },
  office: { label: 'Office', aliases: ['home office', 'office', 'study'], defaultLength: 12, defaultWidth: 10, wallFactor: 1 },
  laundry_room: { label: 'Laundry room', aliases: ['laundry room', 'laundry', 'mudroom', 'mud room'], defaultLength: 8, defaultWidth: 7, wallFactor: 0.8 },
  basement: { label: 'Basement', aliases: ['basement'], defaultLength: 25, defaultWidth: 20, wallFactor: 1 },
  stairwell: { label: 'Stairwell', aliases: ['stairwell', 'stairway', 'staircase', 'stairs'], defaultLength: 14, defaultWidth: 4, wallFactor: 1 },
  entryway: { label: 'Entryway', aliases: ['entryway', 'entry way', 'foyer', 'entry'], defaultLength: 10, defaultWidth: 8, wallFactor: 1 },
  sunroom: { label: 'Sunroom', aliases: ['sunroom', 'sun room'], defaultLength: 14, defaultWidth: 12, wallFactor: 0.7 },
  garage: { label: 'Garage', aliases: ['garage'], defaultLength: 22, defaultWidth: 20, wallFactor: 1 },
  other: { label: 'Room', aliases: [], defaultLength: 12, defaultWidth: 12, wallFactor: 1 },
}

export const ROOM_TYPES = Object.keys(ROOMS) as RoomType[]

export function isRoomType(value: unknown): value is RoomType {
  return typeof value === 'string' && value in ROOMS
}
