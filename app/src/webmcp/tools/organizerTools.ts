import type { AppStore } from '@/store/store'
import type { WebMCPToolDef } from '@/webmcp/modelContext'

export function createOrganizerTools(store: AppStore): WebMCPToolDef[] {
  return [
    {
      name: 'run_av_check',
      description:
        'Run an AV check on one room (by room id) or on every room, fixing any mic or projector faults found. Organizer tool.',
      inputSchema: {
        type: 'object',
        properties: {
          roomId: {
            type: 'string',
            description: 'Optional room id to check (e.g. "grand-hall"); omit to check all rooms',
          },
        },
      },
      annotations: { debugging: true },
      execute: async (args) => {
        const roomId = typeof args.roomId === 'string' && args.roomId ? args.roomId : undefined
        return store.runAvCheck(roomId).message
      },
    },
    {
      name: 'get_room_status',
      description:
        'Read the current AV status (mic, projector, occupancy) of every room. Organizer tool, read-only.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { debugging: true, readOnlyHint: true },
      execute: async () => {
        const rooms = store.getState().rooms
        if (rooms.length === 0) return 'No rooms found.'
        return rooms
          .map(
            (r) =>
              `- ${r.id} (${r.name}): mic ${r.mic} · projector ${r.projector} · occupancy ${r.occupancy}`,
          )
          .join('\n')
      },
    },
  ]
}