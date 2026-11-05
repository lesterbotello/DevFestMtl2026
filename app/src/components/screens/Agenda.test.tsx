import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Agenda from './Agenda'
import { StoreProvider } from '@/store/context'
import { key, saveValue } from '@/store/storage'

beforeEach(() => {
  localStorage.clear()
})

function renderAgenda(agenda: string[]) {
  saveValue(key('agenda'), agenda)
  render(
    <StoreProvider>
      <Agenda />
    </StoreProvider>,
  )
}

describe('Agenda screen', () => {
  it('flags both members of an overlapping saved pair', () => {
    renderAgenda(['agents-and-the-browser', 'ws-hands-on-webmcp'])
    expect(screen.getAllByText('Schedule conflict')).toHaveLength(2)
  })

  it('shows no conflict badge for non-overlapping saves', () => {
    renderAgenda(['webgpu-beyond-the-port', 'kotlin-in-production'])
    expect(screen.queryByText('Schedule conflict')).not.toBeInTheDocument()
  })

  it('lists sessions chronologically within the day', () => {
    renderAgenda(['kotlin-in-production', 'webgpu-beyond-the-port'])
    const times = screen
      .getAllByText(/^\d{2}:\d{2}$/)
      .map((el) => el.textContent)
    expect(times).toEqual(['14:00', '16:00'])
  })

  it('removes a session via its button', async () => {
    const user = userEvent.setup()
    renderAgenda(['webgpu-beyond-the-port'])
    await user.click(screen.getByRole('button', { name: /remove/i }))
    expect(screen.getByText(/agenda is empty/i)).toBeInTheDocument()
  })
})