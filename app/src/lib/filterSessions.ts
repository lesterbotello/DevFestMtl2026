import type { Day, Language, Level, Session, Track } from '@/types'

export interface SessionFilters {
  query?: string
  track?: Track
  day?: Day
  language?: Language
  level?: Level
}

/**
 * Pure search/filter for the session browser.
 * Query case-insensitively matches title or speaker; other filters exact-match when set.
 */
export function filterSessions(sessions: Session[], f: SessionFilters): Session[] {
  const q = f.query?.trim().toLowerCase() ?? ''
  return sessions.filter((s) => {
    if (q && !s.title.toLowerCase().includes(q) && !s.speaker.toLowerCase().includes(q)) {
      return false
    }
    if (f.track && s.track !== f.track) return false
    if (f.day && s.day !== f.day) return false
    if (f.language && s.language !== f.language) return false
    if (f.level && s.level !== f.level) return false
    return true
  })
}