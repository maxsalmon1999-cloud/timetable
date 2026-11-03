// Keep track of friends: who she sees, when she last saw them, and who it's been too long since.
// A friend is "seen" on a block of hers that is tagged with them and has already ended; a tagged block still to come
// means she's seeing them soon, so they aren't overdue.

import type { AppData, Block, Friend } from './types'

// (no runtime imports, so `npm test` can load this file with node directly)
const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000)

export const live = (friends: Friend[] | undefined) => (friends ?? []).filter((f) => !f.removed)

/** reminder choices in the friends list, in days */
export const REMIND_CHOICES = [7, 14, 21, 30, 60, 90]

export const remindLabel = (days: number) =>
  days % 30 === 0 ? (days === 30 ? '1 month' : `${days / 30} months`) : days % 7 === 0 ? (days === 7 ? '1 week' : `${days / 7} weeks`) : `${days} days`

export interface FriendStatus {
  friend: Friend
  /** YYYY-MM-DD of the last block with them that has ended, if any */
  last?: string
  /** YYYY-MM-DD of the next block with them that hasn't ended yet, if any */
  next?: string
  /** days since last seen (or since added, if never) */
  since: number
  /** past their reminder, with nothing planned */
  overdue: boolean
}

/** each (non-removed) friend's last and next time, as of `today` at `nowMin` minutes past midnight */
export function friendStatuses(friends: Friend[] | undefined, blocks: Block[], today: string, nowMin: number): FriendStatus[] {
  return live(friends).map((friend) => {
    let last: string | undefined
    let next: string | undefined
    for (const b of blocks) {
      if (!b.friends?.includes(friend.id)) continue
      const over = b.date < today || (b.date === today && b.end <= nowMin)
      if (over) {
        if (!last || b.date > last) last = b.date
      } else if (!next || b.date < next) next = b.date
    }
    const since = Math.max(0, daysBetween(last ?? friend.added, today))
    const overdue = !!friend.remindDays && !next && since >= friend.remindDays
    return { friend, last, next, since, overdue }
  })
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Friends named in a block's title: the full name or the first name as whole words, ignoring case and accents
 * ("Lunch with aoi" finds Aoi Tanaka). Some names are ordinary words too (May, Will), so callers ask before tagging.
 */
export function namedIn(title: string, friends: Friend[] | undefined): Friend[] {
  const t = fold(title)
  return live(friends).filter((f) => {
    const full = fold(f.name.trim())
    if (!full) return false
    const first = full.split(/\s+/)[0]
    return [full, first].some((n) => new RegExp(`(^|[^\\p{L}\\p{N}])${escape(n)}($|[^\\p{L}\\p{N}])`, 'u').test(t))
  })
}

// ---------- changes to her list (each one undo step via store.update) ----------

const withFriends = (d: AppData, fn: (fs: Friend[]) => Friend[]): AppData => ({ ...d, friends: fn(d.friends ?? []) })

export const addFriend = (d: AppData, f: Friend) => withFriends(d, (fs) => [...fs, f])
export const changeFriend = (d: AppData, id: string, change: Partial<Pick<Friend, 'name' | 'remindDays'>>) =>
  withFriends(d, (fs) =>
    fs.map((f) => {
      if (f.id !== id) return f
      const next = { ...f, ...change }
      if (!next.remindDays) delete next.remindDays
      return next
    }),
  )
/** hidden, not deleted (see Friend.removed); her blocks keep the tag, which then just isn't shown */
export const removeFriend = (d: AppData, id: string) => withFriends(d, (fs) => fs.map((f) => (f.id === id ? { ...f, removed: true as const } : f)))
