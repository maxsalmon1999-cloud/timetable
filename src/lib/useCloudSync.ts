import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppData } from './types'
import { activeConfig } from './firebaseConfig'
import { friendlyError, sendReset, signIn, signOut, signUp, watchDocs, watchUser, writeDocs, type CloudUser } from './cloud'
import { hash, reconcile, stable, type Docs } from './syncModel'

export type CloudStatus =
  | { kind: 'off' } // sync isn't set up in this build
  | { kind: 'starting' }
  | { kind: 'signed-out' }
  | { kind: 'connecting' }
  | { kind: 'offline' }
  | { kind: 'syncing' } // this device's changes are on their way up
  | { kind: 'synced' }
  | { kind: 'error'; message: string }

interface Remote {
  uid: string
  docs: Docs
  fromCache: boolean
  pending: boolean
}

/**
 * Keeps her plans in step with the cloud while she's signed in. The local file stays the main copy: sync only merges
 * the other device's changes in (lib/syncModel.ts) and sends this device's up.
 */
export function useCloudSync(
  data: AppData | null,
  applyRemote: (d: AppData) => void,
  updateSync: (fn: (s: AppData['sync']) => AppData['sync']) => void,
) {
  const configured = !!activeConfig()
  /** undefined until Firebase says who's signed in */
  const [user, setUser] = useState<CloudUser | null | undefined>(undefined)
  const [remote, setRemote] = useState<Remote | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const on = () => setOnline(navigator.onLine)
    window.addEventListener('online', on)
    window.addEventListener('offline', on)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', on)
    }
  }, [])

  useEffect(() => {
    if (!configured) return
    let unsub: (() => void) | undefined
    let alive = true
    watchUser((u) => alive && setUser(u))
      .then((u) => (alive ? (unsub = u) : u()))
      .catch((e) => alive && setError(friendlyError(e)))
    return () => {
      alive = false
      unsub?.()
    }
  }, [configured])

  const uid = user?.uid
  /** bumps to reconnect after the cloud refused the connection */
  const [attempt, setAttempt] = useState(0)
  /** refusals in a row, for the back-off */
  const failures = useRef(0)
  useEffect(() => {
    if (!uid) return
    let unsub: (() => void) | undefined
    let alive = true
    let retry: ReturnType<typeof setTimeout> | undefined
    watchDocs(
      uid,
      (docs, meta) => {
        if (!alive) return
        setRemote({ uid, docs, ...meta })
        if (!meta.fromCache) {
          setError(null)
          failures.current = 0
        }
      },
      (e) => {
        if (!alive) return
        setError(friendlyError(e))
        // a refused listener stops for good: try again in a while (10s, 20s, … up to 5 minutes)
        retry = setTimeout(() => setAttempt((n) => n + 1), Math.min(10_000 * 2 ** failures.current++, 300_000))
      },
    )
      .then((u) => (alive ? (unsub = u) : u()))
      .catch((e) => alive && setError(friendlyError(e)))
    return () => {
      alive = false
      clearTimeout(retry)
      unsub?.()
    }
  }, [uid, attempt])


  // the merge: runs whenever her plans or the cloud copy change
  useEffect(() => {
    if (!data || !uid || remote?.uid !== uid) return
    const base = data.sync?.uid === uid ? data.sync.base : null
    if (!base && remote.fromCache) return // a first sync waits for the server's copy, so nothing gets duplicated
    const r = reconcile(data, remote.docs, base)
    // a doc being written keeps its old fingerprint until the server has it, so if the app closes first it's re-sent
    const nextBase = { ...r.base }
    for (const k of r.writes.keys()) {
      if (base?.[k] !== undefined) nextBase[k] = base[k]
      else delete nextBase[k]
    }
    if (r.writes.size) {
      const written = new Map(r.writes)
      writeDocsAndConfirm(uid, written, updateSync).catch((e) => setError(friendlyError(e)))
    }
    if (r.data !== data) applyRemote({ ...r.data, sync: { uid, base: nextBase } })
    else if (data.sync?.uid !== uid || stable(data.sync.base) !== stable(nextBase)) updateSync(() => ({ uid, base: nextBase }))
  }, [data, remote, uid, applyRemote, updateSync])

  const status: CloudStatus = !configured
    ? { kind: 'off' }
    : user === undefined
      ? { kind: 'starting' }
      : user === null
        ? { kind: 'signed-out' }
        : error
          ? { kind: 'error', message: error }
          : !remote || remote.uid !== uid || remote.fromCache
            ? online
              ? { kind: 'connecting' }
              : { kind: 'offline' }
            : remote.pending
              ? { kind: 'syncing' }
              : { kind: 'synced' }

  const run = useCallback(async (fn: () => Promise<void>) => {
    setError(null)
    try {
      await fn()
    } catch (e) {
      throw new Error(friendlyError(e), { cause: e })
    }
  }, [])

  return {
    status,
    email: user?.email ?? null,
    signIn: (email: string, password: string) => run(() => signIn(email, password)),
    signUp: (email: string, password: string) => run(() => signUp(email, password)),
    signOut: () => run(signOut),
    sendReset: (email: string) => run(() => sendReset(email)),
  }
}

async function writeDocsAndConfirm(uid: string, written: Map<string, string | null>, updateSync: (fn: (s: AppData['sync']) => AppData['sync']) => void) {
  await writeDocs(uid, written)
  // the server has them: now they count as synced
  updateSync((s) => {
    if (s?.uid !== uid) return s
    const base = { ...s.base }
    for (const [k, v] of written) {
      if (v === null) delete base[k]
      else base[k] = hash(v)
    }
    return { ...s, base }
  })
}
