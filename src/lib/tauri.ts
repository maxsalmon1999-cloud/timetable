export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export async function invoke<T>(cmd: string, args?: Record<string, unknown>) {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

const preview = (flag: string) => typeof window !== 'undefined' && new URLSearchParams(location.search).has(flag)

/**
 * The iPhone app: the same iOS build as the iPad, which shows one day at a time instead of the week (PhoneApp.tsx).
 * iPhones say so in their browser name (iPads pretend to be Macs). In the browser, `?phone=1` previews it.
 */
export const isPhone = typeof window !== 'undefined' && ((isTauri && /iPhone|iPod/.test(navigator.userAgent)) || preview('phone'))

/**
 * The iPad app (same web code, different shell). iPadOS reports a Mac-like browser, so this goes by touch points.
 * In the browser, `?ipad=1` previews the iPad layout.
 */
export const isIPad = !isPhone && typeof window !== 'undefined' && ((isTauri && navigator.maxTouchPoints > 1) || preview('ipad'))

/** iPad or iPhone: no Mac-only extras, permissions live in the Settings app */
export const isIOS = isIPad || isPhone

/** the Mac app: native window buttons, self-updating, files in Finder */
export const isMacApp = isTauri && !isIOS
