import { CalendarBlankIcon, CalendarCheckIcon, CalendarPlusIcon, WarningIcon } from '@phosphor-icons/react'
import type { SyncState } from '../lib/useCalendarSync'
import { fmtTime } from '../lib/dates'

export function SyncButton({ synced, state, onClick }: { synced: boolean; state: SyncState; onClick: () => void }) {
  if (!synced)
    return (
      <button className="btn sky" onClick={onClick} title="Show this week's Apple Calendar events">
        <CalendarPlusIcon size={22} weight="bold" />
        <span className="btn-label">Sync with Calendar</span>
      </button>
    )

  if (state.kind === 'no-access' || state.kind === 'error')
    return (
      <button
        className="btn danger"
        onClick={onClick}
        title={state.kind === 'error' ? state.message : 'Timetable isn’t allowed to see your calendars. Click for help.'}
      >
        <WarningIcon size={22} weight="bold" />
        <span className="btn-label">{state.kind === 'error' ? 'Sync problem' : 'Calendar access off'}</span>
      </button>
    )

  if (state.kind === 'ok')
    return (
      <button
        className="btn sky"
        onClick={onClick}
        title={`Updated at ${fmtTime(state.at.getHours() * 60 + state.at.getMinutes())}. Keeps updating by itself; click to refresh now.`}
      >
        <CalendarCheckIcon size={22} weight="bold" />
        <span className="btn-label">Synced</span>
      </button>
    )

  return (
    <button className="btn sky" onClick={onClick} title="Syncing…">
      <CalendarBlankIcon size={22} weight="bold" />
      <span className="btn-label">Syncing…</span>
    </button>
  )
}
