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

export const FIREBASE_CONFIG: FirebaseConfig | null = {
  apiKey: 'AIzaSyD3pCpaMvO0JCurCD5G-F_Jm0S6twnQ8lQ',
  authDomain: 'timetable-2d1f7.firebaseapp.com',
  projectId: 'timetable-2d1f7',
  storageBucket: 'timetable-2d1f7.firebasestorage.app',
  messagingSenderId: '314113777321',
  appId: '1:314113777321:web:262bbabdd89c407c6813b8',
}

export const USE_EMULATOR = import.meta.env.VITE_FIREBASE_EMULATOR === '1'

/** demo- projects only exist in the emulators, no account needed */
const EMULATOR_CONFIG: FirebaseConfig = { apiKey: 'demo-key', authDomain: 'demo-timetable.firebaseapp.com', projectId: 'demo-timetable', appId: 'demo' }

export const activeConfig = (): FirebaseConfig | null => (USE_EMULATOR ? EMULATOR_CONFIG : FIREBASE_CONFIG)
