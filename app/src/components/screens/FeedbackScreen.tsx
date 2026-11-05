import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SEED } from '@/data/seed'
import { useAppStore } from '@/store/context'
import type { AppStore, Result } from '@/store/store'
import type { Day, Feedback } from '@/types'

const dayLabel = (day: Day) => (day === 'sat' ? 'Saturday' : 'Sunday')

// Declarative WebMCP attributes — custom DOM attributes, cast for JSX typing.
// This form HAS toolautosubmit: the agent may submit it directly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const webmcpFormProps = {
  toolname: 'submit_feedback',
  tooldescription: 'Rate a talk and leave a short comment.',
  toolautosubmit: '',
} as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sessionToolProps = { toolparamdescription: 'The session to rate.' } as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ratingToolProps = { toolparamdescription: 'The rating, from 1 (poor) to 5 (amazing).' } as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const commentToolProps = { toolparamdescription: 'An optional short comment for the speaker.' } as any

/**
 * Pure validation for feedback input. Returns an error message, or null when valid.
 * Reused by the declarative WebMCP submit path (respondWith).
 */
export function validateFeedback(input: Feedback): string | null {
  if (!input.sessionId) return 'Please pick a session.'
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    return 'Rating must be between 1 and 5.'
  }
  return null
}

/**
 * Shared submit decision logic. Persists valid feedback through the store and
 * hands the agent-facing result to `respond` — the native respondWith for
 * agent-invoked submits, or a no-op for manual submits (never calls respondWith).
 */
export function handleFeedbackSubmit(
  store: AppStore,
  input: Feedback,
  respond: (p: Promise<string>) => void,
): Result {
  const problem = validateFeedback(input)
  if (problem) {
    respond(Promise.resolve(`Error: ${problem}`))
    return { ok: false, message: problem }
  }
  const result = store.submitFeedback(input)
  if (result.ok) {
    respond(Promise.resolve('Feedback recorded ✓'))
  } else {
    respond(Promise.resolve(`Error: ${result.message}`))
  }
  return result
}

export default function FeedbackScreen() {
  const { state, actions } = useAppStore()
  const [sessionId, setSessionId] = useState('')
  const [rating, setRating] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // WebMCP declarative submit: agentInvoked + respondWith on the native event.
    const native = e.nativeEvent as Event & {
      agentInvoked?: boolean
      respondWith?: (value: unknown) => void
    }
    const respond: (p: Promise<string>) => void =
      native.agentInvoked && typeof native.respondWith === 'function'
        ? (p) => native.respondWith!(p)
        : () => {}
    // Read the DOM, not React controlled state: the WebMCP fill path writes
    // DOM values directly, and whether controlled state has synced by submit
    // time is not guaranteed — FormData is authoritative for humans and
    // agents alike.
    const fd = new FormData(e.currentTarget)
    const result = handleFeedbackSubmit(
      actions,
      {
        sessionId: String(fd.get('sessionId') ?? ''),
        rating: Number(fd.get('rating')),
        comment: String(fd.get('comment') ?? ''),
      },
      respond,
    )
    if (result.ok) {
      setError(null)
      setSessionId('')
      setRating('')
      setComment('')
      toast.success(result.message)
    } else {
      setError(result.message)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rate a talk</CardTitle>
          <CardDescription>Tell the speakers what you loved (or didn't).</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit} {...webmcpFormProps}>
            <div className="space-y-1.5">
              <Label htmlFor="feedback-session">Session</Label>
              <select
                id="feedback-session"
                name="sessionId"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                {...sessionToolProps}
              >
                <option value="" disabled>
                  Pick a session…
                </option>
                {SEED.sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({dayLabel(s.day)} {s.start})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="feedback-rating">Rating</Label>
              <select
                id="feedback-rating"
                name="rating"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                {...ratingToolProps}
              >
                <option value="" disabled>
                  Rate it…
                </option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} — {['Poor', 'Meh', 'Good', 'Great', 'Amazing'][n - 1]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="feedback-comment">Comment</Label>
              <Textarea
                id="feedback-comment"
                name="comment"
                placeholder="Optional — anything you want to add?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                {...commentToolProps}
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit">Submit</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Feedback so far</h2>
        {state.feedback.length === 0 ? (
          <p className="text-sm text-muted-foreground">No feedback yet.</p>
        ) : (
          <ul className="space-y-2">
            {state.feedback.map((f, i) => {
              const session = SEED.sessions.find((s) => s.id === f.sessionId)
              return (
                <li key={i}>
                  <Card>
                    <CardContent className="py-4">
                      <p className="font-medium">
                        {session?.title ?? f.sessionId} · {'★'.repeat(f.rating)}
                      </p>
                      {f.comment && <p className="text-sm text-muted-foreground">{f.comment}</p>}
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