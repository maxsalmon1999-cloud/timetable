import { DAY, PALETTE } from './icons'

/** Earliest/latest anything can be placed. The *visible* range is narrower; see lib/dayRange.ts */
export const MIN_START = DAY.MIN_START
export const MAX_END = DAY.MAX_END
export const DEFAULT_START = DAY.DEFAULT_START
export const DEFAULT_END = DAY.DEFAULT_END
export const EARLIER_STEP = DAY.EARLIER_STEP

export const SNAP = 15
export const snap = (min: number) => Math.round(min / SNAP) * SNAP

export const COLORS: string[] = Object.values(PALETTE)

/** preset lengths for activities: 15m, then every half hour up to 5h (anything else is 'Custom') */
export const DURATIONS = [15, ...Array.from({ length: 10 }, (_, i) => (i + 1) * 30)]

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
