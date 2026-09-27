import { useEffect, useRef, useState } from 'react'
import type { Template } from '../lib/types'

interface Props {
  templates: Template[]
  weekHasBlocks: boolean
  onSaveTemplate: (name: string) => void
  onApply: (t: Template) => void
  onDeleteTemplate: (id: string) => void
  onCopyLastWeek: () => void
  onClearWeek: () => void
}

export function TemplatesMenu(p: Props) {
  const [open, setOpen] = useState(false)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      // clicks inside a modal opened from this menu shouldn't close it
      const t = e.target as HTMLElement
      if (!ref.current?.contains(t) && !t.closest('.modal-backdrop')) setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])

  const act = (fn: () => void) => () => {
    fn()
    setOpen(false)
  }

  return (
    <div className="menu-wrap" ref={ref}>
      <button className={'btn' + (open ? ' active' : '')} onClick={() => setOpen(!open)}>
        Week templates ▾
      </button>
      {open && (
        <div className="menu">
          <div className="menu-section">Use a template for this week</div>
          {p.templates.length === 0 && <div className="menu-empty">No templates yet. Lay out a typical week, then save it below.</div>}
          {p.templates.map((t) => (
            <div key={t.id} className="menu-row">
              <button className="menu-item grow" onClick={act(() => p.onApply(t))}>
                {t.name} <span className="muted">· {t.blocks.length} blocks</span>
              </button>
              <button className="icon-btn" title="Delete template" onClick={() => p.onDeleteTemplate(t.id)}>✕</button>
            </div>
          ))}

          <div className="menu-sep" />
          {naming ? (
            <form
              className="menu-form"
              onSubmit={(e) => {
                e.preventDefault()
                if (!name.trim()) return
                p.onSaveTemplate(name.trim())
                setName('')
                setNaming(false)
                setOpen(false)
              }}
            >
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name, e.g. Normal week" />
              <button className="btn small primary" disabled={!name.trim()}>Save</button>
            </form>
          ) : (
            <button className="menu-item" disabled={!p.weekHasBlocks} onClick={() => setNaming(true)}>
              ★ Save this week as a template…
            </button>
          )}
          <button className="menu-item" onClick={act(p.onCopyLastWeek)}>⧉ Copy last week into this week</button>
          <button className="menu-item danger" disabled={!p.weekHasBlocks} onClick={act(p.onClearWeek)}>
            Clear this week
          </button>
        </div>
      )}
    </div>
  )
}
