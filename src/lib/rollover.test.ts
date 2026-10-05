import { test } from 'node:test'
import assert from 'node:assert/strict'
import { daysBetween, listDate, rollover } from './rollover.ts'
import type { AppData, Todo } from './types.ts'

const td = (id: string, done = false, since?: string): Todo => ({ id, text: id, done, ...(since ? { since } : {}) })
const week = (lists: Partial<Record<number, Todo[]>>) => Array.from({ length: 7 }, (_, i) => lists[i] ?? [])
const data = (todos: AppData['todos']): AppData => ({ version: 3, activities: [], blocks: [], templates: [], todos })

test('list dates', () => {
  assert.equal(listDate('2026-09-28', 0), '2026-09-28')
  assert.equal(listDate('2026-09-28', 6), '2026-10-04')
  assert.equal(daysBetween('2026-10-02', '2026-10-05'), 3)
})

test('unticked to-dos from earlier days this week move to today, ticked ones stay', () => {
  const d = data({ '2026-10-05': week({ 0: [td('a'), td('b', true)], 1: [td('c')], 3: [td('future')] }) })
  const r = rollover(d, '2026-10-07') // Wednesday
  assert.deepEqual(r.todos!['2026-10-05'][0].map((x) => x.id), ['b'])
  assert.deepEqual(r.todos!['2026-10-05'][1], [])
  assert.deepEqual(r.todos!['2026-10-05'][2].map((x) => [x.id, x.since]), [['a', '2026-10-05'], ['c', '2026-10-06']])
  assert.deepEqual(r.todos!['2026-10-05'][3].map((x) => x.id), ['future'])
})

test('rolls across weeks, keeps the original day, and drops the emptied week', () => {
  const d = data({ '2026-09-28': week({ 4: [td('old')] }), '2026-10-05': week({ 0: [td('today')] }) })
  const r = rollover(d, '2026-10-05')
  assert.equal(r.todos!['2026-09-28'], undefined)
  assert.deepEqual(r.todos!['2026-10-05'][0].map((x) => [x.id, x.since]), [['old', '2026-10-02'], ['today', undefined]])
})

test('a to-do that already moved keeps its first day', () => {
  const d = data({ '2026-10-05': week({ 1: [td('a', false, '2026-10-01')] }) })
  const r = rollover(d, '2026-10-08')
  assert.deepEqual(r.todos!['2026-10-05'][3].map((x) => x.since), ['2026-10-01'])
})

test('nothing to move gives back the same object', () => {
  const d = data({ '2026-10-05': week({ 0: [td('done', true)], 2: [td('today')] }) })
  assert.equal(rollover(d, '2026-10-07'), d)
})
