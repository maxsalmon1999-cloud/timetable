import { useEffect, type ReactNode } from 'react'
import { XIcon } from '@phosphor-icons/react'
import { PALETTE } from '../lib/icons'

// open modals, newest last: Escape only closes the top one (e.g. icon library over the block editor)
const openModals: symbol[] = []

/** The three little dots in every panel header; lemon headers swap the lemon dot for pink */
export function Dots({ on }: { on?: string }) {
  const middle = on === PALETTE.lemon ? PALETTE.pink : PALETTE.lemon
  return (
    <div className="dots">
      <span style={{ background: PALETTE.coral }} />
      <span style={{ background: middle }} />
      <span style={{ background: PALETTE.mint }} />
    </div>
  )
}

export function Modal({
  title,
  color = PALETTE.pink,
  width,
  onClose,
  children,
}: {
  title: string
  /** header bar colour: the block's colour, or pink */
  color?: string
  width?: number
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const me = Symbol()
    openModals.push(me)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && openModals[openModals.length - 1] === me && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      openModals.splice(openModals.indexOf(me), 1)
    }
  }, [onClose])

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title} style={{ width }}>
        <div className="panel-head" style={{ background: color }}>
          <div className="panel-title">
            <Dots on={color} />
            <h2>{title}</h2>
          </div>
          <button type="button" className="btn square" title="Close" onClick={onClose}>
            <XIcon size={22} weight="bold" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Confirm({
  title,
  message,
  actions,
  cancelLabel = 'Cancel',
  onClose,
}: {
  title: string
  message: string
  cancelLabel?: string
  actions: { label: string; kind?: 'primary' | 'danger'; icon?: ReactNode; run: () => void }[]
  onClose: () => void
}) {
  return (
    <Modal title={title} width={460} onClose={onClose}>
      <div className="modal-body">
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button className={'btn' + (actions.length ? '' : ' primary')} onClick={onClose}>{cancelLabel}</button>
          {actions.map((a) => (
            <button
              key={a.label}
              className={'btn ' + (a.kind ?? '')}
              onClick={() => {
                a.run()
                onClose()
              }}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}
