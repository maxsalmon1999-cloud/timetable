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
  const week = weekStart.getTime()

  const refresh = useCallback(async () => {
    const id = ++request.current
    const current = () => id === request.current
    try {
      if ((await accessStatus()) !== 'granted') {
        if (current()) setResult({ week, events: [], state: { kind: 'no-access' } })
        return
      }
      const events = await fetchEvents(new Date(week))
      if (current()) setResult({ week, events, state: { kind: 'ok', at: new Date() } })
    } catch (e) {
      // keep showing what we last had for this week
      if (current())
        setResult((prev) => ({ week, events: prev?.week === week ? prev.events : [], state: { kind: 'error', message: String(e) } }))
    }
  }, [week])

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
