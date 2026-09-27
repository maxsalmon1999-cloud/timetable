import { ArrowClockwiseIcon, CheckCircleIcon, WarningCircleIcon } from '@phosphor-icons/react'
import type { SaveStatus } from '../lib/store'
import { revealDataFolder } from '../lib/storage'

export function SaveIndicator({ status, folder, onRetry }: { status: SaveStatus; folder: string | null; onRetry: () => void }) {
  return (
    <div className="save-row">
      {status.kind === 'error' ? (
        <button className="save-pill error" title={status.message} onClick={onRetry}>
          <WarningCircleIcon size={18} weight="bold" />
          Couldn’t save · Retry
        </button>
      ) : status.kind === 'saving' ? (
        <span className="save-pill saving">
          <ArrowClockwiseIcon size={18} weight="bold" />
          Saving…
        </span>
      ) : (
        <span className="save-pill">
          <CheckCircleIcon size={18} weight="bold" />
          All saved
        </span>
      )}
      {folder && (
        <button className="link" title={folder} onClick={() => revealDataFolder()}>
          Show files
        </button>
      )}
    </div>
  )
}
