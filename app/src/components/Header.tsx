import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/context'

export default function Header() {
  const { state, actions } = useAppStore()
  const isOrganizer = state.role === 'organizer'

  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">DevFest MTL &apos;26</h1>
          <Badge variant={isOrganizer ? 'default' : 'secondary'}>
            {isOrganizer ? 'Organizer' : 'Attendee'}
          </Badge>
        </div>
        <div
          className="inline-flex items-center gap-1 rounded-lg border p-1"
          role="group"
          aria-label="Role"
        >
          <Button
            size="sm"
            aria-pressed={state.role === 'attendee'}
            variant={state.role === 'attendee' ? 'default' : 'ghost'}
            onClick={() => actions.setRole('attendee')}
          >
            Attendee
          </Button>
          <Button
            size="sm"
            aria-pressed={isOrganizer}
            variant={isOrganizer ? 'default' : 'ghost'}
            onClick={() => actions.setRole('organizer')}
          >
            Organizer
          </Button>
        </div>
      </div>
    </header>
  )
}