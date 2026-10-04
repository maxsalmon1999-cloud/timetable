const pad = (n: number) => String(n).padStart(2, '0')

export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function fromISO(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Monday of the week containing d */
export function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return addDays(x, -((x.getDay() + 6) % 7))
}

export const weekDates = (weekStart: Date) => Array.from({ length: 7 }, (_, i) => toISO(addDays(weekStart, i)))

/** Placeholder Monday–Sunday for template drafts (1 Jan 2001 was a Monday); never shown to her */
export const TEMPLATE_DATES = weekDates(new Date(2001, 0, 1))

export const fmtTime = (min: number) => `${Math.floor(min / 60)}:${pad(min % 60)}`

export function fmtDuration(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}

/** "21 – 27 September" (year added when it isn't this year) */
/** Toolbar title: just the month(s), since the day header shows the dates. "September", "September – October" */
export function monthLabel(weekStart: Date) {
  const end = addDays(weekStart, 6)
  const month = (d: Date) => d.toLocaleDateString('en-GB', { month: 'long' })
  const thisYear = new Date().getFullYear()
  const year = (d: Date) => (d.getFullYear() === thisYear ? '' : ` ${d.getFullYear()}`)
  if (weekStart.getFullYear() !== end.getFullYear())
    return `${month(weekStart)} ${weekStart.getFullYear()} – ${month(end)} ${end.getFullYear()}`
  if (weekStart.getMonth() === end.getMonth()) return `${month(end)}${year(end)}`
  return `${month(weekStart)} – ${month(end)}${year(end)}`
}

export function weekLabel(weekStart: Date) {
  const end = addDays(weekStart, 6)
  const month = (d: Date) => d.toLocaleDateString('en-GB', { month: 'long' })
  const thisYear = new Date().getFullYear()
  const year = (d: Date) => (d.getFullYear() === thisYear ? '' : ` ${d.getFullYear()}`)
  if (weekStart.getFullYear() !== end.getFullYear())
    return `${weekStart.getDate()} ${month(weekStart)} ${weekStart.getFullYear()} – ${end.getDate()} ${month(end)} ${end.getFullYear()}`
  if (weekStart.getMonth() === end.getMonth()) return `${weekStart.getDate()} – ${end.getDate()} ${month(end)}${year(end)}`
  return `${weekStart.getDate()} ${month(weekStart)} – ${end.getDate()} ${month(end)}${year(end)}`
}
