import { useEffect, useState, type FormEvent } from 'react'
import { ArrowsClockwiseIcon, CloudCheckIcon, CloudSlashIcon, CloudArrowUpIcon, CloudIcon, CloudWarningIcon } from '@phosphor-icons/react'
import type { CloudStatus, useCloudSync } from '../lib/useCloudSync'
import { Modal } from './Modal'
import { PALETTE } from '../lib/icons'

type Cloud = ReturnType<typeof useCloudSync>

const LABELS: Record<Exclude<CloudStatus['kind'], 'off'>, string> = {
  starting: 'Sync',
  'signed-out': 'Sync devices',
  connecting: 'Connecting…',
  offline: 'Offline',
  syncing: 'Syncing…',
  synced: 'Synced',
  error: 'Sync problem',
}

function StatusIcon({ status }: { status: CloudStatus }) {
  const p = { size: 18, weight: 'bold' as const }
  switch (status.kind) {
    case 'synced':
      return <CloudCheckIcon {...p} />
    case 'syncing':
      return <CloudArrowUpIcon {...p} />
    case 'connecting':
      return <ArrowsClockwiseIcon {...p} />
    case 'offline':
      return <CloudSlashIcon {...p} />
    case 'error':
      return <CloudWarningIcon {...p} />
    default:
      return <CloudIcon {...p} />
  }
}

/** The sync pill in the sidebar; opens the sign-in / account window. Hidden when sync isn't set up. */
/** `compact` (iPhone): just the status icon once she's signed in, to leave room in the strip */
export function CloudButton({ cloud, compact }: { cloud: Cloud; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  if (cloud.status.kind === 'off') return null
  const s = cloud.status
  return (
    <>
      <button
        className={'save-pill cloud ' + s.kind + (compact && s.kind !== 'signed-out' ? ' icon-only' : '')}
        aria-label={LABELS[s.kind as keyof typeof LABELS]}
        title={s.kind === 'error' ? s.message : s.kind === 'offline' ? 'Changes are saved here and will sync when you’re back online' : 'Sync your plans across your devices'}
        onClick={() => setOpen(true)}
      >
        <StatusIcon status={s} />
        {compact ? (s.kind === 'signed-out' ? 'Sync' : null) : LABELS[s.kind]}
      </button>
      {open && <SyncModal cloud={cloud} onClose={() => setOpen(false)} />}
    </>
  )
}

function SyncModal({ cloud, onClose }: { cloud: Cloud; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null)
  /** her password hint: shown after a wrong password or on "Show hint" (signed out), edited when signed in */
  const [hint, setHintText] = useState<string | null>(null)
  const [hintDraft, setHintDraft] = useState('')
  const signedIn = cloud.status.kind !== 'signed-out' && cloud.status.kind !== 'starting'

  useEffect(() => {
    if (!signedIn || !cloud.email) return
    let alive = true
    cloud.getHint(cloud.email).then((h) => alive && setHintDraft(h ?? ''))
    return () => {
      alive = false
    }
  }, [signedIn, cloud.email]) // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn: () => Promise<void>, done?: string) => {
    setBusy(true)
    setMessage(null)
    try {
      await fn()
      if (done) setMessage({ text: done })
    } catch (e) {
      setMessage({ text: (e as Error).message, bad: true })
      // a wrong password: offer her hint straight away
      const code = ((e as Error).cause as { code?: string } | undefined)?.code
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') showHint()
    } finally {
      setBusy(false)
    }
  }

  const showHint = async () => {
    const h = await cloud.getHint(email)
    setHintText(h ?? '')
  }

  const submit = (e: FormEvent, create = false) => {
    e.preventDefault()
    act(() => (create ? cloud.signUp(email, password) : cloud.signIn(email, password)))
  }

  return (
    <Modal title="Sync across devices" color={PALETTE.sky} width={460} onClose={onClose}>
      <div className="modal-body">
        {signedIn ? (
          <>
            <p className="modal-message">
              Signed in as <b>{cloud.email}</b>. Your plans, templates and to-dos stay the same on every device signed in to this
              account, and they’re still saved on this device too.
            </p>
            <p className={'sync-state ' + cloud.status.kind}>
              <StatusIcon status={cloud.status} />
              {cloud.status.kind === 'error'
                ? cloud.status.message
                : cloud.status.kind === 'offline'
                  ? 'Offline. Changes are saved here and sync when you’re back online.'
                  : cloud.status.kind === 'synced'
                    ? 'Everything is synced.'
                    : LABELS[cloud.status.kind as keyof typeof LABELS]}
            </p>
            <form
              className="field"
              onSubmit={(e) => {
                e.preventDefault()
                act(() => cloud.setHint(hintDraft), hintDraft.trim() ? 'Hint saved.' : 'Hint removed.')
              }}
            >
              <span className="label">Password hint</span>
              <div className="hint-row">
                <input value={hintDraft} maxLength={120} placeholder="A clue only you'd get, e.g. first pet + year" onChange={(e) => setHintDraft(e.target.value)} />
                <button type="submit" className="btn small" disabled={busy}>
                  Save
                </button>
              </div>
              <span className="check-hint">Shown on the sign-in screen to anyone who types your email, so make it a clue, never the password.</span>
            </form>
            {message && <p className={'sync-message' + (message.bad ? ' bad' : '')}>{message.text}</p>}
            <div className="modal-actions">
              <button className="btn" disabled={busy} onClick={() => act(cloud.signOut)}>
                Sign out
              </button>
              <button className="btn primary" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={(e) => submit(e)} className="sync-form">
            <p className="modal-message">
              Sign in with the same account on your Mac, iPad and iPhone to see the same plans on all of them. Your plans stay
              saved on this device as well.
            </p>
            <label className="field">
              <span className="label">Email</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setHintText(null)
                }}
                autoFocus
              />
            </label>
            <label className="field">
              <span className="label">Password</span>
              <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            {message && <p className={'sync-message' + (message.bad ? ' bad' : '')}>{message.text}</p>}
            {hint !== null && (
              <p className="sync-hint">{hint ? <>Your hint: <b>{hint}</b></> : 'There’s no hint saved for this email.'}</p>
            )}
            <div className="modal-actions">
              <button type="button" className="link" disabled={busy || !email.trim()} onClick={showHint}>
                Show hint
              </button>
              <button
                type="button"
                className="link left"
                disabled={busy || !email.trim()}
                onClick={() => act(() => cloud.sendReset(email), 'We’ve emailed you a link to choose a new password.')}
              >
                Forgot password?
              </button>
              <button type="button" className="btn" disabled={busy || !email.trim() || !password} onClick={(e) => submit(e, true)}>
                Create account
              </button>
              <button type="submit" className="btn primary" disabled={busy || !email.trim() || !password}>
                Sign in
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  )
}
