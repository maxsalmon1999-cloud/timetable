// Little rewards for ticking things off in the to-do pad: sounds (Web Audio) and one-shot effects (Web Animations).
// Spec: design_handoff_timetable_redesign/handoff/HANDOFF.md ("2c Glint" is the chosen tick effect).

// ---------- sound ----------

const SOUND_KEY = 'timetable-todo-sound'

/** sound on/off is a per-Mac preference (browser storage, may be unavailable → on) */
export function soundOn() {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  } catch {
    /* not remembered; fine */
  }
}

let audio: AudioContext | null = null
/** created lazily on the first gesture (browsers block audio before one) */
function ctx() {
  if (!soundOn()) return null
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
    return audio
  } catch {
    return null
  }
}

function tone(freq: number, { type = 'sine' as OscillatorType, ms = 160, gain = 0.1, at = 0, to }: { type?: OscillatorType; ms?: number; gain?: number; at?: number; to?: number } = {}) {
  const ac = ctx()
  if (!ac) return
  const t = ac.currentTime + at / 1000
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + ms / 1000)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000)
  osc.connect(g).connect(ac.destination)
  osc.start(t)
  osc.stop(t + ms / 1000 + 0.02)
}

const LADDER = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1568]

export const sounds = {
  /** pointer down on a checkbox */
  press: () => tone(180, { type: 'square', ms: 40, gain: 0.025 }),
  /** each tick climbs one note: n = how many are done on that day now (1-based) */
  tick: (n: number) => {
    const f = LADDER[Math.min(Math.max(n - 1, 0), LADDER.length - 1)]
    tone(f, { type: 'triangle', ms: 160, gain: 0.13 })
    tone(f * 2, { ms: 160, gain: 0.035 })
  },
  add: () => {
    tone(392, { ms: 90, gain: 0.08 })
    tone(587.33, { ms: 120, gain: 0.08, at: 80 })
  },
  /** one per cleared row, falling */
  clear: (i: number) => tone(660 * Math.pow(0.9, i), { ms: 90, gain: 0.05, at: i * 70 }),
  dayDone: () => {
    ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, { type: 'triangle', ms: 220, gain: 0.12, at: i * 85 }))
    tone(1567.98, { ms: 600, gain: 0.03, at: 4 * 85 })
  },
}

// ---------- effects ----------

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

const SPRING = 'cubic-bezier(.3,1.3,.5,1)'
const STAR = 'M12 1 C12.8 8.5 15.5 11.2 23 12 C15.5 12.8 12.8 15.5 12 23 C11.2 15.5 8.5 12.8 1 12 C8.5 11.2 11.2 8.5 12 1Z'
const PASTELS = ['#a8e8bf', '#ffe680', '#ffb8d6', '#a9d6ff', '#cdb9ff', '#ffc49e', '#8fe0d6']

/** rect of el relative to the layer the effect is drawn in (the layer itself: its own untransformed size) */
function within(layer: HTMLElement, el: HTMLElement) {
  if (el === layer) return { x: 0, y: 0, w: el.offsetWidth, h: el.offsetHeight }
  const a = layer.getBoundingClientRect()
  const b = el.getBoundingClientRect()
  return { x: b.left - a.left, y: b.top - a.top, w: b.width, h: b.height }
}

function spawn(layer: HTMLElement, css: Partial<CSSStyleDeclaration>, html = '') {
  const el = document.createElement('div')
  Object.assign(el.style, { position: 'absolute', pointerEvents: 'none', ...css })
  el.innerHTML = html
  layer.appendChild(el)
  return el
}

const vanish = (el: Element, anim: Animation) => (anim.onfinish = () => el.remove())

/** the box springs, a ring pops off it and the row flashes mint. Drawn inside the row so it moves with it. */
export function tickPop(box: HTMLElement, row: HTMLElement) {
  const layer = row
  row.animate([{ backgroundColor: 'rgba(168,232,191,.95)' }, { backgroundColor: 'rgba(168,232,191,0)' }], { duration: 750, easing: 'ease-out' })
  if (reducedMotion()) return
  box.animate(
    [
      { transform: 'translate(1px,1px) scale(.84)' },
      { transform: 'translate(1px,1px) scale(1.22) rotate(-6deg)', offset: 0.45 },
      { transform: 'translate(1px,1px) scale(.96) rotate(2deg)', offset: 0.75 },
      { transform: 'translate(1px,1px) scale(1)' },
    ],
    { duration: 420, easing: SPRING },
  )
  const r = within(layer, box)
  const ring = spawn(layer, { left: `${r.x + r.w / 2 - 14}px`, top: `${r.y + r.h / 2 - 14}px`, width: '28px', height: '28px', border: '2.5px solid #211c33', boxSizing: 'border-box' })
  vanish(
    ring,
    ring.animate(
      [
        { transform: 'scale(.9)', borderRadius: '10px', opacity: 1 },
        { transform: 'scale(2.3)', borderRadius: '50%', opacity: 0 },
      ],
      { duration: 420, easing: 'ease-out' },
    ),
  )
}

