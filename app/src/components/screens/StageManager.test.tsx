import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import StageManager from './StageManager'
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

function renderStageManager() {
  render(
    <StoreProvider>
      <StageManager />
    </StoreProvider>,
  )
}

function roomCard(id: string): HTMLElement {
  const card = document.querySelector(`[data-room="${id}"]`)
  if (!(card instanceof HTMLElement)) throw new Error(`no card for room ${id}`)
  return card
}

describe('Stage Manager screen', () => {
  it('shows Grand Hall with a faulted mic', () => {
    renderStageManager()
    const hall = roomCard('grand-hall')
    expect(within(hall).getByText('Grand Hall')).toBeInTheDocument()
    expect(within(hall).getByText('Mic 🟡')).toBeInTheDocument()
    expect(within(hall).getByText('Projector 🟢')).toBeInTheDocument()
  })

  it('Run AV check fixes every fault and toasts', async () => {
    const user = userEvent.setup()
    renderStageManager()

    expect(within(roomCard('grand-hall')).getByText('Mic 🟡')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /run av check/i }))
    expect(within(roomCard('grand-hall')).getByText('Mic 🟢')).toBeInTheDocument()
    expect(within(roomCard('studio-b')).getByText('Projector 🟢')).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/av check/i))
  })

  it('Refresh keeps statuses in sync', async () => {
    const user = userEvent.setup()
    renderStageManager()
    await user.click(screen.getByRole('button', { name: /refresh/i }))
    expect(toast.success).toHaveBeenCalled()
    expect(within(roomCard('grand-hall')).getByText('Mic 🟡')).toBeInTheDocument()
  })
})