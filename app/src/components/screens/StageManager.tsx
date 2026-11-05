import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/store/context'

const statusIcon = (ok: boolean) => (ok ? '🟢' : '🟡')

export default function StageManager() {
  const { state, actions } = useAppStore()

  function runAvCheck() {
    const result = actions.runAvCheck()
    if (result.ok) {
      toast.success(result.message)
    } else {
      toast.error(result.message)
    }
  }

  function refresh() {
    toast.success('Rooms refreshed.')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Room status</h2>
          <p className="text-sm text-muted-foreground">
            🟢 all good · 🟡 needs attention
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={runAvCheck}>Run AV check</Button>
          <Button variant="outline" onClick={refresh}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {state.rooms.map((room) => (
          <Card key={room.id} data-room={room.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{room.name}</CardTitle>
                {room.mic === 'fault' || room.projector === 'fault' ? (
                  <Badge variant="destructive">Fault</Badge>
                ) : (
                  <Badge variant="secondary">OK</Badge>
                )}
              </div>
              <CardDescription>Occupancy: {room.occupancy}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                Mic {statusIcon(room.mic === 'ok')}
              </p>
              <p>Projector {statusIcon(room.projector === 'ok')}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}