import type { Session } from '@/types'

/** 'HH:MM' → minutes since midnight */
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** True when two sessions' time ranges intersect on the same day. */
export function overlaps(a: Session, b: Session): boolean {
  if (a.day !== b.day) return false
  const aStart = toMinutes(a.start)
  const bStart = toMinutes(b.start)
  return aStart < bStart + b.durationMin && bStart < aStart + a.durationMin
}

/** Every overlapping pair among the agenda's sessions, in agenda order. */
export function findConflicts(
  agenda: string[],
  sessions: Session[],
): { a: string; b: string }[] {
  const byId = new Map(sessions.map((s) => [s.id, s]))
  const picked = agenda
    .map((id) => byId.get(id))
    .filter((s): s is Session => s !== undefined)
  const conflicts: { a: string; b: string }[] = []
  for (let i = 0; i < picked.length; i++) {
    for (let j = i + 1; j < picked.length; j++) {
      const a = picked[i]
      const b = picked[j]
      if (a && b && overlaps(a, b)) conflicts.push({ a: a.id, b: b.id })
    }
  }
  return conflicts
}