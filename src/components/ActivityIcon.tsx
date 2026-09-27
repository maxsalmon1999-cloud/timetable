import { ICON_COMPONENTS } from '../lib/iconMap'
import type { IconWeight } from '../lib/types'

/**
 * An activity's icon by Phosphor name. With no/unknown icon it renders nothing,
 * or the first letter of `fallback` (used in the round icon discs).
 */
export function ActivityIcon({
  name,
  weight = 'bold',
  size = 24,
  className,
  fallback,
}: {
  name?: string
  weight?: IconWeight
  size?: number
  className?: string
  fallback?: string
}) {
  const Icon = name ? ICON_COMPONENTS[name] : undefined
  if (Icon) return <Icon weight={weight} size={size} className={className} aria-hidden />
  const letter = fallback?.trim()[0]
  return letter ? <span className="icon-letter" style={{ fontSize: size * 0.85 }} aria-hidden>{letter.toUpperCase()}</span> : null
}
