import { useEffect, useRef, useState } from 'react'
import { BroomIcon, CheckIcon, ListChecksIcon, PlusIcon, XIcon } from '@phosphor-icons/react'
import type { Todo } from '../lib/types'
import { uid } from '../lib/constants'
import { fromISO, toISO, weekLabel } from '../lib/dates'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
/** the weekday index of today if it's in this week, else -1 */
const todayIn = (dates: string[]) => dates.indexOf(toISO(new Date()))
const dayMonth = (iso: string) => fromISO(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })

interface Props {
  /** the 7 dates (YYYY-MM-DD) of the week on screen */
  dates: string[]
  /** that week's lists, index 0 = Monday */
  todos: Todo[][]
  /** change one weekday's list (one undo step) */
  onChange: (day: number, fn: (list: Todo[]) => Todo[]) => void
}

/**
 * Toolbar button + the to-do pad that pops out under it, for the week on screen. Closes on ×, Escape or a click
 * outside; stays open while she moves between weeks (Today / ‹ ›) so she can look through them.
 */
export function TodoMenu({ dates, todos, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const weekLeft = todos.flat().filter((t) => !t.done).length

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
      {open && <TodoPad key={dates[0]} dates={dates} todos={todos} onChange={onChange} onClose={() => setOpen(false)} />}
    </div>
  )
}

/** One week's to-do pad: a tab per day. Opens on today in the current week, Monday in any other. */
function TodoPad({ dates, todos, onChange, onClose }: Props & { onClose: () => void }) {
  const today = todayIn(dates)
  const [day, setDay] = useState(Math.max(0, today))
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const list = todos[day] ?? []
  const left = (d: number) => (todos[d] ?? []).filter((t) => !t.done).length
  const ticked = list.length - left(day)
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
        <span className="mono small">{list.length ? (left(day) ? `${left(day)} left` : 'All done!') : ''}</span>
      </div>

      <ul className="todo-list">
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
        {!list.length && <li className="empty">Nothing for {DAYS[day]} yet.</li>}
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
        {ticked > 0 && (
          <button className="btn small" onClick={() => change((l) => l.filter((t) => !t.done))}>
            <BroomIcon size={18} weight="bold" />
            Clear {ticked} ticked
          </button>
        )}
      </div>
    </div>
  )
}
