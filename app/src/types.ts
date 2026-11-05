export type Role = 'attendee' | 'organizer'
export type Language = 'EN' | 'FR'
export type Track = 'web' | 'ai-agents' | 'mobile' | 'cloud' | 'devtools'
export type Level = 'intro' | 'intermediate' | 'advanced'
export type Day = 'sat' | 'sun'

export interface Session {
  id: string
  title: string
  speaker: string
  room: string
  day: Day
  /** 'HH:MM' */
  start: string
  durationMin: number
  track: Track
  language: Language
  level: Level
  rating: number
  type: 'talk' | 'workshop'
  /** workshops only */
  price?: number
  seatsTotal?: number
  seatsRemaining?: number
}

export interface Registration {
  id: string
  workshopId: string
  email: string
  dietary: string
  date: Day
}

export interface Feedback {
  sessionId: string
  rating: number
  comment: string
}

export interface Question {
  id: string
  sessionId: string
  text: string
  upvotes: number
}

export interface Room {
  id: string
  name: string
  mic: 'ok' | 'fault'
  projector: 'ok' | 'fault'
  occupancy: number
}