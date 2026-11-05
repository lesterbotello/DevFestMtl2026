import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import Workshops from './Workshops'
import { StoreProvider } from '@/store/context'
import { key, loadValue, saveValue } from '@/store/storage'
import { fillLikePolyfill } from '@/test/setup'
import type { Registration } from '@/types'

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

function renderWorkshops(registrations: Registration[] = []) {
  if (registrations.length) saveValue(key('registrations'), registrations)
  render(
    <StoreProvider>
      <Workshops />
    </StoreProvider>,
  )
}

describe('Workshops screen', () => {
  it('disables the sold-out workshop option and errors on attempt', async () => {
    const user = userEvent.setup()
    // Fill every seat of ws-figma-to-code (seatsTotal: 16)
    const regs: Registration[] = Array.from({ length: 16 }, (_, i) => ({
      id: `r${i}`,
      workshopId: 'ws-figma-to-code',
      email: `p${i}@example.com`,
      dietary: '',
      date: 'sat',
    }))
    renderWorkshops(regs)

    const workshopSelect = screen.getByLabelText('Workshop') as HTMLSelectElement
    const soldOutOption = workshopSelect.querySelector(
      'option[value="ws-figma-to-code"]',
    ) as HTMLOptionElement
    expect(soldOutOption.disabled).toBe(true)
    expect(screen.getByText(/sold out/i)).toBeInTheDocument()

    // Force the disabled value through (stale UI state) and submit
    fireEvent.change(workshopSelect, { target: { value: 'ws-figma-to-code' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'you@example.com' } })
    await user.click(screen.getByRole('button', { name: /^Register$/ }))
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/sold out/i))
    expect(screen.getByText(/sold out/i)).toBeInTheDocument()
    expect(screen.queryByText(/you@example\.com/)).not.toBeInTheDocument()
  })

  it('successful registration appends to My registrations and decrements seats', async () => {
    const user = userEvent.setup()
    renderWorkshops()

    expect(screen.getByText(/24 seats remaining/i)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Workshop'), 'ws-hands-on-webmcp')
    await user.type(screen.getByLabelText('Email'), 'you@example.com')
    await user.click(screen.getByRole('button', { name: /^Register$/ }))

    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/registered/i))
    expect(screen.getByText(/23 seats remaining/i)).toBeInTheDocument()
    expect(screen.getByText(/you@example\.com/)).toBeInTheDocument()
  })

  it('cancels a registration and restores the seat', async () => {
    const user = userEvent.setup()
    const reg: Registration = {
      id: 'reg-1',
      workshopId: 'ws-hands-on-webmcp',
      email: 'you@example.com',
      dietary: '',
      date: 'sat',
    }
    renderWorkshops([reg])

    expect(screen.getByText(/23 seats remaining/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/cancel/i))
    expect(screen.getByText(/24 seats remaining/i)).toBeInTheDocument()
    expect(screen.queryByText(/you@example\.com/)).not.toBeInTheDocument()
  })

  it('shows the dietary detail input only when the checkbox is checked', async () => {
    const user = userEvent.setup()
    renderWorkshops()
    expect(screen.queryByLabelText(/dietary requirements/i)).not.toBeInTheDocument()
    await user.click(screen.getByLabelText(/dietary needs/i))
    expect(screen.getByLabelText(/dietary requirements/i)).toBeInTheDocument()
  })

  it('registers from DOM values after a polyfill-style fill, deriving the date from the workshop', async () => {
    const user = userEvent.setup()
    renderWorkshops()

    // Fill exactly like the vendored polyfill does (plain value write + events):
    // controlled state syncing from these is not guaranteed — the submit
    // handler must read the DOM (FormData) to see them.
    fillLikePolyfill(screen.getByLabelText('Workshop') as HTMLSelectElement, 'ws-observabilite-otel')
    fillLikePolyfill(screen.getByLabelText('Email') as HTMLInputElement, 'agent@devfest.dev')

    await user.click(screen.getByRole('button', { name: /^Register$/ }))

    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/registered/i))
    const saved = loadValue<Registration[]>(key('registrations'))
    expect(saved).toHaveLength(1)
    expect(saved![0]).toMatchObject({
      workshopId: 'ws-observabilite-otel',
      email: 'agent@devfest.dev',
      // ws-observabilite-otel runs on Sunday; the workshop's day is
      // authoritative even though the (stale) date select still says 'sat'.
      date: 'sun',
    })
  })

  it('syncs the date select when a human picks a workshop', async () => {
    const user = userEvent.setup()
    renderWorkshops()

    const dateSelect = screen.getByLabelText('Date') as HTMLSelectElement
    expect(dateSelect.value).toBe('sat')

    await user.selectOptions(screen.getByLabelText('Workshop'), 'ws-observabilite-otel')
    expect(dateSelect.value).toBe('sun')

    await user.selectOptions(screen.getByLabelText('Workshop'), 'ws-hands-on-webmcp')
    expect(dateSelect.value).toBe('sat')
  })
})