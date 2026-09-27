import { useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { CursorClickIcon, HandGrabbingIcon, PencilSimpleIcon, PlusIcon, SelectionPlusIcon, XIcon } from '@phosphor-icons/react'
import type { Activity } from '../lib/types'
import { fmtDuration } from '../lib/dates'
import { ActivityEditor } from './ActivityEditor'
import { Confirm, Dots } from './Modal'
import { SaveIndicator } from './SaveIndicator'
import { ActivityIcon } from './ActivityIcon'
import type { SaveStatus } from '../lib/store'

interface Props {
  activities: Activity[]
  onDragStart: (e: RPointerEvent, a: Activity) => void
  onSave: (a: Activity) => void
  onDelete: (id: string) => void
  saveStatus: SaveStatus
  folder: string | null
  onRetrySave: () => void
  version: string | null
  /** shown just above the save status (e.g. the update notice) */
  children?: ReactNode
}

export function Sidebar({ activities, onDragStart, onSave, onDelete, saveStatus, folder, onRetrySave, version, children }: Props) {
  const [editing, setEditing] = useState<Activity | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Activity | null>(null)

  return (
    <aside className="sidebar panel">
      <div className="panel-head pink">
        <div className="panel-title">
          <Dots />
          <h1>Activities</h1>
        </div>
        <button className="btn square lemon" title="New activity" onClick={() => setEditing('new')}>
          <PlusIcon size={24} weight="bold" />
        </button>
      </div>

      <ul className="bank">
        {activities.map((a) => (
          <li key={a.id} className="activity" style={{ ['--c' as string]: a.color }} onPointerDown={(e) => e.button === 0 && onDragStart(e, a)}>
            <span className="icon-disc">
              <ActivityIcon name={a.icon} weight={a.iconWeight} size={19} fallback={a.name} />
            </span>
            <span className="activity-name">{a.name}</span>
            <span className="mono activity-dur">{fmtDuration(a.duration)}</span>
            <span className="activity-tools">
              <button title="Edit" onPointerDown={(e) => e.stopPropagation()} onClick={() => setEditing(a)}>
                <PencilSimpleIcon size={17} weight="bold" />
              </button>
              <button title="Remove" onPointerDown={(e) => e.stopPropagation()} onClick={() => setDeleting(a)}>
                <XIcon size={17} weight="bold" />
              </button>
            </span>
          </li>
        ))}
        {!activities.length && <li className="empty">No activities yet. Press + to add one.</li>}
      </ul>

      <div className="sidebar-foot">
        <div className="hints">
          <div><HandGrabbingIcon size={20} weight="bold" /><span><b>Drag</b> an activity onto a day</span></div>
          <div><SelectionPlusIcon size={20} weight="bold" /><span><b>Drag on empty space</b> for any length</span></div>
          <div><CursorClickIcon size={20} weight="bold" /><span><b>Click a block</b> to change it</span></div>
        </div>
        {children}
        <SaveIndicator status={saveStatus} folder={folder} onRetry={onRetrySave} />
        {version && <span className="mono version">Version {version}</span>}
      </div>

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
          message="It comes off your activity list. Blocks already on your weeks stay where they are."
          actions={[{ label: 'Remove', kind: 'danger', run: () => onDelete(deleting.id) }]}
          onClose={() => setDeleting(null)}
        />
      )}
    </aside>
  )
}
