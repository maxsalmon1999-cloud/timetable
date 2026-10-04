import { useEffect, useRef, useState } from 'react'
import { CaretDownIcon, CopyIcon, PlusIcon, SquaresFourIcon, StarIcon, TrashIcon, XIcon } from '@phosphor-icons/react'
import type { Template } from '../lib/types'

interface Props {
  templates: Template[]
  weekHasBlocks: boolean
  onSaveTemplate: (name: string) => void
  onApply: (t: Template) => void
  onDeleteTemplate: (id: string) => void
  /** start a template from a blank week */
  onCreate: () => void
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
      <button className={'btn lemon' + (open ? ' active' : '')} title="Week templates" onClick={() => setOpen(!open)}>
        <SquaresFourIcon size={22} weight="bold" />
        <span className="btn-label">Templates</span>
        <CaretDownIcon size={16} weight="bold" />
      </button>
      {open && (
        <div className="menu panel">
          <div className="menu-section">Use a template for this week</div>
          {p.templates.length === 0 && <div className="menu-empty">No templates yet. Create one from a blank week, or save a week you’ve already planned.</div>}
          {p.templates.map((t) => (
            <div key={t.id} className="menu-row">
              <button className="menu-item grow" onClick={act(() => p.onApply(t))}>
                <SquaresFourIcon size={20} weight="bold" />
                <span className="menu-label">{t.name}</span>
                <span className="mono menu-meta">{t.blocks.length} blocks</span>
              </button>
              <button className="menu-x" title="Delete template" onClick={() => p.onDeleteTemplate(t.id)}>
                <XIcon size={18} weight="bold" />
              </button>
            </div>
          ))}

          <div className="menu-sep" />
          <button className="menu-item" onClick={act(p.onCreate)}>
            <PlusIcon size={20} weight="bold" />
            Create a template
          </button>
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
              <button className="btn primary" disabled={!name.trim()}>Save</button>
            </form>
          ) : (
            <button className="menu-item" disabled={!p.weekHasBlocks} onClick={() => setNaming(true)}>
              <StarIcon size={20} weight="bold" />
              Save this week as a template…
            </button>
          )}
          <button className="menu-item" onClick={act(p.onCopyLastWeek)}>
            <CopyIcon size={20} weight="bold" />
            Copy last week into this week
          </button>
          <button className="menu-item danger" disabled={!p.weekHasBlocks} onClick={act(p.onClearWeek)}>
            <TrashIcon size={20} weight="bold" />
            Clear this week
          </button>
        </div>
      )}
    </div>
  )
}
