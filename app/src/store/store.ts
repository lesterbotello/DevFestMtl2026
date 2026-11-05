import { SEED } from '@/data/seed'
import { key, loadValue, saveValue } from '@/store/storage'
import type { Day, Feedback, Question, Registration, Role, Room } from '@/types'

export type Result<T = undefined> =
  | { ok: true; message: string; data?: T }
  | { ok: false; message: string }

export interface AppState {
  agenda: string[]
  registrations: Registration[]
  feedback: Feedback[]
  questions: Question[]
  rooms: Room[]
  role: Role
}

export interface AppStore {
  getState(): AppState
  subscribe(fn: (s: AppState) => void): () => void
  /** Derived: seatsTotal minus registrations for the workshop. SEED is never mutated. */
  remainingSeats(workshopId: string): number
  addToAgenda(sessionId: string): Result
  removeFromAgenda(sessionId: string): Result
  registerWorkshop(input: {
    workshopId: string
    email: string
    dietary: string
    date: Day
  }): Result<Registration>
  cancelWorkshopRegistration(registrationId: string): Result
  submitFeedback(input: Feedback): Result
  askQuestion(sessionId: string, text: string): Result
  upvoteQuestion(questionId: string): void
  setRole(role: Role): void
  runAvCheck(roomId?: string): Result<Room[]>
  resetDemoData(): void
}

const fail = (message: string): Result<never> => ({ ok: false, message })

const cloneQuestions = (): Question[] => SEED.questions.map((q) => ({ ...q }))
const cloneRooms = (): Room[] => SEED.rooms.map((r) => ({ ...r }))

