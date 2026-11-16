import { useCallback, useEffect, useRef, useState } from 'react'
import { accessStatus, fetchEvents, type Access, type CalEvent } from './calendar'
import type { AppData } from './types'

export type SyncState =
  | { kind: 'off' }
  | { kind: 'loading' }
  | { kind: 'ok'; at: Date }
  | { kind: 'no-access' }
  | { kind: 'error'; message: string }

const REFRESH_MS = 2 * 60 * 1000
/** Calendar hasn't loaded her calendars yet: look again soon, a bit later each time (about a minute in all) */
const RETRY_MS = [1500, 3000, 6000, 12000, 20000, 25000]
const NOT_LOADED = 'Your calendars haven’t loaded yet. Open the Calendar app to check it shows them, then click here.'

/**
 * Whether Apple Calendar is on for this device, which can be the Mac, the iPad or the iPhone.
 * `calendarOn` is this device's own switch (never synced, as Calendar access is per device). Older versions switched it
 * on week by week (`syncedWeeks`, which does sync between devices): those weeks only count where this device already has
 * Calendar access, so turning it on on one device doesn't put a red "access off" warning on another. Such a device
 * gets `calendarOn` saved once, so it stays on.
 */
export function useCalendarSwitch(data: AppData | null, updateSilently: (fn: (d: AppData) => AppData) => void) {
  const [access, setAccess] = useState<Access | null>(null)
  useEffect(() => {
    let alive = true
    accessStatus().then(
      (a) => alive && setAccess(a),
      () => alive && setAccess('denied'),
    )
    return () => {
      alive = false
    }
  }, [])
  const fromEarlier = access === 'granted' && !!data?.syncedWeeks?.length
  const calendarOn = !!data?.calendarOn
  useEffect(() => {
    if (fromEarlier && !calendarOn) updateSilently((d) => (d.calendarOn ? d : { ...d, calendarOn: true }))
  }, [fromEarlier, calendarOn, updateSilently])

  /** switch it on: a setting of this device, not her plans, so no undo step. The week goes in `syncedWeeks` for older versions. */
  const turnOn = useCallback(
    (weekKey: string) =>
      updateSilently((d) => ({ ...d, calendarOn: true, syncedWeeks: [...new Set([...(d.syncedWeeks ?? []), weekKey])] })),
    [updateSilently],
  )
  /** `known`: false until this device's Calendar access has been checked (so the sync prompt doesn't flash up) */
  return { on: calendarOn || fromEarlier, known: calendarOn || access !== null, turnOn }
}

/**
 * Live Apple Calendar events for the week on screen, when Calendar is on.
 * Re-reads every 2 minutes and whenever the app comes back to the front, so
 * events added, moved or deleted in Calendar show up without doing anything.
 */
export function useCalendarSync(weekStart: Date, synced: boolean) {
  // results are tagged with their week so a stale week's events are never shown
  const [result, setResult] = useState<{ week: number; events: CalEvent[]; state: SyncState } | null>(null)
  const request = useRef(0)
  /** how many events the last confirmed read of a week found */
  const lastCount = useRef({ week: 0, count: 0 })
  /** quick re-reads while Calendar is still loading her calendars */
  const retry = useRef<{ week: number; tries: number; timer?: ReturnType<typeof setTimeout> }>({ week: 0, tries: 0 })
  const refreshRef = useRef<() => void>(() => {})
  const week = weekStart.getTime()

  const refresh = useCallback(async () => {
    const id = ++request.current
    const current = () => id === request.current
    clearTimeout(retry.current.timer)
    if (retry.current.week !== week) retry.current = { week, tries: 0 }
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
        retry.current.tries = 0
        setResult({ week, events, state: { kind: 'ok', at: new Date() } })
      }
    } catch (e) {
      if (!current()) return
      if (String(e).includes('no-calendars')) {
        // Calendar hasn't loaded her calendars yet: keep showing what we had and look again soon. If it still isn't
        // ready after about a minute, say so (and keep trying every 2 minutes)
        const n = retry.current.tries++
        if (n < RETRY_MS.length) {
          retry.current.timer = setTimeout(() => refreshRef.current(), RETRY_MS[n])
          setResult((prev) => ({ week, events: keep(prev), state: prev?.week === week ? prev.state : { kind: 'loading' } }))
        } else setResult((prev) => ({ week, events: keep(prev), state: { kind: 'error', message: NOT_LOADED } }))
      } else setResult((prev) => ({ week, events: keep(prev), state: { kind: 'error', message: String(e) } }))
    }
  }, [week]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

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
    const retries = retry
    return () => {
      clearInterval(timer)
      clearTimeout(retries.current.timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [synced, refresh])

  const mine = synced && result?.week === week ? result : null
  const state: SyncState = !synced ? { kind: 'off' } : (mine?.state ?? { kind: 'loading' })
  return { events: mine?.events ?? [], state, refresh }
}
