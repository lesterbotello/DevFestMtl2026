import { SEED } from '@/data/seed'
import type { AppStore } from '@/store/store'
import type { WebMCPToolDef } from '@/webmcp/modelContext'
import { dayName } from '@/webmcp/tools/sessionTools'

export function createRegistrationTools(store: AppStore): WebMCPToolDef[] {
  return [
    {
      name: 'get_my_registrations',
      description:
        "List the user's paid workshop registrations, including the registrationId needed to cancel.",
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: async () => {
        const registrations = store.getState().registrations
        if (registrations.length === 0) return 'You have no workshop registrations yet.'
        return registrations
          .map((r) => {
            const workshop = SEED.sessions.find((s) => s.id === r.workshopId)
            return `- ${r.id}: ${workshop?.title ?? r.workshopId} · ${dayName(r.date)} · ${r.email}`
          })
          .join('\n')
      },
    },
    {
      name: 'cancel_workshop_registration',
      description:
        'Cancel one workshop registration by registrationId. This frees up the seat and is not reversible — check with the user first.',
      inputSchema: {
        type: 'object',
        properties: {
          registrationId: {
            type: 'string',
            description: 'registrationId from get_my_registrations',
          },
        },
        required: ['registrationId'],
      },
      annotations: { consequentialHint: true },
      execute: async (args) => {
        const registrationId =
          typeof args.registrationId === 'string' ? args.registrationId : ''
        return store.cancelWorkshopRegistration(registrationId).message
      },
    },
  ]
}