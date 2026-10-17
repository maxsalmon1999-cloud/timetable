import type { MouseEvent as RMouseEvent, PointerEvent as RPointerEvent } from 'react'

/**
 * Close a pop-up with a tap on the dimmed backdrop. It closes on the click, not the press: closing on the press took the
 * backdrop away mid-tap, so on iPhone the click then landed on whatever was underneath (e.g. the next-day button).
 * Only when the press started on the backdrop too, so a drag out of the pop-up doesn't close it.
 */
export function backdropClose(onClose: () => void) {
  // kept on the element, so a re-render between press and click doesn't forget it
  return {
    onPointerDown: (e: RPointerEvent<HTMLElement>) => (e.currentTarget.dataset.armed = String(e.target === e.currentTarget)),
    onClick: (e: RMouseEvent<HTMLElement>) => e.currentTarget.dataset.armed === 'true' && e.target === e.currentTarget && onClose(),
  }
}
