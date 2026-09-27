export const DAY_START = 6 * 60
export const DAY_END = 24 * 60
export const SNAP = 15
export const HOUR_PX = 56
export const PX_PER_MIN = HOUR_PX / 60

export const snap = (min: number) => Math.round(min / SNAP) * SNAP

export const COLORS = [
  '#4A7DFF', // blue
  '#2FB36B', // green
  '#F29B38', // orange
  '#EF5B7B', // pink
  '#9B6BE0', // purple
  '#2BA9BF', // teal
  '#E0B82E', // yellow
  '#A0785A', // brown
  '#E5534B', // red
  '#8A8F98', // grey
]

/** preset lengths for activities: 15m, then every half hour up to 5h (anything else is 'Custom') */
export const DURATIONS = [15, ...Array.from({ length: 10 }, (_, i) => (i + 1) * 30)]

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
