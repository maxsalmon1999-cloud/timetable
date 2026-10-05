# Timetable: development status

> Living document for LLM agents and humans picking up this project. Keep it current.

## What this is

A deliberately **very simple** weekly time-blocking app for macOS, built by Max for his
girlfriend (non-technical user). Priorities in order: simple to understand → simple to use →
features. If a feature adds UI clutter, it probably doesn't belong.

Core ideas:
1. **Week view** (Mon–Sun, 15-min snapping) that always fits the window with no scrolling: 9:00–22:00 by default,
   widening automatically for earlier/later items, plus "+ Earlier" / "+ Later" rows.
2. **Activity bank** (sidebar) of reusable activities (name, colour, usual length), dragged onto the week.
3. **Week templates**: save a "regular week" and apply it to upcoming weeks (replace or add), or build one from a
   blank week ("Create a template").
4. **Apple Calendar integration** (read-only): per-week "Sync with Calendar"; events shown on the grid, clashes highlighted.

## Stack

- Frontend: Vite + React 19 + TypeScript, no UI/drag libraries (custom pointer-event drag system).
- Desktop shell: Tauri 2 (`src-tauri/`), bundle id `com.maxsalmon.timetable`, targets `.app` + `.dmg`.
- Persistence: custom Rust commands in `src-tauri/src/storage.rs` (no store plugin), see "Data safety" below.
  Falls back to `localStorage` (`timetable-data-v1`) when running in a plain browser (`npm run dev`).
- Toolchain on Max's Mac (Apple Silicon): Node 26, Rust 1.98 (Homebrew `rust` for dev; Homebrew `rustup` stable with
  x86_64 + aarch64 targets for universal release builds), Xcode Command Line Tools only (no full Xcode).
- Repo: GitHub `maxsalmon1999-cloud/timetable` (public; made public 2026-09-27 so releases can serve auto-updates). Never commit secrets or her data.

## Commands

| | |
|---|---|
| `npm run dev` | browser-only dev server on http://localhost:1420 |
| `npm run app:dev` | Tauri window with HMR |
| `npm run app:build` | release `.app` + `.dmg` in `src-tauri/target/release/bundle/{macos,dmg}/` |
| `npm run release [-- patch\|minor\|major\|x.y.z "notes"]` | ship an update to her (see "Releases & auto-update") |
| GitHub → Actions → **Release** → Run workflow | the same release, built on GitHub's Mac (no Max's Mac needed) |
| `npx tsc -b` / `npx oxlint` | typecheck / lint |

## Code map

