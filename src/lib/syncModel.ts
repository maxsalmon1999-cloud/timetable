// How plans sync between devices, without any Firebase code (so it can be tested on its own).
//
// The cloud holds one record ("doc") per thing, keyed by kind + id:
//   a:<id>        an activity (+ its position in the bank)
//   b:<id>        a block
//   t:<id>        a template
//   d:<monday>:<day>:<id>   one of her to-dos (+ its position in that day's list)
//   k:<monday>:<id>         a tick on a timetable block / calendar event that week
//   s:<monday>    "this week is synced with Apple Calendar"
//   f:<id>        a friend (removing one marks it removed: f: docs are never deleted, see KEEP below)
//   x:friendsChecked   the day the "haven't seen in a while" check last ran
//   w:<monday>    (old: a whole week's to-dos in one doc; read and then replaced by d:/k: docs, because two devices
//                 editing the same week while apart lost one side's changes)
// Each device keeps `sync.base`: a fingerprint of every doc as of its last sync. Comparing this device, the cloud and
// the base tells which side changed each doc (a three-way merge), so edits on different devices both survive and
// only a doc edited on both sides since the last sync is decided, in this device's favour.
// templateDraft and `sync` itself stay on this device.

import type { Activity, AppData, Block, Friend, Template, Todo } from './types'

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

/** doc ids can't contain '/', and calendar event ids might */
const enc = encodeURIComponent
const dec = decodeURIComponent

/** the synced part of her plans, as docs */
export function toDocs(d: AppData): Docs {
  const docs: Docs = new Map()
  d.activities.forEach((a, pos) => docs.set(`a:${a.id}`, stable({ ...a, pos })))
  for (const b of d.blocks) docs.set(`b:${b.id}`, stable(b))
  for (const t of d.templates) docs.set(`t:${t.id}`, stable(t))
  for (const [w, lists] of Object.entries(d.todos ?? {}))
    lists.forEach((list, day) => list.forEach((t, pos) => docs.set(`d:${w}:${day}:${enc(t.id)}`, stable({ ...t, pos }))))
  for (const [w, ticks] of Object.entries(d.todoTicks ?? {})) for (const id of ticks) docs.set(`k:${w}:${enc(id)}`, '1')
  for (const w of d.syncedWeeks ?? []) docs.set(`s:${w}`, '1')
  for (const f of d.friends ?? []) docs.set(`f:${enc(f.id)}`, stable(f))
  if (d.friendsChecked) docs.set('x:friendsChecked', stable(d.friendsChecked))
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
  const friends: Friend[] = []
  let friendsChecked: string | undefined
  const legacyWeeks: [string, { lists?: Todo[][]; ticks?: string[] }][] = []
  const items: Record<string, (Todo & { pos: number; day: number })[]> = {}
  const tickSets: Record<string, Set<string>> = {}
  for (const [key, json] of docs) {
    const parts = key.split(':')
    const kind = parts[0]
    if (kind === 's') syncedWeeks.push(parts[1])
    else if (kind === 'k') (tickSets[parts[1]] ??= new Set()).add(dec(parts[2]))
    else if (kind === 'd') (items[parts[1]] ??= []).push({ ...JSON.parse(json), day: Number(parts[2]) })
    else if (kind === 'w') legacyWeeks.push([parts[1], JSON.parse(json)])
    else {
      const v = JSON.parse(json)
      if (kind === 'a') activities.push(v)
      else if (kind === 'b') blocks.push(v)
      else if (kind === 't') templates.push(v)
      else if (kind === 'f') friends.push(v)
      else if (kind === 'x' && parts[1] === 'friendsChecked') friendsChecked = v
    }
  }
  // old whole-week docs: keep any to-do or tick the per-item docs don't already have
  for (const [w, v] of legacyWeeks) {
    const have = new Set((items[w] ?? []).map((t) => t.id))
    v.lists?.forEach((list, day) => list.forEach((t, pos) => have.has(t.id) || (items[w] ??= []).push({ ...t, pos: 1000 + pos, day })))
    for (const id of v.ticks ?? []) (tickSets[w] ??= new Set()).add(id)
  }
  for (const [w, list] of Object.entries(items)) {
    list.sort((x, y) => x.pos - y.pos || (x.id < y.id ? -1 : 1))
    todos[w] = Array.from({ length: 7 }, (_, day) => list.filter((t) => t.day === day).map(({ pos: _p, day: _d, ...t }) => t)) // eslint-disable-line @typescript-eslint/no-unused-vars
  }
  for (const [w, set] of Object.entries(tickSets)) todoTicks[w] = [...set].sort()
  activities.sort((x, y) => x.pos - y.pos || (x.id < y.id ? -1 : 1))
  // keep her local order of blocks/templates where possible, so nothing on screen jumps about
  const order = (ids: string[]) => {
    const at = new Map(ids.map((id, i) => [id, i]))
    return (x: { id: string }, y: { id: string }) => (at.get(x.id) ?? Infinity) - (at.get(y.id) ?? Infinity) || (x.id < y.id ? -1 : 1)
  }
  blocks.sort(order(local.blocks.map((b) => b.id)))
  templates.sort(order(local.templates.map((t) => t.id)))
  friends.sort(order((local.friends ?? []).map((f) => f.id)))
  const { todos: _t, todoTicks: _k, syncedWeeks: _s, friends: _f, friendsChecked: _c, ...rest } = local // eslint-disable-line @typescript-eslint/no-unused-vars
  return {
    ...rest,
    activities: activities.map(({ pos: _, ...a }) => a), // eslint-disable-line @typescript-eslint/no-unused-vars
    blocks,
    templates,
    ...(Object.keys(todos).length ? { todos } : {}),
    ...(Object.keys(todoTicks).length ? { todoTicks } : {}),
    ...(syncedWeeks.length ? { syncedWeeks: syncedWeeks.sort() } : {}),
    ...(friends.length ? { friends } : {}),
    ...(friendsChecked ? { friendsChecked } : {}),
  }
}

/**
 * Docs this app never deletes from the cloud. Apps from before friends existed (v0.8.0 and older) don't know these
 * kinds, so after reading them once they "delete" them on their next sync. Treating a doc missing from the cloud as
 * lost (and putting it back) keeps her friends safe while an old app is still about. Removing a friend is a doc
 * marked `removed`, never a deletion.
 */
const KEEP = (k: string) => k.startsWith('f:') || k.startsWith('x:')

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
    if (KEEP(k) && l !== undefined && r === undefined) {
      // new here, or the cloud lost it (an older app dropped it): (re)upload
      merged.set(k, l)
      writes.set(k, l)
    } else if (KEEP(k) && l === undefined && r !== undefined && !unchangedHere) {
      // gone from this device (an undo of adding a friend): keep it in the cloud, marked removed
      const gone = k.startsWith('f:') ? stable({ ...JSON.parse(r), removed: true }) : r
      merged.set(k, gone)
      if (gone !== r) writes.set(k, gone)
    } else if (unchangedHere) {
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
