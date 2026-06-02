/** YYYY-MM-DD in the user's local timezone — not UTC. */
export function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Format a YYYY-MM-DD (or null) for display, e.g. "3 May 2026" or "—". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  // `iso` is a plain date string. Adding T00:00 keeps the same calendar day
  // when constructing a Date (parsing "2026-05-03" alone is treated as UTC,
  // which can land yesterday in some timezones).
  const d = new Date(`${iso}T00:00:00`)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Inclusive day count between two YYYY-MM-DDs. Used for "read in 7 days". */
export function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00`).getTime()
  const end = new Date(`${endIso}T00:00:00`).getTime()
  if (isNaN(start) || isNaN(end)) return 0
  return Math.round((end - start) / 86_400_000) + 1
}
