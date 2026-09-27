import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type PointerEvent as RPointerEvent } from 'react'
import { useAppData } from './lib/store'
import type { Activity, Block, Template, TemplateBlock } from './lib/types'
import { MAX_END, MIN_START, SNAP, snap, uid } from './lib/constants'
import { addDays, fmtTime, startOfWeek, toISO, weekDates, weekLabel } from './lib/dates'
import { WeekGrid, type HitTest, type Preview } from './components/WeekGrid'
import { Sidebar } from './components/Sidebar'
import { BlockEditor } from './components/BlockEditor'
import { TemplatesMenu } from './components/TemplatesMenu'
import { Confirm } from './components/Modal'
import { revealDataFolder } from './lib/storage'
import { accessStatus, eventsForDay, openPrivacySettings, requestAccess } from './lib/calendar'
import { DEFAULT_TARGETS, visibleRange, type RangeTargets } from './lib/dayRange'
import { PALETTE } from './lib/icons'
import { ActivityIcon } from './components/ActivityIcon'
import { ArrowUUpLeftIcon, ArrowUUpRightIcon, CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'
import { useCalendarSync } from './lib/useCalendarSync'
import { SyncButton } from './components/SyncButton'
import { UpdateNotice } from './components/UpdateNotice'
import { useUpdater } from './lib/useUpdater'

type DragKind =
  | { kind: 'bank'; activity: Activity }
  | { kind: 'move'; block: Block; grab: number }
  | { kind: 'resize'; block: Block }
  | { kind: 'create'; date: string; anchor: number }

type Drag = DragKind & { x0: number; y0: number; x: number; y: number; active: boolean; preview: Preview | null }

type Editing = { block: Block; isNew: boolean }
type Confirming = Omit<ComponentProps<typeof Confirm>, 'onClose'>

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** what a block carries over when copied (to/from activities and templates) */
const look = (x: { title?: string; name?: string; color: string; icon?: string; iconWeight?: Block['iconWeight'] }) => ({
  title: x.title ?? x.name ?? '',
  color: x.color,
  ...(x.icon ? { icon: x.icon } : {}),
  ...(x.iconWeight ? { iconWeight: x.iconWeight } : {}),
})

const NEW_BLOCK_COLOR = PALETTE.sky

export default function App() {
  const { data, update, undo, redo, canUndo, canRedo, status, retrySave, folder, restoredFrom } = useAppData()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [drag, setDrag] = useState<Drag | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [confirming, setConfirming] = useState<Confirming | null>(null)
  const [restoreNoticeSeen, setRestoreNoticeSeen] = useState(false)
  const [syncPromptDismissed, setSyncPromptDismissed] = useState<string | null>(null)
  const hitTestRef = useRef<HitTest | null>(null)
  const dragRef = useRef<Drag | null>(null)
  dragRef.current = drag

  const dates = useMemo(() => weekDates(weekStart), [weekStart])
  const weekBlocks = useMemo(() => (data ? data.blocks.filter((b) => dates.includes(b.date)) : []), [data, dates])
  const weekKey = dates[0]
  const synced = !!data?.syncedWeeks?.includes(weekKey)
  const cal = useCalendarSync(weekStart, synced)
  const updater = useUpdater()

  // ---------- visible hours ----------
  const [targets, setTargets] = useState<RangeTargets & { week: string }>({ ...DEFAULT_TARGETS, week: weekKey })
  const target = targets.week === weekKey ? targets : { ...DEFAULT_TARGETS, week: weekKey } // resets on week change
  const setTarget = (t: Partial<RangeTargets>) => setTargets({ ...target, ...t })
  const dayEvents = useMemo(() => dates.map((d) => eventsForDay(cal.events, d)), [dates, cal.events])
  const range = useMemo(
    () => visibleRange([...weekBlocks, ...dayEvents.flatMap((d) => d.timed)], target, fmtTime),
    [weekBlocks, dayEvents, target.top, target.bottom], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // ---------- Apple Calendar ----------
  const syncWeek = async () => {
    let access = await accessStatus()
    if (access === 'notDetermined') access = (await requestAccess()) ? 'granted' : 'denied'
    if (access !== 'granted') {
      setConfirming({
        title: 'Timetable can’t see your calendars',
        message:
          'To show your Apple Calendar events here, open System Settings → Privacy & Security → Calendars, switch Timetable on (Full Access), then press Sync again.',
        cancelLabel: 'Close',
        actions: [{ label: 'Open System Settings', kind: 'primary', run: openPrivacySettings }],
      })
      return
    }
    if (synced) cal.refresh()
    else update((d) => ({ ...d, syncedWeeks: [...(d.syncedWeeks ?? []), weekKey] }))
  }

  // ---------- data operations ----------
  const saveBlock = (b: Block, addToBank: boolean) =>
    update((d) => ({
      ...d,
      blocks: d.blocks.some((x) => x.id === b.id) ? d.blocks.map((x) => (x.id === b.id ? b : x)) : [...d.blocks, b],
      activities: addToBank
        ? [...d.activities, { id: uid(), name: b.title, color: b.color, duration: b.end - b.start, ...(b.icon ? { icon: b.icon, iconWeight: b.iconWeight } : {}) }]
        : d.activities,
    }))

  const deleteBlock = (id: string) => update((d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== id) }))

  const toTemplateBlocks = (blocks: Block[]): TemplateBlock[] =>
    blocks.map((b) => ({ day: dates.indexOf(b.date), start: b.start, end: b.end, ...look(b) }))

  const placeTemplate = (tbs: TemplateBlock[], replace: boolean) =>
    update((d) => ({
      ...d,
      blocks: [
        ...(replace ? d.blocks.filter((b) => !dates.includes(b.date)) : d.blocks),
        ...tbs.map((tb) => ({ id: uid(), date: dates[tb.day], start: tb.start, end: tb.end, ...look(tb) })),
      ],
    }))

  const applyWithChoice = (tbs: TemplateBlock[], what: string) => {
    if (!tbs.length) {
      setConfirming({ title: 'Nothing to copy', message: `${what} has no blocks.`, actions: [], cancelLabel: 'OK' })
      return
    }
    if (!weekBlocks.length) return placeTemplate(tbs, true)
    setConfirming({
      title: `Use ${what}?`,
      message: 'This week already has some blocks. Replace them, or add to them?',
      actions: [
        { label: 'Add to week', run: () => placeTemplate(tbs, false) },
        { label: 'Replace week', kind: 'primary', run: () => placeTemplate(tbs, true) },
      ],
    })
  }

  const copyLastWeek = () => {
    const prev = weekDates(addDays(weekStart, -7))
    const tbs = data!.blocks
      .filter((b) => prev.includes(b.date))
      .map((b) => ({ day: prev.indexOf(b.date), start: b.start, end: b.end, ...look(b) }))
    applyWithChoice(tbs, 'last week')
  }

  // ---------- dragging ----------
  const beginDrag = (e: RPointerEvent, kind: DragKind) => {
    e.preventDefault()
    setDrag({ ...kind, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, active: false, preview: null })
  }

  const computePreview = useCallback((d: Drag, x: number, y: number): Preview | null => {
    const hit = hitTestRef.current?.(x, y)
    if (!hit) return null
    const m = hit.minute
    switch (d.kind) {
      case 'bank': {
        if (!hit.inside) return null
        const len = d.activity.duration
        const start = clamp(snap(m - Math.min(15, len / 2)), MIN_START, MAX_END - len)
        return { date: hit.date, start, end: Math.min(MAX_END, start + len), ...look(d.activity) }
      }
      case 'move': {
        const len = d.block.end - d.block.start
        const start = clamp(snap(m - d.grab), MIN_START, MAX_END - len)
        return { ...d.block, date: hit.date, start, end: start + len }
      }
      case 'resize':
        return { ...d.block, end: clamp(snap(m), d.block.start + SNAP, MAX_END) }
      case 'create': {
        const a = snap(d.anchor)
        const b = snap(m)
        const start = Math.min(a, b)
        const end = Math.max(a, b, start + SNAP)
        return { date: d.date, start, end, title: '', color: PALETTE.cloud }
      }
    }
  }, [])

  useEffect(() => {
    if (!drag) return

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current!
      const active = d.active || Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 4
      setDrag({ ...d, x: e.clientX, y: e.clientY, active, preview: active ? computePreview(d, e.clientX, e.clientY) : null })
    }

    const onUp = (e: PointerEvent) => {
      const d = dragRef.current!
      setDrag(null)
      const p = d.active ? computePreview(d, e.clientX, e.clientY) : null

      if (!d.active) {
        // a plain click
        if (d.kind === 'move') setEditing({ block: d.block, isNew: false })
        if (d.kind === 'create') {
          const start = clamp(Math.floor(d.anchor / 30) * 30, MIN_START, MAX_END - 60)
          setEditing({ block: { id: uid(), date: d.date, start, end: start + 60, title: '', color: NEW_BLOCK_COLOR }, isNew: true })
        }
        return
      }
      if (!p) return

      switch (d.kind) {
        case 'bank':
          update((x) => ({ ...x, blocks: [...x.blocks, { id: uid(), ...p }] }))
          break
        case 'move':
          if (e.altKey) update((x) => ({ ...x, blocks: [...x.blocks, { ...d.block, id: uid(), date: p.date, start: p.start, end: p.end }] }))
          else if (p.date !== d.block.date || p.start !== d.block.start)
            update((x) => ({ ...x, blocks: x.blocks.map((b) => (b.id === d.block.id ? { ...b, date: p.date, start: p.start, end: p.end } : b)) }))
          break
        case 'resize':
          if (p.end !== d.block.end)
            update((x) => ({ ...x, blocks: x.blocks.map((b) => (b.id === d.block.id ? { ...b, end: p.end } : b)) }))
          break
        case 'create':
          setEditing({ block: { id: uid(), date: p.date, start: p.start, end: p.end, title: '', color: NEW_BLOCK_COLOR }, isNew: true })
          break
      }
    }

    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrag(null)

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKey)
    }
    // re-bind only when a drag starts/ends
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag === null])

  // ---------- keyboard: undo / redo ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  if (status.kind === 'load-failed')
    return (
      <div className="loading" data-tauri-drag-region>
        <div className="load-failed panel">
          <h2>Couldn’t open your saved plans</h2>
          <p>Nothing was changed or deleted. Quit Timetable and open it again. If this keeps happening, your files and daily backups are in Documents › Timetable Plans.</p>
          <p className="mono small">{status.message}</p>
        </div>
      </div>
    )
  if (!data) return <div className="loading" data-tauri-drag-region />

  const isThisWeek = toISO(weekStart) === toISO(startOfWeek(new Date()))
  const showSyncPrompt =
    isThisWeek && !synced && weekBlocks.length === 0 && syncPromptDismissed !== weekKey &&
    !editing && !confirming && !(restoredFrom && !restoreNoticeSeen)
  // while moving/resizing, hide the original so only the preview shows
  const hiddenId = drag?.active && drag.preview && (drag.kind === 'move' || drag.kind === 'resize') ? drag.block.id : null

  return (
    <div className={'app' + (drag?.active ? ' dragging' : '')}>
      {/* the native traffic lights sit on top of this band (overlay title bar) */}
      <div className="titlebar" data-tauri-drag-region />
      <div className="shell">
      <Sidebar
        activities={data.activities}
        onDragStart={(e, activity) => beginDrag(e, { kind: 'bank', activity })}
        onSave={(a) =>
          update((d) => ({
            ...d,
            activities: d.activities.some((x) => x.id === a.id) ? d.activities.map((x) => (x.id === a.id ? a : x)) : [...d.activities, a],
          }))
        }
        onDelete={(id) => update((d) => ({ ...d, activities: d.activities.filter((a) => a.id !== id) }))}
        saveStatus={status}
        folder={folder}
        onRetrySave={retrySave}
        version={updater.version}
      >
        <UpdateNotice state={updater.state} canRestart={status.kind === 'saved'} onRestart={updater.restart} />
      </Sidebar>

      <main className="main">
        <header className="toolbar">
          <div className="nav">
            <button className="btn" disabled={isThisWeek} onClick={() => setWeekStart(startOfWeek(new Date()))}>Today</button>
            <button className="btn square" title="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              <CaretLeftIcon size={22} weight="bold" />
            </button>
            <button className="btn square" title="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              <CaretRightIcon size={22} weight="bold" />
            </button>
            <h2 className="week-label">{weekLabel(weekStart)}</h2>
            <SyncButton synced={synced} state={cal.state} onClick={syncWeek} />
          </div>
          <div className="nav">
            <button className="btn square" title="Undo (⌘Z)" disabled={!canUndo} onClick={undo}>
              <ArrowUUpLeftIcon size={22} weight="bold" />
            </button>
            <button className="btn square" title="Redo (⇧⌘Z)" disabled={!canRedo} onClick={redo}>
              <ArrowUUpRightIcon size={22} weight="bold" />
            </button>
            <TemplatesMenu
              templates={data.templates}
              weekHasBlocks={weekBlocks.length > 0}
              onSaveTemplate={(name) =>
                update((d) => ({ ...d, templates: [...d.templates, { id: uid(), name, blocks: toTemplateBlocks(weekBlocks) }] }))
              }
              onApply={(t: Template) => applyWithChoice(t.blocks, `“${t.name}”`)}
              onDeleteTemplate={(id) => {
                const t = data.templates.find((x) => x.id === id)!
                setConfirming({
                  title: `Delete template “${t.name}”?`,
                  message: 'Weeks you already filled from it won’t change.',
                  actions: [{ label: 'Delete', kind: 'danger', run: () => update((d) => ({ ...d, templates: d.templates.filter((x) => x.id !== id) })) }],
                })
              }}
              onCopyLastWeek={copyLastWeek}
              onClearWeek={() =>
                setConfirming({
                  title: 'Clear this week?',
                  message: `Removes all ${weekBlocks.length} blocks from ${weekLabel(weekStart)}. You can undo with ⌘Z.`,
                  actions: [{ label: 'Clear week', kind: 'danger', run: () => update((d) => ({ ...d, blocks: d.blocks.filter((b) => !dates.includes(b.date)) })) }],
                })
              }
            />
          </div>
        </header>

        <WeekGrid
          dates={dates}
          blocks={weekBlocks}
          preview={drag?.active ? drag.preview : null}
          hiddenId={hiddenId}
          days={dayEvents}
          range={range}
          onEarlier={() => setTarget({ top: range.earlierTo })}
          onHideTop={() => setTarget({ top: DEFAULT_TARGETS.top })}
          onLater={() => setTarget({ bottom: MAX_END })}
          onHideBottom={() => setTarget({ bottom: DEFAULT_TARGETS.bottom })}
          hitTestRef={hitTestRef}
          onEmptyDown={(e, date, minute) => beginDrag(e, { kind: 'create', date, anchor: minute })}
          onBlockDown={(e, block, mode) => {
            const hit = hitTestRef.current?.(e.clientX, e.clientY)
            beginDrag(e, mode === 'move' ? { kind: 'move', block, grab: (hit?.minute ?? block.start) - block.start } : { kind: 'resize', block })
          }}
        />
      </main>
      </div>

      {/* floating chip while dragging an activity outside the grid */}
      {drag?.active && drag.kind === 'bank' && !drag.preview && (
        <div className="drag-chip" style={{ left: drag.x, top: drag.y, ['--c' as string]: drag.activity.color }}>
          <span className="icon-disc small">
            <ActivityIcon name={drag.activity.icon} weight={drag.activity.iconWeight} size={16} fallback={drag.activity.name} />
          </span>
          {drag.activity.name}
        </div>
      )}

      {editing && (
        <BlockEditor
          key={editing.block.id}
          block={editing.block}
          isNew={editing.isNew}
          activities={data.activities}
          clashes={(dayEvents[dates.indexOf(editing.block.date)]?.timed ?? [])}
          onSave={(b, addToBank) => {
            saveBlock(b, addToBank)
            setEditing(null)
          }}
          onDelete={() => {
            deleteBlock(editing.block.id)
            setEditing(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {restoredFrom && !restoreNoticeSeen && (
        <Confirm
          title="Restored from backup"
          message={`Your main save file couldn’t be read, so Timetable opened your most recent backup (${restoredFrom.replace('timetable-', '')}). Nothing else was deleted.`}
          cancelLabel="OK"
          actions={[{ label: 'Show files', run: () => revealDataFolder() }]}
          onClose={() => setRestoreNoticeSeen(true)}
        />
      )}
      {showSyncPrompt && (
        <Confirm
          title="Sync this week with Apple Calendar?"
          message="Bring in this week’s events from your Calendar so you can plan around them. Anything added to your Calendar later in the week will appear here too."
          cancelLabel="Not now"
          actions={[{ label: 'Sync with Calendar', kind: 'primary', run: syncWeek }]}
          onClose={() => setSyncPromptDismissed(weekKey)}
        />
      )}
      {confirming && <Confirm {...confirming} onClose={() => setConfirming(null)} />}
    </div>
  )
}
