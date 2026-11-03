import { useEffect, useMemo, useState } from 'react'
import type { AppData } from './types'
import { friendStatuses, type FriendStatus } from './friends'

const minutesNow = () => {
  const n = new Date()
  return n.getHours() * 60 + n.getMinutes()
}

/**
 * Her friends with when she last saw them, and the once-a-day "haven't seen in a while" pop-up: the first time the
 * app is opened each day (on any device, since the day checked is synced), it lists the friends past their reminder.
 */
export function useFriends(data: AppData | null, today: string, updateSilently: (fn: (d: AppData) => AppData) => void) {
  const blocks = data?.blocks
  const friends = data?.friends
  // re-read on a new day and whenever her blocks or friends change; minutes only matter for today's blocks
  const statuses = useMemo<FriendStatus[]>(
    () => (blocks ? friendStatuses(friends, blocks, today, minutesNow()) : []),
    [friends, blocks, today],
  )
  const overdue = statuses.filter((s) => s.overdue)
  const [ping, setPing] = useState<FriendStatus[] | null>(null)

  const loaded = !!data
  const checked = data?.friendsChecked
  useEffect(() => {
    if (!loaded || checked === today) return
    // a snapshot: the pop-up keeps its list while she reads it
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (overdue.length) setPing(overdue)
    updateSilently((d) => ({ ...d, friendsChecked: today }))
  }, [loaded, checked, today]) // eslint-disable-line react-hooks/exhaustive-deps

  return { statuses, overdue, ping, closePing: () => setPing(null) }
}
