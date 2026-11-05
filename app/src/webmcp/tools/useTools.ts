import { useMemo } from 'react'
import { useAppStore } from '@/store/context'
import type { AppStore } from '@/store/store'
import type { Role } from '@/types'
import { createAgendaTools } from '@/webmcp/tools/agendaTools'
import { createOrganizerTools } from '@/webmcp/tools/organizerTools'
import { createQuestionTools } from '@/webmcp/tools/questionTools'
import { createRegistrationTools } from '@/webmcp/tools/registrationTools'
import { createSessionTools } from '@/webmcp/tools/sessionTools'
import { useWebMCPTool } from '@/webmcp/useWebMCPTool'
import type { WebMCPToolDef } from '@/webmcp/modelContext'

/** The eight attendee-facing tools, composed from the per-file factories. */
export function createAttendeeTools(store: AppStore): WebMCPToolDef[] {
  return [
    ...createSessionTools(store),
    ...createAgendaTools(store),
    ...createRegistrationTools(store),
    ...createQuestionTools(store),
  ]
}

/**
 * Role-driven WebMCP registration: the attendee set is always registered;
 * the organizer set registers only while role is 'organizer' (and unregisters
 * via the hook's abort when the role changes, firing `toolchange`).
 */
export function useTools(role: Role): void {
  const { actions } = useAppStore()
  const attendeeTools = useMemo(() => createAttendeeTools(actions), [actions])
  const organizerTools = useMemo(() => createOrganizerTools(actions), [actions])
  const isOrganizer = role === 'organizer'

  // Fixed hook counts — enabled flag does the gating.
  for (const tool of attendeeTools) {
    useWebMCPTool(tool, true)
  }
  for (const tool of organizerTools) {
    useWebMCPTool(tool, isOrganizer)
  }
}