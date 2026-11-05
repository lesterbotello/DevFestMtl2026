import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import FeedbackScreen, { validateFeedback } from './FeedbackScreen'
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

function renderScreen() {
  render(
    <StoreProvider>
      <FeedbackScreen />
    </StoreProvider>,
  )
}

describe('validateFeedback (pure)', () => {
  it('rejects a missing session', () => {
    expect(validateFeedback({ sessionId: '', rating: 5, comment: '' })).toMatch(/session/i)
  })

  it('rejects out-of-range ratings', () => {
    expect(validateFeedback({ sessionId: 'x', rating: 0, comment: '' })).toMatch(/rating/i)
    expect(validateFeedback({ sessionId: 'x', rating: 6, comment: '' })).toMatch(/rating/i)
  })

  it('accepts valid input (comment optional)', () => {
    expect(validateFeedback({ sessionId: 'webgpu-beyond-the-port', rating: 3, comment: '' })).toBeNull()
  })
})

describe('Feedback screen', () => {
  it('missing session shows an error and the store stays empty', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByRole('button', { name: /submit/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/pick a session/i)
    expect(screen.getByText(/no feedback yet/i)).toBeInTheDocument()
  })

  it('valid input persists and appears in the list below', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.selectOptions(screen.getByLabelText('Session'), 'webgpu-beyond-the-port')
    await user.selectOptions(screen.getByLabelText('Rating'), '5')
    await user.type(screen.getByLabelText('Comment'), 'Stunning WebGPU demos!')
    await user.click(screen.getByRole('button', { name: /submit/i }))

    expect(within(screen.getByRole('list')).getByText(/WebGPU: Beyond the Port/)).toBeInTheDocument()
    expect(screen.getByText(/Stunning WebGPU demos!/)).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalled()
    expect(screen.queryByText(/no feedback yet/i)).not.toBeInTheDocument()
  })
})