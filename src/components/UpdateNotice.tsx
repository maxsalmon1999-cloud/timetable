import { SparkleIcon } from '@phosphor-icons/react'
import type { UpdateState } from '../lib/useUpdater'

export function UpdateNotice({ state, canRestart, onRestart }: { state: UpdateState; canRestart: boolean; onRestart: () => void }) {
  if (state.kind !== 'installed') return null
  return (
    <div className="update-notice">
      <b><SparkleIcon size={18} weight="bold" /> Timetable has been updated</b>
      <span>Restart to use the new version, or it’ll switch over next time you open it.</span>
      <button className="btn small primary" disabled={!canRestart} onClick={onRestart} title={canRestart ? '' : 'Waiting for your changes to save…'}>
        Restart now
      </button>
    </div>
  )
}
