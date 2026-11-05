import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SEED } from '@/data/seed'
import { useAppStore } from '@/store/context'
import type { Day } from '@/types'

const dayLabel = (day: Day) => (day === 'sat' ? 'Saturday' : 'Sunday')
const ALL = 'all'

export default function QaWall() {
  const { state, actions } = useAppStore()
  const [sessionFilter, setSessionFilter] = useState(ALL)
  const [questionText, setQuestionText] = useState('')

  const questions =
    sessionFilter === ALL
      ? state.questions
      : state.questions.filter((q) => q.sessionId === sessionFilter)

  function handleAsk(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const result = actions.askQuestion(sessionFilter, questionText)
    if (result.ok) {
      setQuestionText('')
      toast.success(result.message)
    } else {
      toast.error(result.message)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="qa-session">Session</Label>
          <select
            id="qa-session"
            name="session"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={sessionFilter}
            onChange={(e) => setSessionFilter(e.target.value)}
          >
            <option value={ALL}>All sessions</option>
            {SEED.sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({dayLabel(s.day)})
              </option>
            ))}
          </select>
        </div>

        <form className="space-y-2" onSubmit={handleAsk}>
          <div className="space-y-1.5">
            <Label htmlFor="qa-ask">Ask a question</Label>
            <Input
              id="qa-ask"
              name="question"
              placeholder={
                sessionFilter === ALL ? 'Pick a session above, then ask…' : 'Type your question…'
              }
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={sessionFilter === ALL}>
            Ask
          </Button>
        </form>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Live questions</h2>
        {questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No questions yet — be the first to ask!</p>
        ) : (
          <ul className="space-y-2">
            {questions.map((q) => {
              const session = SEED.sessions.find((s) => s.id === q.sessionId)
              return (
                <li key={q.id}>
                  <Card>
                    <CardContent className="flex items-start justify-between gap-2 py-4">
                      <div>
                        <p>{q.text}</p>
                        <p className="text-xs text-muted-foreground">
                          {session?.title ?? q.sessionId}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => actions.upvoteQuestion(q.id)}>
                        ▲ {q.upvotes}
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