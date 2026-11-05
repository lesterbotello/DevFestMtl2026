import { afterEach, describe, expect, it, vi } from 'vitest'
import { onDeviceBackend, MAX_TOOL_ROUNDS } from './onDevice'
import type { ChatTurn, DiscoveredTool } from './backend'

/**
 * The Prompt API's tool use is OPEN LOOP (per the spec and the prompt-api
 * README: closed-loop `execute` auto-calling is "not yet part of the
 * specification or implemented in browsers"). These tests mock Chrome's
 * documented behavior: prompt() resolves with content chunks, tool-call
 * chunks are executed by the app, and tool responses go back as
 * `{role:'user', content:[{type:'tool-response', value: ToolSuccess}]}`.
 * Nothing ever invokes a tool's `execute` member.
 */

class FakeToolSuccess {
  readonly init: Record<string, unknown>
  constructor(init: Record<string, unknown>) {
    this.init = init
  }
}

interface FakeToolCall {
  callId: string
  name: string
  arguments: Record<string, unknown>
}

type ContentChunk = { type?: string; value?: unknown }
type PromptResult = string | ContentChunk[]

const tools: DiscoveredTool[] = [
  {
    name: 'search_sessions',
    description: 'Search sessions',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: [] },
    ref: 'ref-1',
  },
]

const conversation: ChatTurn[] = [{ role: 'user', text: 'Find WebGPU talks on Saturday' }]

interface LanguageMockOptions {
  /** One entry per prompt() call; the last entry repeats if exhausted. */
  rounds: PromptResult[]
}

