# Fixes after reviewing the first build (27 Sep 2026)

I checked the week view, Edit activity and Edit block screens against the mockup and README.
Her window is about **1450×820 CSS px**, so **1 hour ≈ 42px** on the grid. Every rule below must work at that size, at 1440×900,
and at the 1100×680 minimum.

Tags: **[build]** means the build doesn't match the spec. **[spec]** means the spec itself was wrong and is corrected here.
README.md and the mockup have been updated to match. Do the items in order. Keep STATUS.md current and don't touch the data-safety code.

---

## 1. The time line in 1-hour blocks is cut off [spec]
**What she sees:** in 1h blocks (Lunch, Gym) the time "11:00–12:00" runs into the bottom border.
**Why:** `WeekGrid.tsx` switches to the two-line layout once the slot reaches `TALL_PX = 38`. Two lines actually need about
49px (2 border + 6 padding + 16.8 title + 1 + 15 time + 6 + 2). A 1h block at her size is a 38.6px box, so the time line gets clipped.

**Fix:** delete `TALL_PX`, `ICON_PX`, `NARROW_COL_PX` and `ICON_PX_NARROW`. Pick one of four layouts from the box height
`H = (end − start) · ppm − 3`:

| tier | H | padding | content |
|---|---|---|---|
| tiny | < 24 | `0 6px` | one line, centred vertically: icon 13 · title 12px/700, line-height 1 · **no time** |
| short | 24–43 | `0 8px` | one line, centred vertically, gap 5: icon 16 · title 13px/700 · start `11:00` 11px mono (only when not sharing a lane) |
| medium | 44–71 | `4px 8px` | row 1: icon 16 + title 14px/700, line-height 1.15 · row 2: `11:00–12:00` 11.5px mono, line-height 1.2 |
| tall | ≥ 72 | `6px 9px` | title row + time row (no inline icon) · **24px icon bottom-right** (right 7, bottom 6). When sharing a lane, use the medium inline icon instead |

- In every tier the title never wraps: `min-width:0; overflow:hidden; text-overflow:ellipsis`. The start time never shrinks.
- One-line tiers use `display:flex; align-items:center; height:100%`. At the moment short blocks sit at the top with 2px padding.
- Clash: the Warning icon replaces the inline icon. The tall 24px icon stays.
- Every block and calendar event gets a tooltip `Lunch · 11:00–12:00`, plus the clash text if there is one. Tiny blocks hide the time, so they need it.
- Calendar events use the same tiers, with CalendarBlank as their icon.
- Result at her size: 30m is tiny · 45m and 1h are short · 1½h is medium · 2h and longer are tall. See mockup 1a, and the four block specimens in 1c.

**Check:** at all three window sizes, no text touches a border, and every block that has an icon shows it.

## 2. Her activities and blocks have no icons [spec]
**What she sees:** letters (W, G, L…) in the sidebar discs and no symbol in any block. After Max gave "Work" an icon,
the existing Work blocks still had none (screenshot: Wednesday).
**Why:** my README said the migration leaves icons empty ("no icon = none"). Blocks also copy the activity's look only
when they're created.

**a. Guess icons from names.** Add this to `lib/icons.ts`. The first match wins, so the order matters (`workout` must come before `work`):
```ts
const GUESSES: [RegExp, string][] = [
  [/\b(lecture|class|lesson)/, 'chalkboard-teacher'],
  [/\b(seminar|tutorial|workshop|supervision)/, 'chats-circle'],
  [/\b(exam|test|revis|quiz)/, 'exam'],
  [/\b(essay|writ|assignment|coursework|dissertation|homework)/, 'pencil-line'],
  [/\blibrar/, 'books'],
  [/\bread/, 'book-open'],
  [/\b(study|lab)/, 'student'],
  [/\b(laptop|computer|coding|online)/, 'laptop'],
  [/\b(gym|workout|weights|exercise|training|pilates)/, 'barbell'],
  [/\b(run|jog)/, 'person-simple-run'],
  [/\bswim/, 'swimming-pool'],
  [/\b(yoga|meditat|stretch)/, 'flower-lotus'],
  [/\b(cycl|bike)/, 'bicycle'],
  [/\b(work|job|shift|office|placement|intern)/, 'briefcase'],
  [/\b(brunch|coffee|caf)/, 'coffee'],
  [/\b(lunch|dinner|breakfast|meal|food|eat)/, 'fork-knife'],
  [/\bcook/, 'cooking-pot'],
  [/\b(friend|social|party|drinks|pub)/, 'users-three'],
  [/\b(date|love)/, 'heart'],
  [/\b(call|phone|facetime)/, 'phone'],
  [/\b(music|piano|guitar|sing|choir|band)/, 'music-notes'],
  [/\b(admin|email|errand|bills|forms)/, 'clipboard-text'],
  [/\b(plan|to-?do|tasks)/, 'list-checks'],
  [/\b(clean|tidy|chores)/, 'broom'],
  [/\blaundry/, 'washing-machine'],
  [/\b(shop|grocer|supermarket)/, 'shopping-cart'],
  [/\b(sleep|nap|bed)/, 'bed'],
  [/\bdentist/, 'tooth'],
  [/\b(doctor|gp|appointment|physio)/, 'first-aid'],
  [/\b(film|movie|cinema)/, 'film-slate'],
  [/\b(game|gaming)/, 'game-controller'],
  [/\b(art|paint|draw)/, 'paint-brush'],
  [/\b(travel|train|trip|commute)/, 'train'],
  [/\b(birthday|cake)/, 'cake'],
]
export const guessIcon = (name = '') => GUESSES.find(([re]) => re.test(name.toLowerCase()))?.[1]
```
Add `briefcase` and `clipboard-text` to `iconMap.ts`. Add them to the categories too: briefcase under Study; clipboard-text and
list-checks under Home. Every name `guessIcon` can return must be in `iconMap.ts`. Add a dev-only assert to enforce this.

