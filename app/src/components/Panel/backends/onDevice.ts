import { turnPromptText, type ModelBackend } from './backend'
import { SYSTEM_PROMPT } from '../systemPrompt'

/**
 * Minimal ambient surface for the experimental Prompt API. Per the spec
 * (webmachinelearning.github.io/prompt-api) and its README, tool use is
 * OPEN LOOP: prompt() resolves with content chunks (always an array once
 * expectedOutputs includes tool-call); `tool-call` chunks are executed by
 * the app and their results go back as `LanguageModelToolSuccess`
 * tool-response messages in a follow-up prompt. Closed-loop `execute`
 * auto-calling is a documented FUTURE extension — not implemented in any
 * browser — and must not be relied on.
 * Isolated here so experimental drift touches exactly one file.
 */
declare const LanguageModel: {
  availability(): Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'>
  create(options: {
    initialPrompts?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
    expectedInputs?: Array<{ type: string }>
    expectedOutputs?: Array<{ type: string }>
    tools?: Array<{
      name: string
      description: string
      inputSchema: object
    }>
    monitor?: (target: {
      addEventListener(type: 'downloadprogress', listener: (event: { loaded: number }) => void): void
    }) => void
  }): Promise<{
    prompt(input: string | Array<{ role: 'user'; content: unknown }>): Promise<
      string | Array<{ type?: string; value?: unknown }>
    >
    destroy(): void
  }>
}

/** A tool call the model emitted as a `tool-call` content chunk. */
interface ToolCallValue {
  callId: string
  name: string
  arguments: Record<string, unknown> | null
}

declare const LanguageModelToolSuccess: {
  new (init: {
    callId: string
    name: string
    result: Array<{ type: string; value: unknown }>
  }): unknown
}

/** Safety net against a model that never stops requesting tools. */
export const MAX_TOOL_ROUNDS = 24

export type OnDeviceAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available'

/** Current availability, or null when the Prompt API is absent (flags off, jsdom). */
export async function onDeviceStatus(): Promise<OnDeviceAvailability | null> {
  if (typeof LanguageModel === 'undefined') return null
  try {
    return await LanguageModel.availability()
  } catch {
    return 'unavailable'
  }
}

/** Starts the one-time model download; onProgress receives the loaded fraction 0..1. */
export async function downloadOnDeviceModel(
  onProgress?: (fractionLoaded: number) => void,
): Promise<void> {
  const session = await LanguageModel.create({
    monitor: onProgress
      ? (target) => target.addEventListener('downloadprogress', (e) => onProgress(e.loaded))
      : undefined,
  })
  session.destroy()
}

export const onDeviceBackend: ModelBackend = {
  id: 'on-device',
  async available() {
    const status = await onDeviceStatus()
    return status !== null && status !== 'unavailable'
  },
  async run(conversation, tools, onToolCall) {
    const status = await onDeviceStatus()
    if (status !== 'available') {
      throw new Error(
        status === null
          ? 'The Prompt API is not available in this browser (check the chrome://flags).'
          : `The on-device model is ${status}${status === 'downloadable' ? ' — use the Download button' : ''}.`,
      )
    }
    const last = conversation[conversation.length - 1]
    if (!last || last.role !== 'user') throw new Error('No user message to send.')
    // Fresh session per send, seeded with the prior exchange (tool cards become
    // assistant turns). The user agent's model decides on tools; we execute
    // the tool-call chunks it emits and answer with tool-response messages.
    const session = await LanguageModel.create({
      initialPrompts: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...conversation.slice(0, -1).map((turn) => ({
          role: turn.role === 'tool' ? ('assistant' as const) : turn.role,
          content: turnPromptText(turn),
        })),
      ],
      expectedInputs: [{ type: 'text' }, { type: 'tool-response' }],
      expectedOutputs: [{ type: 'text' }, { type: 'tool-call' }],
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    })
    try {
      let input: string | Array<{ role: 'user'; content: unknown }> = last.text
      let text = ''
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const result = await session.prompt(input)
        const chunks = typeof result === 'string' ? [{ type: 'text', value: result }] : result ?? []
        const roundText = chunks
          .filter((chunk) => chunk?.type === 'text')
          .map((chunk) => String(chunk.value))
          .join('')
        if (roundText) text = text ? `${text} ${roundText}` : roundText
        const calls = chunks
          .filter((chunk) => chunk?.type === 'tool-call')
          .map((chunk) => chunk.value as ToolCallValue)
        if (calls.length === 0) return text
        const responses: Array<{ type: 'tool-response'; value: unknown }> = []
        for (const call of calls) {
          const toolResult = await onToolCall(call.name, call.arguments ?? {})
          responses.push({
            type: 'tool-response',
            value: new LanguageModelToolSuccess({
              callId: call.callId,
              name: call.name,
              result: [{ type: 'text', value: toolResult }],
            }),
          })
        }
        input = [{ role: 'user', content: responses }]
      }
      throw new Error('The on-device model kept requesting tools without answering — try rephrasing.')
    } finally {
      session.destroy()
    }
  },
}