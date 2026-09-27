import { useState } from 'react'
import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import { ICON_CATEGORIES, searchIcons } from '../lib/icons'
import type { IconWeight } from '../lib/types'
import { ActivityIcon } from './ActivityIcon'

/** Search + category pills + icon grid. Clicking the selected icon again clears it. */
export function IconLibrary({
  icon,
  weight = 'bold',
  color,
  onPick,
}: {
  icon?: string
  weight?: IconWeight
  /** background of the selected tile (the activity's colour) */
  color: string
  onPick: (icon: string | undefined) => void
}) {
  const [cat, setCat] = useState('Basics')
  const [query, setQuery] = useState('')
  const searching = query.trim() !== ''
  const names = searching ? searchIcons(query) : ICON_CATEGORIES[cat].icons

  return (
    <div className="icon-lib">
      <label className="search-field">
        <MagnifyingGlassIcon size={22} weight="bold" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search icons — try “book”, “run”, “music”" />
      </label>
      <div className="pills">
        {Object.entries(ICON_CATEGORIES).map(([name, c]) => (
          <button
            type="button"
            key={name}
            className={'pill' + (!searching && name === cat ? ' on' : '')}
            onClick={() => {
              setCat(name)
              setQuery('')
            }}
          >
            <ActivityIcon name={c.icon} size={18} />
            {name}
          </button>
        ))}
      </div>
      <div className="icon-grid">
        {names.map((n) => (
          <button
            type="button"
            key={n}
            title={n.replace(/-/g, ' ')}
            className={'icon-tile' + (n === icon ? ' on' : '')}
            style={n === icon ? { background: color } : undefined}
            onClick={() => onPick(n === icon ? undefined : n)}
          >
            <ActivityIcon name={n} weight={weight} size={28} />
          </button>
        ))}
      </div>
      {searching && names.length === 0 && <div className="no-results">No icons match “{query.trim()}”. Try a simpler word.</div>}
    </div>
  )
}
