import { useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { CaretDoubleRightIcon } from '@phosphor-icons/react'

/**
 * Slide the handle all the way across to confirm (for things that can't be taken back by accident, like removing an
 * activity). Letting go early springs it back. Keyboard: focus the handle and press → or End.
 */
export function SlideToConfirm({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const track = useRef<HTMLDivElement>(null)
  const [x, setX] = useState(0)
  const [dragging, setDragging] = useState(false)
  /** how far the handle can travel, measured when she grabs it */
  const [maxX, setMaxX] = useState(1)
  const start = useRef(0)
  const measure = () => Math.max(1, (track.current?.clientWidth ?? 0) - 52 - 8) // handle 52px, 4px inset each side

  const done = () => {
    const m = measure()
    setMaxX(m)
    setX(m)
    setTimeout(onConfirm, 120)
  }
  const down = (e: RPointerEvent<HTMLButtonElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId) // keep following the finger off the handle
    } catch {
      /* not a live pointer; moves still arrive while over the handle */
    }
    setMaxX(measure())
    start.current = e.clientX - x
    setDragging(true)
  }
  const move = (e: RPointerEvent) => {
    if (!dragging) return
    setX(Math.min(maxX, Math.max(0, e.clientX - start.current)))
  }
  const up = () => {
    if (!dragging) return
    setDragging(false)
    if (x >= maxX * 0.92) done()
    else setX(0)
  }

  const progress = x / maxX
  return (
    <div className="slide-confirm" ref={track} style={{ ['--p' as string]: progress }}>
      <span className="slide-confirm-label">{label}</span>
      <button
        type="button"
        className={'slide-confirm-handle' + (dragging ? ' dragging' : '')}
        style={{ transform: `translateX(${x}px)` }}
        aria-label={label}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={(e) => (e.key === 'ArrowRight' || e.key === 'End') && done()}
      >
        <CaretDoubleRightIcon size={22} weight="bold" />
      </button>
    </div>
  )
}
