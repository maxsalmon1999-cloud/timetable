import { useEffect, useRef, useState } from 'react'
import { BroomIcon, CheckIcon, ListChecksIcon, PlusIcon, XIcon } from '@phosphor-icons/react'
import type { Todo } from '../lib/types'
import { uid } from '../lib/constants'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const todayIndex = () => (new Date().getDay() + 6) % 7

interface Props {
  todos: Todo[][]
  /** change one weekday's list (one undo step) */
  onChange: (day: number, fn: (list: Todo[]) => Todo[]) => void
}

/** Toolbar button + the to-do pad that pops out under it. Closes on × , Escape or a click outside. */
export function TodoMenu({ todos, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const todayLeft = (todos[todayIndex()] ?? []).filter((t) => !t.done).length

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement
      if (!ref.current?.contains(t) && !t.closest('.modal-backdrop')) setOpen(false)
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
        {todayLeft > 0 && <span className="badge mono" title={`${todayLeft} left for today`}>{todayLeft}</span>}
      </button>
      {open && <TodoPad todos={todos} onChange={onChange} onClose={() => setOpen(false)} />}
    </div>
  )
}

/** A to-do pad with a tab per weekday. Not tied to dates: the same lists show whichever week is on screen. */
function TodoPad({ todos, onChange, onClose }: Props & { onClose: () => void }) {
  const [day, setDay] = useState(todayIndex)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const today = todayIndex()
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
        <h1 className="todo-title">To-do</h1>
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
            {name.slice(0, 2)}
            {left(i) > 0 && <span className="todo-count mono">{left(i)}</span>}
          </button>
        ))}
      </div>

      <div className="todo-day">
        <h2>{DAYS[day]}</h2>
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
