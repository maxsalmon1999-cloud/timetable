// The Firebase project that syncs her plans between devices. These values identify the project; they aren't
// secrets (Firebase's security rules, in firestore.rules, decide who can read what).
// Paste the config from Firebase console → Project settings → Your apps → Web app. While it's null, sync is off and
// its button is hidden.
//
// Dev: `VITE_FIREBASE_EMULATOR=1 npm run dev` (with `npm run emulators` running) uses local emulators instead.

export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket?: string
  messagingSenderId?: string
  appId: string
}

export const FIREBASE_CONFIG: FirebaseConfig | null = null

export const USE_EMULATOR = import.meta.env.VITE_FIREBASE_EMULATOR === '1'

/** demo- projects only exist in the emulators, no account needed */
const EMULATOR_CONFIG: FirebaseConfig = { apiKey: 'demo-key', authDomain: 'demo-timetable.firebaseapp.com', projectId: 'demo-timetable', appId: 'demo' }

export const activeConfig = (): FirebaseConfig | null => (USE_EMULATOR ? EMULATOR_CONFIG : FIREBASE_CONFIG)
