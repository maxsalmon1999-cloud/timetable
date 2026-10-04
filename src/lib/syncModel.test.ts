// Run: npm test   (node's own test runner; no dependencies)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reconcile, toDocs, type Docs } from './syncModel.ts'
import type { AppData, Block } from './types.ts'

const act = (id: string, name: string) => ({ id, name, color: '#A9D6FF', duration: 60 })
const blk = (id: string, title: string, start = 600): Block => ({ id, date: '2026-10-05', start, end: start + 60, title, color: '#A9D6FF' })
const data = (over: Partial<AppData> = {}): AppData => ({ version: 3, activities: [], blocks: [], templates: [], ...over })

/** one device: its plans, its base, and a sync step against a shared cloud */
function device(d: AppData) {
  return { data: d, base: null as Record<string, string> | null }
}
function sync(dev: ReturnType<typeof device>, cloud: Docs) {
  const r = reconcile(dev.data, cloud, dev.base)
  for (const [k, v] of r.writes) {
    if (v === null) cloud.delete(k)
    else cloud.set(k, v)
  }
  dev.data = r.data
  dev.base = r.base
  return r
}
const titles = (d: AppData) => d.blocks.map((b) => b.title).sort()

test('first sync uploads everything from a device with plans', () => {
  const cloud: Docs = new Map()
  const mac = device(data({ activities: [act('a1', 'Lecture')], blocks: [blk('b1', 'Lecture')] }))
  const r = sync(mac, cloud)
  assert.equal(r.writes.size, 2)
  assert.equal(r.data, mac.data) // unchanged object, so nothing re-renders
  assert.deepEqual([...cloud.keys()].sort(), ['a:a1', 'b:b1'])
})

test('a second device takes the cloud plans and drops its duplicate starter activities', () => {
  const cloud: Docs = new Map()
  const mac = device(data({ activities: [act('a1', 'Lecture'), act('a2', 'Gym')], blocks: [blk('b1', 'Lecture')] }))
  sync(mac, cloud)
  const ipad = device(data({ activities: [act('x1', 'Lecture'), act('x2', 'Gym'), act('x3', 'Choir')] }))
  sync(ipad, cloud)
  assert.deepEqual(ipad.data.activities.map((a) => a.name), ['Lecture', 'Gym', 'Choir'])
  assert.deepEqual(titles(ipad.data), ['Lecture'])
  sync(mac, cloud)
  assert.deepEqual(mac.data.activities.map((a) => a.name), ['Lecture', 'Gym', 'Choir'])
})

test('edits to different things on two devices both survive', () => {
  const cloud: Docs = new Map()
  const mac = device(data({ blocks: [blk('b1', 'Lecture'), blk('b2', 'Gym')] }))
  sync(mac, cloud)
  const ipad = device(data())
  sync(ipad, cloud)
  // both edit while apart
  mac.data = { ...mac.data, blocks: mac.data.blocks.map((b) => (b.id === 'b1' ? { ...b, title: 'Seminar' } : b)) }
  ipad.data = { ...ipad.data, blocks: [...ipad.data.blocks.filter((b) => b.id !== 'b2'), blk('b3', 'Lunch', 780)] }
  sync(mac, cloud)
  sync(ipad, cloud)
  sync(mac, cloud)
  assert.deepEqual(titles(mac.data), ['Lunch', 'Seminar'])
  assert.deepEqual(titles(ipad.data), ['Lunch', 'Seminar'])
})

test('a delete on one device reaches the other', () => {
  const cloud: Docs = new Map()
  const mac = device(data({ blocks: [blk('b1', 'Lecture')] }))
  sync(mac, cloud)
  const ipad = device(data())
  sync(ipad, cloud)
  ipad.data = { ...ipad.data, blocks: [] }
  sync(ipad, cloud)
  assert.equal(cloud.size, 0)
  sync(mac, cloud)
  assert.deepEqual(mac.data.blocks, [])
})

test('the same block edited on both sides: the device syncing last keeps its version, nothing is lost silently', () => {
  const cloud: Docs = new Map()
  const mac = device(data({ blocks: [blk('b1', 'Lecture')] }))
  sync(mac, cloud)
  const ipad = device(data())
  sync(ipad, cloud)
  mac.data = { ...mac.data, blocks: [{ ...mac.data.blocks[0], title: 'Mac title' }] }
  ipad.data = { ...ipad.data, blocks: [{ ...ipad.data.blocks[0], title: 'iPad title' }] }
  sync(mac, cloud)
  sync(ipad, cloud)
  sync(mac, cloud)
  assert.deepEqual(titles(mac.data), titles(ipad.data))
})

test('a no-op sync writes nothing and changes nothing', () => {
  const cloud: Docs = new Map()
  const mac = device(data({ blocks: [blk('b1', 'Lecture')], todos: { '2026-10-05': [[{ id: 't', text: 'x', done: false }], [], [], [], [], [], []] } }))
  sync(mac, cloud)
  const before = mac.data
  const r = sync(mac, cloud)
  assert.equal(r.writes.size, 0)
  assert.equal(r.data, before)
})

test('to-do lists, ticks and synced weeks travel, and empty weeks leave the cloud', () => {
  const cloud: Docs = new Map()
  const week = '2026-10-05'
  const lists = [[{ id: 't1', text: 'Milk', done: false }], [], [], [], [], [], []]
  const mac = device(data({ todos: { [week]: lists }, todoTicks: { [week]: ['b1'] }, syncedWeeks: [week] }))
  sync(mac, cloud)
  const ipad = device(data())
  sync(ipad, cloud)
  assert.deepEqual(ipad.data.todos, { [week]: lists })
  assert.deepEqual(ipad.data.todoTicks, { [week]: ['b1'] })
  assert.deepEqual(ipad.data.syncedWeeks, [week])
  ipad.data = { ...ipad.data, todos: {}, todoTicks: {} }
  sync(ipad, cloud)
  assert.equal(cloud.has(`w:${week}`), false)
  sync(mac, cloud)
  assert.equal(mac.data.todos, undefined)
})

test('key order inside a record never counts as a change', () => {
  const b = blk('b1', 'Lecture')
  const reordered = { title: b.title, color: b.color, end: b.end, start: b.start, date: b.date, id: b.id }
  assert.equal(toDocs(data({ blocks: [b] })).get('b:b1'), toDocs(data({ blocks: [reordered] })).get('b:b1'))
})

test('device-only fields (template draft) never leave the device', () => {
  const d = data({ templateDraft: { blocks: [blk('d1', 'Draft')] } })
  assert.equal(toDocs(d).size, 0)
  const r = reconcile(d, new Map([['b:b9', JSON.stringify(blk('b9', 'Remote'))]]), {})
  assert.deepEqual(r.data.templateDraft, d.templateDraft)
})
