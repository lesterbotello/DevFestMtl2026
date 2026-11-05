import { SEED } from '@/data/seed'
import { findConflicts, overlaps } from '@/lib/conflicts'
import { key, saveValue } from '@/store/storage'
import { createAppStore } from '@/store/store'
import type { Day, Registration } from '@/types'

let store: ReturnType<typeof createAppStore>

beforeEach(() => {
  localStorage.clear()
  store = createAppStore()
})

describe('overlaps', () => {
  const s = (start: string, durationMin: number, day: Day = 'sat') => ({
    ...SEED.sessions[0],
    start,
    durationMin,
    day,
  })

  it('detects intersecting ranges', () => {
    expect(overlaps(s('14:00', 45), s('14:30', 45))).toBe(true)
    expect(overlaps(s('15:30', 90), s('15:30', 45))).toBe(true)
  })

  it('does not flag adjacent or disjoint ranges', () => {
    expect(overlaps(s('13:00', 90), s('14:30', 45))).toBe(false)
    expect(overlaps(s('09:00', 45), s('16:00', 45))).toBe(false)
  })

  it('does not flag the same slot on different days', () => {
    expect(overlaps(s('14:00', 45, 'sat'), s('14:00', 45, 'sun'))).toBe(false)
  })
})

describe('findConflicts', () => {
  it('flags both members of an overlapping saved pair', () => {
    const agenda = ['agents-and-the-browser', 'ws-hands-on-webmcp']
    const conflicts = findConflicts(agenda, SEED.sessions)
    expect(conflicts).toContainEqual({ a: 'agents-and-the-browser', b: 'ws-hands-on-webmcp' })
  })

  it('finds no conflicts in a clean agenda', () => {
    expect(findConflicts(['webgpu-beyond-the-port', 'kotlin-in-production'], SEED.sessions)).toEqual([])
  })
})

describe('agenda', () => {
  it('persists and notifies subscribers', () => {
    const spy = vi.fn()
    store.subscribe(spy)
    const result = store.addToAgenda('webgpu-beyond-the-port')
    expect(result.ok).toBe(true)
    expect(store.getState().agenda).toContain('webgpu-beyond-the-port')
    expect(spy).toHaveBeenCalled()
    // persistence: a fresh store reads the same state
    expect(createAppStore().getState().agenda).toContain('webgpu-beyond-the-port')
  })

  it('rejects unknown session ids without throwing', () => {
    const result = store.addToAgenda('nope')
    expect(result.ok).toBe(false)
  })

  it('rejects duplicates with a clear message', () => {
    store.addToAgenda('webgpu-beyond-the-port')
    const result = store.addToAgenda('webgpu-beyond-the-port')
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/already/i)
  })

  it('allows adding an overlapping session (flagged, not blocked)', () => {
    const first = store.addToAgenda('agents-and-the-browser')
    const second = store.addToAgenda('ws-hands-on-webmcp')
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(findConflicts(store.getState().agenda, SEED.sessions)).toHaveLength(1)
  })

  it('removes sessions and rejects unknown removals', () => {
    store.addToAgenda('webgpu-beyond-the-port')
    expect(store.removeFromAgenda('webgpu-beyond-the-port').ok).toBe(true)
    expect(store.getState().agenda).not.toContain('webgpu-beyond-the-port')
    expect(store.removeFromAgenda('webgpu-beyond-the-port').ok).toBe(false)
  })
})

