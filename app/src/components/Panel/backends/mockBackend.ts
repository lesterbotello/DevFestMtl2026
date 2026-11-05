import type { ModelBackend } from './backend'

/**
 * Dev-only scripted backend for manual smoke runs (?mockBackend=1): it
 * issues a fixed onToolCall against whatever tools the panel discovered.
 */
const SCRIPT: Array<{ name: string; args: Record<string, unknown> }> = [
  { name: 'search_sessions', args: { query: 'webgpu' } },
]

export function createMockBackend(): ModelBackend {
  return {
    // Behaves as a local backend so the panel treats it like the on-device one.
    id: 'on-device',
    available: async () => true,
    async run(_conversation, tools, onToolCall) {
      const step = SCRIPT.find((s) => tools.some((t) => t.name === s.name))
      if (!step) {
        return 'No scripted tool is registered. Open the panel, pick a role, and try again.'
      }
      const result = await onToolCall(step.name, step.args)
      return `Mock agent ran ${step.name}. Tool said: ${result}`
    },
  }
}