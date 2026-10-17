import { useEffect, useState } from 'react'
import { PlusIcon } from '@phosphor-icons/react'
import { backdropClose } from '../lib/backdrop'

/** The round + button that floats over the phone's lists (bottom right, above the tabs) */
export function Fab({ label, className = '', onClick }: { label: string; className?: string; onClick: () => void }) {
  return (
    <button className={'fab ' + className} aria-label={label} title={label} onClick={onClick}>
      <PlusIcon size={30} weight="bold" />
    </button>
  )
}

/**
 * Adding to-dos on the phone: a pop-up that sits on top of the keyboard. Return (or +) adds and keeps it open for the
 * next one; Done, Return on an empty line or a tap outside closes it.
 */
export function QuickAdd({ dayName, onAdd, onClose }: { dayName: string; onAdd: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState('')
  const [added, setAdded] = useState(0)

  const add = () => {
    onAdd(text)
    setText('')
    setAdded(added + 1)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop quick-add-backdrop" {...backdropClose(onClose)}>
      <div className="modal quick-add" role="dialog" aria-label={`Add to ${dayName}`}>
        <div className="quick-add-head">
          <b>Add to {dayName}</b>
          {added > 0 && <span className="quick-add-count mono">{added} added</span>}
          <button type="button" className="btn small" onClick={onClose}>
            Done
          </button>
        </div>
        {/* no <form>: submitting one makes iOS put the keyboard away, and it should stay up for the next to-do */}
        <div className="todo-add">
          {/* opened by a tap, so iOS lets it bring the keyboard up straight away */}
          <input
            autoFocus
            value={text}
            placeholder="e.g. Buy birthday card"
            enterKeyHint="enter"
            autoCapitalize="sentences"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
              e.preventDefault()
              // Return adds; Return on an empty line closes
              if (text.trim()) add()
              else onClose()
            }}
          />
          {/* pressing it mustn't take the focus from the line, or the keyboard would drop and come back */}
          <button className="btn square mint" type="button" title="Add" disabled={!text.trim()} onPointerDown={(e) => e.preventDefault()} onClick={add}>
            <PlusIcon size={22} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  )
}