```
src/
  App.tsx                 state wiring, ALL drag logic (bank→grid, move, resize, drag-to-create), templates, undo keys
  lib/types.ts            Activity, Block, Template, TemplateBlock (all with optional icon/iconWeight), AppData (version: 2)
  lib/store.ts            useAppData(): load (→ migrate) / save + undo/redo history (reducer: past/present/future), student seed
  lib/migrate.ts          migrate(raw): bring any older saved file up to date (v1→v2 colours, v2→v3 icons). MUST open every old file
  lib/icons.ts            from the design handoff: BASE_ICONS (12), ICON_CATEGORIES, searchIcons, PALETTE, COLOR_MIGRATION,
                          SEED_ACTIVITIES, DAY range constants, guessIcon(name) (ordered regexes), discIcon()
  lib/iconMap.ts          GENERATED explicit name→Phosphor component map (tree-shaking); regenerate if icons.ts lists change.
                          Dev builds throw if any category/guess icon is missing from it
  lib/dayRange.ts         visibleRange(items, targets): which hours the grid shows + the Earlier/Later/auto-note state
  lib/storage.ts          loadData/saveData/revealDataFolder: Tauri invoke vs localStorage. Only place that knows where data lives
  components/SaveIndicator.tsx  sidebar footer: "✓ All changes saved" / "Show files" / save error + retry
  lib/dates.ts            ISO date helpers, Monday-start weeks, time formatting (24h)
  lib/constants.ts        MIN_START/MAX_END (1:00–23:30, where anything can be placed), DEFAULT_START/END, SNAP, COLORS, DURATIONS, uid()
  lib/layout.ts           side-by-side lanes for overlapping blocks
  components/WeekGrid.tsx fit-to-height grid (pxPerMin = measured body height ÷ visible minutes), expand rows, blocks/events,
                          clash rings, hitTest (pointer → {date, minute}) exposed via ref
  components/HoverCard.tsx      details card beside a hovered block / calendar event / all-day event (portal, fixed,
                                pointer-events none). Hover state + lookup live in WeekGrid (useHover, HoverDetails)
  components/TodoMenu.tsx       toolbar To-do button + the to-do pad that pops out under it (per-week, Mon–Sun tabs)
  components/ActivityIcon.tsx   renders an icon by name (or first-letter fallback in discs)
  components/IconLibrary.tsx    search + category pills + icon grid (activity editor, block editor "More icons…")
  components/Sidebar.tsx  activity bank + usage hints + save pill + version
  components/BlockEditor.tsx    chips, colour, 12 quick icons + "More icons…", times (full 1:00–23:30), clash banner
  components/ActivityEditor.tsx two-column: details/icon style/preview + IconLibrary
  components/TemplatesMenu.tsx  toolbar dropdown: apply/save/delete templates, copy last week, clear week
  components/Modal.tsx    Modal (coloured header bar, Escape closes only the top one), Confirm, ColorPicker, Dots
                          (no native alert/confirm; unreliable in WKWebView)
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
  Per event: title, calendar name + colour, start/end, all-day, location, notes (the last two only feed the hover card).
- Needs "Full Access" (macOS 14+ `requestFullAccessToEventsWithCompletion`, older `requestAccessToEntityType`).
  Denied → modal with "Open System Settings" (Privacy & Security → Calendars).
- `AppData.syncedWeeks` (Monday ISO dates) records which weeks she synced; it's undoable like any change.
  Events themselves are NOT stored: they're re-read live, so additions/moves/deletions in Calendar show up.
- Sync prompt: modal on the *current* week when it has no blocks and isn't synced; "Not now" hides it for the session.
- Conflicts: a block overlapping a timed event gets a red ring + ⚠ (tooltip lists the clashes); the event gets a ring too.
  Both are laid out side by side via layoutLanes. Nothing is blocked or removed.
- All-day events show in an "all-day" row under the day headers; they never count as conflicts.
- Timed events entirely outside 1:00–23:30 aren't shown; others widen the visible day like blocks do.
- The bundle is ad-hoc signed (`bundle.macOS.signingIdentity: "-"`) so macOS permissions attach to `com.maxsalmon.timetable`.
- **The bundle uses the hardened runtime, so `src-tauri/Entitlements.plist` must keep
  `com.apple.security.personal-information.calendars`.** Without it macOS silently denies calendar access: no prompt,
  and the app never appears under Privacy & Security → Calendars (bug found 2026-09-27).
  Because it's ad-hoc, each new build may re-ask for Calendar/Documents access.

### Releases & auto-update
- Her app checks `https://github.com/maxsalmon1999-cloud/timetable/releases/latest/download/latest.json` 5 s after
  launch and every 6 h (`src/lib/useUpdater.ts`, production builds only). A newer version is downloaded, signature-checked
  and installed silently; the sidebar then offers "Restart now" (enabled once changes are saved). Ignored → used next launch.
- `npm run release` (scripts/release.mjs): needs clean tree on `main` + `gh` login + key. Bumps version in
  tauri.conf.json/package.json/Cargo.toml, builds, signs the updater tarball, commits "Release vX", tags, pushes, and
  creates a GitHub release with `Timetable.app.tar.gz` (+ `.sig`), `Timetable.dmg`, `latest.json`.
- **Remote releases** (2026-09-28): `.github/workflows/release.yml` runs the same `scripts/release.mjs` on a `macos-latest`
  runner (workflow_dispatch; inputs `bump`, `notes`). Needs repo secret `TAURI_SIGNING_PRIVATE_KEY` = contents of
  `~/.tauri/timetable.key` (Max adds it; agents never handle the key). The "Release vX" commit + tag are pushed to `main` by
  github-actions[bot], so pull before working locally. Agents can trigger it via the GitHub API from any session.
  Trade-off accepted by Max: the key also lives in GitHub's secret store, so his GitHub login (with 2FA) guards updates.
