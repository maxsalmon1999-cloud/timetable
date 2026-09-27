// Curated icon set (Phosphor names, kebab-case). Map to components with an explicit import map, e.g.
// import { ChalkboardTeacher, ... } from '@phosphor-icons/react'; const ICONS = { 'chalkboard-teacher': ChalkboardTeacher, ... }

export type { IconWeight } from './types'

export const BASE_ICONS = ['chalkboard-teacher','chats-circle','book-open','pencil-line','exam','laptop','fork-knife','barbell','users-three','coffee','music-notes','heart'] as const

export const ICON_CATEGORIES: Record<string, { icon: string; icons: string[] }> = {
  Basics: { icon: 'star', icons: [...BASE_ICONS] },
  Study: { icon: 'graduation-cap', icons: ['chalkboard-teacher','briefcase','student','graduation-cap','book-open','books','notebook','pencil-line','exam','calculator','flask','microscope','laptop','presentation-chart','translate','lightbulb','brain'] },
  Health: { icon: 'heartbeat', icons: ['barbell','person-simple-run','person-simple-bike','swimming-pool','heartbeat','flower-lotus','first-aid','pill','bed','moon','tooth','carrot','drop','sneaker-move','bicycle','apple-logo'] },
  Social: { icon: 'users-three', icons: ['users-three','chats-circle','heart','gift','cake','confetti','beer-stein','wine','phone','video-camera','envelope-simple','hand-waving','champagne','dog','coffee','smiley'] },
  Home: { icon: 'house', icons: ['house','broom','washing-machine','shopping-cart','cooking-pot','fork-knife','shower','plant','t-shirt','trash','wrench','key','couch','lamp','basket','bathtub','clipboard-text','list-checks'] },
  Hobbies: { icon: 'palette', icons: ['paint-brush','palette','music-notes','guitar','piano-keys','camera','game-controller','film-slate','television-simple','headphones','pen-nib','scissors','puzzle-piece','book-bookmark','microphone-stage','flower-tulip'] },
  Travel: { icon: 'airplane-tilt', icons: ['airplane-tilt','train','bus','car','map-pin','suitcase','globe-hemisphere-west','tent','mountains','umbrella','sun','compass','ticket','boat','taxi','van'] },
}

export const ALL_ICONS = [...new Set(Object.values(ICON_CATEGORIES).flatMap((c) => c.icons))]
export const searchIcons = (q: string) => ALL_ICONS.filter((n) => n.includes(q.trim().toLowerCase()))

// Icon guessed from an activity/block name (FIXES.md #2). First match wins, so order matters (workout before work).
const GUESSES: [RegExp, string][] = [
  [/\b(lecture|class|lesson)/, 'chalkboard-teacher'],
  [/\b(seminar|tutorial|workshop|supervision)/, 'chats-circle'],
  [/\b(exam|test|revis|quiz)/, 'exam'],
  [/\b(essay|writ|assignment|coursework|dissertation|homework)/, 'pencil-line'],
  [/\blibrar/, 'books'],
  [/\bread/, 'book-open'],
  [/\b(study|lab)/, 'student'],
  [/\b(laptop|computer|coding|online)/, 'laptop'],
  [/\b(gym|workout|weights|exercise|training|pilates)/, 'barbell'],
  [/\b(run|jog)/, 'person-simple-run'],
  [/\bswim/, 'swimming-pool'],
  [/\b(yoga|meditat|stretch)/, 'flower-lotus'],
  [/\b(cycl|bike)/, 'bicycle'],
  [/\b(work|job|shift|office|placement|intern)/, 'briefcase'],
  [/\b(brunch|coffee|caf)/, 'coffee'],
  [/\b(lunch|dinner|breakfast|meal|food|eat)/, 'fork-knife'],
  [/\bcook/, 'cooking-pot'],
  [/\b(friend|social|party|drinks|pub)/, 'users-three'],
  [/\b(date|love)/, 'heart'],
  [/\b(call|phone|facetime)/, 'phone'],
  [/\b(music|piano|guitar|sing|choir|band)/, 'music-notes'],
  [/\b(admin|email|errand|bills|forms)/, 'clipboard-text'],
  [/\b(plan|to-?do|tasks)/, 'list-checks'],
  [/\b(clean|tidy|chores)/, 'broom'],
  [/\blaundry/, 'washing-machine'],
  [/\b(shop|grocer|supermarket)/, 'shopping-cart'],
  [/\b(sleep|nap|bed)/, 'bed'],
  [/\bdentist/, 'tooth'],
  [/\b(doctor|gp|appointment|physio)/, 'first-aid'],
  [/\b(film|movie|cinema)/, 'film-slate'],
  [/\b(game|gaming)/, 'game-controller'],
  [/\b(art|paint|draw)/, 'paint-brush'],
  [/\b(travel|train|trip|commute)/, 'train'],
  [/\b(birthday|cake)/, 'cake'],
]
export const GUESSED_ICONS = GUESSES.map(([, icon]) => icon)
export const guessIcon = (name = '') => GUESSES.find(([re]) => re.test(name.toLowerCase()))?.[1]

/** What discs and chips show: the chosen icon, else a guess from the name, else a star */
export const discIcon = (icon: string | undefined, name: string) => icon ?? guessIcon(name) ?? 'star'

export const PALETTE = {
  sky: '#A9D6FF', mint: '#A8E8BF', peach: '#FFC49E', pink: '#FFB8D6', lilac: '#CDB9FF',
  teal: '#8FE0D6', lemon: '#FFE680', sand: '#E8D3B5', coral: '#FF9A8A', cloud: '#E3E1EC',
} as const

/** v1 → v2 colour migration (case-insensitive). Unknown colours are kept. */
export const COLOR_MIGRATION: Record<string, string> = {
  '#4A7DFF': PALETTE.sky, '#2FB36B': PALETTE.mint, '#F29B38': PALETTE.peach, '#EF5B7B': PALETTE.pink, '#9B6BE0': PALETTE.lilac,
  '#2BA9BF': PALETTE.teal, '#E0B82E': PALETTE.lemon, '#A0785A': PALETTE.sand, '#E5534B': PALETTE.coral, '#8A8F98': PALETTE.cloud,
}

export const SEED_ACTIVITIES = [
  { name: 'Lecture', color: PALETTE.sky, icon: 'chalkboard-teacher', duration: 120 },
  { name: 'Seminar', color: PALETTE.teal, icon: 'chats-circle', duration: 60 },
  { name: 'Reading', color: PALETTE.lilac, icon: 'book-open', duration: 90 },
  { name: 'Library', color: PALETTE.lemon, icon: 'books', duration: 120 },
  { name: 'Essay', color: PALETTE.sand, icon: 'pencil-line', duration: 120 },
  { name: 'Lunch', color: PALETTE.peach, icon: 'fork-knife', duration: 60 },
  { name: 'Gym', color: PALETTE.mint, icon: 'barbell', duration: 60 },
  { name: 'Friends', color: PALETTE.pink, icon: 'users-three', duration: 120 },
]

export const DAY = { DEFAULT_START: 9 * 60, DEFAULT_END: 22 * 60, MIN_START: 60, MAX_END: 23 * 60 + 30, EARLIER_STEP: 120 }
