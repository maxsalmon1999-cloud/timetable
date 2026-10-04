import { useEffect, useRef, useState } from 'react'
import { BroomIcon, CalendarBlankIcon, CheckIcon, ListChecksIcon, PlusIcon, XIcon } from '@phosphor-icons/react'
import type { IconWeight, Todo } from '../lib/types'
import { uid } from '../lib/constants'
import { fmtTime, fromISO, toISO, weekLabel } from '../lib/dates'
import { discIcon } from '../lib/icons'
import { ActivityIcon } from './ActivityIcon'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
/** the weekday index of today if it's in this week, else -1 */
const todayIn = (dates: string[]) => dates.indexOf(toISO(new Date()))
const dayMonth = (iso: string) => fromISO(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })

/** A timetable block or timed calendar event, pulled into that day's list (read live, never copied) */
export interface Scheduled {
  /** block id, or the calendar event's per-day id; also the key in the week's ticks */
  id: string
  kind: 'block' | 'event'
  title: string
  /** minutes from midnight */
  start: number
  color: string
  icon?: string
  iconWeight?: IconWeight
  /** calendar name, for events */
  calendar?: string
}

interface Props {
  /** the 7 dates (YYYY-MM-DD) of the week on screen */
  dates: string[]
  /** that week's lists, index 0 = Monday */
  todos: Todo[][]
  /** change one weekday's list (one undo step) */
  onChange: (day: number, fn: (list: Todo[]) => Todo[]) => void
  /** each day's blocks + timed calendar events, sorted by start */
  scheduled: Scheduled[][]
  /** ids of scheduled items ticked off this week */
  ticked: ReadonlySet<string>
  onTick: (id: string) => void
}

/** unticked items (scheduled + her own) on one day */
const leftOn = (p: Pick<Props, 'todos' | 'scheduled' | 'ticked'>, d: number) =>
  (p.scheduled[d] ?? []).filter((s) => !p.ticked.has(s.id)).length + (p.todos[d] ?? []).filter((t) => !t.done).length

/**
 * Toolbar button + the to-do pad that pops out under it, for the week on screen. Closes on ×, Escape or a click
 * outside; stays open while she moves between weeks (Today / ‹ ›) so she can look through them.
 */
export function TodoMenu(props: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const weekLeft = props.dates.reduce((n, _, d) => n + leftOn(props, d), 0)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement
      if (!ref.current?.contains(t) && !t.closest('.modal-backdrop, .week-nav')) setOpen(false)
    }
    // Escape while editing a line only cancels that edit
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !(e.target as Element | null)?.closest?.('.todo-edit') && setOpen(false)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="menu-wrap" ref={ref}>
      <button className={'btn mint' + (open ? ' active' : '')} aria-expanded={open} title="To-do list" onClick={() => setOpen(!open)}>
        <ListChecksIcon size={22} weight="bold" />
        <span className="btn-label">To-do</span>
        {weekLeft > 0 && <span className="badge mono" title={`${weekLeft} left this week`}>{weekLeft}</span>}
      </button>
      {/* keyed by week so it opens on the right day of each week */}
      {open && <TodoPad key={props.dates[0]} {...props} onClose={() => setOpen(false)} />}
    </div>
  )
}

