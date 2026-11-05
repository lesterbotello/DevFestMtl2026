import { render } from '@testing-library/react'
import { installMockModelContext, removeModelContext } from '@/test/setup'
import { StoreProvider } from '@/store/context'
import { useTools } from '@/webmcp/tools/useTools'
import type { Role } from '@/types'

function Probe({ role }: { role: Role }) {
  useTools(role)
  return null
}

function renderProbe(role: Role) {
  return render(
    <StoreProvider>
      <Probe role={role} />
    </StoreProvider>,
  )
}

afterEach(() => {
  removeModelContext()
})

describe('useTools role-driven registration', () => {
  it('registers exactly the 8 attendee tools when attendee', () => {
    const mock = installMockModelContext()
    renderProbe('attendee')
    expect(mock.registerTool).toHaveBeenCalledTimes(8)
    const names = mock.registerTool.mock.calls.map(([tool]) => tool.name)
    expect(names).toContain('search_sessions')
    expect(names).not.toContain('run_av_check')
    expect(names).not.toContain('get_room_status')
  })

  it('registers 10 tools when organizer', () => {
    const mock = installMockModelContext()
    renderProbe('organizer')
    expect(mock.registerTool).toHaveBeenCalledTimes(10)
    const names = mock.registerTool.mock.calls.map(([tool]) => tool.name)
    expect(names).toContain('run_av_check')
    expect(names).toContain('get_room_status')
  })

  it('flipping role unregisters then re-registers the organizer set', () => {
    const mock = installMockModelContext()
    const utils = renderProbe('organizer')
    expect(mock.registerTool).toHaveBeenCalledTimes(10)

    const organizerSignals = mock.registerTool.mock.calls
      .filter(([tool]) => tool.name === 'run_av_check' || tool.name === 'get_room_status')
      .map(([, options]) => {
        if (!options?.signal) throw new Error('missing signal')
        return options.signal
      })
    expect(organizerSignals).toHaveLength(2)

    // organizer → attendee: organizer tools abort, no new registrations
    utils.rerender(
      <StoreProvider>
        <Probe role="attendee" />
      </StoreProvider>,
    )
    expect(organizerSignals.every((s) => s.aborted)).toBe(true)
    expect(mock.registerTool).toHaveBeenCalledTimes(10)

    // attendee → organizer: the organizer set registers again
    utils.rerender(
      <StoreProvider>
        <Probe role="organizer" />
      </StoreProvider>,
    )
    expect(mock.registerTool).toHaveBeenCalledTimes(12)
  })
})