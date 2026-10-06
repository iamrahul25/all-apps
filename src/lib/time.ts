import { useEffect, useState } from 'react'

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'always' })
const relativeUnits: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]]

export function formatTimeAgo(date: Date, now: number) {
  const seconds = Math.round((now - date.getTime()) / 1000)
  for (const [unit, unitSeconds] of relativeUnits) if (seconds >= unitSeconds) return relativeTime.format(-Math.floor(seconds / unitSeconds), unit)
  return 'just now'
}

export function useNow(intervalMs: number) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), intervalMs); return () => clearInterval(timer) }, [intervalMs])
  return now
}
