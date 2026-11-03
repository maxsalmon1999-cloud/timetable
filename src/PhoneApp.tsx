// The iPhone app: one day at a time, with a Day tab (that day's timetable) and a To-do tab (that day's list).
// ‹ › or a sideways swipe moves between days; + adds a block (Day) or to-dos (To-do).
// Same saved plans, cloud sync and calendar as the Mac/iPad week view (App.tsx); only the screen is different.

import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import {
  CalendarBlankIcon,
  CalendarCheckIcon,
  CalendarDotsIcon,
  CalendarPlusIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ClockIcon,
  ListChecksIcon,
  MapPinIcon,
  NotepadIcon,
  UsersThreeIcon,
  WarningIcon,
} from '@phosphor-icons/react'
import { useAppData } from './lib/store'
import type { Block } from './lib/types'
import { MAX_END, MIN_START, uid } from './lib/constants'
import { addDays, fmtDuration, fmtTime, fromISO, startOfWeek, toISO } from './lib/dates'
import { accessStatus, eventsForDay, overlaps, requestAccess, type CalEvent, type DayEvent } from './lib/calendar'
import { useCalendarSync, type SyncState } from './lib/useCalendarSync'
import { DEFAULT_TARGETS, visibleRange } from './lib/dayRange'
import { layoutLanes } from './lib/layout'
import { discIcon, PALETTE } from './lib/icons'
import { countDay, saveBlock, scheduledOn, setDayTodos, toggleTick } from './lib/plan'
import { rollover } from './lib/rollover'
import { useToday } from './lib/useToday'
import { useCloudSync } from './lib/useCloudSync'
import { ActivityIcon } from './components/ActivityIcon'
import { BlockEditor } from './components/BlockEditor'
import { CloudButton } from './components/CloudSync'
import { Confirm, Modal } from './components/Modal'
import { Count, SoundButton, TodoDay } from './components/TodoMenu'
import { Fab, QuickAdd } from './components/QuickAdd'
import { soundOn, sounds } from './lib/rewards'
import { useFriends } from './lib/useFriends'
import { addFriend, changeFriend, live, removeFriend } from './lib/friends'
import { FriendsPanel, FriendsPing } from './components/Friends'

type Tab = 'day' | 'todo' | 'month'
type Editing = { block: Block; isNew: boolean }
type Confirming = Omit<ComponentProps<typeof Confirm>, 'onClose'>