describe('workshop registration', () => {
  const workshopId = 'ws-hands-on-webmcp'

  it('decrements derived remaining seats and returns the registration', () => {
    expect(store.remainingSeats(workshopId)).toBe(24)
    const result = store.registerWorkshop({ workshopId, email: 'you@example.com', dietary: '', date: 'sat' })
    expect(result.ok).toBe(true)
    if (!result.ok || !result.data) throw new Error('expected ok with data')
    expect(result.data.id).toBeTruthy()
    expect(store.remainingSeats(workshopId)).toBe(23)
  })

  it('rejects unknown workshops and duplicates', () => {
    expect(store.registerWorkshop({ workshopId: 'nope', email: 'a@b.c', dietary: '', date: 'sat' }).ok).toBe(false)
    store.registerWorkshop({ workshopId, email: 'you@example.com', dietary: '', date: 'sat' })
    const again = store.registerWorkshop({ workshopId, email: 'you@example.com', dietary: '', date: 'sat' })
    expect(again.ok).toBe(false)
    expect(again.message).toMatch(/already registered/i)
  })

  it('blocks a second registration for the same workshop even with a different email', () => {
    // One registration per workshop, period (the plan pins same-workshop
    // blocking — the email is not part of the key).
    const first = store.registerWorkshop({ workshopId, email: 'you@example.com', dietary: '', date: 'sat' })
    expect(first.ok).toBe(true)
    const second = store.registerWorkshop({ workshopId, email: 'someone-else@example.com', dietary: '', date: 'sat' })
    expect(second.ok).toBe(false)
    expect(second.message).toMatch(/already registered/i)
    expect(store.remainingSeats(workshopId)).toBe(23)
  })

  it('sells out cleanly: blocks at zero and never goes negative', () => {
    const small = 'ws-figma-to-code' // seatsTotal: 16
    // One registration per workshop means the API alone can't fill 16 seats,
    // so seed the sold-out state directly (other attendees' registrations).
    const seeded: Registration[] = Array.from({ length: 16 }, (_, i) => ({
      id: `sold-${i}`,
      workshopId: small,
      email: `attendee${i}@example.com`,
      dietary: '',
      date: 'sat',
    }))
    saveValue(key('registrations'), seeded)
    store = createAppStore()
    expect(store.remainingSeats(small)).toBe(0)
    const blocked = store.registerWorkshop({ workshopId: small, email: 'late@example.com', dietary: '', date: 'sat' })
    expect(blocked.ok).toBe(false)
    expect(blocked.message).toMatch(/sold out/i)
    expect(store.remainingSeats(small)).toBe(0)
    expect(store.getState().registrations).toHaveLength(16)
  })

  it('cancel restores the seat', () => {
    const reg = store.registerWorkshop({ workshopId, email: 'you@example.com', dietary: '', date: 'sat' })
    if (!reg.ok || !reg.data) throw new Error('expected ok with data')
    expect(store.cancelWorkshopRegistration(reg.data.id).ok).toBe(true)
    expect(store.remainingSeats(workshopId)).toBe(24)
    expect(store.getState().registrations).toHaveLength(0)
    expect(store.cancelWorkshopRegistration(reg.data.id).ok).toBe(false)
  })
})

describe('feedback and questions', () => {
  it('submits valid feedback and rejects invalid input', () => {
    expect(store.submitFeedback({ sessionId: 'webgpu-beyond-the-port', rating: 5, comment: 'Great!' }).ok).toBe(true)
    expect(store.submitFeedback({ sessionId: 'nope', rating: 5, comment: 'x' }).ok).toBe(false)
    expect(store.submitFeedback({ sessionId: 'webgpu-beyond-the-port', rating: 6, comment: 'x' }).ok).toBe(false)
    expect(store.getState().feedback).toHaveLength(1)
  })

  it('asks and upvotes questions', () => {
    const result = store.askQuestion('webgpu-beyond-the-port', 'Will slides be shared?')
    expect(result.ok).toBe(true)
    const question = store.getState().questions[0]
    expect(question.sessionId).toBe('webgpu-beyond-the-port')
    const before = question.upvotes
    store.upvoteQuestion(question.id)
    expect(store.getState().questions[0].upvotes).toBe(before + 1)
    expect(store.askQuestion('nope', 'x').ok).toBe(false)
  })
})

describe('rooms and role', () => {
  it('runAvCheck scoped to grand-hall fixes only the mic fault', () => {
    const result = store.runAvCheck('grand-hall')
    expect(result.ok).toBe(true)
    if (!result.ok || !result.data) throw new Error('expected ok with data')
    expect(result.data.find((r) => r.id === 'grand-hall')!.mic).toBe('ok')
    expect(result.message).toMatch(/grand hall/i)
    // scoped: studio-b projector fault untouched
    expect(store.getState().rooms.find((r) => r.id === 'studio-b')!.projector).toBe('fault')
  })

  it('runAvCheck with no argument checks every room', () => {
    const result = store.runAvCheck()
    expect(result.ok).toBe(true)
    expect(store.getState().rooms.every((r) => r.mic === 'ok' && r.projector === 'ok')).toBe(true)
  })

  it('persists the role', () => {
    store.setRole('organizer')
    expect(createAppStore().getState().role).toBe('organizer')
  })
})

describe('resetDemoData', () => {
  it('restores seed state and empties user data', () => {
    store.addToAgenda('webgpu-beyond-the-port')
    store.registerWorkshop({ workshopId: 'ws-hands-on-webmcp', email: 'a@b.c', dietary: '', date: 'sat' })
    store.submitFeedback({ sessionId: 'webgpu-beyond-the-port', rating: 5, comment: 'nice' })
    store.runAvCheck()
    store.setRole('organizer')

    store.resetDemoData()
    const s = store.getState()
    expect(s.agenda).toEqual([])
    expect(s.registrations).toEqual([])
    expect(s.feedback).toEqual([])
    expect(s.questions).toEqual(SEED.questions)
    expect(s.rooms.find((r) => r.id === 'grand-hall')!.mic).toBe('fault')
    expect(s.role).toBe('attendee')
    // and persistence is wiped: a fresh store also sees the reset
    expect(createAppStore().getState().agenda).toEqual([])
  })
})