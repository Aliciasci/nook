export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function nowMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60
}

export function formatDuration(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes))
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}`
}

/**
 * La même durée, en plus court : « 45 min », « 3h », « 1h30 ».
 *
 * Pour les pastilles et les grands chiffres, où « 03h 00 » met deux zéros
 * inutiles sous les yeux. `formatDuration` reste la forme alignée, celle des
 * tableaux et des bilans où les durées se comparent en colonne.
 */
export function formatDurationShort(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes))
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

export function formatDurationWithSeconds(totalMinutes: number): string {
  const totalSeconds = Math.max(0, Math.round(totalMinutes * 60))
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}
