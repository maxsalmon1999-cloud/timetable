# Handoff: Timetable — pastel neo-brutalist redesign

## Overview
Visual redesign of the existing Timetable macOS app (Vite + React 19 + TS + Tauri 2, repo `maxsalmon1999-cloud/timetable`).
The user is a non-technical student. Priorities: very simple, visually appealing, big clear icons, the whole week fits on one screen
with no vertical scrolling. Adds: new brand + app icon, a 9:00–22:00 default day that auto-widens and can be expanded with + rows,
activity icons with a 12-icon base set and a searchable icon library.

## About the design files
`Timetable Brand Kit.dc.html` is a **design reference built in HTML** — not production code. Recreate it inside the existing
React/Tauri codebase using its patterns (plain CSS in `src/index.css`, no UI libraries, custom pointer-event drag system).
Open it in a browser (keep `support.js` next to it). Artboards:
- **1a** Week view (interactive: + Earlier / + Later rows; Tweaks for screen height & an early event)
- **1b** Block editor modal
- **1d** New activity / icon library (interactive: search, categories, icon style, colour)
- **1c** Brand kit (logo, colour, type, shape, components, icons, day-range rules, voice)

## Fidelity
**High-fidelity.** Final colours, type, spacing, borders, shadows and copy. Match pixel values below.
All existing behaviour in STATUS.md stays (drag/move/resize, templates, undo, calendar sync, data safety). Keep STATUS.md updated.

## Files in this bundle
- `Timetable Brand Kit.dc.html` + `support.js` — the mockup
- `app-icon.svg` — **chosen app icon (option 2a "Blocks")** → replace repo `app-icon.svg`, run `npx tauri icon app-icon.svg`
  to regenerate `src-tauri/icons/*` (png, icns, ico). Also use it for `public/favicon.png`. Options 2b/2c in the mockup were rejected.
- `icons/app-icon-a-blocks.svg` — same icon, referenced by the mockup
- `icons.ts` — drop into `src/lib/icons.ts` (base set, categories, palette, colour migration map)

## Suggested implementation order
1. Tokens + fonts (bundled locally) + Phosphor icons in `index.css` / package.json
2. Data v2 migration (colours, icon fields, new seed) in `storage.ts` / `store.ts` — must still open her current v1 file
3. Visible-day range + fit-to-height grid in `WeekGrid.tsx` / `App.tsx` / `constants.ts`
4. Restyle Sidebar, toolbar, blocks, calendar events, modals, templates menu
5. Icon quick-pick in BlockEditor, icon library in ActivityEditor
6. App icon, Tauri overlay title bar, `npx tsc -b`, `npx oxlint`, hand-test drag in the native window

New app icon: `app-icon.svg` → replace repo `app-icon.svg`, run `npx tauri icon app-icon.svg`.
Keep all behaviour in STATUS.md; this is a visual + day-range change. Update STATUS.md changelog.

## 1. Tokens (put in `index.css :root`, drop dark mode for now)
```
--ink:#211C33; --paper:#FFFBF4; --canvas:#ECE7FB; --line:rgba(33,28,51,.13);
--grape:#B69CFF (primary)  --coral:#FF9A8A (danger)  --mint:#A8E8BF (success, + buttons)
--sky:#A9D6FF (calendar/sync)  --lemon:#FFE680 (today, templates)  --clash:#F0503C  --now:#FF6B57
--bw:2.5px (controls/panels)  --bw-block:2px
--r-control:12px --r-panel:18px --r-block:10px --r-pill:99px
--sh-control:3px 3px 0 var(--ink); --sh-panel:5px 5px 0 var(--ink); --sh-block:3px 3px 0 var(--ink)
```
Canvas background: `repeating-linear-gradient(-45deg, rgba(33,28,51,.045) 0 2px, transparent 2px 22px)` over `--canvas`.
Interaction: hover `translate(-1px,-1px)` + 4px shadow; active `translate(2px,2px)` + 1px shadow.
Disabled: dashed border, no shadow, opacity .5, transparent bg.

## 2. Type
- UI: **Bricolage Grotesque** (Google Fonts, 400–800). Bundle locally (woff2 in `src/assets/fonts`) — the app runs offline.
- Times/durations: **DM Mono** 500.
- Scale: week title 28/800 · modal heading 22/800 · sidebar title 21/800 · activity 16/700 · button 15/700 · block title 14/700 (13 when short) · body 14/500 · labels 13/700 uppercase +0.05em · times 11.5–13 mono.

## 3. Icons
`npm i @phosphor-icons/react`, **weight="bold" everywhere**. 22px in 44px buttons, 24px in blocks, 19px in activity discs.
Replace text glyphs: ‹ › → CaretLeft/Right · ↶ ↷ → ArrowUUpLeft/Right · ▾ → CaretDown · ✎ → PencilSimple · ✕ → X ·
⚠ → Warning · ★ → Star · ⧉ → Copy · "+ New" → Plus (icon-only 44px lemon square, title="New activity").
Toolbar: Templates button gets SquaresFour; Sync button CalendarPlus (not synced) / CalendarCheck (synced).

## 4. Activity palette (constants.ts COLORS)
```
sky #A9D6FF  mint #A8E8BF  peach #FFC49E  pink #FFB8D6  lilac #CDB9FF
teal #8FE0D6 lemon #FFE680 sand #E8D3B5  coral #FF9A8A cloud #E3E1EC
```
Migration (in storage.ts load, bump `AppData.version` to 2): map old → new for activities, blocks, templates:
4A7DFF→sky, 2FB36B→mint, F29B38→peach, EF5B7B→pink, 9B6BE0→lilac, 2BA9BF→teal, E0B82E→lemon, A0785A→sand, E5534B→coral, 8A8F98→cloud.
Unknown colours: keep as is. Blocks render the colour as a **solid fill** (no more color-mix / left border). Text is always ink.

