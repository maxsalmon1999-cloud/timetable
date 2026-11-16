import { useCallback, useEffect, useRef, useState } from 'react'
import { accessStatus, fetchEvents, type CalEvent } from './calendar'

export type SyncState =
  | { kind: 'off' }
  | { kind: 'loading' }
  | { kind: 'ok'; at: Date }
  | { kind: 'no-access' }
  | { kind: 'error'; message: string }

const REFRESH_MS = 2 * 60 * 1000

/**
 * Live Apple Calendar events for the week on screen, when that week is synced.
 * Re-reads every 2 minutes and whenever the app comes back to the front, so
 * events added, moved or deleted in Calendar show up without doing anything.
 */
export function useCalendarSync(weekStart: Date, synced: boolean) {
  // results are tagged with their week so a stale week's events are never shown
  const [result, setResult] = useState<{ week: number; events: CalEvent[]; state: SyncState } | null>(null)
  const request = useRef(0)
  /** how many events the last confirmed read of a week found */
  const lastCount = useRef({ week: 0, count: 0 })
  const week = weekStart.getTime()

  const refresh = useCallback(async () => {
    const id = ++request.current
    const current = () => id === request.current
    // what's on screen for this week: blips never wipe it, only a confirmed answer replaces it
    const keep = (prev: typeof result) => (prev?.week === week ? prev.events : [])
    try {
      if ((await accessStatus()) !== 'granted') {
        if (current()) setResult((prev) => ({ week, events: keep(prev), state: { kind: 'no-access' } }))
        return
      }
      let events = await fetchEvents(new Date(week))
      // a week that had events coming back empty is more likely Calendar still loading than her deleting them all:
      // look again shortly before believing it
      if (!events.length && lastCount.current.week === week && lastCount.current.count > 0) {
        await new Promise((r) => setTimeout(r, 4000))
        if (!current()) return
        events = await fetchEvents(new Date(week))
      }
      if (current()) {
        lastCount.current = { week, count: events.length }
        setResult({ week, events, state: { kind: 'ok', at: new Date() } })
      }
    } catch (e) {
      if (!current()) return
      // Calendar hasn't loaded her calendars yet: keep showing what we had, quietly, and try again on the next round
      if (String(e).includes('no-calendars'))
        setResult((prev) => ({ week, events: keep(prev), state: prev?.week === week ? prev.state : { kind: 'loading' } }))
      else setResult((prev) => ({ week, events: keep(prev), state: { kind: 'error', message: String(e) } }))
    }
  }, [week]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    request.current++ // drop results from any previous week still in flight
    if (!synced) return
    // state is only set after the async read resolves (reading an external system)
    // eslint-disable-next-line react/set-state-in-effect
    refresh()
    const timer = setInterval(refresh, REFRESH_MS)
    const onFocus = () => document.visibilityState === 'visible' && refresh()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [synced, refresh])

  const mine = synced && result?.week === week ? result : null
  const state: SyncState = !synced ? { kind: 'off' } : (mine?.state ?? { kind: 'loading' })
  return { events: mine?.events ?? [], state, refresh }
}
