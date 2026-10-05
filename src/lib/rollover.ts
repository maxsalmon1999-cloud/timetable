// Unticked to-dos don't stay behind on days that have passed: each one moves on to today, across weeks too, keeping
// the day it was first meant for (`since`), so the pad can show how long it has been waiting.
// Only her own to-dos move; timetable and calendar items belong to their day, and ticked to-dos stay where they were done.

import type { AppData, Todo } from './types'

const DAY_MS = 86_400_000
const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** the date of list `day` (0 = Monday) in the week starting `monday` */
export const listDate = (monday: string, day: number) => iso(new Date(parse(monday).getTime() + day * DAY_MS + DAY_MS / 2))

/** whole days between two dates (b − a) */
export const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / DAY_MS)

/** to-dos waiting this many days or more start to glow */
export const STALE_DAYS = 3

/** Move every unticked to-do from days before `today` onto today's list. Returns the same object when nothing moves. */
export function rollover(d: AppData, today: string): AppData {
  if (!d.todos) return d
  const t = parse(today)
  const todayMonday = iso(new Date(t.getTime() - ((t.getDay() + 6) % 7) * DAY_MS + DAY_MS / 2))
  const todayIndex = (t.getDay() + 6) % 7
  const moving: Todo[] = []
  const todos: Record<string, Todo[][]> = {}
  for (const [monday, lists] of Object.entries(d.todos)) {
    todos[monday] = lists.map((list, day) => {
      const date = listDate(monday, day)
      if (date >= today) return list
      const stay = list.filter((x) => x.done)
      if (stay.length === list.length) return list
      for (const x of list) if (!x.done) moving.push({ ...x, since: x.since ?? date })
      return stay
    })
  }
  if (!moving.length) return d
  // oldest first, ahead of today's own
  moving.sort((a, b) => (a.since! < b.since! ? -1 : a.since! > b.since! ? 1 : 0))
  const week = todos[todayMonday] ?? Array.from({ length: 7 }, () => [])
  todos[todayMonday] = week.map((list, day) => (day === todayIndex ? [...moving, ...list] : list))
  // weeks left with nothing in them go
  for (const [monday, lists] of Object.entries(todos)) if (!lists.some((l) => l.length)) delete todos[monday]
  return { ...d, todos }
}
