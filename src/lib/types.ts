export type IconWeight = 'bold' | 'fill' | 'duotone'

/** Optional icon, copied from activity → block → template like title/colour */
interface Iconed {
  /** Phosphor icon name, kebab-case (see lib/icons.ts) */
  icon?: string
  /** default 'bold' */
  iconWeight?: IconWeight
}

export interface Activity extends Iconed {
  id: string
  name: string
  color: string
  /** default length in minutes when dropped onto the calendar */
  duration: number
}

export interface Block extends Iconed {
  id: string
  /** YYYY-MM-DD */
  date: string
  /** minutes from midnight */
  start: number
  end: number
  title: string
  color: string
}

/** A block inside a template: tied to a weekday (0 = Monday) instead of a date */
export interface TemplateBlock extends Iconed {
  day: number
  start: number
  end: number
  title: string
  color: string
}

export interface Template {
  id: string
  name: string
  blocks: TemplateBlock[]
}

export interface AppData {
  /** 1 = original; 2 = pastel palette + icons (see lib/migrate.ts) */
  version: 2
  activities: Activity[]
  blocks: Block[]
  templates: Template[]
  /** Monday (YYYY-MM-DD) of each week she chose to sync with Apple Calendar */
  syncedWeeks?: string[]
}
