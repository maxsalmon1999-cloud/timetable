import { DEFAULT_END, DEFAULT_START, EARLIER_STEP, MAX_END, MIN_START } from './constants'

export interface RangeTargets {
  /** what she asked to see (session only, reset on week change) */
  top: number
  bottom: number
}
export const DEFAULT_TARGETS: RangeTargets = { top: DEFAULT_START, bottom: DEFAULT_END }

export interface DayRange {
  start: number
  end: number
  /** e.g. "Starts 7:00 for Early swim" when an item pulled the start earlier than asked */
  autoNote: string | null
  canEarlier: boolean
  earlierTo: number
  canHideTop: boolean
  canLater: boolean
  canHideBottom: boolean
}

/**
 * The hours shown on the grid: 9:00–22:00 by default, widened to fit every block and
 * timed calendar event this week (start floors to the hour, end ceils to the half hour),
 * and by + Earlier / + Later. Never outside MIN_START..MAX_END.
 */
export function visibleRange(
  items: { start: number; end: number; title: string }[],
  targets: RangeTargets,
  fmt: (m: number) => string,
): DayRange {
  let earliest: (typeof items)[number] | null = null
  let latestEnd = -Infinity
  for (const it of items) {
    if (!earliest || it.start < earliest.start) earliest = it
    latestEnd = Math.max(latestEnd, it.end)
  }
  const start = Math.max(MIN_START, Math.min(targets.top, earliest ? Math.floor(earliest.start / 60) * 60 : Infinity))
  const end = Math.min(MAX_END, Math.max(targets.bottom, Math.ceil(latestEnd / 30) * 30))
  return {
    start,
    end,
    autoNote: earliest && start < targets.top ? `Starts ${fmt(start)} for ${earliest.title || 'Untitled'}` : null,
    canEarlier: start > MIN_START,
    earlierTo: Math.max(MIN_START, start - EARLIER_STEP),
    canHideTop: targets.top < DEFAULT_START,
    canLater: end < MAX_END,
    canHideBottom: targets.bottom > DEFAULT_END,
  }
}
