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

/** Which activity a block belongs to (its "type"), kept apart from its name: a Friends block renamed "Lunch with Aoi"
 * is still tagged Friends. Holding or hovering an activity in the sidebar shows only the blocks with its tag. */
interface Tagged {
  /** the activity's id; missing for blocks of no particular type (or whose activity was deleted, which reads the same) */
  tag?: string
}

export interface Block extends Iconed, Tagged {
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
export interface TemplateBlock extends Iconed, Tagged {
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

/** One line on the to-do pad */
export interface Todo {
  id: string
  text: string
  done: boolean
  /** the day (YYYY-MM-DD) it was first meant for; unticked to-dos move on to today (lib/rollover.ts) and keep this */
  since?: string
}

export interface AppData {
  /** 1 = original; 2 = pastel palette + icon fields; 3 = icons filled in from names; 4 = blocks tagged with their activity (see lib/migrate.ts) */
  version: 4
  activities: Activity[]
  blocks: Block[]
  templates: Template[]
  /** Monday (YYYY-MM-DD) of each week she chose to sync with Apple Calendar */
  syncedWeeks?: string[]
  /**
   * A template being built from scratch ("Create a template"). While present, the grid shows a blank
   * week and every block edit goes here instead of `blocks`. Dates are placeholders: TEMPLATE_DATES.
   */
  templateDraft?: { blocks: Block[] }
  /**
   * To-do pad, per week: Monday (YYYY-MM-DD) → 7 lists, index 0 = Monday (like TemplateBlock.day).
   * Past weeks keep their lists. A week's key is dropped when all its lists are empty.
   */
  todos?: Record<string, Todo[][]>
  /**
   * Ticks on the timetable blocks / calendar events that the to-do pad pulls in: Monday (YYYY-MM-DD) → ids
   * (block id, or calendar `eventIdentifier@startMs|YYYY-MM-DD`). The items themselves are never copied.
   */
  todoTicks?: Record<string, string[]>
  /**
   * This device's link to cloud sync (never synced itself): the signed-in account, and a fingerprint of every synced
   * doc as of the last sync, for the three-way merge in lib/syncModel.ts. Missing when sync is off.
   */
  sync?: { uid: string; base: Record<string, string> }
}
