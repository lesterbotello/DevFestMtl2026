import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import Workshops from './Workshops'
import { StoreProvider } from '@/store/context'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

beforeEach(() => {
  localStorage.clear()
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
})

function getDeclarativeForm(): HTMLFormElement {
  const form = document.querySelector('form[toolname="register_workshop"]')
  if (!(form instanceof HTMLFormElement)) throw new Error('declarative form not found')
  return form
}

describe('Workshops declarative WebMCP form', () => {
  it('exposes the signup form as a declarative tool with per-field descriptions', () => {
    render(
      <StoreProvider>
        <Workshops />
      </StoreProvider>,
    )

    const form = getDeclarativeForm()
    expect(form.getAttribute('tooldescription')).toBe(
      'Register the user for a paid, hands-on workshop. Seats are limited.',
    )
    // Human submits stay human: NO toolautosubmit
    expect(form.hasAttribute('toolautosubmit')).toBe(false)

    const workshopSelect = form.querySelector('select[name="workshop"]')
    const dateSelect = form.querySelector('select[name="date"]')
    const emailInput = form.querySelector('input[name="email"]')
    const dietaryCheckbox = form.querySelector('input[name="dietary"]')
    expect(workshopSelect?.getAttribute('toolparamdescription')).toBeTruthy()
    expect(dateSelect?.getAttribute('toolparamdescription')).toBeTruthy()
    expect(emailInput?.getAttribute('toolparamdescription')).toBeTruthy()
    expect(dietaryCheckbox?.getAttribute('toolparamdescription')).toBeTruthy()
  })

  it('agent-invoked submit shows the agent confirmation toast', async () => {
    const user = userEvent.setup()
    render(
      <StoreProvider>
        <Workshops />
      </StoreProvider>,
    )

    await user.selectOptions(screen.getByLabelText('Workshop'), 'ws-hands-on-webmcp')
    await user.type(screen.getByLabelText('Email'), 'you@example.com')

    const form = getDeclarativeForm()
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true })
    ;(submitEvent as Event & { agentInvoked?: boolean }).agentInvoked = true
    await act(async () => {
      form.dispatchEvent(submitEvent)
    })

    expect(toast.success).toHaveBeenCalledWith('Registration confirmed — prefilled by your agent 🤖')
    expect(screen.getByText(/23 seats remaining/i)).toBeInTheDocument()
    expect(toast.success).not.toHaveBeenCalledWith(expect.stringMatching(/^registered for/i))
  })

  it('agent-invoked submit resolves the declarative tool via respondWith', async () => {
    const user = userEvent.setup()
    render(
      <StoreProvider>
        <Workshops />
      </StoreProvider>,
    )

    await user.selectOptions(screen.getByLabelText('Workshop'), 'ws-hands-on-webmcp')
    await user.type(screen.getByLabelText('Email'), 'you@example.com')

    const received: string[] = []
    const form = getDeclarativeForm()
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true }) as Event & {
      agentInvoked?: boolean
      respondWith?: (p: Promise<string>) => void
    }
    submitEvent.agentInvoked = true
    submitEvent.respondWith = (p) => {
      p.then((value) => received.push(value))
    }
    await act(async () => {
      form.dispatchEvent(submitEvent)
    })

    // The declarative tool's executeTool promise resolves only through
    // respondWith (or form removal) — without this call, an agent-driven fill
    // leaves the panel busy forever after the human clicks Register.
    await vi.waitFor(() => {
      expect(received).toHaveLength(1)
      expect(received[0]).toMatch(/registered for/i)
    })
  })
})