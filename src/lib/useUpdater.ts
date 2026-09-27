import { useEffect, useState } from 'react'
import { isTauri } from './tauri'

export type UpdateState = { kind: 'idle' } | { kind: 'installed'; version: string }

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000

/**
 * Auto-update: shortly after launch and every 6 hours, look for a newer release on
 * GitHub, then download and install it silently. macOS keeps running the old version
 * until the app restarts, so she can finish what she's doing (or ignore it entirely:
 * the new version is used next time she opens Timetable).
 */
export function useUpdater() {
  const [state, setState] = useState<UpdateState>({ kind: 'idle' })
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    if (!isTauri) return
    import('@tauri-apps/api/app').then((m) => m.getVersion()).then(setVersion)
    if (!import.meta.env.PROD) return // never self-update a dev build

    let busy = false
    let installed = false
    const run = async () => {
      if (busy || installed) return
      busy = true
      try {
        const { check } = await import('@tauri-apps/plugin-updater')
        const update = await check()
        if (update) {
          await update.downloadAndInstall()
          installed = true
          setState({ kind: 'installed', version: update.version })
        }
      } catch (e) {
        console.warn('Update check failed', e) // offline etc.; try again later
      } finally {
        busy = false
      }
    }
    const first = setTimeout(run, 5000)
    const timer = setInterval(run, CHECK_EVERY_MS)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [])

  const restart = async () => {
    const { relaunch } = await import('@tauri-apps/plugin-process')
    await relaunch()
  }

  return { state, version, restart }
}
