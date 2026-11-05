import { SYSTEM_PROMPT } from '../systemPrompt'
import { cloudBackend } from './cloud'
import type { ChatTurn, DiscoveredTool } from './backend'

afterEach(() => {
  vi.unstubAllGlobals()
})

const tools: DiscoveredTool[] = [
  {
    name: 'add_to_agenda',
    description: 'Add a session to the agenda',
    inputSchema: { type: 'object' },
    ref: 'ref-1',
  },
]

const conversation: ChatTurn[] = [
  { role: 'user', text: 'Find WebGPU talks on Saturday' },
  { role: 'tool', text: '→ search_sessions {"query":"webgpu"}' },
  { role: 'assistant', text: 'There is one WebGPU talk: 2pm Saturday.' },
  { role: 'user', text: 'Add it to my agenda' },
]

describe('cloudBackend', () => {
  it('builds the right request and loops tool calls until final text', async () => {
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          toolCalls: [{ name: 'add_to_agenda', args: { sessionId: 'webgpu-beyond-the-port' } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ text: 'Added WebGPU: Beyond the Port to your agenda.' }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const onToolCall = vi.fn(async () => 'Added WebGPU: Beyond the Port to your agenda.')
    const backend = cloudBackend('http://localhost:8787')
    const result = await backend.run(conversation, tools, onToolCall)

    expect(result).toBe('Added WebGPU: Beyond the Port to your agenda.')
    expect(onToolCall).toHaveBeenCalledWith('add_to_agenda', { sessionId: 'webgpu-beyond-the-port' })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const [url1, init1] = fetchMock.mock.calls[0]
    expect(url1).toBe('http://localhost:8787/chat')
    expect(init1.method).toBe('POST')
    expect(init1.headers['content-type']).toBe('application/json')
    const payload1 = JSON.parse(init1.body)
    expect(payload1.systemPrompt).toBe(SYSTEM_PROMPT)
    expect(payload1.tools).toEqual([
      {
        name: 'add_to_agenda',
        description: 'Add a session to the agenda',
        inputSchema: { type: 'object' },
      },
    ])
    expect(payload1.messages).toEqual([
      { role: 'user', text: 'Find WebGPU talks on Saturday' },
      { role: 'assistant', text: '→ search_sessions {"query":"webgpu"}' },
      { role: 'assistant', text: 'There is one WebGPU talk: 2pm Saturday.' },
      { role: 'user', text: 'Add it to my agenda' },
    ])

    const [url2, init2] = fetchMock.mock.calls[1]
    expect(url2).toBe('http://localhost:8787/chat')
    const payload2 = JSON.parse(init2.body)
    expect(payload2.messages.slice(-2)).toEqual([
      { role: 'tool-call', name: 'add_to_agenda', args: { sessionId: 'webgpu-beyond-the-port' } },
      {
        role: 'tool-result',
        name: 'add_to_agenda',
        content: 'Added WebGPU: Beyond the Port to your agenda.',
      },
    ])
  })

  it('sends the tool error string back to the model as the tool result', async () => {
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ toolCalls: [{ name: 'add_to_agenda', args: { sessionId: 'missing' } }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ text: 'The tool reported an error, so nothing was added.' }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const onToolCall = vi.fn(async () => 'Error: Tool not registered')
    const backend = cloudBackend('http://localhost:9999')
    const result = await backend.run(conversation, tools, onToolCall)

    expect(result).toBe('The tool reported an error, so nothing was added.')
    const payload2 = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(payload2.messages).toContainEqual({
      role: 'tool-result',
      name: 'add_to_agenda',
      content: 'Error: Tool not registered',
    })
  })

  it('surfaces server failures as errors instead of crashing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    const backend = cloudBackend('http://localhost:8787')
    await expect(backend.run(conversation, tools, async () => 'unused')).rejects.toThrow(/500/)
  })

  it('stops after a bounded number of tool-call hops', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ toolCalls: [{ name: 'add_to_agenda', args: {} }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const backend = cloudBackend('http://localhost:8787')
    await expect(backend.run(conversation, tools, async () => 'ok')).rejects.toThrow(
      /tool-call loop limit/,
    )
  })

  it('supports multi-hop chaining (9 tool calls) before the final text', async () => {
    // A chained run issues several tool calls in one exchange; the bound must allow it.
    const fetchMock = vi.fn()
    for (let hop = 0; hop < 9; hop++) {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ toolCalls: [{ name: 'add_to_agenda', args: { hop } }] }),
      })
    }
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'Done after chaining.' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const onToolCall = vi.fn(async () => 'ok')
    const backend = cloudBackend('http://localhost:8787')
    const result = await backend.run(conversation, tools, onToolCall)

    expect(result).toBe('Done after chaining.')
    expect(fetchMock).toHaveBeenCalledTimes(10)
    expect(onToolCall).toHaveBeenCalledTimes(9)
  })

  it('sends prior tool results back to the model so follow-ups can resolve ids', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Added WebGPU: Beyond the Port to your agenda.' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const withResult: ChatTurn[] = [
      { role: 'user', text: 'Find WebGPU talks on Saturday' },
      {
        role: 'tool',
        text: '→ search_sessions {"query":"webgpu"}',
        result: '- webgpu-beyond-the-port: WebGPU: Beyond the Port · Saturday 14:00',
      },
      { role: 'assistant', text: 'I found one: 2pm Saturday.' },
      { role: 'user', text: 'Add the 2pm one to my agenda' },
    ]

    const backend = cloudBackend('http://localhost:8787')
    const result = await backend.run(withResult, tools, async () => 'unused')

    expect(result).toBe('Added WebGPU: Beyond the Port to your agenda.')
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(payload.messages).toContainEqual({
      role: 'assistant',
      text: '→ search_sessions {"query":"webgpu"}\n- webgpu-beyond-the-port: WebGPU: Beyond the Port · Saturday 14:00',
    })
  })

  it('forwards Gemini thought signatures back with each tool-call round-trip', async () => {
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          toolCalls: [
            {
              name: 'add_to_agenda',
              args: { sessionId: 'webgpu-beyond-the-port' },
              thoughtSignature: 'sig-abc',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ text: 'Added WebGPU: Beyond the Port to your agenda.' }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const onToolCall = vi.fn(async () => 'Added WebGPU: Beyond the Port to your agenda.')
    const backend = cloudBackend('http://localhost:8787')
    const result = await backend.run(conversation, tools, onToolCall)

    expect(result).toBe('Added WebGPU: Beyond the Port to your agenda.')
    const payload2 = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(payload2.messages).toContainEqual({
      role: 'tool-call',
      name: 'add_to_agenda',
      args: { sessionId: 'webgpu-beyond-the-port' },
      thoughtSignature: 'sig-abc',
    })
  })

  it('surfaces the server error body, not just the status code', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: 'Function call is missing a thought_signature.' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const backend = cloudBackend('http://localhost:8787')
    await expect(backend.run(conversation, tools, async () => 'unused')).rejects.toThrow(
      /thought_signature/,
    )
  })
})