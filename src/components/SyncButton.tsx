import type { SyncState } from '../lib/useCalendarSync'
import { fmtTime } from '../lib/dates'

export function SyncButton({ synced, state, onClick }: { synced: boolean; state: SyncState; onClick: () => void }) {
  if (!synced)
    return (
      <button className="btn sync" onClick={onClick} title="Show this week's Apple Calendar events">
        <CalIcon /> Sync with Calendar
      </button>
    )

  const [label, title, cls] =
    state.kind === 'ok'
      ? ['Calendar synced', `Updated at ${fmtTime(state.at.getHours() * 60 + state.at.getMinutes())}. Keeps updating by itself; click to refresh now.`, 'ok']
      : state.kind === 'no-access'
        ? ['Calendar access off', 'Timetable is not allowed to see your calendars. Click for help.', 'warn']
        : state.kind === 'error'
          ? ['Sync problem', state.message, 'warn']
          : ['Syncing…', '', '']

  return (
    <button className={'btn sync ' + cls} onClick={onClick} title={title}>
      {cls === 'ok' ? '✓' : cls === 'warn' ? '⚠' : <CalIcon />} {label}
    </button>
  )
}

function CalIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true" style={{ verticalAlign: '-2px' }}>
      <rect x="1.5" y="2.5" width="13" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.5 6h13M5 1v3M11 1v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
