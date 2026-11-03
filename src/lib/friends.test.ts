import { test } from 'node:test'
import assert from 'node:assert/strict'
import { friendStatuses, namedIn } from './friends.ts'
import type { Block, Friend } from './types.ts'

const f = (id: string, name: string, more: Partial<Friend> = {}): Friend => ({ id, name, added: '2026-10-01', ...more })
const b = (date: string, friends: string[], start = 600, end = 660): Block => ({ id: date + start, date, start, end, title: 'x', color: '#fff', friends })

test('names are found as whole words, first name or full, any case or accents', () => {
  const friends = [f('1', 'Aoi Tanaka'), f('2', 'Zoë'), f('3', 'Sam'), f('4', 'May'), f('5', 'Old', { removed: true })]
  assert.deepEqual(namedIn('Lunch with aoi', friends).map((x) => x.id), ['1'])
  assert.deepEqual(namedIn('Coffee w/ Zoe & Sam', friends).map((x) => x.id), ['2', '3'])
  assert.deepEqual(namedIn('Samba class', friends), [])
  assert.deepEqual(namedIn('Essay due May 3', friends).map((x) => x.id), ['4'])
  assert.deepEqual(namedIn('Drinks with Old', friends), []) // removed friends never match
})

test('last seen counts only blocks that have ended; a planned one stops the reminder', () => {
  const friends = [f('1', 'Aoi', { remindDays: 14 }), f('2', 'Sam', { remindDays: 7 }), f('3', 'Kit')]
  const blocks = [b('2026-10-10', ['1']), b('2026-10-30', ['2'], 600, 660), b('2026-11-03', ['2'], 900, 960)]
  const [aoi, sam, kit] = friendStatuses(friends, blocks, '2026-11-03', 12 * 60)
  assert.equal(aoi.last, '2026-10-10')
  assert.equal(aoi.since, 24)
  assert.equal(aoi.overdue, true)
  assert.equal(sam.last, '2026-10-30') // today's 15:00 hasn't happened yet at noon
  assert.equal(sam.next, '2026-11-03')
  assert.equal(sam.overdue, false)
  assert.equal(kit.since, 33) // never seen: counts from when she added them
  assert.equal(kit.overdue, false) // no reminder set
})
