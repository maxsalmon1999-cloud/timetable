import type { AppData } from './types'

// One place that knows where data lives: a JSON file in the app's data folder
// when running inside Tauri, localStorage when running in a plain browser.

const KEY = 'timetable-data-v1'
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

async function tauriStore() {
  const { load } = await import('@tauri-apps/plugin-store')
  return load('timetable.json', { defaults: {}, autoSave: false })
}

export async function loadData(): Promise<AppData | null> {
  try {
    if (isTauri) {
      const store = await tauriStore()
      return (await store.get<AppData>('data')) ?? null
    }
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as AppData) : null
  } catch (err) {
    console.error('Could not load data', err)
    return null
  }
}

export async function saveData(data: AppData) {
  try {
    if (isTauri) {
      const store = await tauriStore()
      await store.set('data', data)
      await store.save()
      return
    }
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch (err) {
    console.error('Could not save data', err)
  }
}
