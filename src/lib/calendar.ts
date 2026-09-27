import { invoke, isTauri } from './tauri'
import { addDays, fromISO } from './dates'
import { MAX_END, MIN_START } from './constants'

/** An event from Apple Calendar (read-only). start/end are epoch ms. */
export interface CalEvent {
  id: string
  title: string
  calendar: string
  color: string
  start: number
  end: number
  allDay: boolean
}

/** A timed calendar event cut to one day, in minutes from midnight */
export interface DayEvent {
  id: string
  title: string
  calendar: string
  color: string
  start: number
  end: number
}

export type Access = 'granted' | 'notDetermined' | 'denied' | 'restricted' | 'writeOnly' | 'unsupported'

export async function accessStatus(): Promise<Access> {
  return isTauri ? invoke<Access>('calendar_access_status') : 'granted'
}

/** Shows the macOS permission prompt the first time */
export async function requestAccess(): Promise<boolean> {
  return isTauri ? invoke<boolean>('calendar_request_access') : true
}

export async function fetchEvents(weekStart: Date): Promise<CalEvent[]> {
  const start = weekStart.getTime()
  const end = addDays(weekStart, 7).getTime()
  if (!isTauri) return sampleEvents(weekStart)
  return invoke<CalEvent[]>('calendar_events', { startMs: start, endMs: end })
}

export function openPrivacySettings() {
  if (isTauri) invoke('open_calendar_privacy_settings')
}

const minutesOf = (ms: number) => {
  const d = new Date(ms)
  return d.getHours() * 60 + d.getMinutes()
}

/** Split the week's events into what shows on one day */
export function eventsForDay(events: CalEvent[], date: string) {
  const dayStart = fromISO(date).getTime()
  const dayEnd = addDays(fromISO(date), 1).getTime()
  const timed: DayEvent[] = []
  const allDay: CalEvent[] = []
  for (const ev of events) {
    if (ev.start >= dayEnd || ev.end <= dayStart) continue
    if (ev.allDay) {
      allDay.push(ev)
      continue
    }
    const start = ev.start <= dayStart ? 0 : minutesOf(ev.start)
    const end = ev.end >= dayEnd ? 24 * 60 : minutesOf(ev.end)
    if (end <= MIN_START || start >= MAX_END) continue // outside the hours the grid can ever show
    timed.push({ id: `${ev.id}|${date}`, title: ev.title, calendar: ev.calendar, color: ev.color, start, end: Math.max(end, start + 15) })
  }
  return { timed, allDay }
}

export const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) =>
  a.start < b.end && a.end > b.start

// Browser-only stand-in so the UI can be developed without EventKit (npm run dev).
function sampleEvents(weekStart: Date): CalEvent[] {
  const at = (day: number, h: number, m = 0) => {
    const d = addDays(weekStart, day)
    d.setHours(h, m, 0, 0)
    return d.getTime()
  }
  const ev = (id: string, title: string, day: number, sh: number, sm: number, eh: number, em: number, color = '#FF2D55') => ({
    id, title, calendar: 'Sample calendar (browser only)', color, start: at(day, sh, sm), end: at(day, eh, em), allDay: false,
  })
  return [
    ev('s1', 'Dentist', 1, 10, 30, 11, 30),
    ev('s2', 'Call with Mum', 2, 18, 0, 18, 45, '#34C759'),
    ev('s3', 'Dinner with friends', 3, 19, 0, 21, 30, '#AF52DE'),
    ev('s4', 'Team meeting', 0, 9, 30, 10, 30, '#007AFF'),
    ev('s5', 'Team meeting', 4, 9, 30, 10, 30, '#007AFF'),
    { id: 's6', title: 'Bank holiday', calendar: 'UK Holidays', color: '#34C759', start: at(4, 0), end: at(5, 0), allDay: true },
  ]
}
