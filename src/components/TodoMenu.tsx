import { useEffect, useRef, useState, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent } from 'react'
import { BroomIcon, CalendarBlankIcon, CheckIcon, ListChecksIcon, PlusIcon, SpeakerSimpleHighIcon, SpeakerSimpleSlashIcon, XIcon } from '@phosphor-icons/react'
import type { IconWeight, Todo } from '../lib/types'
import { uid } from '../lib/constants'
import { fmtTime, fromISO, toISO, weekLabel } from '../lib/dates'
import { discIcon } from '../lib/icons'
import { daysBetween, STALE_DAYS } from '../lib/rollover'
import { bump, confetti, glint, reducedMotion, setSoundOn, soundOn, sounds, tickPop } from '../lib/rewards'
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

/** items (scheduled + her own) on one day, and how many are ticked */
const countOn = (p: Pick<Props, 'todos' | 'scheduled' | 'ticked'>, d: number) => {
  const plan = p.scheduled[d] ?? []
  const own = p.todos[d] ?? []
  const total = plan.length + own.length
  const done = plan.filter((s) => p.ticked.has(s.id)).length + own.filter((t) => t.done).length
  return { total, done, left: total - done }
}

/** A count badge: the number left, a mint ✓ once there are items and none are left, nothing when empty. Bumps on change. */
function Count({ left, total, className, title }: { left: number; total: number; className: string; title?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(left)
  useEffect(() => {
    if (prev.current !== left) bump(ref.current)
    prev.current = left
  }, [left])
  if (!total) return null
  return (
    <span ref={ref} className={className + (left ? '' : ' zero')} title={title}>
      {left || <CheckIcon size={11} weight="bold" />}
    </span>
  )
}

/**
 * Toolbar button + the to-do pad that pops out under it, for the week on screen. Closes on ×, Escape or a click
 * outside; stays open while she moves between weeks (Today / ‹ ›) so she can look through them.
 */
export function TodoMenu(props: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const week = props.dates.map((_, d) => countOn(props, d))
  const weekLeft = week.reduce((n, c) => n + c.left, 0)
  const weekTotal = week.reduce((n, c) => n + c.total, 0)

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
        <Count left={weekLeft} total={weekTotal} className="badge mono" title={weekLeft ? `${weekLeft} left this week` : 'All done this week'} />
      </button>
      {/* keyed by week so it opens on the right day of each week */}
      {open && <TodoPad key={props.dates[0]} {...props} onClose={() => setOpen(false)} />}
    </div>
  )
}

/** The checkbox's look: mint fill grows in, the tick draws itself (CSS transitions on `.on`) */
function Box({ on }: { on: boolean }) {
  return (
    <span className={'todo-box' + (on ? ' on' : '')} aria-hidden>
      <span className="todo-fill" />
      <svg viewBox="0 0 24 24">
        <polyline points="5,12.5 10,17.5 19.5,7" />
      </svg>
    </span>
  )
}

