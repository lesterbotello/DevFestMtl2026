import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SEED } from '@/data/seed'
import { findConflicts } from '@/lib/conflicts'
import { useAppStore } from '@/store/context'
import type { Day, Session } from '@/types'

const DAY_LABEL: Record<Day, string> = { sat: 'Saturday', sun: 'Sunday' }
const DAYS: Day[] = ['sat', 'sun']

export default function Agenda() {
  const { state, actions } = useAppStore()
  const conflicts = findConflicts(state.agenda, SEED.sessions)
  const conflicted = new Set(conflicts.flatMap((c) => [c.a, c.b]))
  const saved = SEED.sessions.filter((s) => state.agenda.includes(s.id))

  function remove(sessionId: string) {
    const result = actions.removeFromAgenda(sessionId)
    if (result.ok) {
      toast.success(result.message)
    } else {
      toast.error(result.message)
    }
  }

  return (
    <Tabs defaultValue="sat">
      <TabsList>
        {DAYS.map((d) => (
          <TabsTrigger key={d} value={d}>
            {DAY_LABEL[d]}
          </TabsTrigger>
        ))}
      </TabsList>
      {DAYS.map((d) => (
        <TabsContent key={d} value={d} className="pt-4">
          <AgendaDay day={d} saved={saved} conflicted={conflicted} onRemove={remove} />
        </TabsContent>
      ))}
    </Tabs>
  )
}

function AgendaDay({
  day,
  saved,
  conflicted,
  onRemove,
}: {
  day: Day
  saved: Session[]
  conflicted: Set<string>
  onRemove: (sessionId: string) => void
}) {
  const list = saved
    .filter((s) => s.day === day)
    .sort((a, b) => a.start.localeCompare(b.start))

  if (list.length === 0) {
    return (
      <p className="text-muted-foreground">
        Your {DAY_LABEL[day]} agenda is empty — add sessions from the Sessions tab.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {list.map((s) => (
        <li key={s.id}>
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-2 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">{s.start}</span>
                <span className="font-medium">{s.title}</span>
                <span className="text-sm text-muted-foreground">{s.room}</span>
                {conflicted.has(s.id) && <Badge variant="destructive">Schedule conflict</Badge>}
              </div>
              <Button size="sm" variant="outline" onClick={() => onRemove(s.id)}>
                Remove
              </Button>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}