- **Signing and notarisation** (2026-10-04): Max has an Apple Developer account (Individual, Team ID `DR6GPTU9UX`).
  `tauri.conf.json` signs with "Developer ID Application: Max Salmon (DR6GPTU9UX)" (hardened runtime + Entitlements.plist),
  replacing ad-hoc `-`. Notarisation runs when `APPLE_ID` + `APPLE_PASSWORD` (app-specific) + `APPLE_TEAM_ID` are set;
  `release.mjs` refuses to release without them and without the certificate (keychain locally, or `APPLE_CERTIFICATE`
  base64 .p12 + `APPLE_CERTIFICATE_PASSWORD` on GitHub, which Tauri imports into a temporary keychain). Repo secrets:
  `APPLE_TEAM_ID` set; Max sets the other four himself with `bash scripts/setup-apple-secrets.sh` (agents may not write them). Plain `npm run app:build` on Max's Mac
  now signs with the Developer ID too (verified: Authority = Developer ID, timestamped, `codesign --verify` passes;
  Gatekeeper says "Unnotarized" until notarised). Why: ad-hoc builds change identity every release, so macOS forgot her
  Calendar/Documents permission after each update, and fresh installs needed "Open Anyway". The first Developer ID update
  will ask her for permissions once more; after that they should stick.
- Fresh install link (always the newest): https://github.com/maxsalmon1999-cloud/timetable/releases/latest/download/Timetable.dmg
- **Updater signing key: `~/.tauri/timetable.key` (no password) on Max's Mac, NEVER in the repo.** Public key is in
  tauri.conf.json. If the private key is lost, her installed app can't accept updates; she'd need one manual reinstall of a
  build with a new key. Max should keep a backup of it (password manager).
- **Her Mac is Intel.** Releases are universal builds (`--target universal-apple-darwin`, x86_64 + arm64), listed in
  latest.json under both `darwin-x86_64` and `darwin-aarch64`. This needs rustup (`brew install rustup`, keg-only at
  `/opt/homebrew/opt/rustup/bin`, deliberately not on PATH) with both targets; release.mjs prepends it to PATH itself.
  Everyday `npm run app:dev/app:build` still use Homebrew `rust` and build for the host only.
- Updates are only ad-hoc signed, so macOS may re-ask for Calendar/Documents access after an update.
- **Every release must read existing data files.** If the data shape changes, bump `AppData.version` and migrate on load;
  never ship something that can't open her current `timetable.json`.
- Verified end-to-end 2026-09-27: a v0.2.0 copy updated itself to v0.2.1 within ~10 s of launch, signature intact.

### Creating a template from scratch
- Week templates ▾ → "Create a template" sets `AppData.templateDraft = { blocks: [] }`. While it exists the app is in
  template mode: grid shows a blank Mon–Sun (weekday names only, no today/now line, no calendar events), toolbar becomes
  name field + Undo/Redo + Cancel + Save template (needs a name and ≥1 block).
- Draft blocks use placeholder dates `TEMPLATE_DATES` (week of Mon 1 Jan 2001, lib/dates.ts); every block edit goes
  through `withBlocks()` in App.tsx, which targets the draft when present, else `blocks`.
- The draft is part of saved data, so it's undoable and survives a crash/restart (app reopens in template mode).
  The name is UI state only (blank after restart). Save → `templates` gets it, draft removed. Cancel with blocks → confirm.

### Hover card (2026-09-28)
- Resting the mouse on a block, calendar event or all-day event for 350 ms shows a card: full title (wrapped), day +
  time range + length, clashes by name and time; calendar events add location, notes (clamped 3/6 lines) and the calendar.
  Replaced the native `title` tooltips. Template mode shows the weekday only ("Wednesday").
- Placed beside the item's day column (right, or left when there's no room), level with the item's top, kept in the window.
  Anchored to the column rather than the item so it doesn't cover a clashing neighbour in the next lane.
- Goes the moment the mouse leaves; sliding straight to another item swaps it instantly (300 ms grace). Never shows while
  a button is held (drags), hides on any pointer-down in the grid, key press, window blur or resize.
- Content is looked up live by id (`HoverDetails`), so an undo that removes the item removes the card.

