// The only file that talks to Firebase. Loaded on demand, so the app starts as fast as before and works the same
// with sync off. Her docs live at users/<uid>/items/<key> as { json, at }; see lib/syncModel.ts for the keys.

import type { Docs } from './syncModel'
import { activeConfig, USE_EMULATOR } from './firebaseConfig'

export interface CloudUser {
  uid: string
  email: string | null
}

async function load() {
  const config = activeConfig()
  if (!config) throw new Error('Sync is not set up (src/lib/firebaseConfig.ts)')
  const [{ initializeApp }, auth, fs] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')])
  const app = initializeApp(config)
  const a = auth.initializeAuth(app, { persistence: [auth.indexedDBLocalPersistence, auth.browserLocalPersistence] })
  // memory cache only: her plans already live in the local file, which is the copy that survives restarts
  const db = fs.initializeFirestore(app, {})
  if (USE_EMULATOR) {
    auth.connectAuthEmulator(a, 'http://127.0.0.1:9099', { disableWarnings: true })
    fs.connectFirestoreEmulator(db, '127.0.0.1', 8080)
  }
  return { auth, fs, a, db }
}

let loading: ReturnType<typeof load> | null = null
const cloud = () => (loading ??= load())

/** calls back with the signed-in account (or null) now and whenever it changes */
export async function watchUser(cb: (u: CloudUser | null) => void) {
  const { auth, a } = await cloud()
  return auth.onAuthStateChanged(a, (u) => cb(u ? { uid: u.uid, email: u.email } : null))
}

export async function signIn(email: string, password: string) {
  const { auth, a } = await cloud()
  await auth.signInWithEmailAndPassword(a, email.trim(), password)
}

export async function signUp(email: string, password: string) {
  const { auth, a } = await cloud()
  await auth.createUserWithEmailAndPassword(a, email.trim(), password)
}

export async function signOut() {
  const { auth, a } = await cloud()
  await auth.signOut(a)
}

export async function sendReset(email: string) {
  const { auth, a } = await cloud()
  await auth.sendPasswordResetEmail(a, email.trim())
}

export interface DocsMeta {
  /** the snapshot came from Firestore's memory, not the server (offline, or still connecting) */
  fromCache: boolean
  /** some of this device's writes haven't reached the server yet */
  pending: boolean
}

/** live copy of all her docs; includes this device's writes the moment they're made */
export async function watchDocs(uid: string, cb: (docs: Docs, meta: DocsMeta) => void, onError: (e: Error) => void) {
  const { fs, db } = await cloud()
  return fs.onSnapshot(
    fs.collection(db, 'users', uid, 'items'),
    { includeMetadataChanges: true },
    (snap) => {
      const docs: Docs = new Map()
      snap.forEach((d) => {
        const json = d.get('json')
        if (typeof json === 'string') docs.set(d.id, json)
      })
      cb(docs, { fromCache: snap.metadata.fromCache, pending: snap.metadata.hasPendingWrites })
    },
    onError,
  )
}

/** write docs (null = delete). Resolves once the server has them all, which waits while offline. */
export async function writeDocs(uid: string, writes: Map<string, string | null>) {
  const { fs, db } = await cloud()
  const entries = [...writes]
  const commits: Promise<void>[] = []
  for (let i = 0; i < entries.length; i += 400) {
    const batch = fs.writeBatch(db)
    for (const [key, json] of entries.slice(i, i + 400)) {
      const ref = fs.doc(db, 'users', uid, 'items', key)
      if (json === null) batch.delete(ref)
      else batch.set(ref, { json, at: fs.serverTimestamp() })
    }
    commits.push(batch.commit())
  }
  await Promise.all(commits)
}

/** a sentence she can act on, for Firebase's error codes */
export function friendlyError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  const known: Record<string, string> = {
    'auth/invalid-credential': 'That email and password don’t match. Check them and try again.',
    'auth/wrong-password': 'That email and password don’t match. Check them and try again.',
    'auth/user-not-found': 'There’s no account with that email yet. Create one instead.',
    'auth/email-already-in-use': 'There’s already an account with that email. Sign in instead.',
    'auth/invalid-email': 'That doesn’t look like an email address.',
    'auth/weak-password': 'Choose a password with at least 6 characters.',
    'auth/missing-password': 'Type your password.',
    'auth/network-request-failed': 'Couldn’t reach the internet. Check your connection and try again.',
    'auth/too-many-requests': 'Too many tries. Wait a few minutes, then try again.',
    'auth/operation-not-allowed': 'New accounts are switched off for this app.',
    'auth/admin-restricted-operation': 'New accounts are switched off for this app.',
    'permission-denied': 'This account isn’t allowed to sync these plans.',
  }
  return known[code] ?? String((e as Error)?.message ?? e)
}
