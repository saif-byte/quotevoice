# How QuoteVoice was built, step by step

Use this to walk an interviewer through the project from problem to deployed product.

## Step 0: Find a real problem (before any code)

- Researched Reddit and trade forums for repeated complaints from small businesses.
- Picked **quoting speed for residential painters**: quotes are typed at night and sent days later, and homeowners
  usually collect several bids.
- Wrote down the riskiest assumptions (will painters actually dictate a job? do they have consistent rates?) and an
  interview plan to test them. Desk research showed most voice capture happens **in the van after the visit**, so the
  app is designed for that moment rather than talking in front of the customer.
- Found that voice-to-quote tools already exist, so the chosen edge is **measured AI quality**: how often the AI's draft
  is sent without edits.

## Step 1: Pick a stack that costs nothing

| Need | Choice | Why |
| --- | --- | --- |
| App | React + TypeScript + Vite | Fast to build, typed, static output |
| Speech-to-text | Browser Web Speech API | Built into Chrome/Edge/Safari, no key |
| AI | Google Gemini free tier | Free, supports strict JSON output with a schema |
| Database | Browser localStorage | No server needed for a single-user v1 |
| Hosting | GitHub Pages + GitHub Actions | Free, deploys on every push |

Trade-off accepted: data stays on one device. That's fine for validating the idea; sync is the obvious v2.

## Step 2: Design the data model (`src/lib/types.ts`)

The whole product is a pipeline of four shapes:

```
voice note → RawJob → JobSpec → LineItem[] → Quote
```

- **RawJob**: only what was actually said. Unknown = `null`.
- **JobSpec**: complete and ready to price, plus a list of **assumptions** for every gap that was filled.
- **LineItem**: a priced line with a stable `key` (e.g. `r1:walls`), so later edits can be compared with the AI draft.
- **Quote**: keeps both `aiLineItems` (first draft) and `lineItems` (what was sent). That's what makes the quality metric
  possible.

## Step 3: Build the AI reader (`src/lib/gemini.ts`)

- A prompt that explains the painter's world ("9 foot ceilings" is a height, not a surface to paint).
- A **JSON schema** passed as `responseSchema`, so Gemini must return valid structured data.
- `temperature: 0` for consistent output.
- Rule in the prompt: *never guess, use null*. Guessing is done later, visibly, in code.

## Step 4: Build the offline parser (`src/lib/parser.ts`)

A rule-based fallback so the app works without a key or when the AI fails:

- Converts spoken numbers ("twelve by fourteen" → 12 by 14).
- Finds room mentions, splits the note into a segment per room, and reads sizes, surfaces, doors, windows, prep and
  coats from each segment.
- Handles negation ("ceiling is fine"), shared details ("the office and guest bedroom both need…") and whole-job
  statements ("two coats everywhere").

It also serves as the **baseline** the AI is measured against.

## Step 5: Fill gaps honestly (`src/lib/normalize.ts`)

Both readers feed the same normalizer. It validates every value (rejects a 2 ft ceiling or a negative room), fills gaps
with typical values, and writes a plain-English assumption for each one, e.g. *"Hallway: size not mentioned, assumed a
typical 16 × 4 ft."* The painter sees these in yellow before pricing.

## Step 6: Price with code, not AI (`src/lib/pricing.ts`)

- Wall area = perimeter × height × wall factor (kitchens lose wall to cabinets) − doors − windows.
- Ceiling area = length × width. Trim = perimeter.
- Rates are per sq ft for 2 coats; each extra coat adds 30%, a color change adds a coat.
- Paint gallons from coverage, plus a minimum job charge.
- All rates come from the painter's Settings.

## Step 7: Build the 3-step quote flow (`src/pages/NewQuote.tsx`)

1. **Record the job**: mic button (Web Speech API) or typing, plus sample notes for demos.
2. **Check what was heard**: assumptions list, editable room cards, customer and address.
3. **Check the price**: every line editable, add or remove lines, live totals. Then save a draft or finalize.

The timer starts at the first word, and finalizing records the time, giving the **time to quote** metric.

## Step 8: Share without a server (`src/lib/share.ts`)

The finalized quote is compressed (lz-string) into the link itself: `…/#/view/<data>`. The homeowner opens it on any
phone, with no login and no database. They can print it or save it as a PDF.

## Step 9: Dashboard (`src/pages/Dashboard.tsx`, `src/lib/metrics.ts`)

Each tile maps to a metric from the project plan:

| Tile | Meaning | Target |
| --- | --- | --- |
| Quotes sent | North-star metric | 20/week across 5+ users |
| Waiting on an answer | Value of open quotes | — |
| Won / win rate | Outcome tracking | — |
| Time to quote | Median minutes, first word → finalized | Under 3 min |
| AI lines kept as-is | Share of AI lines sent unchanged | 80% |
| Totals changed >10% | How often the painter overrides the AI | Under 20% |

Plus a weekly chart and a table where status can be changed inline.

## Step 10: Test and evaluate

- `src/lib/engine.test.ts`: unit tests for number parsing, gap filling, area math, minimum charge, metrics, share links.
- `eval/`: labeled voice notes scored field by field (`npm run eval`), for the parser and, with a key, for Gemini.
- Tests run in GitHub Actions before every deploy, so a broken build never goes live.

## Step 11: Deploy

`.github/workflows/deploy.yml` installs, tests, builds and publishes `dist/` to GitHub Pages on every push to `main`.
`base: './'` in `vite.config.ts` and hash routing (`#/…`) make it work under `/quotevoice/` without server rewrites.

---

## How to explain it in an interview

**30-second version**
> Painters lose jobs because they type quotes at night and send them days later. QuoteVoice lets a painter talk through
> the job in the van and send an itemized quote in about three minutes. An LLM turns the speech into structured data,
> but plain code does all the pricing from the painter's own rates, and anything the system had to guess is flagged for
> review. I track how often the AI's draft is sent without edits, because that's the number that decides whether
> painters trust it.

**Questions you'll likely get**

- *Why not let the LLM write the whole quote?* Because it can invent numbers, and a wrong price is real money. The LLM
  does what it's good at (messy language → structure); code does what code is good at (arithmetic).
- *How do you know the AI is good?* Two ways: an offline labeled eval set scored field by field, and in-product
  tracking of how many AI line items are sent unchanged and how often totals move more than 10%.
- *What happens when the AI fails?* It falls back to the offline parser, tells the user, and the review step catches
  anything wrong.
- *Why localStorage and not a database?* To ship a working v1 for free and test the riskiest assumption (will painters
  use voice?) before building accounts and sync.
- *What would you build next?* Real painter interviews feeding real voice notes into the eval set, then accounts and
  sync, photo capture, and an "accept quote" button for homeowners.
- *What did you learn from research?* Painters mostly dictate in the van after the visit, not in front of the customer,
  so the flow is built for that moment.