/** One week's to-do pad: a tab per day. Opens on today in the current week, Monday in any other. */
function TodoPad(props: Props & { onClose: () => void }) {
  const { dates, todos, onChange, scheduled, ticked, onTick, onClose } = props
  const today = todayIn(dates)
  const [day, setDay] = useState(Math.max(0, today))
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  /** the checkbox being held down (pointer), so it sinks; leaving it before release cancels */
  const [pressed, setPressed] = useState<string | null>(null)
  /**
   * The day just finished by a tick: 'hold' keeps the full meter for a beat, then 'stamp' swaps in the banner with its
   * stamp-in. Just viewing a finished day shows the banner still.
   */
  const [finish, setFinish] = useState<{ day: number; phase: 'hold' | 'stamp' } | null>(null)
  /** her newest to-do, which drops in */
  const [fresh, setFresh] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)
  const [sound, setSound] = useState(soundOn)
  const padRef = useRef<HTMLDivElement>(null)
  const fxRef = useRef<HTMLDivElement>(null)
  const meterRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const list = todos[day] ?? []
  const plan = scheduled[day] ?? []
  const { total, done } = countOn(props, day)
  const complete = total > 0 && done === total
  const holding = finish?.day === day && finish.phase === 'hold'
  const doneOwn = list.filter((t) => t.done).length
  const change = (fn: (list: Todo[]) => Todo[]) => onChange(day, fn)

  /** the reward path, only when something becomes ticked (unticking stays quiet) */
  const reward = (row: HTMLElement) => {
    const box = row.querySelector<HTMLElement>('.todo-box')
    const doneNow = done + 1
    sounds.tick(doneNow)
    if (box) tickPop(box, row)
    glint(row)
    // after React has drawn the newly filled cell
    requestAnimationFrame(() => bump(meterRef.current?.children[doneNow - 1], 'scale(1.15,1.6)', 360))
    if (doneNow === total) {
      setFinish({ day, phase: 'hold' })
      setTimeout(() => {
        setFinish({ day, phase: 'stamp' })
        sounds.dayDone()
        if (fxRef.current) confetti(fxRef.current)
        // once the banner is on screen
        requestAnimationFrame(() => {
          const banner = padRef.current?.querySelector<HTMLElement>('.todo-banner')
          if (banner) glint(banner, 4)
        })
      }, 240)
    }
  }

  const rowOf = (e: RMouseEvent) => (e.currentTarget as HTMLElement).closest<HTMLElement>('.todo-item')!

  const tickPlanned = (e: RMouseEvent, s: Scheduled) => {
    if (!ticked.has(s.id)) reward(rowOf(e))
    onTick(s.id)
  }

  const tickOwn = (e: RMouseEvent, t: Todo) => {
    if (!t.done) reward(rowOf(e))
    change((l) => l.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))
  }

  const press = (id: string) => ({
    onPointerDown: (e: RPointerEvent) => {
      if (e.button !== 0) return
      setPressed(id)
      sounds.press()
    },
    onPointerUp: () => setPressed(null),
    onPointerLeave: () => setPressed(null),
    onPointerCancel: () => setPressed(null),
  })

  const add = () => {
    const text = draft.trim()
    if (!text) return
    const id = uid()
    change((l) => [...l, { id, text, done: false, since: dates[day] }])
    setFresh(id)
    setDraft('')
    sounds.add()
    requestAnimationFrame(() => {
      const cell = meterRef.current?.lastElementChild
      if (cell && !reducedMotion()) cell.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 300, easing: 'cubic-bezier(.3,1.3,.5,1)' })
    })
  }

  /** ticked rows sweep out one by one, then leave the list */
  const clearTicked = () => {
    if (clearing) return
    const rows = [...(listRef.current?.querySelectorAll<HTMLElement>('.todo-item.own.done') ?? [])]
    const remove = () => change((l) => l.filter((t) => !t.done))
    rows.forEach((_, i) => sounds.clear(i))
    if (reducedMotion() || !rows.length) return remove()
    setClearing(true)
    rows.forEach((r, i) =>
      r.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateX(60px) rotate(2deg)', opacity: 0 }], {
        duration: 320,
        delay: i * 70,
        easing: 'cubic-bezier(.5,0,.75,0)',
        fill: 'forwards',
      }),
    )
    setTimeout(() => {
      remove()
      setClearing(false)
    }, 320 + (rows.length - 1) * 70)
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
    <div className="todo panel" role="dialog" aria-label="To-do list" ref={padRef}>
      <div className="panel-head mint">
        <div className="panel-title">
          <h1 className="todo-title">To-do</h1>
          <span className="mono small">{weekLabel(fromISO(dates[0]))}</span>
        </div>
        <div className="todo-head-tools">
          <button
            className="btn square"
            title={sound ? 'Turn tick sounds off' : 'Turn tick sounds on'}
            aria-pressed={sound}
            onClick={() => {
              setSoundOn(!sound)
              setSound(!sound)
            }}
          >
            {sound ? <SpeakerSimpleHighIcon size={22} weight="bold" /> : <SpeakerSimpleSlashIcon size={22} weight="bold" />}
          </button>
          <button className="btn square" title="Close to-do list" onClick={onClose}>
            <XIcon size={22} weight="bold" />
          </button>
        </div>
      </div>

      <div className="todo-tabs" role="tablist">
        {DAYS.map((name, i) => {
          const c = countOn(props, i)
          return (
            <button
              key={name}
              role="tab"
              aria-selected={i === day}
              className={'todo-tab' + (i === day ? ' on' : '') + (i === today ? ' today' : '')}
              title={name + (c.total ? (c.left ? ` · ${c.left} to do` : ' · all done') : '')}
              onClick={() => {
                setDay(i)
                setEditing(null)
                setFresh(null)
                setFinish(null) // coming back to a finished day shows the banner still
              }}
            >
              <span className="todo-tab-dow">{name.slice(0, 2)}</span>
              <span className="todo-tab-date">{fromISO(dates[i]).getDate()}</span>
              <Count left={c.left} total={c.total} className="todo-count mono" />
            </button>
          )
        })}
      </div>

      <div className="todo-day">
        <h2>
          {DAYS[day]} <span className="todo-day-date">{dayMonth(dates[day])}</span>
        </h2>
        {total > 0 && (!complete || holding) && <span className="mono small">{`${done} of ${total}`}</span>}
      </div>

      {complete && !holding ? (
        <div className={'todo-banner' + (finish?.day === day ? ' stamp' : '')}>
          <span className="todo-banner-check">
            <CheckIcon size={18} weight="bold" />
          </span>
          <div>
            <b>{DAYS[day]}’s done.</b>
            <span className="mono small">
              {total} of {total} ticked
            </span>
          </div>
        </div>
      ) : (
        total > 0 && (
          <div className="todo-meter" ref={meterRef} aria-hidden>
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={i < done ? 'on' : ''} />
            ))}
          </div>
        )
      )}

      <ul className="todo-list" ref={listRef}>
        {plan.map((s) => {
          const on = ticked.has(s.id)
          return (
            <li key={s.id} className={'todo-item planned' + (on ? ' done' : '') + (pressed === s.id ? ' pressed' : '')}>
              <button
                className="todo-rowbtn"
                role="checkbox"
                aria-checked={on}
                title={s.kind === 'event' ? `From your calendar${s.calendar ? ` (${s.calendar})` : ''}` : 'From your timetable'}
                onClick={(e) => tickPlanned(e, s)}
                {...press(s.id)}
              >
                <Box on={on} />
                <span className="todo-time mono">{fmtTime(s.start)}</span>
                <span className={'todo-chip' + (s.kind === 'event' ? ' event' : '')} style={{ ['--c' as string]: s.color }}>
                  {s.kind === 'event' ? (
                    <CalendarBlankIcon size={13} weight="bold" />
                  ) : (
                    <ActivityIcon name={discIcon(s.icon, s.title)} weight={s.iconWeight} size={13} />
                  )}
                </span>
                <span className="todo-text">
                  <span className="strike">{s.title || 'Untitled'}</span>
                </span>
              </button>
            </li>
          )
        })}
        {plan.length > 0 && list.length > 0 && <li className="todo-divider" aria-hidden />}
        {list.map((t) => {
          // waiting since its first day: from 3 days on it glows red now and then
          const waited = t.since && !t.done ? daysBetween(t.since, toISO(new Date())) : 0
          return (
          <li
            key={t.id}
            className={
              'todo-item own' + (t.done ? ' done' : '') + (pressed === t.id ? ' pressed' : '') + (t.id === fresh ? ' fresh' : '') + (waited >= STALE_DAYS ? ' stale' : '')
            }
            title={waited > 0 ? `On your list since ${fromISO(t.since!).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}` : undefined}
          >
            <button className="todo-tick" role="checkbox" aria-checked={t.done} title={t.done ? 'Untick' : 'Tick off'} onClick={(e) => tickOwn(e, t)} {...press(t.id)}>
              <Box on={t.done} />
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
              <span className="todo-text editable" title="Click to change" onClick={() => setEditing({ id: t.id, text: t.text })}>
                <span className="strike">{t.text}</span>
              </span>
            )}
            {waited > 0 && <span className="todo-age mono">{waited}d</span>}
            <button className="todo-remove" title="Remove" onClick={() => change((l) => l.filter((x) => x.id !== t.id))}>
              <XIcon size={16} weight="bold" />
            </button>
          </li>
          )
        })}
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
          <button className="btn small" title="Removes the to-dos you ticked (timetable items stay)" disabled={clearing} onClick={clearTicked}>
            <BroomIcon size={18} weight="bold" />
            Clear {doneOwn} ticked
          </button>
        )}
      </div>

      {/* one-shot effects (rings, glints, stars, confetti) are drawn here */}
      <div className="todo-fx" ref={fxRef} aria-hidden />
    </div>
  )
}
