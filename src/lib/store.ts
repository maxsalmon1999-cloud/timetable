import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { loadData, saveData, type LoadResult } from './storage'
import type { AppData } from './types'
import { uid } from './constants'
import { SEED_ACTIVITIES } from './icons'
import { migrate } from './migrate'

const HISTORY_LIMIT = 100

function seed(): AppData {
  return {
    version: 3,
    activities: SEED_ACTIVITIES.map((a) => ({ id: uid(), ...a })),
    blocks: [],
    templates: [],
  }
}

interface State {
  past: AppData[]
  present: AppData | null
  future: AppData[]
}

type Action =
  | { type: 'load'; data: AppData }
  | { type: 'update'; fn: (d: AppData) => AppData }
  | { type: 'undo' }
  | { type: 'redo' }
  /** the other device's changes arrived: they replace the plans, and undo starts afresh so it can't undo them */
  | { type: 'remote'; data: AppData }
  /** sync bookkeeping only (AppData.sync): no undo step */
  | { type: 'syncMeta'; fn: (s: AppData['sync']) => AppData['sync'] }

const withSync = (d: AppData, from: AppData): AppData => {
  const { sync: _, ...rest } = d // eslint-disable-line @typescript-eslint/no-unused-vars
  return from.sync ? { ...rest, sync: from.sync } : rest
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'load':
      return { past: [], present: a.data, future: [] }
    case 'update': {
      if (!s.present) return s
      const next = a.fn(s.present)
      if (next === s.present) return s
      return { past: [...s.past, s.present].slice(-HISTORY_LIMIT), present: next, future: [] }
    }
    // undo/redo move her plans, never the sync bookkeeping (it describes the cloud, which undo doesn't touch)
    case 'undo': {
      if (!s.present || !s.past.length) return s
      return { past: s.past.slice(0, -1), present: withSync(s.past[s.past.length - 1], s.present), future: [s.present, ...s.future] }
    }
    case 'redo': {
      if (!s.present || !s.future.length) return s
      return { past: [...s.past, s.present], present: withSync(s.future[0], s.present), future: s.future.slice(1) }
    }
    case 'remote':
      return { past: [], present: a.data, future: [] }
    case 'syncMeta': {
      if (!s.present) return s
      const { sync: _, ...rest } = s.present // eslint-disable-line @typescript-eslint/no-unused-vars
      const sync = a.fn(s.present.sync)
      return { ...s, present: sync ? { ...rest, sync } : rest }
    }
  }
}

export type SaveStatus =
  | { kind: 'loading' }
  | { kind: 'load-failed'; message: string }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string }

export function useAppData() {
  const [state, dispatch] = useReducer(reducer, { past: [], present: null, future: [] })
  const [status, setStatus] = useState<SaveStatus>({ kind: 'loading' })
  const [info, setInfo] = useState<Omit<LoadResult, 'data'>>({ restoredFrom: null, folder: null })
  // only ever save after a successful load, so a read failure can't overwrite real data
  const canSave = useRef(false)
  const pending = useRef<AppData | null>(null)
  const running = useRef(false)

  useEffect(() => {
    loadData()
      .then((r) => {
        const data = r.data ? migrate(r.data) : seed() // throws → load-failed, and nothing is ever saved
        canSave.current = true
        setInfo({ restoredFrom: r.restoredFrom, folder: r.folder })
        dispatch({ type: 'load', data })
      })
      .catch((e) => setStatus({ kind: 'load-failed', message: String(e) }))
  }, [])

  // Saves run one at a time; if several changes arrive mid-save only the latest is written.
  const pump = useCallback(async () => {
    if (running.current) return
    running.current = true
    while (pending.current) {
      const d = pending.current
      pending.current = null
      try {
        await saveData(d)
        if (!pending.current) setStatus({ kind: 'saved' })
      } catch (e) {
        setStatus({ kind: 'error', message: String(e) })
      }
    }
    running.current = false
  }, [])

  // Save every change straight away (changes are discrete user actions, never per-frame)
  useEffect(() => {
    if (!canSave.current || !state.present) return
    pending.current = state.present
    setStatus({ kind: 'saving' })
    pump()
  }, [state.present, pump])

  const retrySave = useCallback(() => {
    if (!canSave.current || !state.present) return
    pending.current = state.present
    setStatus({ kind: 'saving' })
    pump()
  }, [state.present, pump])

  const update = useCallback((fn: (d: AppData) => AppData) => dispatch({ type: 'update', fn }), [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])
  const applyRemote = useCallback((data: AppData) => dispatch({ type: 'remote', data }), [])
  const updateSync = useCallback((fn: (s: AppData['sync']) => AppData['sync']) => dispatch({ type: 'syncMeta', fn }), [])

  return {
    data: state.present,
    update,
    undo,
    redo,
    applyRemote,
    updateSync,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    status,
    retrySave,
    ...info,
  }
}
