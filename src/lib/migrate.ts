import type { AppData } from './types'
import { COLOR_MIGRATION } from './icons'

/**
 * Bring saved data up to the current shape. Must always be able to open any file
 * an older release wrote (her real plans). Never drops data.
 *   v1 → v2: saturated colours → pastel palette. Icons are optional, so nothing else changes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrate(raw: any): AppData {
  let d = raw
  if (!d.version || d.version < 2) {
    const color = (c: unknown) => (typeof c === 'string' && COLOR_MIGRATION[c.toUpperCase()]) || c
    d = {
      ...d,
      version: 2,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      activities: d.activities.map((a: any) => ({ ...a, color: color(a.color) })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      blocks: d.blocks.map((b: any) => ({ ...b, color: color(b.color) })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      templates: d.templates.map((t: any) => ({ ...t, blocks: t.blocks.map((b: any) => ({ ...b, color: color(b.color) })) })),
    }
  }
  return d as AppData
}
