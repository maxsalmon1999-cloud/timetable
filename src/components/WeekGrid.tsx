import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type RefObject } from 'react'
import { CalendarBlankIcon, MinusIcon, PlusIcon, SparkleIcon, WarningIcon } from '@phosphor-icons/react'
import type { Block, IconWeight } from '../lib/types'
import { fmtTime, fromISO, toISO } from '../lib/dates'
import { layoutLanes } from '../lib/layout'
import { overlaps, type CalEvent, type DayEvent } from '../lib/calendar'
import type { DayRange } from '../lib/dayRange'
import { MAX_END } from '../lib/constants'
import { ActivityIcon } from './ActivityIcon'

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
  icon?: string
  iconWeight?: IconWeight
}

export interface DayEvents {
  timed: DayEvent[]
  allDay: CalEvent[]
}

interface Props {
  dates: string[]
  blocks: Block[]
  preview: Preview | null
  hiddenId: string | null
  /** Apple Calendar events per day (empty when the week isn't synced) */
  days: DayEvents[]
  range: DayRange
  onEarlier: () => void
  onHideTop: () => void
  onLater: () => void
  onHideBottom: () => void
  hitTestRef: RefObject<HitTest | null>
  onEmptyDown: (e: RPointerEvent, date: string, minute: number) => void
  onBlockDown: (e: RPointerEvent, block: Block, mode: 'move' | 'resize') => void
}

/** under this many px a block shows one line (title + start time) */
const TALL_PX = 38
/** icon shows bottom-right when a block is at least this tall and not sharing a lane… */
const ICON_PX = 50
/** …but in narrow day columns it would sit on the time text, so it needs its own row */
const NARROW_COL_PX = 140
const ICON_PX_NARROW = 64

