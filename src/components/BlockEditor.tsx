import { useState } from 'react'
import type { Activity, Block } from '../lib/types'
import { COLORS, DAY_END, DAY_START, SNAP } from '../lib/constants'
import { fmtTime, fromISO } from '../lib/dates'
import { ColorPicker, Modal } from './Modal'

const TIMES = Array.from({ length: (DAY_END - DAY_START) / SNAP + 1 }, (_, i) => DAY_START + i * SNAP)

export function BlockEditor({
  block,
  isNew,
  activities,
  onSave,
  onDelete,
  onClose,
}: {
  block: Block
  isNew: boolean
  activities: Activity[]
  onSave: (b: Block, addToBank: boolean) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(block.title)
  const [color, setColor] = useState(block.color)
  const [start, setStart] = useState(block.start)
  const [end, setEnd] = useState(block.end)
  const inBank = activities.some((a) => a.name.toLowerCase() === title.trim().toLowerCase())
  const [addToBank, setAddToBank] = useState(false)

  const save = () => {
    if (!title.trim()) return
    onSave({ ...block, title: title.trim(), color, start, end: Math.max(end, start + SNAP) }, addToBank && !inBank)
  }

  const day = fromISO(block.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <Modal title={isNew ? 'New block' : 'Edit block'} onClose={onClose}>
      <p className="muted day-line">{day}</p>
      <form onSubmit={(e) => (e.preventDefault(), save())}>
        {activities.length > 0 && (
          <div className="chips">
            {activities.map((a) => (
              <button
                type="button"
                key={a.id}
                className={'chip' + (a.name === title ? ' selected' : '')}
                style={{ ['--c' as string]: a.color }}
                onClick={() => {
                  setTitle(a.name)
                  setColor(a.color)
                }}
              >
                <span className="dot" />
                {a.name}
              </button>
            ))}
          </div>
        )}
        <label className="field">
          <span>What</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Piano practice" />
        </label>
        <div className="field">
          <span>Colour</span>
          <ColorPicker value={color} onChange={setColor} colors={COLORS} />
        </div>
        <div className="field-row">
          <label className="field">
            <span>From</span>
            <select value={start} onChange={(e) => {
              const s = Number(e.target.value)
              setEnd(Math.min(DAY_END, s + (end - start)))
              setStart(s)
            }}>
              {TIMES.slice(0, -1).map((t) => <option key={t} value={t}>{fmtTime(t)}</option>)}
            </select>
          </label>
          <label className="field">
            <span>To</span>
            <select value={end} onChange={(e) => setEnd(Number(e.target.value))}>
              {TIMES.filter((t) => t > start).map((t) => <option key={t} value={t}>{fmtTime(t)}</option>)}
            </select>
          </label>
        </div>
        {title.trim() && !inBank && (
          <label className="check">
            <input type="checkbox" checked={addToBank} onChange={(e) => setAddToBank(e.target.checked)} />
            Save “{title.trim()}” to my activities
          </label>
        )}
        <div className="modal-actions">
          {!isNew && (
            <button type="button" className="btn danger left" onClick={onDelete}>Delete</button>
          )}
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!title.trim()}>{isNew ? 'Add' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}
