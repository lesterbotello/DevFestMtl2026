import type { AppStore } from '@/store/store'
import type { WebMCPToolDef } from '@/webmcp/modelContext'

export function createAgendaTools(store: AppStore): WebMCPToolDef[] {
  return [
    {
      name: 'add_to_agenda',
      description:
        "Add a session to the user's agenda by session id. Safe to call repeatedly — one call per session — to add multiple sessions.",
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Session id from search_sessions' },
        },
        required: ['sessionId'],
      },
      execute: async (args) => {
        const sessionId = typeof args.sessionId === 'string' ? args.sessionId : ''
        return store.addToAgenda(sessionId).message
      },
    },
    {
      name: 'remove_from_agenda',
      description: "Remove a session from the user's agenda by session id.",
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Session id to remove' },
        },
        required: ['sessionId'],
      },
      execute: async (args) => {
        const sessionId = typeof args.sessionId === 'string' ? args.sessionId : ''
        return store.removeFromAgenda(sessionId).message
      },
    },
  ]
}