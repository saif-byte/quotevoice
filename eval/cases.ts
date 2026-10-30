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
