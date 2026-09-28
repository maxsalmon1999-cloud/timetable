import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CalendarBlankIcon, MapPinIcon, NotepadIcon, WarningIcon } from '@phosphor-icons/react'
import type { Block } from '../lib/types'
import type { CalEvent } from '../lib/calendar'
import { fmtDuration, fmtTime, fromISO, toISO } from '../lib/dates'
import { discIcon } from '../lib/icons'
import { ActivityIcon } from './ActivityIcon'

type Timed = { title: string; start: number; end: number }
/** where to put the card: beside the item's day column (not the item, so a clashing neighbour stays visible), level with its top */
export type Anchor = { top: number; left: number; right: number }

/** The details card beside a hovered block or calendar event. Never takes the pointer, so it can't flicker. */
function HoverCard({ anchor, color, cal, icon, title, children }: {
  anchor: Anchor
  color: string
  /** calendar events get the softened stripe colour, like on the grid */
  cal?: boolean
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  // beside the item: right if there's room, else left; kept inside the window
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width: w, height: h } = el.getBoundingClientRect()
    const gap = 10
    const margin = 8
    let left = anchor.right + gap
    if (left + w > window.innerWidth - margin) left = anchor.left - gap - w
    if (left < margin) left = Math.max(margin, Math.min(window.innerWidth - margin - w, anchor.left))
    const top = Math.max(margin, Math.min(window.innerHeight - margin - h, anchor.top))
    setPos((p) => (p && p.left === left && p.top === top ? p : { left, top }))
    // re-measured when the content changes too (e.g. a calendar refresh adds notes)
  }, [anchor, title, children])

  return createPortal(
    <div
      ref={ref}
      className="hover-card"
      role="tooltip"
      style={{ ['--c' as string]: color, ...(pos ?? { left: 0, top: 0, visibility: 'hidden' }) }}
    >
      <div className={'hover-head' + (cal ? ' cal' : '')}>
        {icon}
        <span className="hover-title">{title}</span>
      </div>
      <div className="hover-body">{children}</div>
    </div>,
    document.body,
  )
}

// "Tue 29 Sept" (toLocaleDateString would add a comma after the weekday); templates have no dates: "Tuesday"
const dayLabel = (d: Date, blank?: boolean) =>
  blank
    ? d.toLocaleDateString('en-GB', { weekday: 'long' })
    : `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`

const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes()

function Clashes({ with: items }: { with: Timed[] }) {
  return items.map((c, i) => (
    <div key={i} className="hover-row clash">
      <WarningIcon size={15} weight="bold" />
      <span>
        Clashes with {c.title || 'Untitled'} <span className="mono">({fmtTime(c.start)}–{fmtTime(c.end)})</span>
      </span>
    </div>
  ))
}

export function BlockCard({ block, anchor, blank, clashes }: { block: Block; anchor: Anchor; blank?: boolean; clashes: Timed[] }) {
  const title = block.title || 'Untitled'
  return (
    <HoverCard
      anchor={anchor}
      color={block.color}
      title={title}
      icon={<ActivityIcon name={discIcon(block.icon, title)} weight={block.iconWeight} size={18} />}
    >
      <div className="hover-when">
        {dayLabel(fromISO(block.date), blank)} · <span className="mono">{fmtTime(block.start)}–{fmtTime(block.end)} · {fmtDuration(block.end - block.start)}</span>
      </div>
      <Clashes with={clashes} />
    </HoverCard>
  )
}

/** Timed or all-day event from Apple Calendar. Times come from the whole event, so ones running past midnight read right. */
export function EventCard({ event, anchor, clashes = [] }: { event: CalEvent; anchor: Anchor; clashes?: Timed[] }) {
  const s = new Date(event.start)
  const e = new Date(event.end)
  // an event ending at midnight (or all-day ones ending 23:59:59) belongs to the day before
  const last = new Date(event.end - 1)
  const oneDay = toISO(s) === toISO(last)
  const when = event.allDay
    ? <>{dayLabel(s)}{!oneDay && <> – {dayLabel(last)}</>} · All day</>
    : oneDay
      ? <>{dayLabel(s)} · <span className="mono">{fmtTime(minutesOf(s))}–{fmtTime(minutesOf(e))} · {fmtDuration(Math.round((event.end - event.start) / 60_000))}</span></>
      : <>{dayLabel(s)} <span className="mono">{fmtTime(minutesOf(s))}</span> – {dayLabel(e)} <span className="mono">{fmtTime(minutesOf(e))}</span></>

  return (
    <HoverCard anchor={anchor} color={event.color} cal title={event.title} icon={<CalendarBlankIcon size={18} weight="bold" />}>
      <div className="hover-when">{when}</div>
      {event.location && (
        <div className="hover-row">
          <MapPinIcon size={15} weight="bold" />
          <span className="hover-clamp">{event.location}</span>
        </div>
      )}
      {event.notes && (
        <div className="hover-row">
          <NotepadIcon size={15} weight="bold" />
          <span className="hover-clamp notes">{event.notes}</span>
        </div>
      )}
      <Clashes with={clashes} />
      <div className="hover-foot">
        <span className="hover-dot" />
        <span>{event.calendar} · edit it in Apple Calendar</span>
      </div>
    </HoverCard>
  )
}
