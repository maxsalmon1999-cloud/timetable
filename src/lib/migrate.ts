import type { AppData } from './types'
import { COLOR_MIGRATION, guessIcon } from './icons'
import { startOfWeek, toISO } from './dates'

/**
 * Bring saved data up to the current shape. Must always be able to open any file
 * an older release wrote (her real plans). Never drops data. Steps run in order.
 *   v1 → v2: saturated colours → pastel palette (icon fields are optional, nothing else changes)
 *   v2 → v3: fill missing icons, never overwriting one that's set. Activities: guessed from the name.
 *            Blocks: the icon of the activity with the same name if it has one, else guessed from the title.
 *   v3 → v4: tag each block with the activity of the same name (case and spaces ignored); others stay untagged.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any

export function migrate(raw: Raw): AppData {
  let d = raw
  const version = d.version ?? 1

  if (version < 2) {
    const color = (c: unknown) => (typeof c === 'string' && COLOR_MIGRATION[c.toUpperCase()]) || c
    d = mapAll(d, (x) => ({ ...x, color: color(x.color) }))
  }

  if (version < 3) {
    // activities first, so blocks named after an activity can take the icon she chose for it
    const activities = d.activities.map((a: Raw) => (a.icon ? a : { ...a, ...iconOf(guessIcon(a.name)) }))
    const byName = new Map<string, Raw>(activities.filter((a: Raw) => a.icon).map((a: Raw) => [key(a.name), a]))
    d = mapAll({ ...d, activities }, (x) => {
      if (x.icon || x.name !== undefined) return x // set already, or an activity (done above)
      const a = byName.get(key(x.title))
      return a ? { ...x, icon: a.icon, ...(a.iconWeight ? { iconWeight: a.iconWeight } : {}) } : { ...x, ...iconOf(guessIcon(x.title)) }
    })
  }

  if (version < 4) {
    const byName = new Map<string, string>(d.activities.map((a: Raw) => [key(a.name), a.id]))
    d = mapAll(d, (x) => {
      if (x.name !== undefined || x.tag) return x // an activity, or tagged already
      const tag = byName.get(key(x.title))
      return tag ? { ...x, tag } : x
    })
  }

  // unreleased dev builds kept one week-less to-do pad (Todo[][]); file it under the current week
  if (Array.isArray(d.todos)) d = { ...d, todos: { [toISO(startOfWeek(new Date()))]: d.todos } }

  return { ...d, version: 4 } as AppData
}

const key = (name: unknown) => String(name ?? '').trim().toLowerCase()
const iconOf = (icon: string | undefined) => (icon ? { icon } : {})

/** Apply fn to every activity, block, template block and draft block */
function mapAll(d: Raw, fn: (x: Raw) => Raw): Raw {
  return {
    ...d,
    activities: d.activities.map(fn),
    blocks: d.blocks.map(fn),
    templates: d.templates.map((t: Raw) => ({ ...t, blocks: t.blocks.map(fn) })),
    ...(d.templateDraft ? { templateDraft: { ...d.templateDraft, blocks: d.templateDraft.blocks.map(fn) } } : {}),
  }
}
