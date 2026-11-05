import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SEED } from '@/data/seed'
import { useAppStore } from '@/store/context'
import type { Day } from '@/types'

const dayLabel = (day: Day) => (day === 'sat' ? 'Saturday' : 'Sunday')

// Declarative WebMCP attributes — custom DOM attributes, cast for JSX typing.
// NO toolautosubmit on this form: the human clicks Register.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const webmcpFormProps = {
  toolname: 'register_workshop',
  tooldescription: 'Register the user for a paid, hands-on workshop. Seats are limited.',
} as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const workshopToolProps = { toolparamdescription: 'The workshop to register for.' } as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dateToolProps = { toolparamdescription: 'The day of the workshop.' } as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const emailToolProps = {
  toolparamdescription: "The attendee's email address for the registration.",
} as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dietaryToolProps = {
  toolparamdescription: 'Whether the attendee has dietary requirements.',
} as any

export default function Workshops() {
  const { state, actions } = useAppStore()
  const workshops = SEED.sessions.filter((s) => s.type === 'workshop')

  const [workshopId, setWorkshopId] = useState('')
  const [date, setDate] = useState<Day>('sat')
  const [email, setEmail] = useState('')
  const [dietaryChecked, setDietaryChecked] = useState(false)
  const [dietaryDetail, setDietaryDetail] = useState('')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // Declarative WebMCP invokes submit with agentInvoked on the native event.
    const nativeEvent = e.nativeEvent as Event & {
      agentInvoked?: boolean
      respondWith?: (p: Promise<string>) => void
    }
    const agentInvoked = nativeEvent.agentInvoked === true
    // Read the DOM, not React controlled state: the WebMCP fill path writes
    // DOM values directly, and whether controlled state has synced by submit
    // time is not guaranteed — FormData is authoritative for humans and
    // agents alike.
    const fd = new FormData(e.currentTarget)
    const formWorkshopId = String(fd.get('workshop') ?? '')
    const workshop = workshops.find((w) => w.id === formWorkshopId)
    const result = actions.registerWorkshop({
      workshopId: formWorkshopId,
      email: String(fd.get('email') ?? ''),
      // An unchecked checkbox is absent from FormData — exactly the empty case.
      dietary: fd.get('dietary') ? String(fd.get('dietaryDetails') ?? '') : '',
      // The workshop's day is authoritative; the date select is a convenience
      // display (kept in sync for humans by the workshop onChange below).
      date: workshop?.day ?? (String(fd.get('date') ?? 'sat') as Day),
    })
    // Resolve the declarative tool's executeTool promise — without this form's
    // autosubmit, respondWith is the only way the agent learns the outcome.
    if (agentInvoked) nativeEvent.respondWith?.(Promise.resolve(result.message))
    if (result.ok) {
      toast.success(
        agentInvoked ? 'Registration confirmed — prefilled by your agent 🤖' : result.message,
      )
    } else {
      toast.error(result.message)
    }
  }

  function handleCancel(registrationId: string) {
    const result = actions.cancelWorkshopRegistration(registrationId)
    if (result.ok) {
      toast.success(result.message)
    } else {
      toast.error(result.message)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        {workshops.map((w) => {
          const seats = actions.remainingSeats(w.id)
          return (
            <Card key={w.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{w.title}</CardTitle>
                  {seats > 0 ? (
                    <Badge variant="secondary">{seats} seats remaining</Badge>
                  ) : (
                    <Badge variant="destructive">Sold out</Badge>
                  )}
                </div>
                <CardDescription>
                  {w.speaker} · {dayLabel(w.day)} {w.start} · {w.room} · {w.language} · ${w.price}
                </CardDescription>
              </CardHeader>
            </Card>
          )
        })}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sign up for a workshop</CardTitle>
            <CardDescription>Seats are limited — first come, first served.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit} {...webmcpFormProps}>
              <div className="space-y-1.5">
                <Label htmlFor="workshop">Workshop</Label>
                <select
                  id="workshop"
                  name="workshop"
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={workshopId}
                  onChange={(e) => {
                    const id = e.target.value
                    setWorkshopId(id)
                    // Keep the date select in sync with the chosen workshop's day.
                    const selected = workshops.find((w) => w.id === id)
                    if (selected) setDate(selected.day)
                  }}
                  {...workshopToolProps}
                >
                  <option value="" disabled>
                    Select a workshop…
                  </option>
                  {workshops.map((w) => (
                    <option key={w.id} value={w.id} disabled={actions.remainingSeats(w.id) === 0}>
                      {w.title} ({dayLabel(w.day)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="date">Date</Label>
                <select
                  id="date"
                  name="date"
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={date}
                  onChange={(e) => setDate(e.target.value as Day)}
                  {...dateToolProps}
                >
                  <option value="sat">Saturday</option>
                  <option value="sun">Sunday</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  {...emailToolProps}
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="dietary"
                    className="size-4 rounded border-input"
                    checked={dietaryChecked}
                    onChange={(e) => setDietaryChecked(e.target.checked)}
                    {...dietaryToolProps}
                  />
                  I have dietary needs
                </label>
                {dietaryChecked && (
                  <div className="space-y-1.5">
                    <Label htmlFor="dietary-details">Dietary requirements</Label>
                    <Input
                      id="dietary-details"
                      name="dietaryDetails"
                      placeholder="e.g. vegetarian, allergies…"
                      value={dietaryDetail}
                      onChange={(e) => setDietaryDetail(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <Button type="submit">Register</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">My registrations</h2>
        {state.registrations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No workshop registrations yet — sign up on the left or ask your agent.
          </p>
        ) : (
          <ul className="space-y-2">
            {state.registrations.map((r) => {
              const workshop = SEED.sessions.find((s) => s.id === r.workshopId)
              return (
                <li key={r.id}>
                  <Card>
                    <CardContent className="flex flex-wrap items-center justify-between gap-2 py-4">
                      <div>
                        <p className="font-medium">{workshop?.title ?? r.workshopId}</p>
                        <p className="text-sm text-muted-foreground">
                          {r.email} · {dayLabel(r.date)}
                          {r.dietary ? ` · ${r.dietary}` : ''}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleCancel(r.id)}>
                        Cancel
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}