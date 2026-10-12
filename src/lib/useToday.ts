import { useEffect, useState } from 'react'
import { toISO } from './dates'

/** today's date (YYYY-MM-DD), kept current across midnight and while the app sleeps in the background */
export function useToday() {
  const [today, setToday] = useState(() => toISO(new Date()))
  useEffect(() => {
    const check = () => setToday(toISO(new Date()))
    const timer = setInterval(check, 60_000)
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
  return today
}
