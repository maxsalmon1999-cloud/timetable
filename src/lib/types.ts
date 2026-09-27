export interface Activity {
  id: string
  name: string
  color: string
  /** default length in minutes when dropped onto the calendar */
  duration: number
}

export interface Block {
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
export interface TemplateBlock {
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
  version: 1
  activities: Activity[]
  blocks: Block[]
  templates: Template[]
  /** Monday (YYYY-MM-DD) of each week she chose to sync with Apple Calendar */
  syncedWeeks?: string[]
}
