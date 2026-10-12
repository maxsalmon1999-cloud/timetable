// Changes to her plans that both the week view (App.tsx) and the phone's day view (PhoneApp.tsx) make.
// Each returns new AppData for store.update(), so each is one undo step.

import type { AppData, Block, IconWeight, Todo } from './types'
import type { DayEvent } from './calendar'
import { fromISO } from './dates'
import { uid } from './constants'

/** A timetable block or timed calendar event, pulled into that day's to-do list (read live, never copied) */
export interface Scheduled {
  /** block id, or the calendar event's per-day id; also the key in the week's ticks */
  id: string
  kind: 'block' | 'event'
  title: string
  /** minutes from midnight */
  start: number
  color: string
  icon?: string
  iconWeight?: IconWeight
  /** calendar name, for events */
  calendar?: string
}

/** items (scheduled + her own) on one day, and how many are ticked */
export const countDay = (own: Todo[], plan: Scheduled[], ticked: ReadonlySet<string>) => {
  const total = plan.length + own.length
  const done = plan.filter((s) => ticked.has(s.id)).length + own.filter((t) => t.done).length
  return { total, done, left: total - done }
}

/** what the to-do list pulls in for one day: her blocks + calendar events that start that day (not all-day ones), by start */
export const scheduledOn = (date: string, blocks: Block[], timed: DayEvent[]): Scheduled[] =>
  [
    ...blocks
      .filter((b) => b.date === date)
      .map((b): Scheduled => ({ id: b.id, kind: 'block', title: b.title, start: b.start, color: b.color, icon: b.icon, iconWeight: b.iconWeight })),
    ...timed
      .filter((e) => e.source.start >= fromISO(date).getTime()) // not the continuation of last night's event
      .map((e): Scheduled => ({ id: e.id, kind: 'event', title: e.title, start: e.start, color: e.color, calendar: e.calendar })),
  ].sort((a, b) => a.start - b.start)

/** change one day's to-do list (day 0 = Monday) in the week starting `week` */
export function setDayTodos(d: AppData, week: string, day: number, fn: (list: Todo[]) => Todo[]): AppData {
  const lists = Array.from({ length: 7 }, (_, i) => d.todos?.[week]?.[i] ?? [])
  lists[day] = fn(lists[day])
  const { [week]: _, ...others } = d.todos ?? {} // eslint-disable-line @typescript-eslint/no-unused-vars
  return { ...d, todos: lists.some((l) => l.length) ? { ...others, [week]: lists } : others }
}

/** tick / untick a pulled-in block or calendar event in the week starting `week` */
export function toggleTick(d: AppData, week: string, id: string): AppData {
  const now = d.todoTicks?.[week] ?? []
  const next = now.includes(id) ? now.filter((x) => x !== id) : [...now, id]
  const { [week]: _, ...others } = d.todoTicks ?? {} // eslint-disable-line @typescript-eslint/no-unused-vars
  return { ...d, todoTicks: next.length ? { ...others, [week]: next } : others }
}

/**
 * Save a block into `blocks` (`within` = which list: her weeks, or the template draft). With `addToBank` it also
 * becomes a new activity, and this block its first, tagged with it.
 */
export function saveBlock(d: AppData, b: Block, addToBank: boolean, within: (d: AppData, fn: (bs: Block[]) => Block[]) => AppData = (x, fn) => ({ ...x, blocks: fn(x.blocks) })): AppData {
  const next = within(d, (bs) => (bs.some((x) => x.id === b.id) ? bs.map((x) => (x.id === b.id ? b : x)) : [...bs, b]))
  if (!addToBank) return next
  const activity = { id: uid(), name: b.title, color: b.color, duration: b.end - b.start, ...(b.icon ? { icon: b.icon, iconWeight: b.iconWeight } : {}) }
  return {
    ...within(next, (bs) => bs.map((x) => (x.id === b.id ? { ...x, tag: activity.id } : x))),
    activities: [...next.activities, activity],
  }
}
