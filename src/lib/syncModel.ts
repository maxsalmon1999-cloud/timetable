// How plans sync between devices, without any Firebase code (so it can be tested on its own).
//
// The cloud holds one record ("doc") per thing, keyed by kind + id:
//   a:<id>        an activity (+ its position in the bank)
//   b:<id>        a block
//   t:<id>        a template
//   w:<monday>    that week's to-do lists and ticks
//   s:<monday>    "this week is synced with Apple Calendar"
// Each device keeps `sync.base`: a fingerprint of every doc as of its last sync. Comparing this device, the cloud and
// the base tells which side changed each doc (a three-way merge), so edits on different devices both survive and
// only a doc edited on both sides since the last sync is decided, in this device's favour.
// templateDraft and `sync` itself stay on this device.

import type { Activity, AppData, Block, Template, Todo } from './types'

/** doc key → the doc's content as canonical JSON */
export type Docs = Map<string, string>

/** JSON with sorted keys, so the same content always gives the same text */
export function stable(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null'
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  const o = v as Record<string, unknown>
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
    .join(',')}}`
}

/** short fingerprint of a doc (cyrb53) */
export function hash(s: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

const hasItems = (lists?: unknown[][]) => !!lists?.some((l) => l.length)

/** the synced part of her plans, as docs */
export function toDocs(d: AppData): Docs {
  const docs: Docs = new Map()
  d.activities.forEach((a, pos) => docs.set(`a:${a.id}`, stable({ ...a, pos })))
  for (const b of d.blocks) docs.set(`b:${b.id}`, stable(b))
  for (const t of d.templates) docs.set(`t:${t.id}`, stable(t))
  const weeks = new Set([...Object.keys(d.todos ?? {}), ...Object.keys(d.todoTicks ?? {})])
  for (const w of weeks) {
    const lists = d.todos?.[w]
    const ticks = d.todoTicks?.[w]
    if (hasItems(lists) || ticks?.length) docs.set(`w:${w}`, stable({ lists: hasItems(lists) ? lists : undefined, ticks: ticks?.length ? [...ticks].sort() : undefined }))
  }
  for (const w of d.syncedWeeks ?? []) docs.set(`s:${w}`, '1')
  return docs
}

/** her plans from docs; device-only fields come from `local` */
export function fromDocs(docs: Docs, local: AppData): AppData {
  const activities: (Activity & { pos: number })[] = []
  const blocks: Block[] = []
  const templates: Template[] = []
  const todos: Record<string, Todo[][]> = {}
  const todoTicks: Record<string, string[]> = {}
  const syncedWeeks: string[] = []
  for (const [key, json] of docs) {
    const at = key.indexOf(':')
    const kind = key.slice(0, at)
    const id = key.slice(at + 1)
    if (kind === 's') {
      syncedWeeks.push(id)
      continue
    }
    const v = JSON.parse(json)
    if (kind === 'a') activities.push(v)
    else if (kind === 'b') blocks.push(v)
    else if (kind === 't') templates.push(v)
    else if (kind === 'w') {
      if (v.lists) todos[id] = v.lists
      if (v.ticks) todoTicks[id] = v.ticks
    }
  }
  activities.sort((x, y) => x.pos - y.pos || (x.id < y.id ? -1 : 1))
  // keep her local order of blocks/templates where possible, so nothing on screen jumps about
  const order = (ids: string[]) => {
    const at = new Map(ids.map((id, i) => [id, i]))
    return (x: { id: string }, y: { id: string }) => (at.get(x.id) ?? Infinity) - (at.get(y.id) ?? Infinity) || (x.id < y.id ? -1 : 1)
  }
  blocks.sort(order(local.blocks.map((b) => b.id)))
  templates.sort(order(local.templates.map((t) => t.id)))
  const { todos: _t, todoTicks: _k, syncedWeeks: _s, ...rest } = local // eslint-disable-line @typescript-eslint/no-unused-vars
  return {
    ...rest,
    activities: activities.map(({ pos: _, ...a }) => a), // eslint-disable-line @typescript-eslint/no-unused-vars
    blocks,
    templates,
    ...(Object.keys(todos).length ? { todos } : {}),
    ...(Object.keys(todoTicks).length ? { todoTicks } : {}),
    ...(syncedWeeks.length ? { syncedWeeks: syncedWeeks.sort() } : {}),
  }
}

export interface Reconciled {
  /** her plans after the merge (the same object as `local` when nothing changed) */
  data: AppData
  /** docs to write to the cloud: content, or null to delete */
  writes: Map<string, string | null>
  /** new base fingerprints */
  base: Record<string, string>
}

/**
 * Three-way merge of this device's plans with the cloud's docs.
 * `base` is null the first time this device syncs with this account: everything on both sides is kept (this device
 * wins where the same doc differs), and the starter activities this device made aren't duplicated by name.
 */
export function reconcile(local: AppData, remote: Docs, base: Record<string, string> | null): Reconciled {
  if (!base) local = firstSyncActivities(local, remote)
  const mine = toDocs(local)
  const merged: Docs = new Map()
  const writes = new Map<string, string | null>()
  const keys = new Set([...mine.keys(), ...remote.keys(), ...Object.keys(base ?? {})])
  for (const k of keys) {
    const l = mine.get(k)
    const r = remote.get(k)
    const unchangedHere = (l === undefined ? undefined : hash(l)) === base?.[k]
    if (unchangedHere) {
      // only the cloud may have changed it (or deleted it)
      if (r !== undefined) merged.set(k, r)
    } else if (l !== undefined) {
      merged.set(k, l)
      if (l !== r) writes.set(k, l)
    } else if (r !== undefined) {
      writes.set(k, null) // deleted on this device
    }
  }
  const newBase: Record<string, string> = {}
  for (const [k, v] of merged) newBase[k] = hash(v)
  const same = merged.size === mine.size && [...merged].every(([k, v]) => mine.get(k) === v)
  return { data: same ? local : fromDocs(merged, local), writes, base: newBase }
}

/**
 * First sync: the bank becomes the cloud's activities in their order, then this device's own ones after them,
 * leaving out any the cloud already has by name (both devices made the starter set).
 */
function firstSyncActivities(local: AppData, remote: Docs): AppData {
  const cloud: (Activity & { pos: number })[] = []
  for (const [k, v] of remote) if (k.startsWith('a:')) cloud.push(JSON.parse(v))
  if (!cloud.length) return local
  cloud.sort((x, y) => x.pos - y.pos || (x.id < y.id ? -1 : 1))
  const names = new Set(cloud.map((a) => a.name.trim().toLowerCase()))
  const ids = new Set(cloud.map((a) => a.id))
  const own = local.activities.filter((a) => !ids.has(a.id) && !names.has(a.name.trim().toLowerCase()))
  return { ...local, activities: [...cloud.map(({ pos: _, ...a }) => a), ...own] } // eslint-disable-line @typescript-eslint/no-unused-vars
}
