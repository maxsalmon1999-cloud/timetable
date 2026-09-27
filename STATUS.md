# Timetable: development status

> Living document for LLM agents and humans picking up this project. Keep it current.

## What this is

A deliberately **very simple** weekly time-blocking app for macOS, built by Max for his
girlfriend (non-technical user). Priorities in order: simple to understand → simple to use →
features. If a feature adds UI clutter, it probably doesn't belong.

Core ideas:
1. **Week view** (Mon–Sun, 6:00–24:00, 15-min snapping) where she blocks out time for activities.
2. **Activity bank** (sidebar) of reusable activities (name, colour, usual length), dragged onto the week.
3. **Week templates**: save a "regular week" and apply it to upcoming weeks (replace or add).
4. **Apple Calendar integration**: *deferred* until the prototype is solid (see Roadmap).

## Stack

- Frontend: Vite + React 19 + TypeScript, no UI/drag libraries (custom pointer-event drag system).
- Desktop shell: Tauri 2 (`src-tauri/`), bundle id `com.maxsalmon.timetable`, targets `.app` + `.dmg`.
- Persistence: `@tauri-apps/plugin-store` → `timetable.json` in the app data dir
  (`~/Library/Application Support/com.maxsalmon.timetable/`). Falls back to `localStorage`
  (`timetable-data-v1`) when running in a plain browser (`npm run dev`).
- Toolchain on Max's Mac: Node 26, Rust 1.98 (Homebrew), Xcode Command Line Tools only (no full Xcode).
- Repo: GitHub `maxsalmon1999-cloud/timetable` (private).

## Commands

| | |
|---|---|
| `npm run dev` | browser-only dev server on http://localhost:1420 |
| `npm run app:dev` | Tauri window with HMR |
| `npm run app:build` | release `.app` + `.dmg` in `src-tauri/target/release/bundle/{macos,dmg}/` |
| `npx tsc -b` / `npx oxlint` | typecheck / lint |

## Code map

```
src/
  App.tsx                 state wiring, ALL drag logic (bank→grid, move, resize, drag-to-create), templates, undo keys
  lib/types.ts            Activity, Block, Template, TemplateBlock, AppData (version: 1)
  lib/store.ts            useAppData(): load/save + undo/redo history (reducer: past/present/future), seed activities
  lib/storage.ts          loadData/saveData: Tauri store vs localStorage. The only place that knows where data lives
  lib/dates.ts            ISO date helpers, Monday-start weeks, time formatting (24h)
  lib/constants.ts        DAY_START/END, SNAP, HOUR_PX, colour palette, durations, uid()
  lib/layout.ts           side-by-side lanes for overlapping blocks
  components/WeekGrid.tsx grid render + hitTest (pointer → {date, minute}) exposed via ref
  components/Sidebar.tsx  activity bank + usage hints
  components/BlockEditor.tsx / ActivityEditor.tsx  modals
  components/TemplatesMenu.tsx  toolbar dropdown: apply/save/delete templates, copy last week, clear week
  components/Modal.tsx    Modal, Confirm, ColorPicker (no native alert/confirm; unreliable in WKWebView)
src-tauri/                Tauri 2 shell; lib.rs registers store + (debug) log plugins
```

### Data model notes
- `Block` stores its own `title`/`color` (copied from the activity), **not** an activity reference,
  so editing or deleting an activity never changes existing blocks.
- Times are minutes from midnight; dates are local `YYYY-MM-DD` strings.
- `Template.blocks[].day` is 0 = Monday … 6 = Sunday.
- Bump `AppData.version` and add a migration in `storage.ts` if the shape changes.

## Current status (2026-09-27)

**Working prototype, verified in browser (Chromium pane):**
- [x] Week navigation (Today / ‹ ›), today highlight, current-time line
- [x] Drag activity from bank onto grid (uses activity's default length)
- [x] Drag on empty space to create; click empty space for a 1h block → editor
- [x] Move blocks (across days), resize by bottom edge, ⌥-drop to duplicate
- [x] Click block → edit title/colour/times, delete; pick from activity chips; "save to my activities"
- [x] Activity bank CRUD (new / edit / remove)
- [x] Save week as template, apply template (replace/add prompt if week not empty), delete template
- [x] Copy last week, clear week (with confirm)
- [x] Undo/redo (⌘Z / ⇧⌘Z + toolbar buttons), 100 steps
- [x] Persistence (localStorage verified across reloads)
- [x] Light + dark mode (follows macOS)
- [x] Tauri release build (`.app` 10 MB, `.dmg` 3 MB, Apple Silicon), launches, writes `timetable.json` via store plugin
- [ ] Drag/drop feel inside the native WKWebView not yet hand-tested by a human

## Roadmap / ideas (rough priority)

1. Hand-test the native app (drag feel in WKWebView, reopen app → data still there). Get her feedback.
2. Get it onto her Mac: unsigned `.dmg` needs right-click → Open (or `xattr -cr`) the first time.
   Proper fix: Apple Developer ID signing + notarisation (needs a paid Apple developer account).
3. **Apple Calendar (read-only first)**: EventKit via Rust (`objc2-event-kit` crate) behind a Tauri
   command `list_events(start, end)`, rendered as non-editable striped blocks on the grid.
   Needs `NSCalendarsFullAccessUsageDescription` in Info.plist and a permission prompt.
   Later maybe: export/push blocks to a dedicated "Timetable" calendar.
4. Small niceties if she asks: weekly totals per activity, notes on blocks, configurable day start/end,
   12h clock option, keyboard delete of selected block, JSON export/backup.

## Changelog

- **2026-09-27**: Project created. Vite+React+TS frontend with week grid, activity bank, drag & drop,
  templates, undo/redo, persistence abstraction; Tauri 2 shell with store plugin; app icon from `app-icon.svg`
  (`npx tauri icon app-icon.svg` to regenerate). Homebrew Rust upgraded 1.72 → 1.98 for Tauri 2.
