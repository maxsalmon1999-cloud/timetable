import { ICON_COMPONENTS } from '../lib/iconMap'
import type { IconWeight } from '../lib/types'

/** An activity's icon by Phosphor name; renders nothing for no/unknown icon (discs use discIcon() to always have one) */
export function ActivityIcon({ name, weight = 'bold', size = 24, className }: { name?: string; weight?: IconWeight; size?: number; className?: string }) {
  const Icon = name ? ICON_COMPONENTS[name] : undefined
  return Icon ? <Icon weight={weight} size={size} className={className} aria-hidden /> : null
}
