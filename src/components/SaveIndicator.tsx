import type { SaveStatus } from '../lib/store'
import { revealDataFolder } from '../lib/storage'

export function SaveIndicator({ status, folder, onRetry }: { status: SaveStatus; folder: string | null; onRetry: () => void }) {
  if (status.kind === 'error')
    return (
      <div className="save-status error" title={status.message}>
        <div>⚠ Couldn’t save your last change.</div>
        <button className="link" onClick={onRetry}>Try again</button>
      </div>
    )

  return (
    <div className="save-status">
      <span>{status.kind === 'saving' ? 'Saving…' : '✓ All changes saved'}</span>
      {folder && (
        <button className="link" title={folder} onClick={() => revealDataFolder()}>
          Show files
        </button>
      )}
    </div>
  )
}
