import { useState } from 'react'
import { CheckIcon, HashIcon } from '@phosphor-icons/react'
import { PALETTE } from '../lib/icons'

const NAMES: Record<string, string> = Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [v.toLowerCase(), k]))

/** "#abc", "abc", "aabbcc" or "#AABBCC" → "#AABBCC"; anything else → null */
function normaliseHex(input: string): string | null {
  const s = input.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(s)) return `#${[...s].map((c) => c + c).join('')}`.toUpperCase()
  if (/^[0-9a-f]{6}$/i.test(s)) return `#${s}`.toUpperCase()
  return null
}

/** relative luminance 0 (black) … 1 (white), for warning about colours too dark for the ink-coloured writing */
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** hexagon rows 7 / 6 / 7 (more rows repeat the pattern) */
function rows(colors: string[], wide = 7) {
  const out: string[][] = []
  for (let i = 0, n = wide; i < colors.length; n = n === wide ? wide - 1 : wide) {
    out.push(colors.slice(i, i + n))
    i += n
  }
  return out
}

/** Colours as a honeycomb, plus her own colour typed as hex */
export function ColorPicker({ value, onChange, colors }: { value: string; onChange: (c: string) => void; colors: string[] }) {
  const current = value.toUpperCase()
  const custom = !colors.some((c) => c.toUpperCase() === current)
  const [draft, setDraft] = useState(custom ? current : '')
  // the colour changed from outside (a type picked, a swatch clicked): show its code, unless she's the one typing it
  const [seen, setSeen] = useState(current)
  if (seen !== current) {
    setSeen(current)
    if (normaliseHex(draft) !== current) setDraft(custom ? current : '')
  }
  const typed = normaliseHex(draft)
  const dark = luminance(current) < 0.25

  return (
    <div className="color-picker">
      <div className="honeycomb" role="radiogroup" aria-label="Colour">
        {rows(colors).map((row, r) => (
          <div key={r} className="comb-row">
            {row.map((c) => {
              const on = c.toUpperCase() === current
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={'hex' + (on ? ' on' : '')}
                  style={{ ['--c' as string]: c }}
                  title={NAMES[c.toLowerCase()] ?? c}
                  aria-label={`Colour ${NAMES[c.toLowerCase()] ?? c}`}
                  onClick={() => onChange(c)}
                >
                  <span className="hex-fill">{on && <CheckIcon size={15} weight="bold" />}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <div className="hex-entry">
        <span className={'hex' + (custom ? ' on' : '') + (typed || custom ? '' : ' empty')} style={{ ['--c' as string]: typed ?? (custom ? current : 'transparent') }} aria-hidden>
          <span className="hex-fill">{custom && <CheckIcon size={15} weight="bold" />}</span>
        </span>
        <label className="hex-input">
          <HashIcon size={16} weight="bold" />
          <input
            className="mono"
            value={draft.replace(/^#/, '')}
            maxLength={7}
            placeholder="Your own, e.g. A1B2C3"
            aria-label="Your own colour, as a hex code"
            spellCheck={false}
            onChange={(e) => {
              setDraft(e.target.value)
              const hex = normaliseHex(e.target.value)
              if (hex) onChange(hex)
            }}
          />
        </label>
      </div>
      {draft && !typed && <p className="hex-note">Type 3 or 6 of 0–9 and A–F, like A1B2C3.</p>}
      {dark && <p className="hex-note">That's quite dark: the writing on it will be hard to read.</p>}
    </div>
  )
}
