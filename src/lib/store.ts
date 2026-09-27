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
    case 'undo': {
      if (!s.present || !s.past.length) return s
      return { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] }
    }
    case 'redo': {
      if (!s.present || !s.future.length) return s
      return { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) }
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

  return {
    data: state.present,
    update,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    status,
    retrySave,
    ...info,
  }
}
