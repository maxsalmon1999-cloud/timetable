import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode, type RefObject } from 'react'
import { CalendarBlankIcon, MinusIcon, PlusIcon, SparkleIcon, WarningIcon } from '@phosphor-icons/react'
import type { Block, IconWeight } from '../lib/types'
import { fmtTime, fromISO, toISO } from '../lib/dates'
import { layoutLanes } from '../lib/layout'
import { overlaps, type CalEvent, type DayEvent } from '../lib/calendar'
import type { DayRange } from '../lib/dayRange'
import { MAX_END } from '../lib/constants'
import { ActivityIcon } from './ActivityIcon'
import { BlockCard, EventCard, type Anchor } from './HoverCard'

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
  /** a template being built: weekday names only, no dates / today / now line */
  blank?: boolean
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
  /** an activity she's holding or hovering in the sidebar: everything not tagged with it fades */
  focusTag?: string | null
}

/**
 * Block layouts by box height H (FIXES.md #1): each tier only shows what fits without touching a border.
 *   tiny   < 24   one line: icon + title (no time)
 *   short  24–43  one line: icon + title + start time (start only when not sharing a lane)
 *   medium 44–71  two lines: icon + title / time range
 *   tall   ≥ 72   two lines + 24px icon bottom-right (inline icon instead when sharing a lane)
 */
type Tier = 'tiny' | 'short' | 'medium' | 'tall'
const tierFor = (H: number): Tier => (H < 24 ? 'tiny' : H < 44 ? 'short' : H < 72 ? 'medium' : 'tall')