export function createAppStore(): AppStore {
  let state: AppState = {
    agenda: loadValue<string[]>(key('agenda')) ?? [],
    registrations: loadValue<Registration[]>(key('registrations')) ?? [],
    feedback: loadValue<Feedback[]>(key('feedback')) ?? [],
    questions: loadValue<Question[]>(key('questions')) ?? cloneQuestions(),
    rooms: loadValue<Room[]>(key('rooms')) ?? cloneRooms(),
    role: loadValue<Role>(key('role')) ?? 'attendee',
  }

  const listeners = new Set<(s: AppState) => void>()

  /** Merge a patch into state, persist the touched slices, then notify. */
  function update(patch: Partial<AppState>): void {
    state = { ...state, ...patch }
    if (patch.agenda) saveValue(key('agenda'), state.agenda)
    if (patch.registrations) saveValue(key('registrations'), state.registrations)
    if (patch.feedback) saveValue(key('feedback'), state.feedback)
    if (patch.questions) saveValue(key('questions'), state.questions)
    if (patch.rooms) saveValue(key('rooms'), state.rooms)
    if (patch.role) saveValue(key('role'), state.role)
    listeners.forEach((fn) => fn(state))
  }

  function getState(): AppState {
    return state
  }

  function subscribe(fn: (s: AppState) => void): () => void {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  }

  function remainingSeats(workshopId: string): number {
    const workshop = SEED.sessions.find((s) => s.id === workshopId)
    if (!workshop || workshop.type !== 'workshop' || !workshop.seatsTotal) return 0
    const taken = state.registrations.filter((r) => r.workshopId === workshopId).length
    return Math.max(0, workshop.seatsTotal - taken)
  }

  function addToAgenda(sessionId: string): Result {
    const session = SEED.sessions.find((s) => s.id === sessionId)
    if (!session) return fail(`Unknown session: ${sessionId}`)
    if (state.agenda.includes(sessionId)) {
      return fail(`${session.title} is already on your agenda.`)
    }
    update({ agenda: [...state.agenda, sessionId] })
    return { ok: true, message: `Added ${session.title} to your agenda.` }
  }

  function removeFromAgenda(sessionId: string): Result {
    const session = SEED.sessions.find((s) => s.id === sessionId)
    if (!session) return fail(`Unknown session: ${sessionId}`)
    if (!state.agenda.includes(sessionId)) {
      return fail(`${session.title} is not on your agenda.`)
    }
    update({ agenda: state.agenda.filter((id) => id !== sessionId) })
    return { ok: true, message: `Removed ${session.title} from your agenda.` }
  }

  function registerWorkshop(input: {
    workshopId: string
    email: string
    dietary: string
    date: Day
  }): Result<Registration> {
    const workshop = SEED.sessions.find((s) => s.id === input.workshopId)
    if (!workshop || workshop.type !== 'workshop') {
      return fail(`Unknown workshop: ${input.workshopId}`)
    }
    const email = input.email.trim()
    if (!email) return fail('An email address is required to register.')
    // Sold-out check first: a full workshop reports its real state to any
    // caller (sold-out is a seeded state — other attendees hold those seats).
    if (remainingSeats(input.workshopId) <= 0) {
      return fail(`Sorry — ${workshop.title} is sold out.`)
    }
    const already = state.registrations.some((r) => r.workshopId === input.workshopId)
    if (already) return fail(`You are already registered for ${workshop.title}.`)
    const registration: Registration = {
      id: crypto.randomUUID(),
      workshopId: input.workshopId,
      email,
      dietary: input.dietary ?? '',
      date: input.date,
    }
    update({ registrations: [...state.registrations, registration] })
    return {
      ok: true,
      message: `Registered for ${workshop.title} — ${remainingSeats(input.workshopId)} seat(s) remaining.`,
      data: registration,
    }
  }

  function cancelWorkshopRegistration(registrationId: string): Result {
    const registration = state.registrations.find((r) => r.id === registrationId)
    if (!registration) return fail(`No registration found with id ${registrationId}.`)
    const workshop = SEED.sessions.find((s) => s.id === registration.workshopId)
    update({
      registrations: state.registrations.filter((r) => r.id !== registrationId),
    })
    return {
      ok: true,
      message: `Cancelled ${workshop?.title ?? registration.workshopId} — ${remainingSeats(registration.workshopId)} seat(s) now available.`,
    }
  }

  function submitFeedback(input: Feedback): Result {
    const session = SEED.sessions.find((s) => s.id === input.sessionId)
    if (!session) return fail(`Unknown session: ${input.sessionId}`)
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      return fail('Rating must be between 1 and 5.')
    }
    update({
      feedback: [
        ...state.feedback,
        { sessionId: input.sessionId, rating: input.rating, comment: input.comment ?? '' },
      ],
    })
    return { ok: true, message: `Thanks for rating ${session.title}!` }
  }

  function askQuestion(sessionId: string, text: string): Result {
    const session = SEED.sessions.find((s) => s.id === sessionId)
    if (!session) return fail(`Unknown session: ${sessionId}`)
    if (!text.trim()) return fail('Question text is required.')
    const question: Question = {
      id: crypto.randomUUID(),
      sessionId,
      text: text.trim(),
      upvotes: 0,
    }
    // Newest first: the Q&A wall surfaces fresh questions at the top.
    update({ questions: [question, ...state.questions] })
    return { ok: true, message: 'Question posted to the Q&A wall.' }
  }

  function upvoteQuestion(questionId: string): void {
    const question = state.questions.find((q) => q.id === questionId)
    if (!question) return
    update({
      questions: state.questions.map((q) =>
        q.id === questionId ? { ...q, upvotes: q.upvotes + 1 } : q,
      ),
    })
  }

  function setRole(role: Role): void {
    update({ role })
  }

  function runAvCheck(roomId?: string): Result<Room[]> {
    const targets = roomId ? state.rooms.filter((r) => r.id === roomId) : state.rooms
    if (roomId && targets.length === 0) return fail(`Unknown room: ${roomId}`)
    const fixed: string[] = []
    const rooms = state.rooms.map((r) => {
      if (!targets.some((t) => t.id === r.id)) return r
      const next = { ...r }
      if (next.mic === 'fault') {
        next.mic = 'ok'
        fixed.push(`${r.name} mic`)
      }
      if (next.projector === 'fault') {
        next.projector = 'ok'
        fixed.push(`${r.name} projector`)
      }
      return next
    })
    update({ rooms })
    const scope = targets.map((r) => r.name).join(', ')
    const detail = fixed.length ? `Fixed: ${fixed.join(', ')}.` : 'No faults found.'
    return {
      ok: true,
      message: `AV check on ${scope} — ${detail}`,
      data: rooms.filter((r) => targets.some((t) => t.id === r.id)),
    }
  }

  function resetDemoData(): void {
    // Restores the full seed state (including role) but leaves panel settings alone.
    update({
      agenda: [],
      registrations: [],
      feedback: [],
      questions: cloneQuestions(),
      rooms: cloneRooms(),
      role: 'attendee',
    })
  }

  return {
    getState,
    subscribe,
    remainingSeats,
    addToAgenda,
    removeFromAgenda,
    registerWorkshop,
    cancelWorkshopRegistration,
    submitFeedback,
    askQuestion,
    upvoteQuestion,
    setRole,
    runAvCheck,
    resetDemoData,
  }
}