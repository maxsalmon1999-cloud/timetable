import { useState, type PointerEvent as RPointerEvent } from 'react'
import type { Activity } from '../lib/types'
import { fmtDuration } from '../lib/dates'
import { ActivityEditor } from './ActivityEditor'
import { Confirm } from './Modal'
import { SaveIndicator } from './SaveIndicator'
import type { SaveStatus } from '../lib/store'

interface Props {
  activities: Activity[]
  onDragStart: (e: RPointerEvent, a: Activity) => void
  onSave: (a: Activity) => void
  onDelete: (id: string) => void
  saveStatus: SaveStatus
  folder: string | null
  onRetrySave: () => void
}

export function Sidebar({ activities, onDragStart, onSave, onDelete, saveStatus, folder, onRetrySave }: Props) {
  const [editing, setEditing] = useState<Activity | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Activity | null>(null)

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <h1>Activities</h1>
        <button className="btn small primary" onClick={() => setEditing('new')}>+ New</button>
      </div>

      <ul className="bank">
        {activities.map((a) => (
          <li key={a.id} className="bank-item" style={{ ['--c' as string]: a.color }} onPointerDown={(e) => e.button === 0 && onDragStart(e, a)}>
            <span className="dot" />
            <span className="bank-name">{a.name}</span>
            <span className="bank-dur">{fmtDuration(a.duration)}</span>
            <span className="bank-tools">
              <button title="Edit" onPointerDown={(e) => e.stopPropagation()} onClick={() => setEditing(a)}>✎</button>
              <button title="Remove" onPointerDown={(e) => e.stopPropagation()} onClick={() => setDeleting(a)}>✕</button>
            </span>
          </li>
        ))}
        {!activities.length && <li className="muted empty">No activities yet. Click “+ New” to add one.</li>}
      </ul>

      <div className="hints">
        <p><b>Drag</b> an activity onto the week to add it.</p>
        <p><b>Drag on empty space</b> to make a block of any length.</p>
        <p><b>Drag a block</b> to move it, or its bottom edge to resize. Hold <kbd>⌥</kbd> while dropping to copy.</p>
        <p><b>Click a block</b> to rename, recolour or delete.</p>
      </div>

      <SaveIndicator status={saveStatus} folder={folder} onRetry={onRetrySave} />

      {editing && (
        <ActivityEditor
          activity={editing === 'new' ? null : editing}
          onSave={(a) => {
            onSave(a)
            setEditing(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <Confirm
          title={`Remove “${deleting.name}”?`}
          message="It will be removed from your activity list. Blocks already on the calendar stay where they are."
          actions={[{ label: 'Remove', kind: 'danger', run: () => onDelete(deleting.id) }]}
          onClose={() => setDeleting(null)}
        />
      )}
    </aside>
  )
}