### To-do pad (2026-10-04)
- Toolbar **To-do** button (mint, last on the right; badge = unticked items in the week on screen) pops out a 340px card
  under it, like the Templates menu: floats over the grid, closes on ×, Escape (unless editing a line) or a click outside.
  **Stays open on Today / ‹ ›** (`.week-nav` buttons are excluded from click-outside) so she can flick through weeks.
- **Per week**: `AppData.todos?: Record<mondayISO, Todo[][]>` (7 lists, 0 = Monday, `{id, text, done}`). Past weeks keep
  their lists; a week's key is removed when all its lists are empty. Optional field, no version bump. migrate.ts files
  the unreleased week-less shape (`Todo[][]`) under the current week. Every add/tick/edit/remove/clear = one undo step.
- Header shows the week's dates. Tabs show weekday + date (today lemon, selected grape, coral count of unticked).
  Opens on today in the current week, Monday in other weeks (`TodoPad` keyed by week). Click text to edit inline
  (Enter/blur saves, Escape cancels, emptying it removes). "Clear N ticked" removes ticked items for that day.
- **Pulled-in items**: each day lists that day's blocks + timed calendar events that *start* that day (no all-day, no
  continuation of last night's event), sorted by start, above her own to-dos (dashed divider). Shown with start time +
  a chip (block colour + icon; calendar events striped with CalendarBlank). Derived live in App (`scheduled`), never
  copied, so moving/renaming/deleting a block updates the list. Tickable, not editable/removable. Ticks live in
  `AppData.todoTicks?: Record<mondayISO, id[]>` (block id or calendar per-day id; stale ids are harmless). Calendar
  events only appear in synced weeks. Counts/badges include unticked pulled-in items; "Clear ticked" only clears her own.
- **Tick rewards** (2026-10-04, from `design_handoff_timetable_redesign/handoff/HANDOFF.md` + `Todo Rewards.dc.html`,
  effect "2c Glint"): 28px checkbox that lifts, sinks while held (leave before release cancels), springs on tick with a
  mint fill, self-drawing check, ring, row flash, drawn strike-through, a light sweep + 2 stars, and a rising note per
  tick (pentatonic ladder). Progress meter (one cell per item, "3 of 7"); finishing a day holds the full meter 240ms,
  then a lemon "Sunday’s done." banner stamps in with confetti + arpeggio. Zero counts show a mint ✓ (tab + toolbar
  badges), counts bump on change. Added rows drop in (lemon flash, blip); "Clear ticked" sweeps rows out one by one.
  Unticking stays quiet. Timetable rows: whole row is the tick target; her own rows: the box.
  Sound on/off: speaker button in the pad header (localStorage `timetable-todo-sound`). No intensity setting (Playful).
  `prefers-reduced-motion`: keeps colour/fill/strike/sound, skips glint, stars, confetti, ring, spring, bumps.
  Code: `lib/rewards.ts` (Web Audio + Web Animations one-shots; row effects are drawn inside the row so they move with
  it), CSS transitions for state (`.todo-box.on`, `.strike`). Browser-verified (frames inspected by pausing animations);
  sound not checked by ear.
- Only in the normal toolbar (not while building a template).
- Toolbar fit: "Week templates" label shortened to "Templates"; `.main` container ≤1140px hides the Templates + To-do
  labels, ≤980px hides all action labels. Checked no toolbar overflow for main widths 800–1240 with the worst-case title.
- Browser-verified at 1440×900 and 1100×680 (per-week lists, nav keeps it open, old-shape migration, pulled-in blocks +
  sample events, ticks saved per week). Released in v0.4.0.

### Data model notes
- `Block` stores its own `title`/`color` (copied from the activity), **not** an activity reference,
  so editing or deleting an activity never changes existing blocks.
- Times are minutes from midnight; dates are local `YYYY-MM-DD` strings.
- `Template.blocks[].day` is 0 = Monday … 6 = Sunday.
- Bump `AppData.version` and add a step in `lib/migrate.ts` if the shape changes (runs on every load, before anything saves).
- Colours are stored as hex; v2 uses the pastel PALETTE. Unknown colours are kept as-is.
- Icons (v3): missing icons are filled on load (activities: guessIcon(name); blocks: the same-named activity's icon, else
  guessIcon(title)). Set icons are never overwritten. Discs/chips show `discIcon()` = icon ?? guess ?? star (no letters).
