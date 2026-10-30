import { ROOMS, ROOM_TYPES } from './rooms'
import type { Prep, RawJob, RawRoom, RoomType } from './types'

/**
 * Offline parser: a rule-based fallback that turns a painter's note into a RawJob.
 *
 * It runs entirely in the browser with no API key, so the demo always works.
 * The Gemini extractor (gemini.ts) is the "real" AI path; this parser is the
 * safety net and the baseline it is measured against (see eval/).
 */

const ONES: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
}
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60 }

/** "twenty two" → "22", "nine foot" → "9 foot", "a couple of doors" → "2 doors". */
export function wordsToNumbers(text: string): string {
  let t = text
  t = t.replace(
    new RegExp(`\\b(${Object.keys(TENS).join('|')})[\\s-](${Object.keys(ONES).slice(0, 9).join('|')})\\b`, 'g'),
    (_, tens: string, ones: string) => String(TENS[tens] + ONES[ones]),
  )
  t = t.replace(new RegExp(`\\b(${Object.keys(TENS).join('|')})\\b`, 'g'), (w: string) => String(TENS[w]))
  t = t.replace(new RegExp(`\\b(${Object.keys(ONES).join('|')})\\b`, 'g'), (w: string) => String(ONES[w]))
  t = t.replace(/\b(?:a\s+)?(?:couple|pair)\s+(?:of\s+)?/g, '2 ')
  t = t.replace(/\bsingle\s+coat\b/g, '1 coat')
  return t
}

const NEGATION = /\b(no|not|skip|skipping|except|without|don't|dont|doesn't|doesnt|leave|leaving|excluding|minus)\b[^,;]*$/
const FINE_AFTER = /^\s*(is|are|look|looks|seem|seems)\s+(fine|good|ok|okay|in good shape|great)/

/** 'yes' if the thing is mentioned positively, 'no' if only negatively, null if not at all. */
function mention(text: string, re: RegExp): 'yes' | 'no' | null {
  const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
  let result: 'yes' | 'no' | null = null
  for (const m of text.matchAll(global)) {
    const start = m.index ?? 0
    const before = text.slice(Math.max(0, start - 30), start)
    const after = text.slice(start + m[0].length, start + m[0].length + 30)
    const negative = NEGATION.test(before) || FINE_AFTER.test(after)
    if (!negative) return 'yes'
    result = 'no'
  }
  return result
}

function yesNo(v: 'yes' | 'no' | null): boolean | null {
  return v === null ? null : v === 'yes'
}