/** the day view's scale: an hour is this tall */
const HOUR_PX = 64
const PX = HOUR_PX / 60
const weekdayName = (iso: string) => fromISO(iso).toLocaleDateString('en-GB', { weekday: 'long' })
const dayMonth = (iso: string) => fromISO(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
const shift = (iso: string, n: number) => toISO(addDays(fromISO(iso), n))
/** the 1st of the month n months on from the month of `iso` */
const monthOf = (iso: string, n = 0) => {
  const d = fromISO(iso)
  return toISO(new Date(d.getFullYear(), d.getMonth() + n, 1))
}

export default function PhoneApp() {
  const { data, update, undo, canUndo, status, restoredFrom, applyRemote, updateSync, updateSilently } = useAppData()
  const cloud = useCloudSync(data, applyRemote, updateSync)
  const today = useToday()
  // unticked to-dos from days gone by move on to today (as on the Mac)
  const loaded = !!data
  useEffect(() => {
    if (loaded) updateSilently((d) => rollover(d, today))
  }, [loaded, today, data?.todos, updateSilently])

  const [date, setDate] = useState(today)
  // left open overnight on "today": follow today to the new day
  const [shownToday, setShownToday] = useState(today)
  if (shownToday !== today) {
    setShownToday(today)
    if (date === shownToday) setDate(today)
  }
  /** which way the last day change went, so the new day slides in from that side */
  const [dir, setDir] = useState<1 | -1>(1)
  /** ‹ › and swipes: a day at a time, or a month at a time on the Month tab */
  const go = (n: 1 | -1) => {
    setDir(n)
    setFreshTodo(null)
    if (tab === 'month') setMonth(monthOf(month, n))
    else setDate(shift(date, n))
  }
  const goTo = (iso: string) => {
    setDir(iso < date ? -1 : 1)
    setFreshTodo(null)
    setDate(iso)
  }

  const [tab, setTabState] = useState<Tab>('day')
  /** the month on the Month tab (its 1st); opens on the month of the day she's on */
  const [month, setMonth] = useState(() => monthOf(today))
  const setTab = (t: Tab) => {
    if (t === 'month' && tab !== 'month') setMonth(monthOf(date))
    setTabState(t)
    setFreshTodo(null)
  }
  const friends = useFriends(data, today, updateSilently)
  const [friendsOpen, setFriendsOpen] = useState(false)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [viewing, setViewing] = useState<DayEvent | CalEvent | null>(null)
  const [confirming, setConfirming] = useState<Confirming | null>(null)
  const [restoreNoticeSeen, setRestoreNoticeSeen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [sound, setSound] = useState(soundOn)
  /** the to-do pop-up is open */
  const [adding, setAdding] = useState(false)
  /** the to-do just added, which drops into the list */
  const [freshTodo, setFreshTodo] = useState<string | null>(null)
  const fxRef = useRef<HTMLDivElement>(null)
  useKeyboardInset()

  const weekStart = useMemo(() => startOfWeek(fromISO(date)), [date])
  const weekKey = toISO(weekStart)
  const day = (fromISO(date).getDay() + 6) % 7
  const synced = !!data?.syncedWeeks?.includes(weekKey)
  const cal = useCalendarSync(weekStart, synced)
  const events = useMemo(() => eventsForDay(cal.events, date), [cal.events, date])
  const blocks = useMemo(() => (data ? data.blocks.filter((b) => b.date === date) : []), [data, date])
  const plan = useMemo(() => scheduledOn(date, blocks, events.timed), [date, blocks, events.timed])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  // ---------- Apple Calendar (per week, like on the Mac) ----------
  const syncWeek = async () => {
    let access = await accessStatus()
    if (access === 'notDetermined') access = (await requestAccess()) ? 'granted' : 'denied'
    if (access !== 'granted') {
      setConfirming({
        title: 'Timetable can’t see your calendars',
        message: 'To show your calendar events here, open the Settings app, tap Apps → Timetable → Calendars, choose Full Access, then tap Calendar again.',
        actions: [],
        cancelLabel: 'OK',
      })
      return
    }
    if (synced) cal.refresh()
    else update((d) => ({ ...d, syncedWeeks: [...(d.syncedWeeks ?? []), weekKey] }))
  }

  // ---------- swiping between days ----------
  // A sideways drag across the day changes the day. Native listeners, so a mostly sideways move can stop iOS
  // scrolling (React's touch listeners can't): otherwise iOS takes it as a scroll and cancels the touch. A cancel still
  // counts, from the last place the finger was. A mouse (browser preview) uses pointer events.
  const bodyRef = useRef<HTMLElement>(null)
  const swipeTo = useEffectEvent((n: 1 | -1) => go(n))
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    let start: { x: number; y: number; t: number } | null = null
    let last = { x: 0, y: 0 }
    const decide = (t: number) => {
      if (!start) return
      const dx = last.x - start.x
      const dy = last.y - start.y
      if (Math.abs(dx) > 70 && Math.abs(dx) > 1.6 * Math.abs(dy) && t - start.t < 800) swipeTo(dx < 0 ? 1 : -1)
      start = null
    }
    const inSheet = (e: Event) => !!(e.target as Element).closest?.('.modal-backdrop')
    const down = (x: number, y: number, t: number, e: Event) => {
      start = inSheet(e) ? null : { x, y, t }
      last = { x, y }
    }
    const onTouchStart = (e: TouchEvent) => (e.touches.length === 1 ? down(e.touches[0].clientX, e.touches[0].clientY, e.timeStamp, e) : (start = null))
    const onTouchMove = (e: TouchEvent) => {
      if (!start) return
      last = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      const dx = Math.abs(last.x - start.x)
      if (dx > 10 && dx > Math.abs(last.y - start.y) && e.cancelable) e.preventDefault()
    }
    const onTouchEnd = (e: TouchEvent) => {
      const p = e.changedTouches[0]
      if (p) last = { x: p.clientX, y: p.clientY }
      decide(e.timeStamp)
    }
    const onTouchCancel = (e: TouchEvent) => decide(e.timeStamp)
    const onPointerDown = (e: PointerEvent) => e.pointerType === 'mouse' && down(e.clientX, e.clientY, e.timeStamp, e)
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      last = { x: e.clientX, y: e.clientY }
      decide(e.timeStamp)
    }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchCancel)
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointerup', onPointerUp)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchCancel)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointerup', onPointerUp)
    }
  }, [loaded])

  if (status.kind === 'load-failed')
    return (
      <div className="loading">
        <div className="load-failed panel">
          <h2>Couldn’t open your saved plans</h2>
          <p>Nothing was changed or deleted. Close Timetable and open it again.</p>
          <p className="mono small">{status.message}</p>
        </div>
      </div>
    )
  if (!data) return <div className="loading" />

  const isToday = date === today
  const counts = countDay(data.todos?.[weekKey]?.[day] ?? [], plan, new Set(data.todoTicks?.[weekKey] ?? []))

  const addTodo = (text: string) => {
    const t = text.trim()
    if (!t) return
    const id = uid()
    update((d) => setDayTodos(d, weekKey, day, (l) => [...l, { id, text: t, done: false, since: date }]))
    setFreshTodo(id)
    sounds.add()
  }

  /** + on the Day tab: a 1-hour block at the next free time (from now on today, from 9:00 on other days) */
  const newBlock = () => {
    const now = new Date()
    let start = isToday ? Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30 : DEFAULT_TARGETS.top
    for (const b of [...blocks].sort((a, b) => a.start - b.start)) if (b.start <= start && b.end > start) start = b.end
    start = Math.min(Math.max(start, MIN_START), MAX_END - 60)
    setEditing({ block: { id: uid(), date, start, end: start + 60, title: '', color: PALETTE.sky }, isNew: true })
  }

  return (
    <div className="phone-app">
      <header className="phone-head">
        <button className="btn square" aria-label={tab === 'month' ? 'Previous month' : 'Previous day'} onClick={() => go(-1)}>
          <CaretLeftIcon size={24} weight="bold" />
        </button>
        {tab === 'month' ? (
          <div className="phone-title">
            <h1>{fromISO(month).toLocaleDateString('en-GB', { month: 'long' })}</h1>
            <div className="phone-date">
              <span>{fromISO(month).getFullYear()}</span>
              {month === monthOf(today) ? (
                <span className="phone-today-tag">This month</span>
              ) : (
                <button
                  className="phone-today-btn"
                  onClick={() => {
                    setDir(month < monthOf(today) ? 1 : -1)
                    setMonth(monthOf(today))
                  }}
                >
                  Go to this month
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="phone-title">
            <h1>{weekdayName(date)}</h1>
            <div className="phone-date">
              <span>{dayMonth(date)}</span>
              {isToday ? (
                <span className="phone-today-tag">Today</span>
              ) : (
                <button className="phone-today-btn" onClick={() => goTo(today)}>
                  Go to today
                </button>
              )}
            </div>
          </div>
        )}
        <button className="btn square" aria-label={tab === 'month' ? 'Next month' : 'Next day'} onClick={() => go(1)}>
          <CaretRightIcon size={24} weight="bold" />
        </button>
      </header>

      <div className="phone-strip">
        <CloudButton cloud={cloud} compact />
        <button className="save-pill phone-friends" aria-label="Friends" onClick={() => setFriendsOpen(true)}>
          <UsersThreeIcon size={18} weight="bold" />
          <span className="pill-label">Friends</span>
          {friends.overdue.length > 0 && <span className="badge mono due">{friends.overdue.length}</span>}
        </button>
        <span className="phone-strip-gap" />
        {tab === 'day' && <CalendarPill synced={synced} state={cal.state} onClick={syncWeek} />}
        {tab === 'todo' && <SoundButton on={sound} onChange={setSound} />}
      </div>

      <main className="phone-body" ref={bodyRef}>
        <div key={(tab === 'month' ? month : date) + tab} className={'phone-page ' + (dir > 0 ? 'from-right' : 'from-left')}>
          {tab === 'month' ? (
            <MonthView
              month={month}
              today={today}
              selected={date}
              blocks={data.blocks}
              onPick={(iso) => {
                goTo(iso)
                setTabState('day')
              }}
            />
          ) : tab === 'day' ? (
            <DayView
              date={date}
              isToday={isToday}
              blocks={blocks}
              timed={events.timed}
              allDay={events.allDay}
              onBlock={(block) => setEditing({ block, isNew: false })}
              onEvent={setViewing}
              onEmpty={(minute) => {
                const start = Math.min(Math.max(Math.floor(minute / 30) * 30, MIN_START), MAX_END - 60)
                setEditing({ block: { id: uid(), date, start, end: start + 60, title: '', color: PALETTE.sky }, isNew: true })
              }}
            />
          ) : (
            <div className="phone-todo">
              <TodoDay
                date={date}
                todos={data.todos?.[weekKey]?.[day] ?? []}
                plan={plan}
                ticked={new Set(data.todoTicks?.[weekKey] ?? [])}
                onChange={(fn) => update((d) => setDayTodos(d, weekKey, day, fn))}
                onTick={(id) => update((d) => toggleTick(d, weekKey, id))}
                fx={fxRef}
                heading={false}
                addLine={false}
                freshId={freshTodo}
              />
            </div>
          )}
        </div>
        {tab === 'month' ? null : tab === 'day' ? (
          <Fab label={`Add to ${weekdayName(date)}’s timetable`} onClick={newBlock} />
        ) : (
          <Fab
            label={date < today ? 'Add a to-do to today' : `Add a to-do to ${weekdayName(date)}`}
            className="mint"
            onClick={() => {
              // to-dos left on a day gone by move on to today at once (lib/rollover.ts), so add them there
              if (date < today) goTo(today)
              setAdding(true)
            }}
          />
        )}
        {/* to-do rewards (confetti) are drawn here */}
        <div className="todo-fx" ref={fxRef} aria-hidden />
      </main>

      {toast && (
        <div className="phone-toast" role="status">
          <span>{toast}</span>
          {canUndo && (
            <button
              className="btn small"
              onClick={() => {
                undo()
                setToast(null)
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}

      <nav className="phone-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'day'} className={tab === 'day' ? 'on' : ''} onClick={() => setTab('day')}>
          <ClockIcon size={24} weight="bold" />
          Day
        </button>
        <button role="tab" aria-selected={tab === 'todo'} className={tab === 'todo' ? 'on' : ''} onClick={() => setTab('todo')}>
          <ListChecksIcon size={24} weight="bold" />
          To-do
          <Count left={counts.left} total={counts.total} className="badge mono" />
        </button>
        <button role="tab" aria-selected={tab === 'month'} className={tab === 'month' ? 'on' : ''} onClick={() => setTab('month')}>
          <CalendarDotsIcon size={24} weight="bold" />
          Month
        </button>
      </nav>

      {editing && (
        <BlockEditor
          key={editing.block.id}
          block={editing.block}
          isNew={editing.isNew}
          activities={data.activities}
          friends={live(data.friends)}
          clashes={events.timed}
          phone
          onSave={(b, addToBank) => {
            update((d) => saveBlock(d, b, addToBank))
            setEditing(null)
          }}
          onDelete={() => {
            const b = editing.block
            update((d) => ({ ...d, blocks: d.blocks.filter((x) => x.id !== b.id) }))
            setEditing(null)
            setToast(`Deleted “${b.title || 'Untitled'}”`)
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {adding && <QuickAdd dayName={weekdayName(date)} onAdd={addTodo} onClose={() => setAdding(false)} />}
      {viewing && <EventSheet event={viewing} onClose={() => setViewing(null)} />}
      {friends.ping && <FriendsPing overdue={friends.ping} onClose={friends.closePing} onOpenList={() => setFriendsOpen(true)} />}
      {friendsOpen && (
        <FriendsPanel
          statuses={friends.statuses}
          onAdd={(name) => update((d) => addFriend(d, { id: uid(), name, added: today }))}
          onChange={(id, change) => update((d) => changeFriend(d, id, change))}
          onRemove={(id) => update((d) => removeFriend(d, id))}
          onClose={() => setFriendsOpen(false)}
        />
      )}
      {restoredFrom && !restoreNoticeSeen && (
        <Confirm
          title="Restored from backup"
          message={`Your main save file couldn’t be read, so Timetable opened your most recent backup (${restoredFrom.replace('timetable-', '')}). Nothing else was deleted.`}
          cancelLabel="OK"
          actions={[]}
          onClose={() => setRestoreNoticeSeen(true)}
        />
      )}
      {confirming && <Confirm {...confirming} onClose={() => setConfirming(null)} />}
    </div>
  )
}

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * A month of days, each a button that stands out from the page (press it to open that day). Only the month's own
 * days are drawn; each shows up to four dots in the colours of what's planned.
 */
function MonthView({ month, today, selected, blocks, onPick }: { month: string; today: string; selected: string; blocks: Block[]; onPick: (iso: string) => void }) {
  const first = fromISO(month)
  const lead = (first.getDay() + 6) % 7
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const prefix = month.slice(0, 8)
  const byDay = new Map<string, Block[]>()
  for (const b of blocks) if (b.date.startsWith(prefix)) byDay.set(b.date, [...(byDay.get(b.date) ?? []), b])
  const rows = Math.ceil((lead + count) / 7)
  return (
    <div className="month">
      <div className="month-dow" aria-hidden>
        {DOW.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="month-grid" style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
        {Array.from({ length: lead }, (_, i) => (
          <span key={'blank' + i} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const iso = prefix + String(i + 1).padStart(2, '0')
          const planned = (byDay.get(iso) ?? []).sort((a, b) => a.start - b.start)
          return (
            <button
              key={iso}
              className={'month-day' + (iso === today ? ' today' : '') + (iso === selected ? ' selected' : '') + (iso < today ? ' past' : '')}
              aria-label={`${weekdayName(iso)} ${dayMonth(iso)}${planned.length ? `, ${planned.length} planned` : ''}`}
              onClick={() => onPick(iso)}
            >
              <span className="month-num">{i + 1}</span>
              <span className="month-dots" aria-hidden>
                {planned.slice(0, 4).map((b) => (
                  <span key={b.id} style={{ ['--c' as string]: b.color }} />
                ))}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Calendar on/off for the week of the day on screen */
function CalendarPill({ synced, state, onClick }: { synced: boolean; state: SyncState; onClick: () => void }) {
  const p = { size: 18, weight: 'bold' as const }
  if (!synced)
    return (
      <button className="save-pill phone-cal" onClick={onClick} title="Show this week’s calendar events">
        <CalendarPlusIcon {...p} />
        Calendar
      </button>
    )
  if (state.kind === 'no-access' || state.kind === 'error')
    return (
      <button className="save-pill phone-cal bad" onClick={onClick}>
        <WarningIcon {...p} />
        Calendar off
      </button>
    )
  return (
    <button className="save-pill phone-cal on" onClick={onClick} title="Shows this week’s calendar events; tap to refresh">
      {state.kind === 'ok' ? <CalendarCheckIcon {...p} /> : <CalendarBlankIcon {...p} />}
      Calendar
    </button>
  )
}

/** One day's timetable, top to bottom: 9:00–22:00, widened for anything earlier or later. Scrolls. */
function DayView({ date, isToday, blocks, timed, allDay, onBlock, onEvent, onEmpty }: {
  date: string
  isToday: boolean
  blocks: Block[]
  timed: DayEvent[]
  allDay: CalEvent[]
  onBlock: (b: Block) => void
  onEvent: (e: DayEvent | CalEvent) => void
  /** tap on an empty bit of the day, at this minute */
  onEmpty: (minute: number) => void
}) {
  const range = visibleRange([...blocks, ...timed], DEFAULT_TARGETS, fmtTime)
  const { start, end } = range
  const lanes = layoutLanes([...blocks, ...timed])
  const scroller = useRef<HTMLDivElement>(null)
  const now = useNow()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  // open on what matters: now (today), else the first thing on, else the top
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const first = Math.min(...blocks.map((b) => b.start), ...timed.map((e) => e.start))
    const focus = isToday ? nowMin - 60 : Number.isFinite(first) ? first - 30 : start
    el.scrollTop = Math.max(0, (focus - start) * PX)
    // only when the day opens, not on every change
  }, [date]) // eslint-disable-line react-hooks/exhaustive-deps

  const hours: number[] = []
  for (let h = Math.ceil(start / 60) * 60; h <= end; h += 60) hours.push(h)
  /** where an item goes, and how much room its words have */
  const place = (it: { id: string; start: number; end: number }) => {
    const l = lanes.get(it.id) ?? { lane: 0, lanes: 1 }
    const height = Math.max(18, (Math.min(it.end, end) - Math.max(it.start, start)) * PX - 3)
    return {
      style: { top: (Math.max(it.start, start) - start) * PX + 1, height, left: `calc(${(l.lane / l.lanes) * 100}% + 2px)`, width: `calc(${100 / l.lanes}% - 6px)` },
      fit: { height, narrow: l.lanes > 1 },
    }
  }

  return (
    <div className="day-scroll" ref={scroller}>
      {allDay.length > 0 && (
        <div className="day-allday">
          {allDay.map((ev) => (
            <button key={ev.id} className="allday-event" style={{ ['--c' as string]: ev.color }} onClick={() => onEvent(ev)}>
              {ev.title}
            </button>
          ))}
        </div>
      )}
      <div className="day-grid" style={{ height: (end - start) * PX + 12 }}>
        <div className="day-gutter">
          {hours.map((h) => (
            <span key={h} className="hour-label" style={{ top: (h - start) * PX }}>
              {fmtTime(h)}
            </span>
          ))}
        </div>
        <div
          className="day-col"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            onEmpty(start + (e.clientY - r.top) / PX)
          }}
        >
          {hours.map((h) => (
            <div key={h} className="hour-line" style={{ top: (h - start) * PX }} />
          ))}
          {timed.map((ev) => {
            const { style, fit } = place(ev)
            return (
              <button
                key={ev.id}
                className={'item cal-event day-item' + (blocks.some((b) => overlaps(b, ev)) ? ' conflict' : '')}
                style={{ ...style, ['--c' as string]: ev.color }}
                onClick={(e) => {
                  e.stopPropagation()
                  onEvent(ev)
                }}
              >
                <ItemText title={ev.title} start={ev.start} end={ev.end} {...fit} icon={<CalendarBlankIcon size={16} weight="bold" />} />
              </button>
            )
          })}
          {blocks.map((b) => {
            const clash = timed.some((ev) => overlaps(b, ev))
            const { style, fit } = place(b)
            return (
              <button
                key={b.id}
                className={'item block day-item' + (clash ? ' conflict' : '')}
                style={{ ...style, ['--c' as string]: b.color }}
                onClick={(e) => {
                  e.stopPropagation()
                  onBlock(b)
                }}
              >
                <ItemText
                  title={b.title}
                  start={b.start}
                  end={b.end}
                  {...fit}
                  icon={clash ? <WarningIcon size={16} weight="bold" className="clash-icon" /> : <ActivityIcon name={discIcon(b.icon, b.title)} weight={b.iconWeight} size={16} />}
                />
              </button>
            )
          })}
          {isToday && nowMin >= start && nowMin <= end && (
            <div className="now-line" style={{ top: (nowMin - start) * PX }}>
              <span className="now-dot" />
            </div>
          )}
        </div>
      </div>
      {!blocks.length && !timed.length && <p className="day-empty">Nothing planned. Tap a time or + to add something.</p>}
    </div>
  )
}

/** a block's or event's words: one line when short, title over times when there's room */
function ItemText({ title, start, end, height, narrow, icon }: { title: string; start: number; end: number; height: number; narrow: boolean; icon: ReactNode }) {
  const name = title || 'Untitled'
  if (height < 40)
    return (
      <span className="item-line">
        {icon}
        <span className="item-title">{name}</span>
        <span className="item-start mono">{fmtTime(start)}</span>
      </span>
    )
  return (
    <span className="item-text">
      <span className="item-title-row">
        {icon}
        <span className="item-title">{name}</span>
      </span>
      <span className="item-time mono">
        {fmtTime(start)}–{fmtTime(end)}
        {!narrow && ` · ${fmtDuration(end - start)}`}
      </span>
    </span>
  )
}

/** Details of a calendar event (read-only: it belongs to the Calendar app) */
function EventSheet({ event, onClose }: { event: DayEvent | CalEvent; onClose: () => void }) {
  const src = 'source' in event ? event.source : event
  const s = new Date(src.start)
  const e = new Date(src.end)
  const sameDay = toISO(s) === toISO(new Date(src.end - 1))
  const when = src.allDay
    ? sameDay
      ? 'All day'
      : `All day, until ${new Date(src.end - 1).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`
    : `${fmtTime(s.getHours() * 60 + s.getMinutes())}–${fmtTime(e.getHours() * 60 + e.getMinutes())}${sameDay ? '' : ' (next day)'} · ${fmtDuration(Math.round((src.end - src.start) / 60000))}`
  return (
    <Modal title={src.title || 'Untitled'} color={`color-mix(in srgb, ${src.color} 45%, ${PALETTE.cloud})`} onClose={onClose}>
      <div className="modal-body event-sheet">
        <div className="hover-row">
          <ClockIcon size={18} weight="bold" />
          <span className="mono">{when}</span>
        </div>
        {src.location && (
          <div className="hover-row">
            <MapPinIcon size={18} weight="bold" />
            <span>{src.location}</span>
          </div>
        )}
        {src.notes && (
          <div className="hover-row">
            <NotepadIcon size={18} weight="bold" />
            <span className="event-notes">{src.notes}</span>
          </div>
        )}
        <div className="hover-foot">
          <span className="hover-dot" style={{ ['--c' as string]: src.color }} />
          From your calendar{src.calendar ? ` (${src.calendar})` : ''}. Change it in the Calendar app.
        </div>
      </div>
    </Modal>
  )
}

/** the time now, to the minute */
function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  return now
}

/**
 * How much of the screen the keyboard covers, as the CSS variable --kb, so pop-ups can sit on top of it instead of
 * under it. iOS also scrolls the page to show a focused line; it's put back when the keyboard goes.
 */
function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const set = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      document.documentElement.style.setProperty('--kb', `${kb}px`)
      if (kb < 1 && window.scrollY) window.scrollTo(0, 0)
    }
    set()
    vv.addEventListener('resize', set)
    vv.addEventListener('scroll', set)
    return () => {
      vv.removeEventListener('resize', set)
      vv.removeEventListener('scroll', set)
    }
  }, [])
}