- **Changing an activity's icon/style updates its blocks** (weeks, templates, draft) whose title matches the activity's
  old or new name (trimmed, case-insensitive) and whose icon is empty or still the activity's old icon. Blocks she gave a
  different icon by hand keep it. Same update → one undo step (`saveActivity()` in App.tsx).
- Editors suggest an icon from the name as she types (guessIcon) until she picks one (tile, library or activity chip).

### Design system (2026-09-27 redesign, "pastel neo-brutalist")
- Source of truth: `design_handoff_timetable_redesign/` (README.md = spec with exact values; `Timetable Brand Kit.dc.html`
  = mockup, view it via the dev server at /design_handoff_timetable_redesign/Timetable%20Brand%20Kit.dc.html). Lint ignores it.
- **FIXES.md in the handoff folder overrides README.md where they disagree** (all 5 fixes done 2026-09-27).
- Tokens live in `src/index.css :root`: ink/paper/canvas, grape (primary) / coral (danger) / mint / sky (calendar) /
  lemon (today, templates); borders 2.5px (2px blocks); radii 12/18/10; solid ink offset shadows, never blurred.
  Hover lifts 1px, press sinks 2px, disabled = dashed + 50%. Light mode only (dark mode dropped for now).
- Fonts bundled from npm (@fontsource-variable/bricolage-grotesque opsz, @fontsource/dm-mono 400/500): works offline.
  Times/durations use DM Mono (`.mono`).
- Icons: @phosphor-icons/react, `<Name>Icon` exports, weight bold for UI. Activity icons may be bold/fill/duotone.
- Window: Tauri `titleBarStyle: Overlay` + `hiddenTitle`, `trafficLightPosition {x:34,y:30}` puts the real window buttons in
  the pink sidebar header (a 52×14 `.traffic-light-space` replaces the decorative dots there in Tauri; browser keeps dots).
  No top band. `data-tauri-drag-region` on the sidebar header and toolbar (+ their non-button children); needs
  `core:window:allow-start-dragging`. Min window 1100×680; below ~880px of main width the toolbar goes icon-only.
- Blocks/events: four tiers by box height H = minutes·pxPerMin − 3 (WeekGrid `tierFor`): tiny <24 (icon+title, no time),
  short 24–43 (one line + start time unless sharing a lane), medium 44–71 (two lines, inline icon), tall ≥72 (two lines +
  24px icon bottom-right; inline icon if sharing a lane). One-line tiers are vertically centred. A clash warning replaces
  the inline icon. Tiny content shrinks to the box and hides below 9px (30m at 1100×680); the hover card always has it. At her ~1450×820 window 1h ≈ 41px (short), 30m tiny,
  1½h medium, 2h+ tall. A browser check found no text touching a border at 1450×820, 1440×900, 1100×680.

## Current status (2026-09-28)

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
- [x] FIXES.md (2026-09-27): block height tiers, icons everywhere (guess + v3 migration + follow-through + suggestions),
      segmented control, native traffic lights in the sidebar header, icon library opens on the icon's category.
      Browser-verified at 3 sizes; migration verified on a real v1 copy, a crafted v2 file, and the real dev file on disk.
      **Traffic-light position not yet eyeballed in the native window** (tune trafficLightPosition if off).
- [x] "Create a template" from a blank week (browser-tested: build, save, apply, restart with draft, discard)
- [x] 2026-09-27 redesign implemented per handoff: tokens, fonts, Phosphor icons, fit-to-height grid with
      Earlier/Later + auto-widen note, icon library, data v2 migration (verified on a real v1 file on disk), new app icon,
      overlay title bar. Verified in browser at 1440×900 and 1100×680; drag/move/resize/create, templates (icons carried),
      undo re-tested. **Not yet eyeballed in the native window** (overlay title bar / traffic lights / window dragging).
- [x] Tauri release build (`.app` 10 MB, `.dmg` 3 MB, Apple Silicon), launches, writes `timetable.json` via store plugin
- [ ] Drag/drop feel inside the native WKWebView not yet hand-tested by a human
- [ ] "Restored from backup" notice not yet seen in the native window (logic verified via files)
- [x] Hover card on blocks/events (browser-verified at 1450×820 and 1100×680: delay, instant swap, hide on leave/press/drag,
      Sunday flips left, template weekday). Calendar location/notes: Rust type-checked for aarch64-apple-darwin, **not yet
      seen with real EventKit data**. Released in v0.3.1.
