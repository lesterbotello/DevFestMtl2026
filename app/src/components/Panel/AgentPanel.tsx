import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAppStore } from '@/store/context'
import { key, loadValue, saveValue } from '@/store/storage'
import { getModelContext } from '@/webmcp/modelContext'
import type { ChatTurn, DiscoveredTool, ModelBackend } from './backends/backend'
import { cloudBackend } from './backends/cloud'
import { downloadOnDeviceModel, onDeviceStatus } from './backends/onDevice'
import type { OnDeviceAvailability } from './backends/onDevice'
import { isConsequential, mapDiscoveredTools } from './tools'

/** A consequential-tool confirmation awaiting the user's decision. */
interface PendingGate {
  resolve: (confirmed: boolean) => void
}

/** Panel settings, persisted at dfm26:v1:panelSettings (survives the footer reset). */
interface PanelSettings {
  backend: 'on-device' | 'cloud'
  serverUrl: string
}

const DEFAULT_SETTINGS: PanelSettings = { backend: 'on-device', serverUrl: 'http://localhost:8787' }

function loadSettings(): PanelSettings {
  const saved = loadValue<Partial<PanelSettings>>(key('panelSettings'))
  return saved ? { ...DEFAULT_SETTINGS, ...saved } : DEFAULT_SETTINGS
}

/**
 * The agent panel: a drawer + "Agent" toggle. On open it discovers the tools
 * this page registered via document.modelContext.getTools(), maps them for the
 * current role, and shows a tool-count badge. Sends go through the pluggable
 * backend; tool calls requested by the backend execute via executeTool(ref, args).
 * A `toolchange` event re-fetches the list (stale-tool refresh after role flips).
 */
