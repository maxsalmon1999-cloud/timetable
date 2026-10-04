import { useCallback, useEffect, useState } from 'react'
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
  useEffect(() => {
    if (!uid) return
    let unsub: (() => void) | undefined
    let alive = true
    watchDocs(
      uid,
      (docs, meta) => {
        if (!alive) return
        setRemote({ uid, docs, ...meta })
        if (!meta.fromCache) setError(null)
      },
      (e) => alive && setError(friendlyError(e)),
    )
      .then((u) => (alive ? (unsub = u) : u()))
      .catch((e) => alive && setError(friendlyError(e)))
    return () => {
      alive = false
      unsub?.()
    }
  }, [uid])

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
