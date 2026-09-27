import { useState } from 'react'
import type { Activity } from '../lib/types'
import { COLORS, DURATIONS, uid } from '../lib/constants'
import { fmtDuration } from '../lib/dates'
import { ColorPicker, Modal } from './Modal'

export function ActivityEditor({
  activity,
  onSave,
  onClose,
}: {
  activity: Activity | null
  onSave: (a: Activity) => void
  onClose: () => void
}) {
  const [name, setName] = useState(activity?.name ?? '')
  const [color, setColor] = useState(activity?.color ?? COLORS[0])
  const [duration, setDuration] = useState(activity?.duration ?? 60)

  const save = () => name.trim() && onSave({ id: activity?.id ?? uid(), name: name.trim(), color, duration })

  return (
    <Modal title={activity ? 'Edit activity' : 'New activity'} onClose={onClose}>
      <form onSubmit={(e) => (e.preventDefault(), save())}>
        <label className="field">
          <span>Name</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Yoga" />
        </label>
        <div className="field">
          <span>Colour</span>
          <ColorPicker value={color} onChange={setColor} colors={COLORS} />
        </div>
        <label className="field">
          <span>Usual length</span>
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {DURATIONS.map((d) => (
              <option key={d} value={d}>{fmtDuration(d)}</option>
            ))}
          </select>
        </label>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!name.trim()}>Save</button>
        </div>
      </form>
    </Modal>
  )
}
