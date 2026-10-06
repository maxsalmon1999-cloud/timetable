import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { CursorClickIcon, HandGrabbingIcon, PencilSimpleIcon, PlusIcon, SelectionPlusIcon, XIcon } from '@phosphor-icons/react'
import type { Activity } from '../lib/types'
import { fmtDuration } from '../lib/dates'
import { discIcon } from '../lib/icons'
import { isMacApp } from '../lib/tauri'
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
  /** the activity whose blocks she's looking at (others fade on the week) */
  focusTag: string | null
  onFocusTag: (id: string | null) => void
  /** blocks of each type in the week on screen, by activity id */
  weekCounts: Record<string, number>
}

const HOVER_MS = 350
const HOLD_MS = 300

export function Sidebar({ activities, onDragStart, onSave, onDelete, saveStatus, folder, onRetrySave, version, children, focusTag, onFocusTag, weekCounts }: Props) {
  const [editing, setEditing] = useState<Activity | 'new' | null>(null)
  const filter = useTypeFilter(focusTag, onFocusTag)
  const [deleting, setDeleting] = useState<Activity | null>(null)

  return (
    <aside className="sidebar panel">
      <div className="panel-head pink" data-tauri-drag-region>
        <div className="panel-title" data-tauri-drag-region>
          {/* in the app the real window buttons sit here instead of the decorative dots */}
          {isMacApp ? <div className="traffic-light-space" data-tauri-drag-region /> : <Dots />}
          <h1 data-tauri-drag-region>Activities</h1>
        </div>
        <button className="btn square lemon" title="New activity" onClick={() => setEditing('new')}>
          <PlusIcon size={24} weight="bold" />
        </button>
      </div>

      <ul className="bank">
        {activities.map((a) => (
          <li
            key={a.id}
            className={'activity' + (focusTag === a.id ? ' focused' : '')}
            style={{ ['--c' as string]: a.color }}
            onPointerDown={(e) => {
              if (e.button !== 0) return
              filter.holdStart(a.id)
              onDragStart(e, a)
            }}
            onPointerEnter={(e) => filter.enter(e, a.id)}
            onPointerLeave={filter.leave}
          >
            <span className="icon-disc">
              <ActivityIcon name={discIcon(a.icon, a.name)} weight={a.iconWeight} size={19} />
            </span>
            <span className="activity-name">{a.name}</span>
            <span className="mono activity-dur">
              {focusTag === a.id ? `${weekCounts[a.id] ?? 0} this week` : fmtDuration(a.duration)}
            </span>
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

/**
 * Looking at one type: rest the mouse on an activity (Mac), or press and hold it (any device, finger included).
 * Moving the mouse to another activity switches at once; leaving the list or letting go ends it. Dragging still works:
 * the week ignores the filter while a drag is under way.
 */
function useTypeFilter(focusTag: string | null, onFocusTag: (id: string | null) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const held = useRef(false)

  useEffect(() => {
    const release = () => {
      clearTimeout(timer.current)
      if (held.current) {
        held.current = false
        onFocusTag(null)
      }
    }
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    return () => {
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
      clearTimeout(timer.current)
    }
  }, [onFocusTag])

  return {
    holdStart: (id: string) => {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        held.current = true
        onFocusTag(id)
      }, HOLD_MS)
    },
    enter: (e: RPointerEvent, id: string) => {
      if (e.pointerType !== 'mouse' || e.buttons || held.current) return
      clearTimeout(timer.current)
      if (focusTag) onFocusTag(id) // already looking: switch straight away
      else timer.current = setTimeout(() => onFocusTag(id), HOVER_MS)
    },
    leave: () => {
      if (held.current) return
      clearTimeout(timer.current)
      // a moment's grace, so sliding to the next activity doesn't flash the whole week back
      timer.current = setTimeout(() => onFocusTag(null), 120)
    },
  }
}
