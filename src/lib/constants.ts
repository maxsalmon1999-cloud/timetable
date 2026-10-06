import { DAY, PALETTE } from './icons'

/** Earliest/latest anything can be placed. The *visible* range is narrower; see lib/dayRange.ts */
export const MIN_START = DAY.MIN_START
export const MAX_END = DAY.MAX_END
export const DEFAULT_START = DAY.DEFAULT_START
export const DEFAULT_END = DAY.DEFAULT_END
export const EARLIER_STEP = DAY.EARLIER_STEP

export const SNAP = 15
export const snap = (min: number) => Math.round(min / SNAP) * SNAP

/** the picker's colours, round the colour wheel; the honeycomb lays them out 7 / 6 / 7 */
export const COLORS: string[] = [
  PALETTE.coral, PALETTE.salmon, PALETTE.peach, PALETTE.apricot, PALETTE.butter, PALETTE.lemon, PALETTE.lime,
  PALETTE.mint, PALETTE.sage, PALETTE.teal, PALETTE.aqua, PALETTE.sky, PALETTE.periwinkle,
  PALETTE.lilac, PALETTE.orchid, PALETTE.pink, PALETTE.rose, PALETTE.sand, PALETTE.stone, PALETTE.cloud,
]

/** preset lengths for activities: 15m, then every half hour up to 5h (anything else is 'Custom') */
export const DURATIONS = [15, ...Array.from({ length: 10 }, (_, i) => (i + 1) * 30)]

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
