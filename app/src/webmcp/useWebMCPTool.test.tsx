import { render } from '@testing-library/react'
import { installMockModelContext, removeModelContext } from '@/test/setup'
import { useWebMCPTool } from '@/webmcp/useWebMCPTool'
import type { WebMCPToolDef } from '@/webmcp/modelContext'

const tool: WebMCPToolDef = {
  name: 'echo_test',
  description: 'Test tool',
  inputSchema: { type: 'object', properties: {} },
  execute: async (args) => `echo:${String(args.q ?? '')}`,
}

function Probe() {
  useWebMCPTool(tool)
  return null
}

afterEach(() => {
  removeModelContext()
})

describe('useWebMCPTool', () => {
  it('registers the tool with a signal on mount', () => {
    const mock = installMockModelContext()
    render(<Probe />)
    expect(mock.registerTool).toHaveBeenCalledTimes(1)
    const [registered, options] = mock.registerTool.mock.calls[0]
    expect(registered).toBe(tool)
    expect(options?.signal).toBeInstanceOf(AbortSignal)
  })

  it('aborts the registration on unmount', () => {
    const mock = installMockModelContext()
    const utils = render(<Probe />)
    const [, options] = mock.registerTool.mock.calls[0]
    if (!options?.signal) throw new Error('missing signal')
    const aborted = vi.fn()
    options.signal.addEventListener('abort', aborted)
    utils.unmount()
    expect(aborted).toHaveBeenCalledTimes(1)
    expect(options.signal.aborted).toBe(true)
  })

  it('the registered execute runs with (args, { signal })', async () => {
    const mock = installMockModelContext()
    render(<Probe />)
    const [registered] = mock.registerTool.mock.calls[0]
    const result = await registered.execute(
      { q: 'webgpu' },
      { signal: new AbortController().signal },
    )
    expect(result).toBe('echo:webgpu')
  })

  it('no-ops (no throw, no registration) when there is no model context', () => {
    removeModelContext()
    expect(() => render(<Probe />)).not.toThrow()
  })
})