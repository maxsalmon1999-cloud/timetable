export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export async function invoke<T>(cmd: string, args?: Record<string, unknown>) {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}