**b. Migration v2 → v3** in `migrate.ts`. Fill any missing `icon` with `guessIcon(name | title)` for activities, blocks,
template blocks and `templateDraft` blocks. Never overwrite an icon that's already set. Bump `AppData.version` to 3.
It must still open v1 and v2 files. Test it on a copy of a real v1 file and on the current v2 dev file.

**c. Editing an activity's icon updates its blocks.** When an activity is saved with a changed icon or weight, apply the change
in the same `update()` so it's one undo step. It goes to blocks, template blocks and draft blocks whose title matches the activity
name (trimmed, case-insensitive) **and** whose icon is either empty or still the activity's old icon. Blocks she changed by hand
keep their own icon. Update the "Data model notes" in STATUS.md to say so.

**d. Suggest an icon as she types.** In the activity and block editors, until she picks an icon herself, the selected icon follows
`guessIcon(name)`. Stop following it once she clicks any icon.

**e. No more letters.** Remove the letter fallback from `ActivityIcon`. Discs (sidebar, drag chip, editor preview) and block-editor
chips use `icon ?? guessIcon(name) ?? 'star'`.

**Check:** her activities show briefcase, barbell, fork-knife, book-open, users-three and clipboard-text, unless an icon was
already set. Wednesday's Work block shows its icon.

## 3. The "Duotone" icon shrinks to a dot [build]
**Why:** in the Icon style control each segment is about 86px wide. The label doesn't fit, so the flexbox shrinks the SVG instead.
**Fix:** `.segmented button svg { flex-shrink: 0 }`, segment `padding: 0 6px`, `gap: 5px`, label 13px, icon kept at 20px.
**Check:** all three segments show a full-size icon, including when Duotone is selected.

## 4. Two sets of traffic lights [spec]
**What she sees:** the real window buttons sit in an empty 40px band, and the fake dots repeat just below them in the
Activities header.
**Fix:** move the real buttons to where the dots are and remove the band. This gives the grid 24px more, so 1h goes from about 42px to 45px.
- `tauri.conf.json` window: `"trafficLightPosition": { "x": 34, "y": 30 }`. Tune it by eye so the buttons sit exactly where
  the dots were. If the installed Tauri doesn't support this option, keep the band and do only the next bullet.
- Sidebar header: in Tauri (`isTauri`), render an empty 52×14 spacer instead of `<Dots />`. The browser build keeps the dots,
  and modals keep them too.
- Remove `.titlebar` and set `.shell` padding to 16px on all sides. Put `data-tauri-drag-region` on the sidebar header and on the
  toolbar row, but not on their buttons.

**Check:** in the native window the buttons sit in the pink header, dragging the empty toolbar space moves the window, and there's no empty band at the top.

## 5. Small things [build]
- `IconLibrary` should open on the category that contains the current icon (fall back to Basics), so the selected tile is visible when editing.

## Already right (leave alone)
Tokens, fonts, toolbar and buttons, day header and today pill, today tint, the Earlier and Later rows, the fit-to-height grid,
colour migration, modal chrome, swatches, the 12-icon quick pick, the icon library layout, the save pill, hints, and the app icon.