- [x] Apple Calendar: sync button + current-week prompt, live refresh, all-day row, conflict highlighting (UI verified in
      browser with sample events; native EventKit build compiles/signs; real-calendar read awaiting Max clicking Allow)

## Roadmap / ideas (rough priority)

1. Hand-test the native app (drag feel in WKWebView, reopen app → data still there). Get her feedback.
2. Get it onto her Mac: install the latest `Timetable.dmg` (link above); unsigned, so right-click → Open the first time.
   Proper fix: Apple Developer ID signing + notarisation (paid Apple developer account); would also stop permission re-prompts.
3. Calendar follow-ups if she wants them: choose which calendars to show, "stop syncing this week",
   open an event in Calendar.app (details now show on hover), optionally write blocks back to a "Timetable" calendar.
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
- **2026-09-27**: Her Mac is Intel → releases are now universal (Intel + Apple Silicon) via rustup; v0.2.2.
- **2026-09-27**: Big UI redesign from `design_handoff_timetable_redesign/`: pastel neo-brutalist look, Bricolage Grotesque +
  DM Mono, Phosphor icons, activity icons + searchable icon library, student starter activities, fit-to-height 9:00–22:00
  day that auto-widens (+ Earlier / + Later), data v2 (pastel colours, icon fields) with v1 migration, new app icon,
  overlay title bar.
- **2026-09-27**: "Create a template" builds a template on a blank week (`templateDraft`).
- **2026-09-27**: Fix: Calendar sync never prompted for access (hardened runtime without the calendars entitlement).
  Added `src-tauri/Entitlements.plist`.
- **2026-09-27**: FIXES.md round: 4-tier block layout, activity icons guessed from names (data v3 migration, follow-through
  on icon edits, live suggestions, no letter discs), Duotone segment fix, real traffic lights in the sidebar header (no top
  band), icon library opens on the current icon's category. Handoff folder replaced by the updated one.
- **2026-09-27**: **Released v0.3.0** (universal): redesign, icons, create-a-template, FIXES.md round, calendar entitlement fix.
  Installed copies auto-update; fresh installs via the Timetable.dmg link.
- **2026-09-28**: Hover card: resting the mouse on any block or calendar event shows its full title, day, times, length and
  clashes; calendar events also show location, notes and calendar (EventKit now reads location + notes). Replaces the
  native tooltips.
- **2026-09-28**: Releases can run remotely: GitHub Actions workflow "Release" builds, signs and publishes on GitHub's Mac.
  `release.mjs` now also takes the key from `TAURI_SIGNING_PRIVATE_KEY` and finds rustup on PATH.
- **2026-10-04**: **Released v0.3.1** (hover card), the first release built by the GitHub Actions workflow. Repo secret
  `TAURI_SIGNING_PRIVATE_KEY` set from `~/.tauri/timetable.key`. Checked: universal, calendar entitlement, latest.json has both platforms.
- **2026-10-04**: Known issue: her calendar sync worked, then broke (likely after an auto-update). Max fixed it on her Mac by hand.
  Cause is probably ad-hoc signing: each build has a new code hash, so macOS's saved Calendar permission stops matching.
  Expect it to recur on updates until Developer ID signing + notarisation (Max is setting up an Apple Developer account).
- **2026-10-04**: Week title shows only the month ("September", "September – October"); the day header already has the dates.
  `monthLabel` in dates.ts; `weekLabel` (full dates) is still used in the clear-week confirm. Released in v0.4.0.
- **2026-10-04**: To-do pad: toolbar To-do button pops out a Mon–Sun tabbed checklist for the week on screen; past weeks
  keep theirs. Released in v0.4.0.
- **2026-10-04**: To-do pad pulls in each day's timetable blocks and calendar events (with start times), tickable. Released in v0.4.0.
- **2026-10-04**: **Released v0.4.0** (GitHub Actions): to-do pad (per week, pulls in blocks + calendar events), month-only title.
- **2026-10-04**: To-do tick rewards (handoff in `design_handoff_timetable_redesign/handoff/`): springy checkbox, glint +
  stars, note ladder, progress meter, day-done banner + confetti, ✓ zero badges, add/clear motion, sound toggle. Not yet released.
