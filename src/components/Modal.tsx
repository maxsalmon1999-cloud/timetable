import { useEffect, type ReactNode } from 'react'

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

export function ColorPicker({ value, onChange, colors }: { value: string; onChange: (c: string) => void; colors: string[] }) {
  return (
    <div className="swatches">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          className={'swatch' + (c === value ? ' selected' : '')}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={`Colour ${c}`}
        />
      ))}
    </div>
  )
}

export function Confirm({
  title,
  message,
  actions,
  onClose,
}: {
  title: string
  message: string
  actions: { label: string; kind?: 'primary' | 'danger'; run: () => void }[]
  onClose: () => void
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted">{message}</p>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        {actions.map((a) => (
          <button
            key={a.label}
            className={'btn ' + (a.kind ?? '')}
            onClick={() => {
              a.run()
              onClose()
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
    </Modal>
  )
}
