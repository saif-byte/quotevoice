import type { EvalCase } from '../src/lib/evaluate'
import { SAMPLE_NOTES } from '../src/lib/samples'

/**
 * Hand-labeled test set for the extraction step.
 *
 * These notes are written to sound like real painters (no punctuation, filler
 * words, numbers spoken as words). Replace or extend them with real voice
 * notes from interviews (experiment E1) to get the "edit-free rate on 30 real
 * jobs" metric from the project plan.
 */
export const CASES: EvalCase[] = [
  {
    id: 'sample-1',
    note: SAMPLE_NOTES[0].text,
    customerName: 'Sarah Johnson',
    paintIncluded: true,
    rooms: [
      { type: 'living_room', lengthFt: 20, widthFt: 16, heightFt: 9, walls: true, ceiling: true, trim: true, prep: 'light', coats: 2 },
      { type: 'master_bedroom', lengthFt: 15, widthFt: 14, walls: true, ceiling: false, colorChange: true, doors: 2, windows: 2 },
      { type: 'hallway', walls: true, trim: true },
    ],
  },
  {
    id: 'sample-2',
    note: SAMPLE_NOTES[1].text,
    customerName: 'Mike Chen',
    paintIncluded: false,
    rooms: [
      { type: 'kids_bedroom', lengthFt: 12, widthFt: 11, walls: true, ceiling: true, trim: true, prep: 'light' },
      { type: 'kids_bedroom', lengthFt: 12, widthFt: 11, walls: true, ceiling: true, trim: true, prep: 'light' },
      { type: 'bathroom', lengthFt: 9, widthFt: 8, walls: true, ceiling: false, prep: 'heavy' },
    ],
  },
  {
    id: 'sample-3',
    note: SAMPLE_NOTES[2].text,
    rooms: [
      { type: 'kitchen', lengthFt: 14, widthFt: 12, heightFt: 8, walls: true, ceiling: false, coats: 1 },
      { type: 'dining_room', lengthFt: 13, widthFt: 12, heightFt: 8, walls: true, trim: true, wallpaper: true },
    ],
  },
  {
    id: 'no-punctuation',
    note: 'ok so this is for tom baker living room twelve by eighteen walls and ceiling eight foot ceilings kitchen walls only ten by twelve two coats everywhere customer has their own paint',
    customerName: 'Tom Baker',
    paintIncluded: false,
    rooms: [
      { type: 'living_room', lengthFt: 18, widthFt: 12, heightFt: 8, walls: true, ceiling: true, coats: 2 },
      { type: 'kitchen', lengthFt: 12, widthFt: 10, walls: true, ceiling: false, coats: 2 },
    ],
  },
  {
    id: 'shared-details',
    note: 'Estimate for Linda Park. The office and the guest bedroom both need walls and ceilings, light patching. Office is 10 by 11, guest room is 12 by 12. We supply paint.',
    customerName: 'Linda Park',
    paintIncluded: true,
    rooms: [
      { type: 'office', lengthFt: 11, widthFt: 10, walls: true, ceiling: true, prep: 'light' },
      { type: 'bedroom', lengthFt: 12, widthFt: 12, walls: true, ceiling: true, prep: 'light' },
    ],
  },
  {
    id: 'negation',
    note: 'Quote for Dave Ross. Master bedroom 13 by 16, walls and trim, ceiling is fine, no patching needed, three doors. Vaulted ceilings in there.',
    customerName: 'Dave Ross',
    rooms: [{ type: 'master_bedroom', lengthFt: 16, widthFt: 13, heightFt: 12, walls: true, ceiling: false, trim: true, prep: 'none', doors: 3 }],
  },
  {
    id: 'everything',
    note: 'Job for the Nguyens. Nursery ten by eleven, everything, walls ceiling trim, going from bright red to white. Powder room walls only. Ceilings are nine feet.',
    customerName: 'Nguyens',
    rooms: [
      { type: 'nursery', lengthFt: 11, widthFt: 10, heightFt: 9, walls: true, ceiling: true, trim: true, colorChange: true },
      { type: 'powder_room', heightFt: 9, walls: true, ceiling: false },
    ],
  },
  {
    id: 'basement-heavy',
    note: 'Customer is Robert King. Basement about 500 square feet, walls and ceiling, lots of patching and some drywall repair, one coat of primer counts as a coat so two coats total. Stairwell walls too.',
    customerName: 'Robert King',
    rooms: [
      { type: 'basement', walls: true, ceiling: true, prep: 'heavy', coats: 2 },
      { type: 'stairwell', walls: true },
    ],
  },
  {
    id: 'three-bedrooms',
    note: 'Quote for Emily Stone. Three bedrooms upstairs all about 11 by 12, walls and ceiling, 2 coats. Upstairs hallway walls only. Labor only, she bought paint already.',
    customerName: 'Emily Stone',
    paintIncluded: false,
    rooms: [
      { type: 'bedroom', lengthFt: 12, widthFt: 11, walls: true, ceiling: true, coats: 2 },
      { type: 'bedroom', lengthFt: 12, widthFt: 11, walls: true, ceiling: true, coats: 2 },
      { type: 'bedroom', lengthFt: 12, widthFt: 11, walls: true, ceiling: true, coats: 2 },
      { type: 'hallway', walls: true, ceiling: false },
    ],
  },
  {
    id: 'family-room-windows',
    note: 'Family room 18 by 22 with 10 foot ceilings, walls ceiling and crown molding, four windows, some cracks to fill. Entryway walls and the front door.',
    rooms: [
      { type: 'family_room', lengthFt: 22, widthFt: 18, heightFt: 10, walls: true, ceiling: true, trim: true, windows: 4, prep: 'light' },
      { type: 'entryway', walls: true, doors: 1 },
    ],
  },
]