export default function AgentPanel({ backend }: { backend: ModelBackend | null }) {
  const { state } = useAppStore()
  const [open, setOpen] = useState(false)
  const [conversation, setConversation] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [tools, setTools] = useState<DiscoveredTool[]>([])
  const [pending, setPending] = useState<PendingGate | null>(null)
  const [onDevice, setOnDevice] = useState<OnDeviceAvailability | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null)
  const [settings, setSettings] = useState<PanelSettings>(loadSettings)

  // The prop is the non-cloud default (on-device); the persisted toggle can
  // switch the panel to the cloud Gemini fallback (key stays server-side).
  const activeBackend =
    settings.backend === 'cloud' ? cloudBackend(settings.serverUrl) : backend

  function updateSettings(patch: Partial<PanelSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveValue(key('panelSettings'), next)
      return next
    })
  }

  /** Resolve the open confirmation gate (if any) and close the dialog. */
  function settleGate(confirmed: boolean) {
    pending?.resolve(confirmed)
    setPending(null)
  }

  // Latest refs: event listeners and callbacks must read current values,
  // not the render-time snapshot they were created in.
  const roleRef = useRef(state.role)
  roleRef.current = state.role
  const toolsRef = useRef<DiscoveredTool[]>([])
  toolsRef.current = tools

  const refreshTools = useCallback(async (): Promise<DiscoveredTool[]> => {
    const mc = getModelContext()
    if (!mc) {
      setTools([])
      return []
    }
    try {
      const discovered = await mc.getTools()
      const mapped = mapDiscoveredTools(discovered, roleRef.current)
      setTools(mapped)
      return mapped
    } catch {
      setTools([])
      return []
    }
  }, [])

  // Discovery on open + stale-tool refresh: role flips re-register tools,
  // which fires toolchange in a real WebMCP context. Also probe the on-device
  // model so the panel can offer its one-time download.
  useEffect(() => {
    if (!open) return
    void refreshTools()
    let alive = true
    void onDeviceStatus().then((status) => {
      if (alive) setOnDevice(status)
    })
    const mc = getModelContext()
    if (mc) mc.addEventListener('toolchange', refreshTools)
    return () => {
      alive = false
      mc?.removeEventListener('toolchange', refreshTools)
    }
  }, [open, refreshTools])

  /** Kick off the one-time on-device model download, reporting progress. */
  async function startDownload() {
    setDownloadProgress(0)
    try {
      await downloadOnDeviceModel((fractionLoaded) => setDownloadProgress(fractionLoaded))
      setOnDevice('available')
      setConversation((prev) => [...prev, { role: 'assistant', text: 'On-device model ready ✓' }])
    } catch (err) {
      setConversation((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `Error: download failed — ${err instanceof Error ? err.message : String(err)}`,
        },
      ])
      setOnDevice(await onDeviceStatus())
    } finally {
      setDownloadProgress(null)
    }
  }

  const onToolCall = useCallback(async (name: string, args: Record<string, unknown>): Promise<string> => {
    const tool = toolsRef.current.find((t) => t.name === name)
    if (!tool) return `Error: unknown tool "${name}"`
    // Consequential tools block on an explicit user confirmation.
    if (isConsequential(tool)) {
      const confirmed = await new Promise<boolean>((resolve) => setPending({ resolve }))
      if (!confirmed) return 'User declined this action.'
    }
    setConversation((prev) => [...prev, { role: 'tool', text: `→ ${name} ${JSON.stringify(args)}` }])
    const mc = getModelContext()
    let result: string
    if (!mc) {
      result = 'Error: WebMCP is not available in this browser.'
    } else {
      try {
        result = await mc.executeTool(tool.ref, args)
      } catch (err) {
        result = `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    }
    // Attach the result to the card we just pushed: it renders in the panel
    // and the next send — a fresh model session — replays it, so follow-ups
    // can resolve what the tool returned (e.g. the session id to add). Only
    // the in-flight card lacks a result: sends are serialized by `busy`, and
    // backends await each onToolCall.
    setConversation((prev) => {
      const copy = [...prev]
      for (let i = copy.length - 1; i >= 0; i--) {
        const turn = copy[i]
        if (turn.role === 'tool' && turn.result === undefined) {
          copy[i] = { ...turn, result }
          return copy
        }
      }
      return prev
    })
    return result
  }, [])

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const text = input.trim()
    if (!text || !activeBackend || busy) return
    const history: ChatTurn[] = [...conversation, { role: 'user', text }]
    setConversation(history)
    setInput('')
    setBusy(true)
    try {
      // Declarative form tools register asynchronously once their form mounts,
      // so the snapshot taken when the panel opened can predate them:
      // re-discover just before running, so every send carries the freshest
      // tool list (and onToolCall resolves names against that same list).
      const fresh = await refreshTools()
      // A failed re-discovery (transient getTools error) must not strip the
      // model of the tools it already had — fall back to the last known list.
      const sendTools = fresh.length > 0 ? fresh : toolsRef.current
      toolsRef.current = sendTools
      const reply = await activeBackend.run(history, sendTools, onToolCall)
      setConversation((prev) => [...prev, { role: 'assistant', text: reply }])
    } catch (err) {
      setConversation((prev) => [
        ...prev,
        { role: 'assistant', text: `Error: ${err instanceof Error ? err.message : String(err)}` },
      ])
    } finally {
      setBusy(false)
    }
  }

  const toolBadge = `${tools.length} tool${tools.length === 1 ? '' : 's'}`

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        aria-pressed={open}
        className="fixed bottom-4 right-4 z-30 shadow-lg"
        onClick={() => setOpen((v) => !v)}
      >
        Agent
      </Button>
      {open && (
        <aside
          aria-label="Agent panel"
          className="fixed bottom-16 right-4 z-30 flex max-h-[70vh] w-96 flex-col gap-3 rounded-xl border bg-background p-4 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Agent</span>
              <Badge variant="secondary">{toolBadge}</Badge>
            </div>
            <Button variant="ghost" size="sm" aria-label="Close" onClick={() => setOpen(false)}>
              ×
            </Button>
          </div>

          <div
            role="group"
            aria-label="Model backend"
            className="flex items-center gap-1 rounded-lg border p-1"
          >
            <Button
              size="sm"
              variant={settings.backend === 'on-device' ? 'default' : 'ghost'}
              aria-pressed={settings.backend === 'on-device'}
              onClick={() => updateSettings({ backend: 'on-device' })}
            >
              On-device
            </Button>
            <Button
              size="sm"
              variant={settings.backend === 'cloud' ? 'default' : 'ghost'}
              aria-pressed={settings.backend === 'cloud'}
              onClick={() => updateSettings({ backend: 'cloud' })}
            >
              Cloud
            </Button>
          </div>
          {settings.backend === 'cloud' && (
            <input
              aria-label="Server URL"
              className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs"
              placeholder="http://localhost:8787"
              value={settings.serverUrl}
              onChange={(e) => updateSettings({ serverUrl: e.target.value })}
            />
          )}

          {activeBackend?.id === 'on-device' && onDevice === 'downloadable' && (
            <div className="rounded-lg border bg-muted/40 p-2 text-xs">
              <p className="mb-2 text-muted-foreground">
                The on-device model needs a one-time download before the agent can run offline.
              </p>
              <Button size="sm" onClick={() => void startDownload()}>
                Download on-device model
              </Button>
            </div>
          )}
          {downloadProgress !== null && (
            <progress
              aria-label="On-device model download progress"
              className="w-full"
              max={1}
              value={downloadProgress}
            />
          )}

          <div className="flex-1 space-y-2 overflow-y-auto text-sm">
            {conversation.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {activeBackend
                  ? 'Ask the agent anything — it can use the tools this page registered.'
                  : 'No model backend yet. Run with ?mockBackend=1 to smoke-test tool execution.'}
              </p>
            )}
            {conversation.map((turn, i) => (
              <div
                key={i}
                className={
                  turn.role === 'user'
                    ? 'rounded-lg bg-muted px-2 py-1 text-right'
                    : turn.role === 'tool'
                      ? 'rounded-lg border bg-muted/40 px-2 py-1 font-mono text-xs text-muted-foreground'
                      : 'rounded-lg border px-2 py-1'
                }
              >
                {turn.text}
                {turn.role === 'tool' && turn.result && (
                  <div className="mt-1 whitespace-pre-wrap border-t pt-1">{turn.result}</div>
                )}
              </div>
            ))}
          </div>

          <form className="flex flex-col gap-2" onSubmit={send}>
            <Label htmlFor="agent-input">Message</Label>
            <Textarea
              id="agent-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the agent…"
              rows={2}
            />
            <Button type="submit" disabled={!activeBackend || busy || !input.trim()}>
              Send
            </Button>
          </form>
        </aside>
      )}

      <AlertDialog open={pending !== null} onOpenChange={(o) => !o && settleGate(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm action</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel your workshop registration — continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settleGate(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => settleGate(true)}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}