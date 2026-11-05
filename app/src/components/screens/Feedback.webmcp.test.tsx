import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { createAppStore } from '@/store/store'
import { StoreProvider } from '@/store/context'
import { key, loadValue } from '@/store/storage'
import { fillLikePolyfill, installMockModelContext, removeModelContext } from '@/test/setup'
import { installDeclarativeToasts } from '@/webmcp/declarativeEvents'
import FeedbackScreen, { handleFeedbackSubmit } from './FeedbackScreen'
import type { Feedback } from '@/types'

vi.mock('sonner', () => {
  const t = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() })
  return { toast: t }
})

beforeEach(() => {
  localStorage.clear()
  vi.mocked(toast).mockClear()
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
  removeModelContext()
})

function getDeclarativeForm(): HTMLFormElement {
  const form = document.querySelector('form[toolname="submit_feedback"]')
  if (!(form instanceof HTMLFormElement)) throw new Error('declarative feedback form not found')
  return form
}

describe('feedback declarative form attributes', () => {
  it('carries toolname, toolautosubmit, and per-field descriptions', () => {
    render(
      <StoreProvider>
        <FeedbackScreen />
      </StoreProvider>,
    )

    const form = getDeclarativeForm()
    expect(form.getAttribute('tooldescription')).toBe('Rate a talk and leave a short comment.')
    expect(form.hasAttribute('toolautosubmit')).toBe(true)
    expect(form.querySelector('select[name="sessionId"]')?.getAttribute('toolparamdescription')).toBeTruthy()
    expect(form.querySelector('select[name="rating"]')?.getAttribute('toolparamdescription')).toBeTruthy()
    expect(form.querySelector('textarea[name="comment"]')?.getAttribute('toolparamdescription')).toBeTruthy()
  })
})

describe('handleFeedbackSubmit (respondWith contract)', () => {
  it('invalid input: respond receives resolved "Error: <message>", nothing persists', async () => {
    const store = createAppStore()
    const respond = vi.fn()
    const result = handleFeedbackSubmit(store, { sessionId: '', rating: 5, comment: '' }, respond)
    expect(result.ok).toBe(false)
    expect(respond).toHaveBeenCalledTimes(1)
    const promise = respond.mock.calls[0][0] as Promise<string>
    await expect(promise).resolves.toMatch(/^Error: /)
    expect(store.getState().feedback).toEqual([])
  })

  it('valid input: respond receives resolved "Feedback recorded ✓" and feedback persists', async () => {
    const store = createAppStore()
    const respond = vi.fn()
    const input: Feedback = { sessionId: 'webgpu-beyond-the-port', rating: 5, comment: 'Great!' }
    const result = handleFeedbackSubmit(store, input, respond)
    expect(result.ok).toBe(true)
    const promise = respond.mock.calls[0][0] as Promise<string>
    await expect(promise).resolves.toBe('Feedback recorded ✓')
    expect(store.getState().feedback).toHaveLength(1)
  })

  it('manual path (noop respond): store result still drives the UI, respondWith untouched', () => {
    const store = createAppStore()
    const respond = vi.fn()
    const input: Feedback = { sessionId: 'webgpu-beyond-the-port', rating: 4, comment: 'nice' }
    const result = handleFeedbackSubmit(store, input, respond)
    expect(result.ok).toBe(true)
    expect(store.getState().feedback).toHaveLength(1)
  })
})

describe('agent-invoked autosubmit (component level)', () => {
  it('respondWith receives the resolved result and the feedback renders', async () => {
    const user = userEvent.setup()
    render(
      <StoreProvider>
        <FeedbackScreen />
      </StoreProvider>,
    )

    await user.selectOptions(screen.getByLabelText('Session'), 'webgpu-beyond-the-port')
    await user.selectOptions(screen.getByLabelText('Rating'), '5')

    const received: string[] = []
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true }) as Event & {
      agentInvoked?: boolean
      respondWith?: (p: Promise<string>) => void
    }
    submitEvent.agentInvoked = true
    submitEvent.respondWith = (p) => {
      p.then((value) => received.push(value))
    }

    await act(async () => {
      getDeclarativeForm().dispatchEvent(submitEvent)
    })

    await vi.waitFor(() => expect(received).toEqual(['Feedback recorded ✓']))
    expect(screen.queryByText(/no feedback yet/i)).not.toBeInTheDocument()
  })

  it('agent submit reads DOM values after a polyfill-style fill, not React state', async () => {
    render(
      <StoreProvider>
        <FeedbackScreen />
      </StoreProvider>,
    )

    // Fill exactly like the vendored polyfill does (plain value write + events).
    // Controlled state syncing from these events is not guaranteed — the
    // submit handler must read the DOM (FormData) to see them.
    fillLikePolyfill(screen.getByLabelText('Session') as HTMLSelectElement, 'webgpu-beyond-the-port')
    fillLikePolyfill(screen.getByLabelText('Rating') as HTMLSelectElement, '5')
    fillLikePolyfill(screen.getByLabelText('Comment') as HTMLTextAreaElement, 'Loved the live demo!')

    const received: string[] = []
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true }) as Event & {
      agentInvoked?: boolean
      respondWith?: (p: Promise<string>) => void
    }
    submitEvent.agentInvoked = true
    submitEvent.respondWith = (p) => {
      p.then((value) => received.push(value))
    }

    await act(async () => {
      getDeclarativeForm().dispatchEvent(submitEvent)
    })

    await vi.waitFor(() => expect(received).toEqual(['Feedback recorded ✓']))
    expect(loadValue<Feedback[]>(key('feedback'))).toEqual([
      { sessionId: 'webgpu-beyond-the-port', rating: 5, comment: 'Loved the live demo!' },
    ])
  })
})

describe('installDeclarativeToasts', () => {
  it('toasts on toolactivated/toolcancel and uninstalls cleanly', () => {
    const mock = installMockModelContext()
    const uninstall = installDeclarativeToasts()

    const activatedListener = mock.addEventListener.mock.calls.find(
      ([type]) => type === 'toolactivated',
    )?.[1]
    const cancelListener = mock.addEventListener.mock.calls.find(
      ([type]) => type === 'toolcancel',
    )?.[1]
    expect(activatedListener).toBeTypeOf('function')
    expect(cancelListener).toBeTypeOf('function')

    activatedListener?.()
    expect(toast).toHaveBeenCalledWith('Agent is filling this form…')
    cancelListener?.()
    expect(toast).toHaveBeenCalledWith('Agent cancelled')

    uninstall()
    expect(mock.removeEventListener).toHaveBeenCalled()
  })

  it('no-ops without a model context', () => {
    removeModelContext()
    expect(() => installDeclarativeToasts()).not.toThrow()
  })
})