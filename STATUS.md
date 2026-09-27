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
4. **Apple Calendar integration** (read-only): per-week "Sync with Calendar"; events shown on the grid, clashes highlighted.

## Stack

- Frontend: Vite + React 19 + TypeScript, no UI/drag libraries (custom pointer-event drag system).
- Desktop shell: Tauri 2 (`src-tauri/`), bundle id `com.maxsalmon.timetable`, targets `.app` + `.dmg`.
- Persistence: custom Rust commands in `src-tauri/src/storage.rs` (no store plugin), see "Data safety" below.
  Falls back to `localStorage` (`timetable-data-v1`) when running in a plain browser (`npm run dev`).
- Toolchain on Max's Mac: Node 26, Rust 1.98 (Homebrew), Xcode Command Line Tools only (no full Xcode).
- Repo: GitHub `maxsalmon1999-cloud/timetable` (public; made public 2026-09-27 so releases can serve auto-updates). Never commit secrets or her data.

## Commands

| | |
|---|---|
| `npm run dev` | browser-only dev server on http://localhost:1420 |
| `npm run app:dev` | Tauri window with HMR |
| `npm run app:build` | release `.app` + `.dmg` in `src-tauri/target/release/bundle/{macos,dmg}/` |
| `npm run release [-- patch\|minor\|major\|x.y.z "notes"]` | ship an update to her (see "Releases & auto-update") |
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
  components/SyncButton.tsx     toolbar button next to the week title: Sync / Syncing… / ✓ synced / ⚠ access off
  lib/tauri.ts            isTauri + invoke() shared by storage and calendar
  lib/calendar.ts         CalEvent type, access/fetch wrappers, eventsForDay (split into day/minutes), overlaps(),
                          sampleEvents() used ONLY in the browser (npm run dev) since EventKit needs the native app
  lib/useCalendarSync.ts  live events for the visible week if synced: refresh every 2 min + on window focus
src-tauri/src/storage.rs  load_data / save_data / reveal_data_folder commands (atomic writes, backups, recovery)
src-tauri/src/calendar.rs EventKit via objc2-event-kit: calendar_access_status / calendar_request_access /
                          calendar_events(startMs, endMs) / open_calendar_privacy_settings
src-tauri/Info.plist      merged into the bundle; usage strings for the Documents + Calendars permission prompts
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

### Apple Calendar (read-only)
- EventKit reads whatever Calendar.app on that Mac has (iCloud, Google, Exchange, subscribed). Birthdays calendar skipped.
- Needs "Full Access" (macOS 14+ `requestFullAccessToEventsWithCompletion`, older `requestAccessToEntityType`).
  Denied → modal with "Open System Settings" (Privacy & Security → Calendars).
- `AppData.syncedWeeks` (Monday ISO dates) records which weeks she synced; it's undoable like any change.
  Events themselves are NOT stored: they're re-read live, so additions/moves/deletions in Calendar show up.
- Sync prompt: modal on the *current* week when it has no blocks and isn't synced; "Not now" hides it for the session.
- Conflicts: a block overlapping a timed event gets a red ring + ⚠ (tooltip lists the clashes); the event gets a ring too.
  Both are laid out side by side via layoutLanes. Nothing is blocked or removed.
- All-day events show in an "all-day" row under the day headers; they never count as conflicts.
- Timed events entirely outside 6:00–24:00 aren't shown.
- The bundle is ad-hoc signed (`bundle.macOS.signingIdentity: "-"`) so macOS permissions attach to `com.maxsalmon.timetable`.
  Because it's ad-hoc, each new build may re-ask for Calendar/Documents access.

### Releases & auto-update
- Her app checks `https://github.com/maxsalmon1999-cloud/timetable/releases/latest/download/latest.json` 5 s after
  launch and every 6 h (`src/lib/useUpdater.ts`, production builds only). A newer version is downloaded, signature-checked
  and installed silently; the sidebar then offers "Restart now" (enabled once changes are saved). Ignored → used next launch.
- `npm run release` (scripts/release.mjs): needs clean tree on `main` + `gh` login + key. Bumps version in
  tauri.conf.json/package.json/Cargo.toml, builds, signs the updater tarball, commits "Release vX", tags, pushes, and
  creates a GitHub release with `Timetable.app.tar.gz` (+ `.sig`), `Timetable.dmg`, `latest.json`.
- Fresh install link (always the newest): https://github.com/maxsalmon1999-cloud/timetable/releases/latest/download/Timetable.dmg
- **Updater signing key: `~/.tauri/timetable.key` (no password) on Max's Mac, NEVER in the repo.** Public key is in
  tauri.conf.json. If the private key is lost, her installed app can't accept updates; she'd need one manual reinstall of a
  build with a new key. Max should keep a backup of it (password manager).
- Builds are Apple Silicon only (`darwin-aarch64`); Homebrew Rust has no x86_64 target. An Intel Mac would need rustup +
  a universal build.
- Updates are only ad-hoc signed, so macOS may re-ask for Calendar/Documents access after an update.
- **Every release must read existing data files.** If the data shape changes, bump `AppData.version` and migrate on load;
  never ship something that can't open her current `timetable.json`.
- Verified end-to-end 2026-09-27: a v0.2.0 copy updated itself to v0.2.1 within ~10 s of launch, signature intact.

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
- [x] Apple Calendar: sync button + current-week prompt, live refresh, all-day row, conflict highlighting (UI verified in
      browser with sample events; native EventKit build compiles/signs; real-calendar read awaiting Max clicking Allow)

## Roadmap / ideas (rough priority)

1. Hand-test the native app (drag feel in WKWebView, reopen app → data still there). Get her feedback.
2. Get it onto her Mac: install the latest `Timetable.dmg` (link above); unsigned, so right-click → Open the first time.
   Proper fix: Apple Developer ID signing + notarisation (paid Apple developer account); would also stop permission re-prompts.
3. Calendar follow-ups if she wants them: choose which calendars to show, "stop syncing this week",
   click an event to see details / open it in Calendar.app, optionally write blocks back to a "Timetable" calendar.
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
- **2026-09-27**: Apple Calendar integration (read-only, EventKit): per-week sync button, prompt on blank current week,
  live refresh (2 min + focus), all-day row, conflict highlighting. Bundle now ad-hoc signed with its bundle id.
- **2026-09-27**: Repo made public. Auto-updates via tauri-plugin-updater + GitHub Releases; `npm run release`; version
  shown in sidebar. Released v0.2.0 (first with updater) and v0.2.1 (update test, no changes).
