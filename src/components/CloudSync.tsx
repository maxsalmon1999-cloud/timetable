import { useState, type FormEvent } from 'react'
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
export function CloudButton({ cloud }: { cloud: Cloud }) {
  const [open, setOpen] = useState(false)
  if (cloud.status.kind === 'off') return null
  const s = cloud.status
  return (
    <>
      <button
        className={'save-pill cloud ' + s.kind}
        title={s.kind === 'error' ? s.message : s.kind === 'offline' ? 'Changes are saved here and will sync when you’re back online' : 'Sync your plans across your devices'}
        onClick={() => setOpen(true)}
      >
        <StatusIcon status={s} />
        {LABELS[s.kind]}
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
  const signedIn = cloud.status.kind !== 'signed-out' && cloud.status.kind !== 'starting'

  const act = async (fn: () => Promise<void>, done?: string) => {
    setBusy(true)
    setMessage(null)
    try {
      await fn()
      if (done) setMessage({ text: done })
    } catch (e) {
      setMessage({ text: (e as Error).message, bad: true })
    } finally {
      setBusy(false)
    }
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
              Sign in with the same account on your Mac and your iPad to see the same plans on both. Your plans stay saved on this
              device as well.
            </p>
            <label className="field">
              <span className="label">Email</span>
              <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </label>
            <label className="field">
              <span className="label">Password</span>
              <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            {message && <p className={'sync-message' + (message.bad ? ' bad' : '')}>{message.text}</p>}
            <div className="modal-actions">
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
