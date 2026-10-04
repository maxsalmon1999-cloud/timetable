export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export async function invoke<T>(cmd: string, args?: Record<string, unknown>) {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

/**
 * The iPad app (same web code, different shell). iPadOS reports a Mac-like browser, so this goes by touch points.
 * In the browser, `?ipad=1` previews the iPad layout.
 */
export const isIPad =
  typeof window !== 'undefined' && ((isTauri && navigator.maxTouchPoints > 1) || new URLSearchParams(location.search).has('ipad'))

/** the Mac app: native window buttons, self-updating, files in Finder */
export const isMacApp = isTauri && !isIPad
