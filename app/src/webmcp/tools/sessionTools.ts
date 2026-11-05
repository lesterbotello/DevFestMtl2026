import { SEED } from '@/data/seed'
import { findConflicts } from '@/lib/conflicts'
import { filterSessions } from '@/lib/filterSessions'
import type { AppStore } from '@/store/store'
import type { Day, Language, Level, Track } from '@/types'
import type { WebMCPToolDef } from '@/webmcp/modelContext'

export const dayName = (day: Day): string => (day === 'sat' ? 'Saturday' : 'Sunday')

/** 'all' — like an omitted value — means "no filter" in that dimension. */
function unAll<T>(value: unknown): T | undefined {
  return value === 'all' ? undefined : (value as T | undefined)
}

export const sessionLine = (id: string): string => {
  const s = SEED.sessions.find((x) => x.id === id)
  if (!s) return `- ${id} (unknown session)`
  return `- ${s.id}: ${s.title} · ${dayName(s.day)} ${s.start} · ${s.room} · ${s.language} · ${s.track} · ${s.type}`
}

export function createSessionTools(store: AppStore): WebMCPToolDef[] {
  return [
    {
      name: 'search_sessions',
      description:
        'Search conference sessions by title or speaker, with optional filters for track, day, language, and level. Returns matching sessions with their ids, titles, and times. Always put the user\'s search words in `query` — e.g. "Find WebGPU talks on Saturday" means query="WebGPU" and day="sat", nothing else. Omit any filter the user did not explicitly ask for; pass "all" to search every value of a filter.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'The words to search for, matched case-insensitively against session titles and speakers. Always put the user\'s search words here — e.g. for "Find WebGPU talks on Saturday", query="WebGPU".',
          },
          track: {
            type: 'string',
            enum: ['all', 'web', 'ai-agents', 'mobile', 'cloud', 'devtools'],
            description:
              'Session track. Set only when the user explicitly names a track (web, ai-agents, mobile, cloud, devtools); never guess a track from the search words — "WebGPU talks" does not mean the web track. Omit or pass "all" for every track.',
          },
          day: {
            type: 'string',
            enum: ['all', 'sat', 'sun'],
            description: 'Conference day — omit or "all" for both days',
          },
          language: {
            type: 'string',
            enum: ['all', 'EN', 'FR'],
            description: 'Session language — omit or "all" for every language',
          },
          level: {
            type: 'string',
            enum: ['all', 'intro', 'intermediate', 'advanced'],
            description: 'Session level — omit or "all" for every level',
          },
        },
      },
      annotations: { readOnlyHint: true },
      execute: async (args) => {
        const sessions = filterSessions(SEED.sessions, {
          query: typeof args.query === 'string' ? args.query : undefined,
          track: unAll<Track>(args.track),
          day: unAll<Day>(args.day),
          language: unAll<Language>(args.language),
          level: unAll<Level>(args.level),
        })
        if (sessions.length === 0) return 'No sessions matched those filters.'
        return sessions.map((s) => sessionLine(s.id)).join('\n')
      },
    },
    {
      name: 'get_session_details',
      description: 'Get full details (title, speaker, time, room, rating, price) for one session by id.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Session id from search_sessions' },
        },
        required: ['sessionId'],
      },
      annotations: { readOnlyHint: true },
      execute: async (args) => {
        const id = typeof args.sessionId === 'string' ? args.sessionId : ''
        const s = SEED.sessions.find((x) => x.id === id)
        if (!s) return `No session found with id "${id}".`
        const price = s.price !== undefined ? ` · $${s.price} workshop` : ''
        return [
          `${s.title} (${s.id})`,
          `Speaker: ${s.speaker}`,
          `When: ${dayName(s.day)} at ${s.start} (${s.durationMin} min)`,
          `Where: ${s.room}`,
          `Language: ${s.language} · Track: ${s.track} · Level: ${s.level}`,
          `Rating: ${s.rating.toFixed(1)}${price}`,
        ].join('\n')
      },
    },
    {
      name: 'get_my_agenda',
      description:
        "List the sessions saved on the user's agenda, with any schedule conflicts flagged. Read-only.",
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: async () => {
        const agenda = store.getState().agenda
        if (agenda.length === 0) return 'Your agenda is empty.'
        const lines = agenda.map((id) => sessionLine(id))
        const conflicts = findConflicts(agenda, SEED.sessions)
        if (conflicts.length > 0) {
          lines.push(
            `Conflicts: ${conflicts.map((c) => `${c.a} ↔ ${c.b}`).join(', ')} — the user may want to drop one.`,
          )
        }
        return lines.join('\n')
      },
    },
  ]
}