export function WeekGrid(p: Props) {
  const { dates, blocks, preview, hiddenId, days, range, hitTestRef } = p
  const colsRef = useRef<HTMLDivElement>(null)
  // elements kept in state (not just refs) so their sizes are measured as soon as they mount
  const [bodyEl, setBodyEl] = useState<HTMLDivElement | null>(null)
  const bodyHeight = useSize(bodyEl).height
  const now = useNow()
  const today = p.blank ? '' : toISO(now)
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
  const hover = useHover()

  return (
    <div className={"grid-card panel" + (p.blank ? " blank" : "") + (p.focusTag ? " filtering" : "")} onPointerDownCapture={hover.hide}>
      <div className="grid-head">
        <div />
        {dates.map((d) => {
          const dt = fromISO(d)
          return (
            <div key={d} className="day-head-cell">
              <div className={'day-head' + (d === today ? ' today' : '')}>
                <span className="dow">{dt.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                {!p.blank && <span className="dom">{dt.getDate()}</span>}
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
                <div key={ev.id} className="allday-event" style={{ ['--c' as string]: ev.color }} {...hover.on({ kind: 'allday', id: ev.id, day: i })}>
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
              ref={colsRef}
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
                  return placeItem(s, e, lane, n, start, ppm)
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
                      <EventView
                        key={ev.id}
                        event={ev}
                        placed={place(ev.id, ev.start, ev.end)}
                        conflict={dayBlocks.some((b) => overlaps(b, ev))}
                        hover={hover.on({ kind: 'event', id: ev.id, day: i })}
                      />
                    ))}
                    {dayBlocks.map((b) => (
                      <BlockView
                        key={b.id}
                        block={b}
                        placed={place(b.id, b.start, b.end)}
                        conflicts={dayEvents.filter((ev) => overlaps(b, ev))}
                        match={!!p.focusTag && b.tag === p.focusTag}
                        onDown={(e, mode) => p.onBlockDown(e, b, mode)}
                        hover={hover.on({ kind: 'block', id: b.id, day: i })}
                      />
                    ))}
                    {preview && preview.date === d && (
                      <BlockView block={{ ...preview, id: 'preview' }} ghost placed={placeItem(preview.start, preview.end, 0, 1, start, ppm)} />
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
      {hover.target && <HoverDetails target={hover.target} {...p} />}

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
  tier: Tier
  /** box height in px */
  height: number
  /** sharing its lane with overlapping items */
  shared: boolean
}

function placeItem(s: number, e: number, lane: number, lanes: number, dayStart: number, ppm: number): Placed {
  const boxHeight = (e - s) * ppm - 3
  const tier = tierFor(boxHeight)
  return {
    tier,
    height: boxHeight,
    shared: lanes > 1,
    style: {
      top: (s - dayStart) * ppm + 1.5,
      height: boxHeight,
      left: `calc(${(lane / lanes) * 100}% + ${lane ? 2 : 5}px)`,
      width: `calc(${100 / lanes}% - ${lanes > 1 ? 7 : 10}px)`,
    },
  }
}

/** Title/time/icon laid out for the item's tier. `icon` is a rendered icon at the requested size. */
function ItemContent({
  title,
  s,
  e,
  placed,
  clash,
  icon,
}: {
  title: string
  s: number
  e: number
  placed: Placed
  clash: boolean
  icon: (size: number, className?: string) => ReactNode
}) {
  const { tier, shared } = placed
  const bigIcon = tier === 'tall' && !shared
  // Tiny boxes can be very thin in small windows (30m ≈ 12px at 1100×680): shrink to fit the inside
  // (box − 2px borders top and bottom), and drop what would be illegible. The hover card still says it all.
  const room = placed.height - 5
  const iconSize = tier === 'tiny' ? Math.min(13, room) : tier === 'short' ? 13 : 15
  const textSize = Math.min(12, room)
  const showIcon = tier !== 'tiny' || iconSize >= 9
  const showTitle = tier !== 'tiny' || textSize >= 9
  // a clash warning takes the inline icon's place; the big icon stays
  const inline = !showIcon
    ? null
    : clash
      ? <WarningIcon className="clash-icon" size={iconSize} weight="bold" />
      : !bigIcon && icon(tier === 'tiny' ? iconSize : 16, 'inline-icon')

  if (tier === 'tiny' || tier === 'short')
    return (
      <div className="item-line" style={tier === 'tiny' ? { fontSize: textSize } : undefined}>
        {inline}
        {showTitle && <span className="item-title">{title}</span>}
        {tier === 'short' && !shared && <span className="item-start mono">{fmtTime(s)}</span>}
      </div>
    )
  return (
    <>
      <div className="item-text">
        <div className="item-title-row">
          {inline}
          <span className="item-title">{title}</span>
        </div>
        <div className="item-time mono">
          {fmtTime(s)}–{fmtTime(e)}
        </div>
      </div>
      {bigIcon && icon(24, 'item-icon')}
    </>
  )
}

function BlockView({
  block,
  placed,
  ghost,
  conflicts = [],
  match,
  onDown,
  hover,
}: {
  block: Block
  placed: Placed
  ghost?: boolean
  conflicts?: DayEvent[]
  /** tagged with the activity she's filtering by */
  match?: boolean
  onDown?: (e: RPointerEvent, mode: 'move' | 'resize') => void
  hover?: HoverHandlers
}) {
  const clash = conflicts.length > 0
  const title = block.title || 'Untitled'
  return (
    <div
      className={`item block tier-${placed.tier}` + (ghost ? ' ghost' : '') + (clash ? ' conflict' : '') + (match ? ' match' : '')}
      style={{ ...placed.style, ['--c' as string]: block.color }}
      {...hover}
      onPointerDown={(e) => {
        if (e.button !== 0 || !onDown) return
        e.stopPropagation()
        onDown(e, 'move')
      }}
    >
      <ItemContent
        title={title}
        s={block.start}
        e={block.end}
        placed={placed}
        clash={clash}
        icon={(size, className) => <ActivityIcon className={className} name={block.icon} weight={block.iconWeight} size={size} />}
      />
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

function EventView({ event, placed, conflict, hover }: { event: DayEvent; placed: Placed; conflict: boolean; hover: HoverHandlers }) {
  return (
    <div
      className={`item cal-event tier-${placed.tier}` + (conflict ? ' conflict' : '')}
      style={{ ...placed.style, ['--c' as string]: event.color }}
      {...hover}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <ItemContent
        title={event.title}
        s={event.start}
        e={event.end}
        placed={placed}
        clash={conflict}
        icon={(size, className) => <CalendarBlankIcon className={className} size={size} weight="bold" aria-hidden />}
      />
    </div>
  )
}

interface HoverTarget {
  kind: 'block' | 'event' | 'allday'
  id: string
  /** column index */
  day: number
  anchor: Anchor
}
type HoverHandlers = { onPointerEnter: (e: RPointerEvent<HTMLElement>) => void; onPointerLeave: () => void }

/**
 * Which item the mouse rests on. The card appears after a short pause and goes the moment the mouse leaves;
 * sliding straight from one item to the next swaps it at once. Nothing shows while a button is held (drags).
 */
function useHover() {
  const [target, setTarget] = useState<HoverTarget | null>(null)
  const timer = useRef(0)
  const shown = useRef(false)
  const hiddenAt = useRef(-Infinity)

  const hide = useCallback(() => {
    clearTimeout(timer.current)
    if (shown.current) hiddenAt.current = performance.now()
    shown.current = false
    setTarget(null)
  }, [])

  useEffect(() => {
    // leaving the window can skip pointerleave; resizing, or a key like ⌘Z, can move the item from under the card
    const events = ['blur', 'resize', 'keydown'] as const
    events.forEach((ev) => window.addEventListener(ev, hide))
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, hide))
      clearTimeout(timer.current)
    }
  }, [hide])

  const on = (t: Omit<HoverTarget, 'anchor'>): HoverHandlers => ({
    onPointerEnter: (e) => {
      if (e.buttons || e.pointerType === 'touch') return
      clearTimeout(timer.current)
      const el = e.currentTarget
      const show = () => {
        const item = el.getBoundingClientRect()
        const col = (el.parentElement ?? el).getBoundingClientRect()
        shown.current = true
        setTarget({ ...t, anchor: { top: item.top, left: col.left, right: col.right } })
      }
      if (performance.now() - hiddenAt.current < 300) show()
      else timer.current = window.setTimeout(show, 350)
    },
    onPointerLeave: hide,
  })

  return { target, hide, on }
}

/** Looks the hovered item up in the current data, so the card is never stale (and vanishes if it was undone away) */
function HoverDetails({ target, blocks, days, dates, hiddenId, blank }: { target: HoverTarget } & Props) {
  const eventsOn = (day: number) => days[day] ?? { timed: [], allDay: [] }
  const { timed, allDay } = eventsOn(target.day)
  const date = dates[target.day]
  if (target.kind === 'block') {
    const b = blocks.find((x) => x.id === target.id)
    if (!b || b.id === hiddenId) return null
    const clashes = eventsOn(dates.indexOf(b.date)).timed.filter((ev) => overlaps(b, ev))
    return <BlockCard block={b} anchor={target.anchor} blank={blank} clashes={clashes} />
  }
  if (target.kind === 'event') {
    const ev = timed.find((x) => x.id === target.id)
    if (!ev) return null
    const clashes = blocks.filter((b) => b.date === date && b.id !== hiddenId && overlaps(b, ev))
    return <EventCard event={ev.source} anchor={target.anchor} clashes={clashes} />
  }
  const ev = allDay.find((x) => x.id === target.id)
  return ev ? <EventCard event={ev} anchor={target.anchor} /> : null
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