/**
 * Field-test cases: written from the misreads found when an agent used the app
 * as "Mike Delgado", a residential painter (2026-10-30). These were added
 * BEFORE fixing the parser, so the first score on them is an honest baseline.
 */
export const FIELD_CASES: EvalCase[] = [
  {
    id: 'field-staying-as-is',
    note: "Quote for Dan Miller at 18 Birch Lane. Just the one bedroom, twelve by fourteen, walls only, ceiling and trim are staying as is. Couple nail holes. Going from beige to a light gray. We're supplying the paint.",
    customerName: 'Dan Miller',
    paintIncluded: true,
    rooms: [{ type: 'bedroom', lengthFt: 14, widthFt: 12, walls: true, ceiling: false, trim: false, prep: 'light', colorChange: false }],
  },
  {
    id: 'field-past-and-out-of-scope',
    note: "ok this is the Henderson job, we did their kitchen last year so just the living room hallway and master. Living room is sixteen by twenty two, walls and ceiling, they're going from dark navy to a light cream on the walls. Some patching, there's a hole where the doorknob went through the wall. Hallway's about four by eighteen walls only leave the ceiling. Master bedroom walls ceiling and trim, two doors and three windows, I didn't measure it. She asked about the garage door but I told her interior only. They're buying their own paint.",
    paintIncluded: false,
    rooms: [
      { type: 'living_room', lengthFt: 22, widthFt: 16, walls: true, ceiling: true, colorChange: true },
      { type: 'hallway', lengthFt: 18, widthFt: 4, walls: true, ceiling: false },
      { type: 'master_bedroom', walls: true, ceiling: true, trim: true, doors: 2, windows: 3 },
    ],
  },
  {
    id: 'field-ceiling-height-like',
    note: 'Estimate for Grace Fellowship. Fellowship hall is forty by sixty, walls only, ceilings are like fourteen foot. Two coats.',
    customerName: 'Grace Fellowship',
    rooms: [{ type: 'hallway', lengthFt: 60, widthFt: 40, heightFt: 14, walls: true, ceiling: false, coats: 2 }],
  },
  {
    id: 'field-spoken-correction',
    note: 'Quote for Tina Ruiz. Office is fourteen by twelve no wait twelve by twelve, walls and trim. Guest bedroom ten by eleven, walls only.',
    customerName: 'Tina Ruiz',
    rooms: [
      { type: 'office', lengthFt: 12, widthFt: 12, walls: true, trim: true },
      { type: 'bedroom', lengthFt: 11, widthFt: 10, walls: true, trim: false },
    ],
  },
  {
    id: 'field-wallpaper-border',
    note: "Job for Paul Grant. Two kids bedrooms eleven by twelve, walls and ceiling, there's a wallpaper border we gotta strip in both.",
    customerName: 'Paul Grant',
    rooms: [
      { type: 'kids_bedroom', lengthFt: 12, widthFt: 11, walls: true, ceiling: true, wallpaper: false, wallpaperBorder: true },
      { type: 'kids_bedroom', lengthFt: 12, widthFt: 11, walls: true, ceiling: true, wallpaper: false, wallpaperBorder: true },
    ],
  },
  {
    id: 'field-long-note',
    note:
      "Alright this one's for Karen Walsh over on 77 Elm Street. Pretty big job. The whole house needs some light patching, nail holes mostly. " +
      'Living room fifteen by eighteen walls and ceiling. Dining room twelve by twelve walls and trim. Kitchen walls only, cabinets stay. ' +
      "There's a little powder room off the kitchen, do the walls and ceiling in there and it's got some water damage so real repair. " +
      'Hallway is three and a half by twenty, walls only, three doors along it. Then upstairs, master bedroom fourteen by sixteen walls ceiling trim. ' +
      'Two more bedrooms about eleven by twelve each, walls only. Ceilings are eight foot throughout. We are doing the paint.',
    customerName: 'Karen Walsh',
    paintIncluded: true,
    rooms: [
      { type: 'living_room', lengthFt: 18, widthFt: 15, heightFt: 8, walls: true, ceiling: true, prep: 'light' },
      { type: 'dining_room', lengthFt: 12, widthFt: 12, walls: true, trim: true, prep: 'light' },
      { type: 'kitchen', walls: true, ceiling: false, prep: 'light' },
      { type: 'powder_room', walls: true, ceiling: true, prep: 'heavy' },
      { type: 'hallway', lengthFt: 20, widthFt: 3.5, walls: true, doors: 3, prep: 'light' },
      { type: 'master_bedroom', lengthFt: 16, widthFt: 14, walls: true, ceiling: true, trim: true, prep: 'light' },
      { type: 'bedroom', lengthFt: 12, widthFt: 11, walls: true, ceiling: false, prep: 'light' },
      { type: 'bedroom', lengthFt: 12, widthFt: 11, walls: true, ceiling: false, prep: 'light' },
    ],
  },
]