/** One week's to-do pad: a tab per day. Opens on today in the current week, Monday in any other. */
function TodoPad(props: Props & { onClose: () => void }) {
  const { dates, todos, onChange, scheduled, ticked, onTick, onClose } = props
  const today = todayIn(dates)
  const [day, setDay] = useState(Math.max(0, today))
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const list = todos[day] ?? []
  const plan = scheduled[day] ?? []
  const left = (d: number) => leftOn(props, d)
  const total = list.length + plan.length
  const doneOwn = list.filter((t) => t.done).length
  const change = (fn: (list: Todo[]) => Todo[]) => onChange(day, fn)

  const add = () => {
    const text = draft.trim()
    if (!text) return
    change((l) => [...l, { id: uid(), text, done: false }])
    setDraft('')
  }

  const finishEdit = () => {
    if (!editing) return
    const text = editing.text.trim()
    const before = list.find((t) => t.id === editing.id)
    if (before && text !== before.text)
      change((l) => (text ? l.map((t) => (t.id === editing.id ? { ...t, text } : t)) : l.filter((t) => t.id !== editing.id)))
    setEditing(null)
  }

  return (
    <div className="todo panel" role="dialog" aria-label="To-do list">
      <div className="panel-head mint">
        <div className="panel-title">
          <h1 className="todo-title">To-do</h1>
          <span className="mono small">{weekLabel(fromISO(dates[0]))}</span>
        </div>
        <button className="btn square" title="Close to-do list" onClick={onClose}>
          <XIcon size={22} weight="bold" />
        </button>
      </div>

      <div className="todo-tabs" role="tablist">
        {DAYS.map((name, i) => (
          <button
            key={name}
            role="tab"
            aria-selected={i === day}
            className={'todo-tab' + (i === day ? ' on' : '') + (i === today ? ' today' : '')}
            title={name + (left(i) ? ` · ${left(i)} to do` : '')}
            onClick={() => {
              setDay(i)
              setEditing(null)
            }}
          >
            <span className="todo-tab-dow">{name.slice(0, 2)}</span>
            <span className="todo-tab-date">{fromISO(dates[i]).getDate()}</span>
            {left(i) > 0 && <span className="todo-count mono">{left(i)}</span>}
          </button>
        ))}
      </div>

      <div className="todo-day">
        <h2>
          {DAYS[day]} <span className="todo-day-date">{dayMonth(dates[day])}</span>
        </h2>
        <span className="mono small">{total ? (left(day) ? `${left(day)} left` : 'All done!') : ''}</span>
      </div>

      <ul className="todo-list">
        {plan.map((s) => {
          const done = ticked.has(s.id)
          return (
            <li key={s.id} className={'todo-item planned' + (done ? ' done' : '')}>
              <button className="todo-check" role="checkbox" aria-checked={done} title={done ? 'Untick' : 'Tick off'} onClick={() => onTick(s.id)}>
                {done && <CheckIcon size={16} weight="bold" />}
              </button>
              <span className="todo-time mono">{fmtTime(s.start)}</span>
              <span
                className={'todo-chip' + (s.kind === 'event' ? ' event' : '')}
                style={{ ['--c' as string]: s.color }}
                title={s.kind === 'event' ? `From your calendar${s.calendar ? ` (${s.calendar})` : ''}` : 'From your timetable'}
              >
                {s.kind === 'event' ? (
                  <CalendarBlankIcon size={13} weight="bold" />
                ) : (
                  <ActivityIcon name={discIcon(s.icon, s.title)} weight={s.iconWeight} size={13} />
                )}
              </span>
              <span className="todo-text plain">{s.title || 'Untitled'}</span>
            </li>
          )
        })}
        {plan.length > 0 && list.length > 0 && <li className="todo-divider" aria-hidden />}
        {list.map((t) => (
          <li key={t.id} className={'todo-item' + (t.done ? ' done' : '')}>
            <button
              className="todo-check"
              role="checkbox"
              aria-checked={t.done}
              title={t.done ? 'Untick' : 'Tick off'}
              onClick={() => change((l) => l.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))}
            >
              {t.done && <CheckIcon size={16} weight="bold" />}
            </button>
            {editing?.id === t.id ? (
              <input
                className="todo-edit"
                autoFocus
                value={editing.text}
                onChange={(e) => setEditing({ id: t.id, text: e.target.value })}
                onBlur={finishEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') finishEdit()
                  if (e.key === 'Escape') setEditing(null)
                }}
              />
            ) : (
              <span className="todo-text" title="Click to change" onClick={() => setEditing({ id: t.id, text: t.text })}>
                {t.text}
              </span>
            )}
            <button className="todo-remove" title="Remove" onClick={() => change((l) => l.filter((x) => x.id !== t.id))}>
              <XIcon size={16} weight="bold" />
            </button>
          </li>
        ))}
        {!total && <li className="empty">Nothing for {DAYS[day]} yet.</li>}
      </ul>

      <div className="todo-foot">
        <form
          className="todo-add"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <input value={draft} placeholder={`Add to ${DAYS[day]}…`} onChange={(e) => setDraft(e.target.value)} />
          <button className="btn square mint" type="submit" title="Add" disabled={!draft.trim()}>
            <PlusIcon size={22} weight="bold" />
          </button>
        </form>
        {doneOwn > 0 && (
          <button className="btn small" title="Removes the to-dos you ticked (timetable items stay)" onClick={() => change((l) => l.filter((t) => !t.done))}>
            <BroomIcon size={18} weight="bold" />
            Clear {doneOwn} ticked
          </button>
        )}
      </div>
    </div>
  )
}
