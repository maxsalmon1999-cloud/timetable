import { useState } from 'react'
import { CheckIcon, PlusIcon, SquaresFourIcon, TrashIcon, WarningIcon } from '@phosphor-icons/react'
import type { Activity, Block, Friend } from '../lib/types'
import { namedIn } from '../lib/friends'
import { FriendChips, FriendDisc } from './Friends'
import { COLORS, MAX_END, MIN_START, SNAP } from '../lib/constants'
import { BASE_ICONS, discIcon, guessIcon, PALETTE } from '../lib/icons'
import { fmtTime, fromISO } from '../lib/dates'
import { overlaps, type DayEvent } from '../lib/calendar'
import { Modal } from './Modal'
import { ColorPicker } from './ColorPicker'
import { IconLibrary } from './IconLibrary'
import { ActivityIcon } from './ActivityIcon'
import { isIOS } from '../lib/tauri'

// any time can be picked; the grid widens itself to show it
const TIMES = Array.from({ length: (MAX_END - MIN_START) / SNAP + 1 }, (_, i) => MIN_START + i * SNAP)

export function BlockEditor({
  block,
  isNew,
  activities,
  friends = [],
  weekdayOnly,
  clashes,
  onSave,
  onDelete,
  onClose,
  phone,
}: {
  block: Block
  isNew: boolean
  activities: Activity[]
  /** her friends (not removed), for "With" */
  friends?: Friend[]
  /** template drafts have no real dates: just say "Monday" */
  weekdayOnly?: boolean
  /** this day's timed calendar events */
  clashes: DayEvent[]
  onSave: (b: Block, addToBank: boolean) => void
  onDelete: () => void
  onClose: () => void
  /** the iPhone: times first, colour and icon folded away, and picking a type for a new block uses its usual length */
  phone?: boolean
}) {
  const [title, setTitle] = useState(block.title)
  /** the block's type (an activity id), separate from its name */
  const [tag, setTag] = useState(block.tag)
  const [color, setColor] = useState(block.color)
  const [chosenIcon, setChosenIcon] = useState(block.icon)
  // until an icon is picked (tile, library or activity chip), it follows a guess from the title
  const [iconPicked, setIconPicked] = useState(!!block.icon)
  const icon = iconPicked ? chosenIcon : (guessIcon(title) ?? chosenIcon)
  const setIcon = (n: string | undefined) => {
    setChosenIcon(n)
    setIconPicked(true)
  }
  const [iconWeight, setIconWeight] = useState(block.iconWeight)
  const [start, setStart] = useState(block.start)
  const [end, setEnd] = useState(block.end)
  const [library, setLibrary] = useState(false)
  const [addToBank, setAddToBank] = useState(false)
  const [looks, setLooks] = useState(!phone)
  const inBank = activities.some((a) => a.name.toLowerCase() === title.trim().toLowerCase())
  const clashing = clashes.filter((ev) => overlaps({ start, end }, ev))

  const tagged = activities.find((a) => a.id === tag)
  /** pick a type: its colour and icon come along; the name too, unless she's written her own */
  const pickType = (a: Activity) => {
    if (a.id === tag) return setTag(undefined) // tapping the chosen type again clears it
    const ownName = title.trim() && title.trim().toLowerCase() !== (tagged?.name ?? '').trim().toLowerCase()
    setTag(a.id)
    if (!ownName) setTitle(a.name)
    setColor(a.color)
    setIcon(a.icon ?? guessIcon(a.name))
    setIconWeight(a.iconWeight)
    if (phone && isNew) setEnd(Math.min(MAX_END, start + a.duration))
  }

  /** friends who were (or will be) there; tags of removed friends are kept, just not shown */
  const [withIds, setWithIds] = useState<string[]>(block.friends ?? [])
  const toggleWith = (id: string) => setWithIds(withIds.includes(id) ? withIds.filter((x) => x !== id) : [...withIds, id])
  /** friends the name mentions who aren't ticked under "With": asked about before saving */
  const [asking, setAsking] = useState<{ friends: Friend[]; picked: string[] } | null>(null)

  const save = (extra: string[] = [], ask = true) => {
    if (!title.trim()) return
    // a name mentioning a friend ("Lunch with Aoi"): check before tagging them, as some names are ordinary words too.
    // Only for names new in this edit, so saving an old block again doesn't ask again.
    const before = isNew ? [] : namedIn(block.title, friends).map((f) => f.id)
    const mentioned = namedIn(title, friends).filter((f) => !withIds.includes(f.id) && !before.includes(f.id))
    if (ask && mentioned.length) return setAsking({ friends: mentioned, picked: mentioned.map((f) => f.id) })
    const { icon: _i, iconWeight: _w, tag: _t, friends: _f, ...rest } = block // eslint-disable-line @typescript-eslint/no-unused-vars
    // a block named exactly like an activity, with no type picked, is that type
    const finalTag = tag ?? activities.find((a) => a.name.trim().toLowerCase() === title.trim().toLowerCase())?.id
    const people = [...withIds, ...extra.filter((id) => !withIds.includes(id))]
    onSave(
      {
        ...rest,
        title: title.trim(),
        color,
        start,
        end: Math.max(end, start + SNAP),
        ...(finalTag ? { tag: finalTag } : {}),
        ...(icon ? { icon, iconWeight } : {}),
        ...(people.length ? { friends: people } : {}),
      },
      addToBank && !inBank,
    )
  }

  const looksFields = (
    <>
      <div className="field">
        <span className="label">Colour</span>
        <ColorPicker value={color} onChange={setColor} colors={COLORS} />
      </div>
      <div className="field">
        <span className="label">Icon</span>
        <div className="icon-quick">
          {BASE_ICONS.map((n) => (
            <button
              type="button"
              key={n}
              title={n.replace(/-/g, ' ')}
              className={'icon-tile small' + (n === icon ? ' on' : '')}
              style={n === icon ? { background: color } : undefined}
              onClick={() => setIcon(n === icon ? undefined : n)}
            >
              <ActivityIcon name={n} weight={iconWeight} size={24} />
            </button>
          ))}
        </div>
        <button type="button" className="pill dashed" onClick={() => setLibrary(true)}>
          {icon && !(BASE_ICONS as readonly string[]).includes(icon) ? (
            <ActivityIcon name={icon} weight={iconWeight} size={18} />
          ) : (
            <SquaresFourIcon size={18} weight="bold" />
          )}
          More icons…
        </button>
      </div>
    </>
  )
  const times = (
    <div className="field-row">
      <label className="field">
        <span className="label">From</span>
        <select
          className="mono"
          value={start}
          onChange={(e) => {
            const s = Number(e.target.value)
            setEnd(Math.min(MAX_END, s + (end - start)))
            setStart(s)
          }}
        >
          {TIMES.slice(0, -1).map((t) => <option key={t} value={t}>{fmtTime(t)}</option>)}
        </select>
      </label>
      <label className="field">
        <span className="label">To</span>
        <select className="mono" value={end} onChange={(e) => setEnd(Number(e.target.value))}>
          {TIMES.filter((t) => t > start).map((t) => <option key={t} value={t}>{fmtTime(t)}</option>)}
        </select>
      </label>
    </div>
  )

  const day = fromISO(block.date).toLocaleDateString('en-GB', weekdayOnly ? { weekday: 'long' } : { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <>
      <Modal title={isNew ? 'New block' : 'Edit block'} color={color} width={500} onClose={onClose}>
        <form className="modal-body" onSubmit={(e) => (e.preventDefault(), save())}>
          <div className="day-line">{day}</div>
          {activities.length > 0 && (
            <div className="field">
              <span className="label">Type</span>
              <div className="pills" role="radiogroup" aria-label="Type">
                {activities.map((a) => (
                  <button
                    type="button"
                    key={a.id}
                    role="radio"
                    aria-checked={a.id === tag}
                    title={a.id === tag ? 'Tap again for no type' : `Make this a ${a.name} block`}
                    className={'pill' + (a.id === tag ? ' on' : '')}
                    style={a.id === tag ? { background: a.color } : undefined}
                    onClick={() => pickType(a)}
                  >
                    <ActivityIcon name={discIcon(a.icon, a.name)} weight={a.iconWeight} size={17} />
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <label className="field">
            <span className="label">What</span>
            <input autoFocus={!isIOS /* the iPad/iPhone keyboard would cover half the editor; she usually picks a chip */} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Piano practice" />
          </label>
          {friends.length > 0 && (
            <div className="field">
              <span className="label">With</span>
              <FriendChips friends={friends} selected={withIds} onToggle={toggleWith} />
            </div>
          )}
          {phone && times}
          {looks ? (
            looksFields
          ) : (
            <button type="button" className="pill dashed" onClick={() => setLooks(true)}>
              <span className="looks-dot" style={{ background: color }} />
              {icon && <ActivityIcon name={icon} weight={iconWeight} size={18} />}
              Colour &amp; icon…
            </button>
          )}
          {!phone && times}
          {clashing.length > 0 && (
            <div className="clash-banner">
              <WarningIcon size={22} weight="bold" className="clash-icon" />
              Clashes with {clashing.map((c) => `${c.title} (${fmtTime(c.start)}–${fmtTime(c.end)})`).join(', ')} in your Calendar
            </div>
          )}
          {title.trim() && !inBank && (
            <label className="check">
              <input type="checkbox" checked={addToBank} onChange={(e) => setAddToBank(e.target.checked)} />
              <span>
                Repeating activity?
                <span className="check-hint">
                  {phone ? `Adds “${title.trim()}” to your types, ready to pick again` : `Adds “${title.trim()}” to your activities on the left, ready to drag in again`}
                </span>
              </span>
            </label>
          )}
          <div className="modal-actions">
            {!isNew && (
              <button type="button" className="btn danger left" onClick={onDelete}>
                <TrashIcon size={20} weight="bold" />
                Delete
              </button>
            )}
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary" disabled={!title.trim()}>
              {isNew ? <PlusIcon size={20} weight="bold" /> : <CheckIcon size={20} weight="bold" />}
              {isNew ? 'Add' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      {asking && (
        <Modal title={asking.friends.length === 1 ? `With ${asking.friends[0].name}?` : 'With these friends?'} color={PALETTE.pink} width={440} onClose={() => setAsking(null)}>
          <div className="modal-body">
            <p className="modal-message">
              “{title.trim()}” mentions {asking.friends.length === 1 ? asking.friends[0].name : 'some of your friends'}. Tag{' '}
              {asking.friends.length === 1 ? 'them' : 'the ones who were there'}, so it counts as time together?
            </p>
            {asking.friends.length > 1 && (
              <FriendChips
                friends={asking.friends}
                selected={asking.picked}
                onToggle={(id) => setAsking({ ...asking, picked: asking.picked.includes(id) ? asking.picked.filter((x) => x !== id) : [...asking.picked, id] })}
              />
            )}
            <div className="modal-actions">
              <button className="btn" onClick={() => save([], false)}>
                No
              </button>
              <button className="btn primary" disabled={!asking.picked.length} onClick={() => save(asking.picked, false)}>
                {asking.friends.length === 1 ? <FriendDisc friend={asking.friends[0]} size={22} /> : null}
                {asking.friends.length === 1 ? `Yes, tag ${asking.friends[0].name}` : 'Tag them'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {library && (
        <Modal title="Choose an icon" color={color} width={640} onClose={() => setLibrary(false)}>
          <div className="modal-body">
            <IconLibrary
              icon={icon}
              weight={iconWeight}
              color={color}
              onPick={(n) => {
                setIcon(n)
                if (n) setLibrary(false)
              }}
            />
          </div>
        </Modal>
      )}
    </>
  )
}