function titleCase(s: string): string {
  return s.replace(/\b([a-z])([a-z'’]*)/g, (_, a: string, b: string) => a.toUpperCase() + b)
}

// ---------- room mentions ----------

interface Mention {
  start: number
  end: number
  type: RoomType
  name: string
  count: number
  plural: boolean
  isNew: boolean
}

const ALIASES: { alias: string; type: RoomType }[] = ROOM_TYPES.flatMap((type) =>
  ROOMS[type].aliases.map((alias) => ({ alias, type })),
).sort((a, b) => b.alias.length - a.alias.length)

const QUALIFIERS = ['upstairs', 'downstairs', 'main', 'front', 'back', 'small', 'big', 'large', 'second', 'guest', 'hall', 'basement', 'master', 'kids', 'spare']

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\']/g, (c) => (c === "'" ? "['’]?" : '\\' + c))
}

function findMentions(text: string): Mention[] {
  const taken: [number, number][] = []
  const found: Mention[] = []
  for (const { alias, type } of ALIASES) {
    const re = new RegExp(`\\b${escapeRe(alias)}(s|es)?\\b`, 'g')
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0
      const end = start + m[0].length
      if (taken.some(([a, b]) => start < b && end > a)) continue
      taken.push([start, end])

      const before = text.slice(Math.max(0, start - 30), start)
      const plural = Boolean(m[1])
      let count = 1
      const countMatch = before.match(/(?:^|\s)(\d+|both)\s+(?:(?:of\s+the|the|small|big|large|kids?['’]?|upstairs|downstairs|guest|spare|other)\s+)*$/)
      if (countMatch && (plural || countMatch[1] === 'both')) {
        count = countMatch[1] === 'both' ? 2 : Math.min(6, Math.max(1, Number(countMatch[1])))
      } else if (plural && type !== 'other' && !/stairs$/.test(m[0])) {
        count = 2
      }

      const qualifier = before.match(new RegExp(`\\b(${QUALIFIERS.join('|')})\\s+$`))?.[1]
      const isNew = /\b(other|another|second|2nd|third|3rd)\s+(?:\w+\s+)?$/.test(before)
      let name = titleCase(alias).replace(/^(\w)/, (c) => c.toUpperCase())
      name = name.charAt(0) + name.slice(1).toLowerCase()
      if (qualifier && !alias.startsWith(qualifier) && !['second', 'other'].includes(qualifier)) {
        name = `${qualifier.charAt(0).toUpperCase()}${qualifier.slice(1)} ${name.toLowerCase()}`
      }
      found.push({ start, end, type, name, count, plural, isNew })
    }
  }
  return found.sort((a, b) => a.start - b.start)
}

// ---------- per-segment extraction ----------

interface SegmentInfo {
  lengthFt: number | null
  widthFt: number | null
  heightFt: number | null
  walls: boolean | null
  ceiling: boolean | null
  trim: boolean | null
  doors: number | null
  windows: number | null
  prep: Prep | null
  wallpaper: boolean | null
  colorChange: boolean | null
  coats: number | null
}

const FT = `(?:feet|foot|ft|'|’)`
const HEIGHT_PATTERNS: RegExp[] = [
  new RegExp(`(\\d+(?:\\.\\d+)?)\\s*-?\\s*${FT}\\s*(?:high\\s+|tall\\s+)?ceilings?`, 'g'),
  new RegExp(`ceilings?\\s+(?:are|is|at|of)\\s*(?:about|around|roughly|maybe)?\\s*(\\d+(?:\\.\\d+)?)\\s*${FT}?(?:\\s*(?:high|tall))?`, 'g'),
  new RegExp(`ceilings?\\s+(?:about|around|roughly|maybe)?\\s*(\\d+(?:\\.\\d+)?)\\s*${FT}(?:\\s*(?:high|tall))?`, 'g'),
  new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${FT}\\s+(?:high|tall)`, 'g'),
]

function extractHeight(text: string): { height: number | null; rest: string } {
  let rest = text
  let height: number | null = null
  for (const re of HEIGHT_PATTERNS) {
    rest = rest.replace(re, (whole: string, n: string) => {
      const v = Number(n)
      if (v < 6 || v > 30) return whole
      if (height === null) height = v
      return ' '.repeat(whole.length)
    })
  }
  if (height === null && /\b(vaulted|cathedral)\b/.test(rest)) height = 12
  return { height, rest }
}

function countOf(text: string, singular: string): number | null {
  const v = mention(text, new RegExp(`\\b${singular}s?\\b`))
  if (v !== 'yes') return v === 'no' ? 0 : null
  const m = text.match(new RegExp(`(\\d+)\\s+(?:[a-z]+\\s+){0,2}${singular}s?\\b`))
  if (m) return Math.min(40, Number(m[1]))
  return new RegExp(`\\b${singular}s\\b`).test(text) ? 2 : 1
}

function extractSegment(segment: string): SegmentInfo {
  const { height, rest } = extractHeight(segment)
  let text = rest

  let lengthFt: number | null = null
  let widthFt: number | null = null
  const dims = text.match(/(\d+(?:\.\d+)?)\s*(?:feet|foot|ft|'|’)?\s*(?:by|x|×)\s*(\d+(?:\.\d+)?)/)
  if (dims) {
    lengthFt = Math.max(Number(dims[1]), Number(dims[2]))
    widthFt = Math.min(Number(dims[1]), Number(dims[2]))
    text = text.replace(dims[0], ' '.repeat(dims[0].length))
  } else {
    const area = text.match(/(\d{2,4})\s*(?:square\s*(?:feet|foot)|sq\.?\s*ft|sqft)/)
    if (area) {
      const side = Math.round(Math.sqrt(Number(area[1])) * 10) / 10
      lengthFt = side
      widthFt = side
    }
  }

  const everything = /\b(everything|top to bottom|the works|whole room|full repaint|all surfaces)\b/.test(text)
  const walls = everything ? true : yesNo(mention(text, /\bwalls?\b/))
  const ceiling = everything ? true : yesNo(mention(text, /\bceilings?\b/))
  const trim = everything
    ? true
    : yesNo(mention(text, /\b(trim|baseboards?|base boards?|crown mou?ldings?|mou?ldings?|casings?)\b/))

  let prep: Prep | null = null
  if (/(lots of|a lot of|heavy|major|significant|extensive|serious)\s+(?:\w+\s+)?(patch|repair|crack|hole|damage|prep)|water damage|drywall repair|skim coat|peeling/.test(text)) {
    prep = 'heavy'
  } else {
    const light = mention(text, /\b(patch(?:ing|es)?|nail holes?|cracks?|holes|scuffs?|caulk(?:ing)?|sanding|touch ?ups?|prep)\b/)
    if (light === 'yes') prep = 'light'
    else if (light === 'no') prep = 'none'
  }

  const wallpaper = yesNo(mention(text, /\bwall ?paper\b/))
  let colorChange: boolean | null = null
  if (/\b(dark|darker|navy|deep red|bright red|bold colou?r|black|color change|colour change|extra coat|additional coat|third coat)\b|going from \w+ to/.test(text)) {
    colorChange = true
  }

  // Use the last mention: "one coat of primer… so two coats total" → 2.
  let coats: number | null = null
  const coatMatches = [...text.matchAll(/\b(\d)\s*coats?\b/g)]
  if (coatMatches.length) coats = Math.min(4, Math.max(1, Number(coatMatches[coatMatches.length - 1][1])))

  return {
    lengthFt,
    widthFt,
    heightFt: height,
    walls,
    ceiling,
    trim,
    doors: countOf(text, 'door'),
    windows: countOf(text, 'window'),
    prep,
    wallpaper,
    colorChange,
    coats,
  }
}

// ---------- whole-note fields ----------

const NAME_STOP = new Set([
  'at', 'on', 'in', 'the', 'and', 'her', 'his', 'their', 'house', 'home', 'place', 'residence', 'is', 'has',
  'wants', 'needs', 'who', 'for', 'with', 'about', 'over', 'up', 'down', 'by', 'a', 'an', 'this', 'that',
  'job', 'quote', 'estimate', 'interior', 'exterior', 'living', 'master', 'kitchen', 'two', 'three',
])

export function extractCustomerName(original: string): string | null {
  const patterns = [
    /\b(?:quote|estimate|job|bid|work|this is|it's|it is)\s+(?:is\s+)?for\s+(?:the\s+)?((?:mr|mrs|ms|dr)\.?\s+)?([a-z][a-z'’-]+)(?:\s+([a-z][a-z'’-]+))?/i,
    /\b(?:customer|client|homeowner|owner)(?:['’]s name)?\s*(?:is|:|name is|named)\s+((?:mr|mrs|ms|dr)\.?\s+)?([a-z][a-z'’-]+)(?:\s+([a-z][a-z'’-]+))?/i,
  ]
  for (const re of patterns) {
    const m = original.match(re)
    if (!m) continue
    const first = m[2]
    if (NAME_STOP.has(first.toLowerCase())) continue
    const second = m[3] && !NAME_STOP.has(m[3].toLowerCase()) ? m[3] : ''
    const title = m[1] ? titleCase(m[1].trim().replace(/\.?$/, '.').toLowerCase()) + ' ' : ''
    return (title + titleCase(`${first} ${second}`.trim().toLowerCase())).trim()
  }
  return null
}

export function extractAddress(lower: string): string | null {
  const m = lower.match(
    /\b(\d{1,6}\s+(?:[a-z]+\s+){1,3}(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|boulevard|blvd|way|place|pl|circle|cir|terrace|parkway|pkwy|trail|trl))\b/,
  )
  return m ? titleCase(m[1]) : null
}

function extractPaintIncluded(lower: string): boolean | null {
  if (
    /\b(customer|homeowner|client|owner|they|she|he|they're|she's|he's)\s*(?:is|are|will be|will|already|'s|'re)?\s*(?:supplying|providing|buying|bought|supply|provide|buy|getting|get|picked|picking|has|have|got)\s+(?:out\s+)?(?:the\s+|their\s+|her\s+|his\s+)?(?:own\s+)?paint/.test(lower) ||
    /\bpaint\s+(?:is\s+|will be\s+)?(?:supplied|provided|bought|purchased)\s+by\s+(?:the\s+)?(?:customer|homeowner|client|owner|them)/.test(lower) ||
    /\blabou?r only\b/.test(lower)
  ) {
    return false
  }
  if (/\b(we're|we are|we'll|we will|i'll|i will|i'm|i am|we)\s+(?:supplying|providing|buying|supply|provide|including|include|getting|get)\s+(?:the\s+|all\s+the\s+)?(?:paint|materials)/.test(lower) || /\bpaint (?:is )?included\b/.test(lower)) {
    return true
  }
  return null
}

const NOTE_KEYWORDS = /\b(cabinets?|exterior|outside|deck|fence|siding|shutters|garage door|furniture|move (?:the )?furniture|stain(?:ing)?|epoxy|popcorn)\b/

const GLOBAL_MARKERS = /\b(throughout|everywhere|all (?:the )?rooms|whole (?:house|place|job|thing)|every room|each room|all of (?:them|it)|everything|all of the rooms)\b/

// ---------- main ----------

export interface ParseResult {
  raw: RawJob
  assumptions: string[]
}

/** First word of a room name, ignoring generic words: "Guest bedroom" and "Guest room" → "guest". */
function aliasFamily(name: string): string {
  const words = name.toLowerCase().split(/\s+/)
  return words.length > 1 ? words[0] : ''
}

interface RoomAcc {
  room: RawRoom
  segments: string[]
  sharedSegments: string[]
}

export function parseNote(note: string): ParseResult {
  const assumptions: string[] = []
  const lower = wordsToNumbers(note.toLowerCase())
  const sentences = lower
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const rooms: RoomAcc[] = []
  const globalText: string[] = []
  let lastRooms: RoomAcc[] = []

  const roomFor = (m: Mention): RoomAcc[] => {
    const created: RoomAcc[] = []
    if (m.count === 1 && !m.isNew) {
      const existing = rooms.find((r) => r.room.name.toLowerCase() === m.name.toLowerCase())
      if (existing) return [existing]
      // "guest bedroom" … later "guest room": same room if it's the only one of that type.
      const sameType = rooms.filter((r) => r.room.type === m.type)
      if (sameType.length === 1 && m.type !== 'other' && aliasFamily(sameType[0].room.name) === aliasFamily(m.name)) return sameType

    }
    const sameName = rooms.filter((r) => r.room.name.toLowerCase().startsWith(m.name.toLowerCase())).length
    for (let i = 0; i < m.count; i++) {
      const n = sameName + i + 1
      const name = m.count > 1 || sameName > 0 ? `${m.name} ${n}` : m.name
      const acc: RoomAcc = { room: { name, type: m.type }, segments: [], sharedSegments: [] }
      rooms.push(acc)
      created.push(acc)
    }
    return created
  }

  for (const sentence of sentences) {
    const mentions = findMentions(sentence)
    if (mentions.length === 0) {
      const isGlobal = GLOBAL_MARKERS.test(sentence) || lastRooms.length === 0
      const heightOnly = extractHeight(sentence).height !== null && sentence.replace(/[^a-z]/g, '').length < 60
      if (isGlobal || heightOnly) globalText.push(sentence)
      else lastRooms.forEach((r) => r.segments.push(sentence))
      continue
    }

    // Split the sentence at each room mention. Text before the first mention belongs to it.
    const groups: { accs: RoomAcc[]; text: string }[] = mentions.map((m, i) => {
      const from = i === 0 ? 0 : m.start
      const to = i + 1 < mentions.length ? mentions[i + 1].start : sentence.length
      const own = sentence.slice(from, to).replace(sentence.slice(m.start, m.end), ' ')
      return { accs: roomFor(m), text: own }
    })

    // "the bedroom and the bathroom both need walls" → both rooms share the details.
    for (let i = groups.length - 2; i >= 0; i--) {
      const stripped = groups[i].text.replace(/\b(and|the|plus|also|as well as|both|in|of)\b|[,&\s]/g, '')
      if (stripped.length === 0) groups[i].accs.forEach((a) => a.sharedSegments.push(groups[i + 1].text))
    }
    groups.forEach((g) => g.accs.forEach((a) => a.segments.push(g.text)))
    lastRooms = groups[groups.length - 1].accs
    for (const m of mentions) {
      if (m.plural && m.count === 2 && !/(\d+|both)\s+(?:\w+\s+)?$/.test(sentence.slice(Math.max(0, m.start - 20), m.start))) {
        assumptions.push(`"${m.name}s" mentioned without a number, assumed 2.`)
      }
    }
  }

  // Combine everything heard about each room.
  for (const acc of rooms) {
    const infos = [...acc.segments, ...acc.sharedSegments].map(extractSegment)
    const own = acc.segments.map(extractSegment)
    const first = <K extends keyof SegmentInfo>(list: SegmentInfo[], key: K): SegmentInfo[K] | null => {
      for (const info of list) if (info[key] !== null) return info[key]
      return null
    }
    const r = acc.room
    r.lengthFt = first(own, 'lengthFt')
    r.widthFt = first(own, 'widthFt')
    r.heightFt = first(own, 'heightFt')
    r.walls = first(infos, 'walls')
    r.ceiling = first(infos, 'ceiling')
    r.trim = first(infos, 'trim')
    r.doors = first(own, 'doors')
    r.windows = first(own, 'windows')
    r.prep = first(infos, 'prep')
    r.wallpaper = first(infos, 'wallpaper')
    r.colorChange = first(infos, 'colorChange')
    r.coats = first(infos, 'coats')
    if (r.doors !== null && r.doors !== undefined && /\bdoors\b/.test(acc.segments.join(' ')) && !/\d+\s+(?:[a-z]+\s+){0,2}doors?\b/.test(acc.segments.join(' '))) {
      assumptions.push(`${r.name}: "doors" mentioned without a count, assumed 2.`)
    }
    if (r.windows !== null && r.windows !== undefined && /\bwindows\b/.test(acc.segments.join(' ')) && !/\d+\s+(?:[a-z]+\s+){0,2}windows?\b/.test(acc.segments.join(' '))) {
      assumptions.push(`${r.name}: "windows" mentioned without a count, assumed 2.`)
    }
  }

  // Whole-job details: said before any room, or with "throughout", "every room", etc.
  const global = extractSegment(globalText.join('. '))
  for (const { room } of rooms) {
    if (room.walls == null && room.ceiling == null && room.trim == null) {
      room.walls = global.walls
      room.ceiling = global.ceiling
      room.trim = global.trim
    }
    room.prep ??= global.prep
  }

  const notes = sentences
    .filter((s) => NOTE_KEYWORDS.test(s))
    .map((s) => {
      const clipped = s.length > 90 ? s.slice(0, 87) + '…' : s
      return clipped.charAt(0).toUpperCase() + clipped.slice(1)
    })

  return {
    raw: {
      customerName: extractCustomerName(note),
      address: extractAddress(lower),
      rooms: rooms.map((r) => r.room),
      coats: global.coats,
      heightFt: global.heightFt,
      paintIncluded: extractPaintIncluded(lower),
      notes,
    },
    assumptions,
  }
}
