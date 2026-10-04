# To-do tick rewards — implementation handoff

Target: `src/components/TodoMenu.tsx` + `src/index.css` in the Timetable app (pastel neo-brutalist; tokens already in `index.css`: ink `#211c33`, paper `#fffbf4`, mint `#a8e8bf`, lemon `#ffe680`, lilac `#b69cff`, pink `#ffb8d6`). Visual/behaviour reference: `Todo Rewards.dc.html` (open in a browser; section **1b** is the full proposal, **2c** is the chosen tick effect). Treat it as a spec, not code to port — it's a self-contained design file; re-implement idiomatically in React + CSS.

Update STATUS.md (Current status / Roadmap / Changelog) per the repo's CLAUDE.md.

## Problems being fixed
1. Ticking is an instant colour swap — no motion/sound.
2. Checkbox lacks the app's press/lift behaviour; hit area is only the 26px box.
3. Day completion is a 12px "All done!" footnote.
4. Zero counts just vanish (done looks same as empty).
5. No progress indicator.
6. Clearing ticked items is abrupt.

## Spec

### Checkbox (28×28, was 26)
- Rest: white bg, 2px ink border, radius 8, `box-shadow: 2px 2px 0 ink`.
- **Pointer down:** sink + squash — `translate(2px,2px) scale(.84)`, shadow 0, 90ms ease-out. Tiny click: square wave 180Hz, 40ms, gain 0.025. Pointer leave before up cancels (no tick).
- **Tick (on release):**
  - Box spring: keyframes `scale(.84)` → `1.22 rotate(-6deg)` @45% → `.96 rotate(2deg)` @75% → `1`, 420ms `cubic-bezier(.3,1.3,.5,1)`. Rests at `translate(1px,1px)`, shadow 0 (pressed-in = done).
  - Fill: mint layer inside box (`overflow:hidden`) scales 0→1.5 while radius 50%→0%, 220ms `cubic-bezier(.3,1.4,.5,1)`.
  - Check: SVG polyline `5,12.5 10,17.5 19.5,7`, stroke ink 3.4, round caps; `stroke-dasharray:22`, dashoffset 22→0, 220ms `cubic-bezier(.65,0,.35,1)`, 80ms delay. (Replaces Phosphor CheckIcon in the box.)
  - Ring: ink 2.5px outline 28px square from box centre, `scale(.9)→2.3`, radius 10px→50%, opacity 1→0, 420ms.
  - Row flash: background mint (alpha .95) → transparent, 750ms.
  - Strike-through: drawn, not `text-decoration` — inner span with `background-image: linear-gradient(ink,ink)`, `background-position: 0 58%`, `background-size: 0% 2.5px → 100% 2.5px`, 280ms `cubic-bezier(.65,0,.35,1)`, `box-decoration-break: clone`. Text opacity → .5 (150ms delay).
  - **Glint (chosen effect, 2c):** clip box over the row (radius 12, overflow hidden); a 46px band `linear-gradient(90deg, transparent, rgba(255,255,255,.95) 40%, rgba(255,230,128,.95) 60%, transparent)`, `skewX(-20deg)`, translates from -60px to row width +20px in 560ms `cubic-bezier(.5,0,.3,1)`. Then 2 (3 at "Party") 14px four-point stars (ink 1.8 stroke, lemon/pink fill) pop at ~55%/80%/end of the row: `scale(0) rotate(-45deg)` → `1.2 rotate(15deg)` @45% → `0 rotate(90deg)`, 480ms, delays 200ms + i·110ms. Star path: `M12 1 C12.8 8.5 15.5 11.2 23 12 C15.5 12.8 12.8 15.5 12 23 C11.2 15.5 8.5 12.8 1 12 C8.5 11.2 11.2 8.5 12 1Z`.
  - Sound ladder: each tick plays the next note in C-major pentatonic-ish `[523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1568]` indexed by number done today (triangle, 160ms, gain .13, plus octave sine at gain .035). WebAudio, lazily created AudioContext on first gesture.
- **Untick:** reverse transitions only. No particles, no sound. Rewards are one-way.
- Timetable-derived rows: whole row is the click target (`cursor:pointer`). User-added rows: box only (row has × delete).

### Progress meter
Under the day heading: one cell per item, `flex:1; height:12px; 2px ink border; radius 4`, white → mint. On tick the newly filled cell bounces `scale(1.15,1.6)` 360ms. On add, the new cell grows from `scaleX(0)`. Status text becomes `"3 of 7"` (replaces "N left"). Meter hidden when 0 items or all done.

### Day complete
When last item ticks (240ms after the tick):
- Lemon banner replaces the meter: ink 2.5px border, radius 12, `3px 3px 0` shadow, `rotate(-1.5deg)`; mint ✓ circle + "Sunday's done." (18/800) + mono "7 of 7 ticked". Stamps in: `translateY(-14px) rotate(-9deg) scale(.55)` → `rotate(1deg) scale(1.08)` @60% → rest, 520ms.
- Glint across the banner (more stars), confetti shower over the pad (~50 pieces, pastel w/ 1.5px ink border, falling 1.4–2.3s), arpeggio C5–E5–G5–C6 at 85ms steps + soft G6 sine tail.

### Zero states
Day tab count badge and toolbar To-do badge: at 0 (with items existing) show a mint circle with ✓ instead of disappearing. Badges bump `scale(1→1.4→1)` 340ms whenever counts change.

### Add / clear
- Add: new row drops in `translateY(-10px) scale(.96)` → rest with lemon flash, 700ms; two-note sine blip (G4→D5).
- Clear ticked: rows slide out `translateX(60px) rotate(2deg)` + fade, 320ms, staggered 70ms; descending soft blips. Remove from state after the animation.
- Clear button gets the standard lift/press hover/active.

### Settings (optional, if you want them in-app)
- Intensity: Subtle (no particles) / Playful (default) / Party (more stars + pad bounce on day complete).
- Sound on/off.

### Accessibility
`prefers-reduced-motion: reduce` → keep colour, fill, strike, sound; skip glint/stars/confetti/ring/bounces. Keep the checkbox a real `<button>` with `aria-pressed`/`role="checkbox"` + `aria-checked`; Space/Enter should trigger the same reward path.

## Implementation hints
- Particles: one absolutely-positioned, `pointer-events:none` overlay inside the pad; spawn DOM nodes and drive with Web Animations API (`el.animate(...).onfinish = remove`). No library needed.
- Trigger rewards in the toggle handler only when transitioning to done; read the post-toggle count for the note index and day-complete check.
- Keep CSS transitions for state-driven bits (fill, check dash, strike, opacity) and WAAPI for one-shot effects.