/** a light sweeps across el, then stars pop along it. Drawn inside el (position: relative) so it moves with it. */
export function glint(el: HTMLElement, stars = 2) {
  if (reducedMotion()) return
  const layer = el
  const r = within(layer, el)
  const clip = spawn(layer, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px`, borderRadius: '12px', overflow: 'hidden' })
  const band = document.createElement('div')
  Object.assign(band.style, {
    position: 'absolute',
    top: '-10%',
    height: '120%',
    width: '46px',
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.95) 40%, rgba(255,230,128,.95) 60%, transparent)',
  })
  clip.appendChild(band)
  vanish(
    clip,
    band.animate([{ transform: 'translateX(-60px) skewX(-20deg)' }, { transform: `translateX(${r.w + 20}px) skewX(-20deg)` }], {
      duration: 560,
      easing: 'cubic-bezier(.5,0,.3,1)',
    }),
  )
  const spots = stars <= 2 ? [0.55, 0.8] : Array.from({ length: stars }, (_, i) => 0.3 + (0.7 * i) / (stars - 1))
  spots.forEach((at, i) => {
    const size = 14
    const star = spawn(
      layer,
      { left: `${r.x + r.w * Math.min(at, 0.97) - size / 2}px`, top: `${r.y + (i % 2 ? r.h * 0.75 : r.h * 0.2) - size / 2}px`, width: `${size}px`, height: `${size}px`, transform: 'scale(0)' },
      `<svg viewBox="0 0 24 24" width="${size}" height="${size}"><path d="${STAR}" fill="${i % 2 ? '#ffb8d6' : '#ffe680'}" stroke="#211c33" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
    )
    vanish(
      star,
      star.animate(
        [
          { transform: 'scale(0) rotate(-45deg)' },
          { transform: 'scale(1.2) rotate(15deg)', offset: 0.45 },
          { transform: 'scale(0) rotate(90deg)' },
        ],
        { duration: 480, delay: 200 + i * 110, easing: 'ease-out', fill: 'backwards' },
      ),
    )
  })
}

/** pastel confetti falls over the whole layer */
export function confetti(layer: HTMLElement, count = 50) {
  if (reducedMotion()) return
  const { width, height } = layer.getBoundingClientRect()
  for (let i = 0; i < count; i++) {
    const w = 6 + Math.random() * 6
    const piece = spawn(layer, {
      left: `${Math.random() * width}px`,
      top: '-16px',
      width: `${w}px`,
      height: `${w * (Math.random() < 0.5 ? 1 : 0.55)}px`,
      background: PASTELS[i % PASTELS.length],
      border: '1.5px solid #211c33',
      borderRadius: Math.random() < 0.3 ? '50%' : '2px',
      boxSizing: 'border-box',
    })
    const drift = (Math.random() - 0.5) * 80
    const spin = (Math.random() < 0.5 ? -1 : 1) * (240 + Math.random() * 480)
    vanish(
      piece,
      piece.animate(
        [
          { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
          { transform: `translate(${drift}px, ${height + 30}px) rotate(${spin}deg)`, opacity: 1, offset: 0.9 },
          { transform: `translate(${drift}px, ${height + 40}px) rotate(${spin}deg)`, opacity: 0 },
        ],
        { duration: 1400 + Math.random() * 900, delay: Math.random() * 250, easing: 'cubic-bezier(.25,.4,.6,1)', fill: 'backwards' },
      ),
    )
  }
}

/** a quick scale bump, e.g. a count that changed or a meter cell that filled */
export function bump(el: Element | null | undefined, peak = 'scale(1.4)', ms = 340) {
  if (!el || reducedMotion()) return
  el.animate([{ transform: 'scale(1)' }, { transform: peak }, { transform: 'scale(1)' }], { duration: ms, easing: SPRING })
}
