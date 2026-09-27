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
- Persistence: custom Rust commands in `src-tauri/src/storage.rs` (no store plugin), see "Data safety" below.
  Falls back to `localStorage` (`timetable-data-v1`) when running in a plain browser (`npm run dev`).
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
  lib/storage.ts          loadData/saveData/revealDataFolder: Tauri invoke vs localStorage. Only place that knows where data lives
  components/SaveIndicator.tsx  sidebar footer: "✓ All changes saved" / "Show files" / save error + retry
  lib/dates.ts            ISO date helpers, Monday-start weeks, time formatting (24h)
  lib/constants.ts        DAY_START/END, SNAP, HOUR_PX, colour palette, durations, uid()
  lib/layout.ts           side-by-side lanes for overlapping blocks
  components/WeekGrid.tsx grid render + hitTest (pointer → {date, minute}) exposed via ref
  components/Sidebar.tsx  activity bank + usage hints
  components/BlockEditor.tsx / ActivityEditor.tsx  modals
  components/TemplatesMenu.tsx  toolbar dropdown: apply/save/delete templates, copy last week, clear week
  components/Modal.tsx    Modal, Confirm, ColorPicker (no native alert/confirm; unreliable in WKWebView)
src-tauri/src/storage.rs  load_data / save_data / reveal_data_folder commands (atomic writes, backups, recovery)
src-tauri/Info.plist      merged into the bundle; NSDocumentsFolderUsageDescription for the Documents prompt
```

### Data safety (Max's hard requirement: her planning must never be lost)
- Data folder: `~/Documents/Timetable Plans/` (visible to her; covered by Time Machine and by iCloud if her
  Mac syncs Desktop & Documents, which is the only protection against the Mac itself dying).
  Falls back to the app data dir if Documents is inaccessible. macOS asks once for Documents access.
  NOT named `Timetable`: APFS is case-insensitive and would collide with the `~/Documents/timetable` repo on Max's Mac.
- Every change is saved immediately (no debounce), serialised in `store.ts` so only the latest state is written.
- Writes are atomic: temp file → fsync → rename → fsync dir. A crash mid-save leaves the previous file intact.
- `Backups/timetable-YYYY-MM-DD.json`: rewritten on each save, so it's the latest state of that day; newest 60 kept.
- On load, if `timetable.json` is unreadable it is renamed `timetable-damaged-<stamp>.json` (never overwritten)
  and the newest valid backup is restored; the UI shows a "Restored from backup" notice. Missing file → same.
- If loading throws, the app shows an error screen and **never saves**, so a read failure can't overwrite real data.
- `save_data` refuses payloads without `activities`/`blocks`/`templates` arrays.
- One-off migration: reads the old plugin-store file (`~/Library/Application Support/com.maxsalmon.timetable/timetable.json`,
  shape `{ "data": … }`) if the new folder has nothing.

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
- [x] Persistence: native app tested for migration, corrupt-file recovery, deleted-file recovery, backup pruning (60)
- [x] Save status indicator in sidebar + "Show files" (opens the data folder in Finder)
- [x] Activity lengths: 15m, then 30m steps up to 5h, plus "Custom…" (hours + 0/15/30/45 minutes)
- [x] Light + dark mode (follows macOS)
- [x] Tauri release build (`.app` 10 MB, `.dmg` 3 MB, Apple Silicon), launches, writes `timetable.json` via store plugin
- [ ] Drag/drop feel inside the native WKWebView not yet hand-tested by a human
- [ ] "Restored from backup" notice not yet seen in the native window (logic verified via files)

## Roadmap / ideas (rough priority)

1. Hand-test the native app (drag feel in WKWebView, reopen app → data still there). Get her feedback.
2. Get it onto her Mac: unsigned `.dmg` needs right-click → Open (or `xattr -cr`) the first time.
   Proper fix: Apple Developer ID signing + notarisation (needs a paid Apple developer account).
3. **Apple Calendar (read-only first)**: EventKit via Rust (`objc2-event-kit` crate) behind a Tauri
   command `list_events(start, end)`, rendered as non-editable striped blocks on the grid.
   Needs `NSCalendarsFullAccessUsageDescription` in Info.plist and a permission prompt.
   Later maybe: export/push blocks to a dedicated "Timetable" calendar.
4. Closing mid-save: saves are immediate + atomic, so at worst the very last action is lost on ⌘Q. Could add a
   close-requested handler that awaits the save queue if this ever matters.
5. Small niceties if she asks: weekly totals per activity, notes on blocks, configurable day start/end,
   12h clock option, keyboard delete of selected block, JSON export/backup.

## Changelog

- **2026-09-27**: Project created. Vite+React+TS frontend with week grid, activity bank, drag & drop,
  templates, undo/redo, persistence abstraction; Tauri 2 shell with store plugin; app icon from `app-icon.svg`
  (`npx tauri icon app-icon.svg` to regenerate). Homebrew Rust upgraded 1.72 → 1.98 for Tauri 2.
- **2026-09-27**: Data safety overhaul: replaced tauri-plugin-store with Rust storage commands (atomic writes,
  daily backups ×60, damaged-file recovery, no-save-after-failed-load), data moved to `~/Documents/Timetable Plans/`,
  save indicator + "Show files". Activity length presets now 15m + half-hour steps to 5h + Custom.
