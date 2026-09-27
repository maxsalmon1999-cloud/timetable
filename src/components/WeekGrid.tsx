import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent, type RefObject } from 'react'
import type { Block } from '../lib/types'
import { DAY_END, DAY_START, HOUR_PX, PX_PER_MIN } from '../lib/constants'
import { fmtTime, fromISO, toISO } from '../lib/dates'
import { layoutLanes } from '../lib/layout'
import { eventsForDay, overlaps, type CalEvent, type DayEvent } from '../lib/calendar'

export interface Hit {
  date: string
  minute: number
  inside: boolean
}
export type HitTest = (x: number, y: number) => Hit | null

export interface Preview {
  date: string
  start: number
  end: number
  title: string
  color: string
}

interface Props {
  dates: string[]
  blocks: Block[]
  preview: Preview | null
  hiddenId: string | null
  /** Apple Calendar events for this week (empty when the week isn't synced) */
  events: CalEvent[]
  hitTestRef: RefObject<HitTest | null>
  onEmptyDown: (e: RPointerEvent, date: string, minute: number) => void
  onBlockDown: (e: RPointerEvent, block: Block, mode: 'move' | 'resize') => void
}

const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START / 60 + i)
const HEIGHT = (DAY_END - DAY_START) * PX_PER_MIN

export function WeekGrid({ dates, blocks, preview, hiddenId, events, hitTestRef, onEmptyDown, onBlockDown }: Props) {
  const colsRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const now = useNow()
  const today = toISO(now)

  // lets App translate a pointer position into a day + minute
  useLayoutEffect(() => {
    hitTestRef.current = (x, y) => {
      const el = colsRef.current
      if (!el) return null
      const r = el.getBoundingClientRect()
      const day = Math.min(6, Math.max(0, Math.floor(((x - r.left) / r.width) * 7)))
      const minute = Math.min(DAY_END, Math.max(DAY_START, DAY_START + (y - r.top) / PX_PER_MIN))
      const inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
      return { date: dates[day], minute, inside }
    }
  }, [dates, hitTestRef])

  // open scrolled to 7am
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = (7 * 60 - DAY_START) * PX_PER_MIN
  }, [])

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const days = dates.map((d) => eventsForDay(events, d))
  const hasAllDay = days.some((d) => d.allDay.length > 0)

  return (
    <div className="grid-scroll" ref={scrollRef}>
      <div className="grid-head">
        <div className="head-row">
          <div className="gutter" />
          {dates.map((d) => {
            const dt = fromISO(d)
            return (
              <div key={d} className={'day-head' + (d === today ? ' today' : '')}>
                <span className="dow">{dt.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                <span className="dom">{dt.getDate()}</span>
              </div>
            )
          })}
        </div>
        {hasAllDay && (
          <div className="head-row allday-row">
            <div className="gutter allday-label">all-day</div>
            {days.map(({ allDay }, i) => (
              <div key={dates[i]} className="allday-cell">
                {allDay.map((ev) => (
                  <div key={ev.id} className="allday-event" style={{ ['--c' as string]: ev.color }} title={`${ev.title}\n${ev.calendar}`}>
                    {ev.title}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid-body" style={{ height: HEIGHT }}>
        <div className="gutter">
          {HOURS.map((h) => (
            <div key={h} className="hour-label" style={{ top: (h * 60 - DAY_START) * PX_PER_MIN }}>
              {h}:00
            </div>
          ))}
        </div>

        <div className="cols" ref={colsRef} style={{ backgroundSize: `100% ${HOUR_PX}px` }}>
          {dates.map((d, i) => {
            const dayBlocks = blocks.filter((b) => b.date === d && b.id !== hiddenId)
            const dayEvents = days[i].timed
            const lanes = layoutLanes<{ id: string; start: number; end: number }>([...dayBlocks, ...dayEvents])
            const laneStyle = (id: string) => {
              const { lane, lanes: n } = lanes.get(id)!
              return { left: `calc(${(lane / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)` }
            }
            return (
              <div
                key={d}
                className={'col' + (d === today ? ' today' : '')}
                onPointerDown={(e) => {
                  if (e.button !== 0 || e.target !== e.currentTarget) return
                  const hit = hitTestRef.current?.(e.clientX, e.clientY)
                  if (hit) onEmptyDown(e, d, hit.minute)
                }}
              >
                {dayEvents.map((ev) => (
                  <EventView key={ev.id} event={ev} style={laneStyle(ev.id)} conflict={dayBlocks.some((b) => overlaps(b, ev))} />
                ))}
                {dayBlocks.map((b) => (
                  <BlockView
                    key={b.id}
                    block={b}
                    style={laneStyle(b.id)}
                    conflicts={dayEvents.filter((ev) => overlaps(b, ev))}
                    onDown={(e, mode) => onBlockDown(e, b, mode)}
                  />
                ))}
                {preview && preview.date === d && (
                  <BlockView block={{ ...preview, id: 'preview' }} ghost style={{ left: 2, right: 2 }} />
                )}
                {d === today && nowMin >= DAY_START && (
                  <div className="now-line" style={{ top: (nowMin - DAY_START) * PX_PER_MIN }} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function BlockView({
  block,
  style,
  ghost,
  conflicts = [],
  onDown,
}: {
  block: Block
  style: React.CSSProperties
  ghost?: boolean
  conflicts?: DayEvent[]
  onDown?: (e: RPointerEvent, mode: 'move' | 'resize') => void
}) {
  const height = (block.end - block.start) * PX_PER_MIN
  const short = block.end - block.start <= 30
  const clash = conflicts.length > 0
  return (
    <div
      className={'block' + (ghost ? ' ghost' : '') + (short ? ' short' : '') + (clash ? ' conflict' : '')}
      title={clash ? `Clashes with: ${conflicts.map((c) => `${c.title} (${fmtTime(c.start)}–${fmtTime(c.end)})`).join(', ')}` : undefined}
      style={{
        ...style,
        top: (block.start - DAY_START) * PX_PER_MIN,
        height,
        ['--c' as string]: block.color,
      }}
      onPointerDown={(e) => {
        if (e.button !== 0 || !onDown) return
        e.stopPropagation()
        onDown(e, 'move')
      }}
    >
      <div className="block-title">
        {clash && <span className="clash-icon">⚠ </span>}
        {block.title || 'Untitled'}
      </div>
      <div className="block-time">
        {fmtTime(block.start)} – {fmtTime(block.end)}
      </div>
      {onDown && (
        <div
          className="resize-handle"
          onPointerDown={(e) => {
            if (e.button !== 0) return
            e.stopPropagation()
            onDown(e, 'resize')
          }}
        />
      )}
    </div>
  )
}

function EventView({ event, style, conflict }: { event: DayEvent; style: React.CSSProperties; conflict: boolean }) {
  const short = event.end - event.start <= 30
  const start = Math.max(event.start, DAY_START)
  return (
    <div
      className={'cal-event' + (short ? ' short' : '') + (conflict ? ' conflict' : '')}
      style={{ ...style, top: (start - DAY_START) * PX_PER_MIN, height: (event.end - start) * PX_PER_MIN, ['--c' as string]: event.color }}
      title={`${event.title}\n${event.calendar} · ${fmtTime(event.start)}–${fmtTime(event.end)}\nFrom Apple Calendar (edit it there)`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="block-title">{event.title}</div>
      <div className="block-time">
        {fmtTime(event.start)} – {fmtTime(event.end)}
      </div>
    </div>
  )
}

function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  return now
}