- **2026-10-04**: Developer ID signing switched on (Team DR6GPTU9UX); release workflow and script set up for notarisation.
  Awaiting Max's Apple secrets before the first notarised release.
- **2026-10-04 (in progress)**: Cloud sync (Firebase, `src/lib/syncModel.ts` three-way merge + tests, `cloud.ts`, `useCloudSync.ts`,
  `CloudSync.tsx`; verified with emulators: two browser "devices", first-sync merge, live updates, no write loop). Off until
  `src/lib/firebaseConfig.ts` has a config. iPad groundwork: `tauri ios init` (gen/apple), Rust compiles for iOS sim (calendar
  colour via CGColor, updater/process desktop-only, capabilities split). NOT done yet: iPad Info.plist (landscape, calendar
  strings, Files sharing), touch drag/hover, hide Mac-only UI on iPad, simulator run, TestFlight workflow.
- **2026-10-04**: **Released v0.5.0**, the first Developer ID signed + notarised release (tick rewards; sync code included but
  off). Verified the download: Gatekeeper "accepted, source=Notarized Developer ID", ticket stapled, universal, calendar
  entitlement, latest.json has both platforms. Notarisation took about 50 minutes. Lesson: never push to main while the
  Release workflow runs; its final `git push` fails and nothing is published (happened once, re-ran).
- **2026-10-04**: iPad app runs in the simulator (iPad A16, iOS 27): `src-tauri/Info.ios.plist` (calendar strings, landscape
  only, full screen, no status bar, Files sharing, no-encryption flag), iPad-only device family, team DR6GPTU9UX, iOS 16+.
  Web side: `isIPad`/`isMacApp` in lib/tauri.ts (touch points; `?ipad=1` previews in a browser) hide the traffic-light gap,
  Show files, self-updater and System Settings button on iPad; touch: `touch-action` on the grid (none) and activities (pan-y),
  pointercancel drops a drag, 10px tap slop for fingers, 16px resize grip on coarse pointers, no pinch zoom, safe-area
  padding. Simulator build: `npx tauri ios build --debug --target aarch64-sim`. Screenshot showed the full week rendering;
  tapping (calendar prompt, drags) not yet tested (needs simulator access in the Claude panel).
  TestFlight: `.github/workflows/testflight.yml` (after each Release, monthly, or by hand) builds with automatic signing via
  an App Store Connect API key and uploads with altool, build number = run number. Needs secrets from
  `scripts/setup-testflight-secrets.sh` and the app record in App Store Connect. Untested until then.
- **2026-10-05**: To-dos carry over: unticked to-dos from past days (any week) move onto today on launch, at midnight and on
  focus (`lib/rollover.ts` + tests; store action `silent`, so no undo step; done in the data, so synced devices agree).
  Each keeps `since` (first day it was meant for); from 3 days waiting it shows "Nd" and pulses red every 6s (reduced motion:
  a static red edge). Only her own to-dos move; timetable/calendar items and ticked to-dos stay on their day.
- **2026-10-06**: Test pass (browser at 1440×900 with a QA device, two-device sync on the emulator, iPad Pro 13" simulator).
  All flows passed except three bugs, now fixed:
  1. **Sync lost to-dos** when both devices edited the same week while apart (whole week was one doc). To-dos and ticks
     are now one doc each (`d:<monday>:<day>:<id>`, `k:<monday>:<id>`, ids URI-encoded); old `w:` docs are read, merged by
     id, and deleted. Tests cover the conflict, the migration and slash-containing calendar ids (17 tests).
  2. **iPad calendar crashed** on its first call ("class EKEventStore could not be found"): EventKit wasn't linked into the
     iOS app (a Rust staticlib's link directives don't reach Xcode). Added `EventKit.framework` to gen/apple/project.yml.
     The first TestFlight build (run 37386358546, build 1) has this bug.
  3. On iPad the block editor and template name no longer summon the keyboard by themselves (`autoFocus={!isIPad}`).
  Simulator note: it runs portrait with the app landscape, so system alerts/keyboard draw sideways; taps use the portrait
  frame. Screenshots lag one action.
