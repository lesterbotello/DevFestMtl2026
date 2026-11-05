import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { key, saveValue } from '@/store/storage'

beforeEach(() => {
  localStorage.clear()
})

describe('App shell smoke', () => {
  it('renders the DevFest MTL heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /DevFest MTL '26/i })).toBeInTheDocument()
  })

  it('renders the six tab labels for organizers', () => {
    saveValue(key('role'), 'organizer')
    render(<App />)
    for (const label of ['Sessions', 'My Agenda', 'Workshops', 'Feedback', 'Q&A', 'Stage Manager']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument()
    }
  })

  it('hides the Stage Manager tab for attendees', () => {
    render(<App />)
    expect(screen.getByRole('tab', { name: 'Sessions' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Stage Manager' })).not.toBeInTheDocument()
  })

  it('shows the reset demo data link in the footer', () => {
    render(<App />)
    expect(screen.getByRole('link', { name: /reset demo data/i })).toBeInTheDocument()
  })

  it('flips the role when the toggle is clicked (provider wiring)', async () => {
    const user = userEvent.setup()
    render(<App />)
    const organizerButton = screen.getByRole('button', { name: 'Organizer' })
    expect(organizerButton).toHaveAttribute('aria-pressed', 'false')
    await user.click(organizerButton)
    expect(organizerButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('returns to the Sessions tab when flipping to Attendee while Stage Manager is open', async () => {
    const user = userEvent.setup()
    saveValue(key('role'), 'organizer')
    render(<App />)

    await user.click(screen.getByRole('tab', { name: 'Stage Manager' }))
    expect(screen.getByRole('tab', { name: 'Stage Manager' })).toHaveAttribute(
      'data-state',
      'active',
    )

    await user.click(screen.getByRole('button', { name: 'Attendee' }))

    // The Stage tab (and its organizer content) must be gone, and Sessions
    // must be the active tab again — no lingering organizer screen.
    expect(screen.queryByRole('tab', { name: 'Stage Manager' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Sessions' })).toHaveAttribute('data-state', 'active')
  })
})