import type { AppData } from './types'
import { invoke, isTauri } from './tauri'

// One place that knows where data lives. Inside the app, Rust owns the files
// (src-tauri/src/storage.rs: atomic writes + daily backups in ~/Documents/Timetable).
// In a plain browser (npm run dev) it falls back to localStorage.

const KEY = 'timetable-data-v1'

export interface LoadResult {
  data: AppData | null
  /** name of the backup used when the main file was missing or damaged */
  restoredFrom: string | null
  /** folder holding the data, null in the browser */
  folder: string | null
}

/** Throws if saved data exists but can't be read. Callers must not save after a failed load. */
export async function loadData(): Promise<LoadResult> {
  if (isTauri) return invoke<LoadResult>('load_data')
  const raw = localStorage.getItem(KEY)
  return { data: raw ? (JSON.parse(raw) as AppData) : null, restoredFrom: null, folder: null }
}

export async function saveData(data: AppData) {
  if (isTauri) await invoke('save_data', { data })
  else localStorage.setItem(KEY, JSON.stringify(data))
}

export async function revealDataFolder() {
  if (isTauri) await invoke('reveal_data_folder')
}
