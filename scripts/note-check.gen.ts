import { it } from 'vitest'
import { parseLocally } from '../src/lib/extract'
import { priceJob } from '../src/lib/pricing'
import { DEFAULT_RATES } from '../src/lib/pricing'
it('note', () => {
  const note = "Quote for Sarah Lee at 42 Maple Street, her number is 555 201 7788. Living room is sixteen by twenty with nine foot ceilings, walls and ceiling, two coats. Master bedroom twelve by fourteen, walls and trim, some nail holes to patch. Hallway walls only. Four doors in total. We're supplying the paint."
  const { job } = parseLocally(note)
  console.log(JSON.stringify({ name: job.customerName, addr: job.address, phone: job.customerPhone, rooms: job.rooms.map(r => `${r.name} ${r.lengthFt}x${r.widthFt}x${r.heightFt} w${r.walls} c${r.ceiling} t${r.trim} d${r.doors} prep:${r.prep} coats:${r.coats}`), assumptions: job.assumptions, paint: job.paintIncluded }, null, 1))
  const items = priceJob(job, DEFAULT_RATES); console.log(items.map(i => `${i.description} ${i.amount}`).join('\n'), items.reduce((s, i) => s + i.amount, 0))
})