## 5. Activity icons (new, optional field)
Add `icon?: string` (Phosphor name) to `Activity`, `Block`, `TemplateBlock`; copy it like title/colour. Part of the v2 migration
(no icon = none). Also add `iconWeight?: 'bold'|'fill'|'duotone'` (default bold).
She is a student — new seed activities (replace store.ts `seed()`):
Lecture sky chalkboard-teacher 2h · Seminar teal chats-circle 1h · Reading lilac book-open 1h30 · Library lemon books 2h ·
Essay sand pencil-line 2h · Lunch peach fork-knife 1h · Gym mint barbell 1h · Friends pink users-three 2h.
Base set (12, shown first everywhere): chalkboard-teacher, chats-circle, book-open, pencil-line, exam, laptop, fork-knife,
barbell, users-three, coffee, music-notes, heart.
Block editor: those 12 as a 6×2 grid of 44px tiles (1b) + dashed "More icons…" pill that opens the full library.
Activity editor ("+" in sidebar) = **icon library (1d)**: name, colour, usual length, icon style (Bold/Filled/Duotone segmented),
live preview (sidebar pill + block); right side search field + category pills (Basics = the 12 base icons, default; Study, Health, Social, Home, Hobbies, Travel)
+ 8-col grid of square tiles (selected = activity colour + shadow). Search matches icon names across all categories.
Category lists are in the `CATS` constant of the mockup's logic — copy them to `src/lib/icons.ts`. Import icons by name via
`import * as Icons from '@phosphor-icons/react'` only for the curated list (tree-shake with an explicit map). Calendar events use CalendarBlank.

## 6. Visible day range (replaces DAY_START/DAY_END 6–24)
```
DEFAULT_START = 9:00   DEFAULT_END = 22:00
MIN_START = 1:00       MAX_END = 23:30       EARLIER_STEP = 120 min
```
- `visibleStart = max(MIN_START, min(topTarget, floorHour(earliest item this week)))`
- `visibleEnd   = min(MAX_END, max(bottomTarget, ceilHalfHour(latest item this week)))`
- Items = her blocks + timed calendar events for the visible week.
- `topTarget` / `bottomTarget` are UI state (session only, reset on week change), default 9:00/22:00.
- Top row: "+ Earlier (from X)" sets `topTarget = max(MIN_START, visibleStart - 120)`; "− Hide early hours" resets. When the range was
  widened automatically show the teal note "Starts 7:00 for Early swim" (earliest item title).
- Bottom row: "+ Later (until 23:30)" sets `bottomTarget = MAX_END`; "− Hide late hours" resets.
- **No vertical scroll**: `pxPerMin = gridBodyHeight / (visibleEnd - visibleStart)`, measured with ResizeObserver on the grid body.
  Replace constant `HOUR_PX`/`PX_PER_MIN` with this value (pass into WeekGrid + hitTest). Remove the "scroll to 7am" effect and `overflow-y:auto`.
- Drag/resize/create clamps and BlockEditor `TIMES` use MIN_START..MAX_END (the full possible range), not the visible range.
  Dropping outside the visible range is impossible; the editor can pick any time and the range will then auto-widen.
- Hour labels every hour (`9:00`), lines 1.5px `--line`. No half-hour lines.
- Block layout: `height >= 38px` → two lines (title, `9:00–13:00`); icon bottom-right at 24px when height ≥ 50px and not sharing a lane.
  `< 38px` → one line: title + start time.

## 7. Layout (1440×900 reference; everything scales with window)
- Tauri: `titleBarStyle: "Overlay"`, `hiddenTitle: true`; 40px drag region (`data-tauri-drag-region`) on top of canvas.
- Body: canvas, padding 0 16px 16px, gap 16.
- Sidebar: 264px paper panel. Pink header bar (three 11px dots coral/lemon/mint, "Activities", lemon + button), activities as 52px pastel
  pills (white icon disc, name, mono duration), hints as a dashed card with 3 icon rows, save pill (mint "All saved" / coral "Couldn't save · Retry"), version.
- Toolbar: 60px, on canvas (no panel). Left: Today · ‹ · › · week title 28px · Sync. Right: Undo · Redo · Week templates.
- Grid panel: day header 62px (today = lemon pill with shadow; today column tinted lemon 35%), top expand row 42px, body, bottom expand row 42px.
- Now line: 3px `--now` with a 14px ink-bordered dot.
- Calendar events: dashed 2px ink border, stripes `repeating-linear-gradient(-45deg, paper 0 7px, <colour> 7px 14px)`, no shadow.
- Clash: `outline:3px solid --clash; outline-offset:2px` + Warning icon; in the block editor show a coral-tint banner naming the clash.
- Modals (Modal.tsx): paper panel, header bar in the block's colour (or pink), close = 44px X square, 18px radius, 8px shadow.
  Inputs/selects 48px, white, 2.5px ink border, r12; focus = `box-shadow:0 0 0 4px var(--lilac)`. Swatches 34px circles, selected = paper + ink double ring + check.
- Templates menu: same panel style, rows 44px with icons.

## 8. Voice
Short, warm, verbs first; 24h times; UK spelling. Product words: block, activity, template.
