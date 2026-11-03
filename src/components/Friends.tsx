import { useState } from 'react'
import { PlusIcon, UsersThreeIcon, XIcon } from '@phosphor-icons/react'
import type { Friend } from '../lib/types'
import { REMIND_CHOICES, remindLabel, type FriendStatus } from '../lib/friends'
import { fromISO, toISO, addDays } from '../lib/dates'
import { PALETTE } from '../lib/icons'
import { Confirm, Modal } from './Modal'

const DISC_COLORS = [PALETTE.pink, PALETTE.sky, PALETTE.mint, PALETTE.lemon, PALETTE.lilac, PALETTE.peach, PALETTE.teal]

/** a friend's initial in a coloured circle (colour fixed by their id) */
export function FriendDisc({ friend, size = 30 }: { friend: Friend; size?: number }) {
  let h = 0
  for (const c of friend.id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return (
    <span className="friend-disc" style={{ width: size, height: size, fontSize: size * 0.45, background: DISC_COLORS[h % DISC_COLORS.length] }} aria-hidden>
      {friend.name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}

/** "Fri 7 Nov", or today / tomorrow */
function dayName(iso: string) {
  const today = toISO(new Date())
  if (iso === today) return 'today'
  if (iso === toISO(addDays(new Date(), 1))) return 'tomorrow'
  const d = fromISO(iso)
  return `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`
}

const seenText = (s: FriendStatus) =>
  !s.last ? 'Not seen yet' : s.since === 0 ? 'Seen today' : s.since === 1 ? 'Seen yesterday' : `Seen ${s.since} days ago`

/** Pick who was there: one chip per friend (block editor) */
export function FriendChips({ friends, selected, onToggle }: { friends: Friend[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="pills" role="group" aria-label="Friends there">
      {friends.map((f) => {
        const on = selected.includes(f.id)
        return (
          <button type="button" key={f.id} className={'pill friend-pill' + (on ? ' on' : '')} aria-pressed={on} onClick={() => onToggle(f.id)}>
            <FriendDisc friend={f} size={22} />
            {f.name}
          </button>
        )
      })}
    </div>
  )
}

interface PanelProps {
  statuses: FriendStatus[]
  onAdd: (name: string) => void
  onChange: (id: string, change: Partial<Pick<Friend, 'name' | 'remindDays'>>) => void
  onRemove: (id: string) => void
  onClose: () => void
}

/** The friends list: add, rename, set how long before a reminder, remove. Shows when she last saw each one. */
export function FriendsPanel({ statuses, onAdd, onChange, onRemove, onClose }: PanelProps) {
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [removing, setRemoving] = useState<Friend | null>(null)
  const sorted = [...statuses].sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.friend.name.localeCompare(b.friend.name))

  const add = () => {
    if (!name.trim()) return
    onAdd(name.trim())
    setName('')
  }
  const finishEdit = () => {
    if (editing && editing.name.trim()) onChange(editing.id, { name: editing.name.trim() })
    setEditing(null)
  }

  return (
    <>
      <Modal title="Friends" color={PALETTE.pink} width={540} onClose={onClose}>
        <div className="modal-body friends">
          <p className="friends-intro">
            Add friends, then tag them on your blocks (“With”). Pick a reminder and Timetable tells you when it’s been a while.
          </p>
          <div className="todo-add">
            <input
              value={name}
              placeholder="A friend’s name"
              autoCapitalize="words"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
            />
            <button className="btn square primary" title="Add friend" disabled={!name.trim()} onClick={add}>
              <PlusIcon size={22} weight="bold" />
            </button>
          </div>

          {sorted.length ? (
            <ul className="friend-list">
              {sorted.map((s) => (
                <li key={s.friend.id} className={'friend-row' + (s.overdue ? ' overdue' : '')}>
                  <FriendDisc friend={s.friend} size={40} />
                  <div className="friend-main">
                    {editing?.id === s.friend.id ? (
                      <input
                        className="friend-edit"
                        autoFocus
                        value={editing.name}
                        onChange={(e) => setEditing({ id: s.friend.id, name: e.target.value })}
                        onBlur={finishEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') finishEdit()
                          if (e.key === 'Escape') {
                            e.stopPropagation()
                            setEditing(null)
                          }
                        }}
                      />
                    ) : (
                      <button className="friend-name" title="Rename" onClick={() => setEditing({ id: s.friend.id, name: s.friend.name })}>
                        {s.friend.name}
                      </button>
                    )}
                    <span className="friend-seen mono">
                      {seenText(s)}
                      {s.next && ` · seeing them ${dayName(s.next)}`}
                    </span>
                    {s.overdue && <span className="friend-due">Time to catch up</span>}
                    <label className="friend-remind">
                      <span>Remind me after</span>
                      <select
                        value={s.friend.remindDays ?? 0}
                        onChange={(e) => onChange(s.friend.id, { remindDays: Number(e.target.value) || undefined })}
                      >
                        <option value={0}>never</option>
                        {REMIND_CHOICES.map((d) => (
                          <option key={d} value={d}>
                            {remindLabel(d)}
                          </option>
                        ))}
                        {s.friend.remindDays && !REMIND_CHOICES.includes(s.friend.remindDays) && (
                          <option value={s.friend.remindDays}>{remindLabel(s.friend.remindDays)}</option>
                        )}
                      </select>
                    </label>
                  </div>
                  <button className="friend-remove" title={`Remove ${s.friend.name}`} onClick={() => setRemoving(s.friend)}>
                    <XIcon size={18} weight="bold" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="friends-empty">
              <UsersThreeIcon size={28} weight="bold" />
              No friends added yet.
            </p>
          )}
        </div>
      </Modal>
      {removing && (
        <Confirm
          title={`Remove ${removing.name}?`}
          message="They come off your friends list. Blocks you had with them stay as they are."
          cancelLabel="Keep"
          actions={[{ label: 'Remove', kind: 'danger', run: () => onRemove(removing.id) }]}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  )
}

/** The once-a-day pop-up: friends she hasn't seen for longer than she asked to be reminded about */
export function FriendsPing({ overdue, onClose, onOpenList }: { overdue: FriendStatus[]; onClose: () => void; onOpenList: () => void }) {
  return (
    <Modal title="Time to catch up?" color={PALETTE.lemon} width={460} onClose={onClose}>
      <div className="modal-body">
        <p className="modal-message">It’s been a while since you saw {overdue.length === 1 ? 'this friend' : 'these friends'}:</p>
        <ul className="friend-list ping">
          {overdue.map((s) => (
            <li key={s.friend.id} className="friend-row">
              <FriendDisc friend={s.friend} size={36} />
              <div className="friend-main">
                <b className="friend-name static">{s.friend.name}</b>
                <span className="friend-seen mono">
                  {s.last ? `${s.since} days since you saw them` : `Not seen in the ${s.since} days since you added them`}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button
            className="btn"
            onClick={() => {
              onClose()
              onOpenList()
            }}
          >
            Friends list
          </button>
          <button className="btn primary" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </Modal>
  )
}