function installLanguageModelMock({ rounds }: LanguageMockOptions) {
  const created: Array<Record<string, unknown>> = []
  const promptCalls: unknown[] = []
  let destroyed = 0

  const session = {
    prompt: async (input: unknown) => {
      promptCalls.push(input)
      const index = Math.min(promptCalls.length - 1, rounds.length - 1)
      return rounds[index]
    },
    destroy: () => {
      destroyed++
    },
  }

  vi.stubGlobal('LanguageModelToolSuccess', FakeToolSuccess)
  vi.stubGlobal('LanguageModel', {
    availability: async () => 'available',
    create: async (options: Record<string, unknown>) => {
      created.push(options)
      return session
    },
  })

  return { created, promptCalls, destroyed: () => destroyed }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('onDeviceBackend.run — open-loop tool use', () => {
  it('executes tool-call chunks and feeds LanguageModelToolSuccess back until final text', async () => {
    const searchCall: FakeToolCall = {
      callId: 'call-1',
      name: 'search_sessions',
      arguments: { query: 'webgpu' },
    }
    const { created, promptCalls, destroyed } = installLanguageModelMock({
      rounds: [
        [{ type: 'tool-call', value: searchCall }],
        [{ type: 'text', value: 'Found WebGPU: Beyond the Port (Sat 14:00).' }],
      ],
    })
    const onToolCall = vi.fn(async () => 'webgpu-beyond-the-port — Sat 14:00')

    const result = await onDeviceBackend.run(conversation, tools, onToolCall)

    expect(result).toBe('Found WebGPU: Beyond the Port (Sat 14:00).')
    expect(onToolCall).toHaveBeenCalledWith('search_sessions', { query: 'webgpu' })
    // The session was created with the README's pinned options — and without
    // an `execute` member, which no browser implements.
    expect(created[0].expectedInputs).toEqual([{ type: 'text' }, { type: 'tool-response' }])
    expect(created[0].expectedOutputs).toEqual([{ type: 'text' }, { type: 'tool-call' }])
    expect(created[0].tools).toEqual([
      {
        name: 'search_sessions',
        description: 'Search sessions',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: [] },
      },
    ])
    // First prompt() is the user text; the second is the tool response.
    expect(promptCalls[0]).toBe('Find WebGPU talks on Saturday')
    expect(promptCalls[1]).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'tool-response',
            value: expect.any(FakeToolSuccess),
          },
        ],
      },
    ])
    const response = (promptCalls[1] as Array<{ content: Array<{ value: FakeToolSuccess }> }>)[0]
      .content[0].value
    expect(response.init).toEqual({
      callId: 'call-1',
      name: 'search_sessions',
      result: [{ type: 'text', value: 'webgpu-beyond-the-port — Sat 14:00' }],
    })
    expect(destroyed()).toBe(1)
  })

  it('handles multiple tool calls in one round and any text emitted alongside them', async () => {
    const { promptCalls } = installLanguageModelMock({
      rounds: [
        [
          { type: 'text', value: 'Searching and checking your agenda…' },
          { type: 'tool-call', value: { callId: 'a', name: 'search_sessions', arguments: { query: 'webgpu' } } },
          { type: 'tool-call', value: { callId: 'b', name: 'get_my_agenda', arguments: {} } },
        ],
        [{ type: 'text', value: 'Found it.' }],
      ],
    })
    const onToolCall = vi.fn(async (_name: string) => 'done')

    const result = await onDeviceBackend.run(conversation, tools, onToolCall)

    expect(result).toBe('Searching and checking your agenda… Found it.')
    expect(onToolCall).toHaveBeenCalledTimes(2)
    expect(onToolCall).toHaveBeenNthCalledWith(1, 'search_sessions', { query: 'webgpu' })
    expect(onToolCall).toHaveBeenNthCalledWith(2, 'get_my_agenda', {})
    // Both responses ride back in ONE follow-up prompt message.
    const followUp = promptCalls[1] as Array<{ content: Array<{ value: FakeToolSuccess }> }>
    expect(followUp[0].content).toHaveLength(2)
    expect(followUp[0].content[0].value.init).toMatchObject({ callId: 'a', name: 'search_sessions' })
    expect(followUp[0].content[1].value.init).toMatchObject({ callId: 'b', name: 'get_my_agenda' })
  })

  it('returns a text-only round directly (chunks array without tool calls)', async () => {
    installLanguageModelMock({
      rounds: [[{ type: 'text', value: 'No tools needed here.' }]],
    })
    const onToolCall = vi.fn(async () => 'unused')

    const result = await onDeviceBackend.run(conversation, tools, onToolCall)

    expect(result).toBe('No tools needed here.')
    expect(onToolCall).not.toHaveBeenCalled()
  })

  it('stops a model that never stops requesting tools', async () => {
    installLanguageModelMock({
      rounds: [
        [
          {
            type: 'tool-call',
            value: { callId: 'loop', name: 'search_sessions', arguments: {} },
          },
        ],
      ],
    })
    const onToolCall = vi.fn(async () => 'result')

    await expect(onDeviceBackend.run(conversation, tools, onToolCall)).rejects.toThrow(
      /kept requesting tools/,
    )
    expect(onToolCall).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS)
  })

  it('still gates on model availability before creating a session', async () => {
    vi.stubGlobal('LanguageModel', { availability: async () => 'downloadable' })
    const onToolCall = vi.fn(async () => 'unused')

    await expect(onDeviceBackend.run(conversation, tools, onToolCall)).rejects.toThrow(
      /The on-device model is downloadable/,
    )
    expect(onToolCall).not.toHaveBeenCalled()
  })

  it('seeds prior tool results so a follow-up send can resolve session ids', async () => {
    const { created } = installLanguageModelMock({
      rounds: [[{ type: 'text', value: 'Added WebGPU: Beyond the Port to your agenda.' }]],
    })
    const followUp: ChatTurn[] = [
      { role: 'user', text: 'Find WebGPU talks on Saturday' },
      {
        role: 'tool',
        text: '→ search_sessions {"day":"sat","query":"WebGPU"}',
        result:
          '- webgpu-beyond-the-port: WebGPU: Beyond the Port · Saturday 14:00 · Salle 512 · EN · web · talk',
      },
      { role: 'assistant', text: 'I found one WebGPU talk: 2pm Saturday.' },
      { role: 'user', text: 'Add the 2pm one to my agenda' },
    ]

    await onDeviceBackend.run(followUp, tools, vi.fn(async () => 'unused'))

    const seeded = (created[0].initialPrompts as Array<{ role: string; content: string }>).find(
      (p) => p.content.includes('search_sessions'),
    )
    expect(seeded?.role).toBe('assistant')
    expect(seeded?.content).toContain('webgpu-beyond-the-port')
  })
})