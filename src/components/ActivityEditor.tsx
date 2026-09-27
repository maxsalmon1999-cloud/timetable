import { useState } from 'react'
import { CheckIcon, PlusIcon } from '@phosphor-icons/react'
import type { Activity, IconWeight } from '../lib/types'
import { COLORS, DURATIONS, uid } from '../lib/constants'
import { discIcon, guessIcon, PALETTE } from '../lib/icons'
import { fmtDuration, fmtTime } from '../lib/dates'
import { ColorPicker, Modal } from './Modal'
import { IconLibrary } from './IconLibrary'
import { ActivityIcon } from './ActivityIcon'

const WEIGHTS: [IconWeight, string][] = [
  ['bold', 'Bold'],
  ['fill', 'Filled'],
  ['duotone', 'Duotone'],
]

/** New / edit activity: details on the left, icon library on the right */
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
  const [color, setColor] = useState(activity?.color ?? PALETTE.pink)
  const [duration, setDuration] = useState(activity?.duration ?? 60)
  const [custom, setCustom] = useState(() => !DURATIONS.includes(activity?.duration ?? 60))
  const [chosenIcon, setChosenIcon] = useState(activity?.icon)
  // until she picks one herself, the icon follows a guess from the name
  const [iconPicked, setIconPicked] = useState(!!activity?.icon)
  const icon = iconPicked ? chosenIcon : (guessIcon(name) ?? chosenIcon)
  const pickIcon = (n: string | undefined) => {
    setChosenIcon(n)
    setIconPicked(true)
  }
  const [weight, setWeight] = useState<IconWeight>(activity?.iconWeight ?? 'bold')
  const hours = Math.floor(duration / 60)
  const mins = duration % 60
  const setHM = (h: number, m: number) => setDuration(Math.max(15, Math.min(18 * 60, h * 60 + m)))

  const save = () => {
    if (!name.trim()) return
    onSave({
      id: activity?.id ?? uid(),
      name: name.trim(),
      color,
      duration,
      ...(icon ? { icon, iconWeight: weight } : {}),
    })
  }
  const preview = name.trim() || 'New activity'

  return (
    <Modal title={activity ? 'Edit activity' : 'New activity'} color={PALETTE.lemon} width={880} onClose={onClose}>
      <form className="lib-layout" onSubmit={(e) => (e.preventDefault(), save())}>
        <div className="lib-details">
          <label className="field">
            <span className="label">Name</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Revision" />
          </label>
          <div className="field">
            <span className="label">Colour</span>
            <ColorPicker value={color} onChange={setColor} colors={COLORS} columns={5} />
          </div>
          <label className="field">
            <span className="label">Usual length</span>
            <select
              className="mono"
              value={custom ? 'custom' : duration}
              onChange={(e) => {
                if (e.target.value === 'custom') return setCustom(true)
                setCustom(false)
                setDuration(Number(e.target.value))
              }}
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>{fmtDuration(d)}</option>
              ))}
              <option value="custom">Custom…</option>
            </select>
          </label>
          {custom && (
            <div className="field-row">
              <label className="field">
                <span className="label">Hours</span>
                <input type="number" className="mono" min={0} max={18} value={hours} onChange={(e) => setHM(Number(e.target.value) || 0, mins)} />
              </label>
              <label className="field">
                <span className="label">Minutes</span>
                <select className="mono" value={mins} onChange={(e) => setHM(hours, Number(e.target.value))}>
                  {[0, 15, 30, 45].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
            </div>
          )}
          <div className="field">
            <span className="label">Icon style</span>
            <div className="segmented">
              {WEIGHTS.map(([w, label]) => (
                <button type="button" key={w} className={w === weight ? 'on' : ''} onClick={() => setWeight(w)}>
                  <ActivityIcon name={icon ?? 'star'} weight={w} size={20} />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="field preview">
            <span className="label">Preview</span>
            <div className="activity" style={{ ['--c' as string]: color }}>
              <span className="icon-disc"><ActivityIcon name={discIcon(icon, preview)} weight={weight} size={19} /></span>
              <span className="activity-name">{preview}</span>
              <span className="mono activity-dur">{fmtDuration(duration)}</span>
            </div>
            <div className="item block tier-tall preview-block" style={{ ['--c' as string]: color }}>
              <div className="item-text">
                <div className="item-title-row"><span className="item-title">{preview}</span></div>
                <div className="item-time mono">{fmtTime(14 * 60)}–{fmtTime(Math.min(24 * 60, 14 * 60 + duration))}</div>
              </div>
              <ActivityIcon className="item-icon" name={icon} weight={weight} size={24} />
            </div>
          </div>
        </div>

        <div className="lib-icons">
          <IconLibrary icon={icon} weight={weight} color={color} onPick={pickIcon} />
          <div className="modal-actions">
            <span className="mono caption">{icon ? `${icon.replace(/-/g, ' ')} · ${weight}` : 'No icon'}</span>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary" disabled={!name.trim()}>
              {activity ? <CheckIcon size={20} weight="bold" /> : <PlusIcon size={20} weight="bold" />}
              {activity ? 'Save' : 'Add activity'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
