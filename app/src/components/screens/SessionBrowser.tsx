import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SEED } from '@/data/seed'
import { filterSessions } from '@/lib/filterSessions'
import { useAppStore } from '@/store/context'
import type { Day, Language, Level, Track } from '@/types'

const ALL = 'all'

const TRACKS: Track[] = ['web', 'ai-agents', 'mobile', 'cloud', 'devtools']
const DAYS: Day[] = ['sat', 'sun']
const LANGUAGES: Language[] = ['EN', 'FR']
const LEVELS: Level[] = ['intro', 'intermediate', 'advanced']

const dayLabel = (day: Day) => (day === 'sat' ? 'Saturday' : 'Sunday')

export default function SessionBrowser() {
  const { state, actions } = useAppStore()
  const [query, setQuery] = useState('')
  const [track, setTrack] = useState<string>(ALL)
  const [day, setDay] = useState<string>(ALL)
  const [language, setLanguage] = useState<string>(ALL)
  const [level, setLevel] = useState<string>(ALL)

  const sessions = filterSessions(SEED.sessions, {
    query,
    track: track === ALL ? undefined : (track as Track),
    day: day === ALL ? undefined : (day as Day),
    language: language === ALL ? undefined : (language as Language),
    level: level === ALL ? undefined : (level as Level),
  })

  function toggleAgenda(sessionId: string) {
    const onAgenda = state.agenda.includes(sessionId)
    const result = onAgenda ? actions.removeFromAgenda(sessionId) : actions.addToAgenda(sessionId)
    if (result.ok) {
      toast.success(result.message)
    } else {
      toast.error(result.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="session-search">Search</Label>
          <Input
            id="session-search"
            placeholder="Title or speaker…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Track</Label>
          <Select value={track} onValueChange={setTrack}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {TRACKS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Day</Label>
          <Select value={day} onValueChange={setDay}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {DAYS.map((d) => (
                <SelectItem key={d} value={d}>
                  {dayLabel(d)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Language</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {LANGUAGES.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {sessions.length} session{sessions.length === 1 ? '' : 's'}
        </p>
        <div className="w-40">
          <Label>Level</Label>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {LEVELS.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sessions.map((s) => {
          const onAgenda = state.agenda.includes(s.id)
          return (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{s.title}</CardTitle>
                  <Badge variant={s.type === 'workshop' ? 'default' : 'secondary'}>
                    {s.type === 'workshop' ? 'Workshop' : 'Talk'}
                  </Badge>
                </div>
                <CardDescription>
                  {s.speaker} · {dayLabel(s.day)} {s.start} · {s.room} · {s.language}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="outline">{s.track}</Badge>
                  <Badge variant="outline">{s.level}</Badge>
                  <span>
                    ★ {s.rating.toFixed(1)} · {s.durationMin} min
                  </span>
                  {s.type === 'workshop' && s.price !== undefined && (
                    <Badge variant="outline">${s.price}</Badge>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button size="sm" variant={onAgenda ? 'outline' : 'default'} onClick={() => toggleAgenda(s.id)}>
                  {onAgenda ? 'Remove from agenda' : 'Add to agenda'}
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </div>
  )
}