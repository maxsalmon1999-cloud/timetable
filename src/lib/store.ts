import { useCallback, useEffect, useReducer, useRef } from 'react'
import { loadData, saveData } from './storage'
import type { AppData } from './types'
import { uid } from './constants'

const HISTORY_LIMIT = 100

function seed(): AppData {
  const a = (name: string, color: string, duration: number) => ({ id: uid(), name, color, duration })
  return {
    version: 1,
    activities: [
      a('Work', '#4A7DFF', 240),
      a('Gym', '#2FB36B', 60),
      a('Lunch', '#F29B38', 60),
      a('Reading', '#9B6BE0', 30),
      a('Friends', '#EF5B7B', 120),
      a('Admin', '#8A8F98', 30),
    ],
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

export function useAppData() {
  const [state, dispatch] = useReducer(reducer, { past: [], present: null, future: [] })
  const loaded = useRef(false)

  useEffect(() => {
    loadData().then((d) => {
      loaded.current = true
      dispatch({ type: 'load', data: d ?? seed() })
    })
  }, [])

  // save shortly after each change
  useEffect(() => {
    if (!loaded.current || !state.present) return
    const t = setTimeout(() => saveData(state.present!), 300)
    return () => clearTimeout(t)
  }, [state.present])

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
  }
}