export function WeekGrid(p: Props) {
  const { dates, blocks, preview, hiddenId, days, range, hitTestRef } = p
  const colsRef = useRef<HTMLDivElement>(null)
  // elements kept in state (not just refs) so their sizes are measured as soon as they mount
  const [bodyEl, setBodyEl] = useState<HTMLDivElement | null>(null)
  const [colsEl, setColsEl] = useState<HTMLDivElement | null>(null)
  const bodyHeight = useSize(bodyEl).height
  const colWidth = useSize(colsEl).width / 7
  const iconMin = colWidth >= NARROW_COL_PX ? ICON_PX : ICON_PX_NARROW
  const now = useNow()
  const today = toISO(now)
  const { start, end } = range
  // the whole visible day always fits: hours get shorter instead of scrolling
  const ppm = bodyHeight / (end - start)

  // lets App translate a pointer position into a day + minute
  useLayoutEffect(() => {
    hitTestRef.current = (x, y) => {
      const el = colsRef.current
      if (!el || !ppm) return null
      const r = el.getBoundingClientRect()
      const day = Math.min(6, Math.max(0, Math.floor(((x - r.left) / r.width) * 7)))
      const minute = Math.min(end, Math.max(start, start + (y - r.top) / ppm))
      const inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
      return { date: dates[day], minute, inside }
    }
  }, [dates, start, end, ppm, hitTestRef])

  const hours: number[] = []
  for (let h = Math.ceil(start / 60); h * 60 <= end; h++) hours.push(h)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const hasAllDay = days.some((d) => d.allDay.length > 0)

  return (
    <div className="grid-card panel">
      <div className="grid-head">
        <div />
        {dates.map((d) => {
          const dt = fromISO(d)
          return (
            <div key={d} className="day-head-cell">
              <div className={'day-head' + (d === today ? ' today' : '')}>
                <span className="dow">{dt.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                <span className="dom">{dt.getDate()}</span>
              </div>
            </div>
          )
        })}
      </div>

      {hasAllDay && (
        <div className="allday-row">
          <div className="allday-label">all day</div>
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

      <div className="expand-row top">
        <div />
        <div className="expand-actions">
          {range.canEarlier && (
            <button className="expand-btn" onClick={p.onEarlier}>
              <span className="expand-disc add"><PlusIcon size={18} weight="bold" /></span>
              Earlier <span className="mono">from {fmtTime(range.earlierTo)}</span>
            </button>
          )}
          {range.autoNote && (
            <span className="auto-note">
              <SparkleIcon size={15} weight="bold" />
              {range.autoNote}
            </span>
          )}
          {range.canHideTop && (
            <button className="expand-btn" onClick={p.onHideTop}>
              <span className="expand-disc"><MinusIcon size={18} weight="bold" /></span>
              Hide early hours
            </button>
          )}
        </div>
      </div>

      <div className="grid-body" ref={setBodyEl}>
        {ppm > 0 && (
          <>
            <div className="gutter">
              {hours.map((h) => (
                <div key={h} className="hour-label" style={{ top: (h * 60 - start) * ppm }}>
                  {h}:00
                </div>
              ))}
            </div>

            <div
              className="cols"
              ref={(el) => {
                colsRef.current = el
                setColsEl(el)
              }}
            >
              {hours.map((h) => (
                <div key={h} className="hour-line" style={{ top: (h * 60 - start) * ppm }} />
              ))}
              {dates.map((d, i) => {
                const dayBlocks = blocks.filter((b) => b.date === d && b.id !== hiddenId)
                const dayEvents = days[i].timed
                const lanes = layoutLanes<{ id: string; start: number; end: number }>([...dayBlocks, ...dayEvents])
                const place = (id: string, s: number, e: number): Placed => {
                  const { lane, lanes: n } = lanes.get(id) ?? { lane: 0, lanes: 1 }
                  return placeItem(s, e, lane, n, start, ppm, iconMin)
                }
                return (
                  <div
                    key={d}
                    className={'col' + (d === today ? ' today' : '')}
                    onPointerDown={(e) => {
                      if (e.button !== 0 || e.target !== e.currentTarget) return
                      const hit = hitTestRef.current?.(e.clientX, e.clientY)
                      if (hit) p.onEmptyDown(e, d, hit.minute)
                    }}
                  >
                    {dayEvents.map((ev) => (
                      <EventView key={ev.id} event={ev} placed={place(ev.id, ev.start, ev.end)} conflict={dayBlocks.some((b) => overlaps(b, ev))} />
                    ))}
                    {dayBlocks.map((b) => (
                      <BlockView
                        key={b.id}
                        block={b}
                        placed={place(b.id, b.start, b.end)}
                        conflicts={dayEvents.filter((ev) => overlaps(b, ev))}
                        onDown={(e, mode) => p.onBlockDown(e, b, mode)}
                      />
                    ))}
                    {preview && preview.date === d && (
                      <BlockView block={{ ...preview, id: 'preview' }} ghost placed={placeItem(preview.start, preview.end, 0, 1, start, ppm, iconMin)} />
                    )}
                    {d === today && nowMin >= start && nowMin <= end && (
                      <div className="now-line" style={{ top: (nowMin - start) * ppm }}>
                        <span className="now-dot" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <div className="expand-row bottom">
        <div />
        <div className="expand-actions">
          {range.canLater && (
            <button className="expand-btn" onClick={p.onLater}>
              <span className="expand-disc add"><PlusIcon size={18} weight="bold" /></span>
              Later <span className="mono">until {fmtTime(MAX_END)}</span>
            </button>
          )}
          {range.canHideBottom && (
            <button className="expand-btn" onClick={p.onHideBottom}>
              <span className="expand-disc"><MinusIcon size={18} weight="bold" /></span>
              Hide late hours
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface Placed {
  style: CSSProperties
  height: number
  /** alone in its lane and tall enough for the bottom-right icon */
  showIcon: boolean
}

function placeItem(s: number, e: number, lane: number, lanes: number, dayStart: number, ppm: number, iconMin: number): Placed {
  const height = (e - s) * ppm
  return {
    height,
    showIcon: lanes === 1 && height >= Math.max(TALL_PX, iconMin),
    style: {
      top: (s - dayStart) * ppm + 1.5,
      height: height - 3,
      left: `calc(${(lane / lanes) * 100}% + ${lane ? 2 : 5}px)`,
      width: `calc(${100 / lanes}% - ${lanes > 1 ? 7 : 10}px)`,
    },
  }
}

function ItemText({ title, s, e, tall, clash }: { title: string; s: number; e: number; tall: boolean; clash: boolean }) {
  const warn = clash && <WarningIcon className="clash-icon" size={tall ? 15 : 13} weight="bold" />
  if (!tall)
    return (
      <div className="item-line">
        {warn}
        <span className="item-title">{title}</span>
        <span className="item-time">{fmtTime(s)}</span>
      </div>
    )
  return (
    <div className="item-text">
      <div className="item-title-row">
        {warn}
        <span className="item-title">{title}</span>
      </div>
      <div className="item-time">
        {fmtTime(s)}–{fmtTime(e)}
      </div>
    </div>
  )
}

function BlockView({
  block,
  placed,
  ghost,
  conflicts = [],
  onDown,
}: {
  block: Block
  placed: Placed
  ghost?: boolean
  conflicts?: DayEvent[]
  onDown?: (e: RPointerEvent, mode: 'move' | 'resize') => void
}) {
  const tall = placed.height >= TALL_PX
  const clash = conflicts.length > 0
  return (
    <div
      className={'item block' + (ghost ? ' ghost' : '') + (tall ? '' : ' short') + (clash ? ' conflict' : '')}
      style={{ ...placed.style, ['--c' as string]: block.color }}
      title={clash ? `Clashes with ${conflicts.map((c) => `${c.title} (${fmtTime(c.start)}–${fmtTime(c.end)})`).join(', ')}` : undefined}
      onPointerDown={(e) => {
        if (e.button !== 0 || !onDown) return
        e.stopPropagation()
        onDown(e, 'move')
      }}
    >
      <ItemText title={block.title || 'Untitled'} s={block.start} e={block.end} tall={tall} clash={clash} />
      {placed.showIcon && (
        <ActivityIcon className="item-icon" name={block.icon} weight={block.iconWeight} size={24} />
      )}
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

function EventView({ event, placed, conflict }: { event: DayEvent; placed: Placed; conflict: boolean }) {
  const tall = placed.height >= TALL_PX
  return (
    <div
      className={'item cal-event' + (tall ? '' : ' short') + (conflict ? ' conflict' : '')}
      style={{ ...placed.style, ['--c' as string]: event.color }}
      title={`${event.title}\n${event.calendar} · ${fmtTime(event.start)}–${fmtTime(event.end)}\nFrom Apple Calendar (change it there)`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <ItemText title={event.title} s={event.start} e={event.end} tall={tall} clash={conflict} />
      {placed.showIcon && <CalendarBlankIcon className="item-icon" size={24} weight="bold" />}
    </div>
  )
}

function useSize(el: HTMLElement | null) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  return size
}

function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  return now
}
