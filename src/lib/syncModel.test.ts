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

test('to-dos added to the same week on both devices while apart are both kept', () => {
  const cloud: Docs = new Map()
  const week = '2026-10-05'
  const empty = () => Array.from({ length: 7 }, () => [] as { id: string; text: string; done: boolean }[])
  const mac = device(data({ todos: { [week]: [[{ id: 't0', text: 'Shared', done: false }], [], [], [], [], [], []] } }))
  sync(mac, cloud)
  const ipad = device(data())
  sync(ipad, cloud)
  // apart: each adds one to Monday, and the iPad ticks the shared one
  const macLists = mac.data.todos![week].map((l) => [...l])
  macLists[0].push({ id: 'm1', text: 'From Mac', done: false })
  mac.data = { ...mac.data, todos: { [week]: macLists } }
  const ipadLists = ipad.data.todos![week].map((l) => l.map((t) => (t.id === 't0' ? { ...t, done: true } : t)))
  ipadLists[0].push({ id: 'p1', text: 'From iPad', done: false })
  ipad.data = { ...ipad.data, todos: { [week]: ipadLists } }
  sync(mac, cloud)
  sync(ipad, cloud)
  sync(mac, cloud)
  const ids = (d: AppData) => (d.todos?.[week] ?? empty())[0].map((t) => `${t.id}${t.done ? '✓' : ''}`).sort()
  assert.deepEqual(ids(mac.data), ['m1', 'p1', 't0✓'])
  assert.deepEqual(ids(ipad.data), ['m1', 'p1', 't0✓'])
})

test('old whole-week to-do docs from v0.6.0 are read, then replaced by per-item docs without losing anything', () => {
  const week = '2026-10-05'
  const lists = [[{ id: 't1', text: 'Milk', done: false }], [], [{ id: 't2', text: 'Essay', done: true }], [], [], [], []]
  const cloud: Docs = new Map([[`w:${week}`, JSON.stringify({ lists, ticks: ['b1'] })]])
  // a device that synced with v0.6.0: same content locally, base knows the old doc
  const mac = device(data({ todos: { [week]: lists }, todoTicks: { [week]: ['b1'] } }))
  mac.base = { [`w:${week}`]: 'old' }
  sync(mac, cloud)
  assert.equal(cloud.has(`w:${week}`), false)
  assert.deepEqual([...cloud.keys()].sort(), [`d:${week}:0:t1`, `d:${week}:2:t2`, `k:${week}:b1`])
  // a fresh device that only ever saw the old doc gets everything
  const fresh = device(data())
  sync(fresh, new Map([[`w:${week}`, JSON.stringify({ lists, ticks: ['b1'] })]]))
  assert.deepEqual(fresh.data.todos, { [week]: lists })
  assert.deepEqual(fresh.data.todoTicks, { [week]: ['b1'] })
})

test('ticks on calendar events with slashes in their ids survive', () => {
  const cloud: Docs = new Map()
  const id = 'ABC/123:XYZ@1791200000000|2026-10-06'
  const mac = device(data({ todoTicks: { '2026-10-05': [id] } }))
  sync(mac, cloud)
  assert.ok([...cloud.keys()].every((k) => !k.includes('/')))
  const ipad = device(data())
  sync(ipad, cloud)
  assert.deepEqual(ipad.data.todoTicks, { '2026-10-05': [id] })
})