/**
 * Held-out cases: the same kinds of phrasing as the field test, reworded, and
 * written AFTER the parser fixes without tuning the parser to them. Their score
 * is the more honest estimate of how the fixes generalize.
 */
export const HELD_OUT_CASES: EvalCase[] = [
  {
    id: 'heldout-left-alone',
    note: 'Estimate for Jim Park. Den is about eighteen by fourteen, just walls, the ceiling and baseboards can stay how they are. We will supply paint.',
    customerName: 'Jim Park',
    paintIncluded: true,
    rooms: [{ type: 'family_room', lengthFt: 18, widthFt: 14, walls: true, ceiling: false, trim: false }],
  },
  {
    id: 'heldout-past-work',
    note: 'So for the Coopers, we painted the dining room for them back in spring, this time it is only the office, ten by twelve, walls and trim. The ceilings in the office are maybe nine foot.',
    rooms: [{ type: 'office', lengthFt: 12, widthFt: 10, heightFt: 9, walls: true, trim: true }],
  },
  {
    id: 'heldout-correction-count',
    note: 'Quote for Rita Shaw. Master bedroom sixteen by fifteen walls and ceiling, two doors actually three doors, and four windows.',
    customerName: 'Rita Shaw',
    rooms: [{ type: 'master_bedroom', lengthFt: 16, widthFt: 15, walls: true, ceiling: true, doors: 3, windows: 4 }],
  },
  {
    id: 'heldout-landmark-and-global',
    note: "Job for Omar Hassan. Laundry room next to the kitchen, eight by seven, walls only. Then the bathroom across from the bedroom, walls and ceiling. Every room has some nail holes. Ceilings are about nine feet everywhere.",
    customerName: 'Omar Hassan',
    rooms: [
      { type: 'laundry_room', lengthFt: 8, widthFt: 7, heightFt: 9, walls: true, ceiling: false, prep: 'light' },
      { type: 'bathroom', heightFt: 9, walls: true, ceiling: true, prep: 'light' },
    ],
  },
]
