import { SYSTEM_PROMPT } from '../systemPrompt'
import { turnPromptText, type ModelBackend } from './backend'

/**
 * A turn as spoken to the cloud server: plain text turns plus the structured
 * tool-protocol entries appended during a run (call requested, result returned).
 */
export type CloudMessage =
  | { role: 'user' | 'assistant'; text: string }
  | {
      role: 'tool-call'
      name: string
      args: Record<string, unknown>
      /** Gemini issues this with each call and requires it back on the next request. */
      thoughtSignature?: string
    }
  | { role: 'tool-result'; name: string; content: string }

/** Hard cap so a model that never stops calling tools cannot loop forever.
 * Generous enough for multi-call chaining runs (several tool calls in one
 * exchange), small enough to fail fast when the model loops. */
const MAX_TOOL_HOPS = 10

/**
 * The cloud Gemini fallback. The panel POSTs { systemPrompt, tools, messages }
 * to `${serverUrl}/chat`; the server (server/index.mjs, zero-dep) translates to
 * Gemini generateContent. Each response is either { text } (final answer) or
 * { toolCalls: [{name, args, thoughtSignature}] } — tool calls run through
 * onToolCall (same gate and error contract as the on-device backend), and
 * their results loop back to the server alongside the signature Gemini
 * issued, which its 3.x thinking models require on the next round-trip.
 * The API key never leaves the server process.
 */
export function cloudBackend(serverUrl: string): ModelBackend {
  return {
    id: 'cloud',
    available: async () => true,
    async run(conversation, tools, onToolCall) {
      // Tool cards from prior exchanges become assistant turns; the structured
      // tool-call/tool-result pairs for THIS run are appended below.
      const messages: CloudMessage[] = conversation.map((turn) => ({
        role: turn.role === 'tool' ? ('assistant' as const) : turn.role,
        text: turnPromptText(turn),
      }))

      for (let hop = 0; hop < MAX_TOOL_HOPS; hop++) {
        const response = await fetch(`${serverUrl}/chat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            systemPrompt: SYSTEM_PROMPT,
            tools: tools.map(({ name, description, inputSchema }) => ({
              name,
              description,
              inputSchema,
            })),
            messages,
          }),
        })
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null
          throw new Error(
            body?.error
              ? `Cloud server: ${body.error}`
              : `Cloud server responded with ${response.status}.`,
          )
        }

        const data = (await response.json()) as {
          text?: string
          toolCalls?: Array<{
            name: string
            args?: Record<string, unknown>
            thoughtSignature?: string
          }>
        }
        if (typeof data.text === 'string') return data.text
        if (!data.toolCalls?.length) {
          throw new Error('Cloud server returned neither text nor toolCalls.')
        }

        for (const call of data.toolCalls) {
          const args = call.args ?? {}
          messages.push({
            role: 'tool-call',
            name: call.name,
            args,
            thoughtSignature: call.thoughtSignature,
          })
          const content = await onToolCall(call.name, args)
          messages.push({ role: 'tool-result', name: call.name, content })
        }
      }
      throw new Error('Cloud model exceeded the tool-call loop limit.')
    },
  }
}