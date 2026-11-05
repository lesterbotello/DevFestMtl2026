import { SEED } from '@/data/seed'
import { filterSessions } from '@/lib/filterSessions'

const sessions = SEED.sessions

describe('filterSessions', () => {
  it('query matches title case-insensitively', () => {
    const result = filterSessions(sessions, { query: 'webgpu' })
    expect(result.map((s) => s.id)).toContain('webgpu-beyond-the-port')
  })

  it('query matches speaker case-insensitively', () => {
    const result = filterSessions(sessions, { query: 'JUlia' })
    // No "Julia" in seed; use a seeded speaker fragment instead.
    const tremblay = filterSessions(sessions, { query: 'TREMBLAY' })
    expect(tremblay.map((s) => s.id)).toEqual(['webgpu-beyond-the-port'])
    expect(result).toEqual([])
  })

  it('combines track and day filters', () => {
    const result = filterSessions(sessions, { track: 'web', day: 'sat' })
    expect(result.map((s) => s.id)).toContain('webgpu-beyond-the-port')
    expect(result.every((s) => s.track === 'web' && s.day === 'sat')).toBe(true)
  })

  it('returns all sessions when no filters are set', () => {
    expect(filterSessions(sessions, {})).toHaveLength(sessions.length)
    expect(filterSessions(sessions, { query: '' })).toHaveLength(sessions.length)
  })

  it('filters by language', () => {
    const fr = filterSessions(sessions, { language: 'FR' })
    expect(fr.length).toBeGreaterThan(0)
    expect(fr.every((s) => s.language === 'FR')).toBe(true)
  })

  it('query matches against title OR speaker, not other fields', () => {
    const byRoom = filterSessions(sessions, { query: 'grand hall' })
    expect(byRoom).toEqual([])
  })
})