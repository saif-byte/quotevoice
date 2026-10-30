// Core data model for QuoteVoice.
//
// The flow is:  voice note (text)  →  RawJob  →  JobSpec  →  LineItem[]  →  Quote
//   - RawJob:   what the extractor (AI or parser) heard. Anything not said is left empty.
//   - JobSpec:  RawJob with sensible defaults filled in. Every default is written down
//               as an "assumption" so the painter can see and correct it.
//   - LineItem: priced lines, produced by plain code from JobSpec + the painter's rates.

export type RoomType =
  | 'master_bedroom'
  | 'bedroom'
  | 'kids_bedroom'
  | 'nursery'
  | 'living_room'
  | 'family_room'
  | 'dining_room'
  | 'kitchen'
  | 'bathroom'
  | 'powder_room'
  | 'hallway'
  | 'office'
  | 'laundry_room'
  | 'basement'
  | 'stairwell'
  | 'entryway'
  | 'sunroom'
  | 'garage'
  | 'other'

export type Prep = 'none' | 'light' | 'heavy'

/** A room as heard in the voice note. `undefined` / `null` = not mentioned. */
export interface RawRoom {
  name: string
  type: RoomType
  lengthFt?: number | null
  widthFt?: number | null
  heightFt?: number | null
  walls?: boolean | null
  ceiling?: boolean | null
  trim?: boolean | null
  doors?: number | null
  windows?: number | null
  prep?: Prep | null
  wallpaper?: boolean | null
  wallpaperBorder?: boolean | null
  colorChange?: boolean | null
  coats?: number | null
}

export interface RawJob {
  customerName?: string | null
  address?: string | null
  rooms: RawRoom[]
  coats?: number | null
  heightFt?: number | null
  paintIncluded?: boolean | null
  /** Things mentioned that the quote does not price (e.g. "cabinets are staying"). */
  notes?: string[] | null
}

/** A fully specified room, ready to price. */
export interface Room {
  id: string
  name: string
  type: RoomType
  lengthFt: number
  widthFt: number
  heightFt: number
  walls: boolean
  ceiling: boolean
  trim: boolean
  doors: number
  windows: number
  prep: Prep
  wallpaper: boolean
  wallpaperBorder: boolean
  /** Dark or bold walls going lighter: one extra coat on the walls only. */
  colorChange: boolean
  coats: number
}

export interface JobSpec {
  customerName: string
  address: string
  rooms: Room[]
  paintIncluded: boolean
  notes: string[]
  /** Every value the system filled in because the note didn't say it. */
  assumptions: string[]
}

export interface RateCard {
  wallPerSqFt: number
  ceilingPerSqFt: number
  trimPerLinFt: number
  doorEach: number
  windowEach: number
  prepLightPerRoom: number
  prepHeavyPerRoom: number
  wallpaperPerSqFt: number
  wallpaperBorderPerLinFt: number
  paintPerGallon: number
  coverageSqFtPerGallon: number
  minimumJob: number
  taxPct: number
}

export interface LineItem {
  /** Stable key, e.g. "r1:walls". Used to detect which AI lines the painter changed. */
  key: string
  description: string
  qty: number
  unit: string
  rate: number
  amount: number
}

/** A discount the painter agrees to, applied after the line items and before tax. */
export interface Discount {
  type: 'percent' | 'amount'
  value: number
  /** Optional reason shown to the customer, e.g. "Returning customer". */
  reason: string
}

export type QuoteStatus = 'draft' | 'sent' | 'won' | 'lost'
export type ExtractorName = 'gemini' | 'parser'

export interface Quote {
  id: string
  number: string
  createdAt: string
  status: QuoteStatus
  transcript: string
  extractor: ExtractorName
  job: JobSpec
  /** Line items exactly as first generated from the AI's reading of the note. */
  aiLineItems: LineItem[]
  /** Line items as the painter finally sent them. */
  lineItems: LineItem[]
  discount?: Discount
  /** When the painter started recording/typing, and when they finalized. */
  captureStartedAt: string
  finalizedAt?: string
  decidedAt?: string
  isSample?: boolean
  /** Random code in the short customer link (#/q/<code>), set when the quote is finished. */
  shareToken?: string
  /** Set when the homeowner clicks Accept on the customer link. */
  acceptedName?: string
  acceptedAt?: string
}

export interface BusinessInfo {
  name: string
  phone: string
  email: string
  license: string
  validDays: number
}

export interface AiSettings {
  geminiApiKey: string
  geminiModel: string
}

export interface Settings {
  business: BusinessInfo
  rates: RateCard
  ai: AiSettings
}
