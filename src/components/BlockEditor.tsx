import { useState } from 'react'
import { CheckIcon, PlusIcon, SquaresFourIcon, TrashIcon, WarningIcon } from '@phosphor-icons/react'
import type { Activity, Block } from '../lib/types'
import { COLORS, MAX_END, MIN_START, SNAP } from '../lib/constants'
import { BASE_ICONS, discIcon, guessIcon } from '../lib/icons'
import { fmtTime, fromISO } from '../lib/dates'
import { overlaps, type DayEvent } from '../lib/calendar'
import { Modal } from './Modal'
import { ColorPicker } from './ColorPicker'
import { IconLibrary } from './IconLibrary'
import { ActivityIcon } from './ActivityIcon'
import { isIPad } from '../lib/tauri'

// any time can be picked; the grid widens itself to show it
const TIMES = Array.from({ length: (MAX_END - MIN_START) / SNAP + 1 }, (_, i) => MIN_START + i * SNAP)

export function BlockEditor({
  block,
  isNew,
  activities,
  weekdayOnly,
  clashes,
  onSave,
  onDelete,
  onClose,
}: {
  block: Block
  isNew: boolean
  activities: Activity[]
  /** template drafts have no real dates: just say "Monday" */
  weekdayOnly?: boolean
  /** this day's timed calendar events */
  clashes: DayEvent[]
  onSave: (b: Block, addToBank: boolean) => void
  onDelete: () => void
  onClose: () => void
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
  }

  const save = () => {
    if (!title.trim()) return
    const { icon: _i, iconWeight: _w, tag: _t, ...rest } = block // eslint-disable-line @typescript-eslint/no-unused-vars
    // a block named exactly like an activity, with no type picked, is that type
    const finalTag = tag ?? activities.find((a) => a.name.trim().toLowerCase() === title.trim().toLowerCase())?.id
    onSave(
      { ...rest, title: title.trim(), color, start, end: Math.max(end, start + SNAP), ...(finalTag ? { tag: finalTag } : {}), ...(icon ? { icon, iconWeight } : {}) },
      addToBank && !inBank,
    )
  }

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
            <input autoFocus={!isIPad /* the iPad keyboard would cover half the editor; she usually picks a chip */} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Piano practice" />
          </label>
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
                <span className="check-hint">Adds “{title.trim()}” to your activities on the left, ready to drag in again</span>
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
