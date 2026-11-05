import { useEffect, useState } from 'react'
import AgentPanel from '@/components/Panel/AgentPanel'
import type { ModelBackend } from '@/components/Panel/backends/backend'
import { createMockBackend } from '@/components/Panel/backends/mockBackend'
import { onDeviceBackend } from '@/components/Panel/backends/onDevice'
import Header from '@/components/Header'
import Agenda from '@/components/screens/Agenda'
import FeedbackScreen from '@/components/screens/FeedbackScreen'
import QaWall from '@/components/screens/QaWall'
import SessionBrowser from '@/components/screens/SessionBrowser'
import StageManager from '@/components/screens/StageManager'
import Workshops from '@/components/screens/Workshops'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'
import { StoreProvider, useAppStore } from '@/store/context'
import { installDeclarativeToasts } from '@/webmcp/declarativeEvents'
import { useTools } from '@/webmcp/tools/useTools'

const TABS = [
  { value: 'sessions', label: 'Sessions' },
  { value: 'agenda', label: 'My Agenda' },
  { value: 'workshops', label: 'Workshops' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'qa', label: 'Q&A' },
  { value: 'stage', label: 'Stage Manager', organizerOnly: true },
] as const

function Footer() {
  const { actions } = useAppStore()
  return (
    <footer className="border-t px-4 py-4 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <span>DevFest MTL 2026 — conference companion demo</span>
        <a
          href="#"
          className="underline underline-offset-4 hover:text-foreground"
          onClick={(e) => {
            e.preventDefault()
            actions.resetDemoData()
          }}
        >
          Reset demo data
        </a>
      </div>
    </footer>
  )
}

/** Renders nothing — registers the role-appropriate WebMCP tool set. */
function ToolRegistrations() {
  const { state } = useAppStore()
  useTools(state.role)
  return null
}

function Shell() {
  const { state } = useAppStore()
  // Default backend is the on-device Prompt API (no key, works offline).
  // ?mockBackend=1 overrides it with a scripted backend for smoke tests,
  // and the panel's Cloud toggle switches to the Gemini-backed server.
  const [backend] = useState<ModelBackend | null>(() =>
    new URLSearchParams(window.location.search).has('mockBackend') ? createMockBackend() : onDeviceBackend,
  )
  const [activeTab, setActiveTab] = useState('sessions')
  useEffect(() => installDeclarativeToasts(), [])
  const visibleTabs = TABS.filter(
    (tab) => !('organizerOnly' in tab && tab.organizerOnly) || state.role === 'organizer',
  )

  // A role flip can retire the active tab (Stage Manager); snap back to
  // Sessions so organizer content never lingers on-screen for attendees.
  useEffect(() => {
    setActiveTab('sessions')
  }, [state.role])

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex flex-wrap">
            {visibleTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {visibleTabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="pt-4">
              {tab.value === 'sessions' ? (
                <SessionBrowser />
              ) : tab.value === 'agenda' ? (
                <Agenda />
              ) : tab.value === 'workshops' ? (
                <Workshops />
              ) : tab.value === 'feedback' ? (
                <FeedbackScreen />
              ) : tab.value === 'qa' ? (
                <QaWall />
              ) : tab.value === 'stage' ? (
                <StageManager />
              ) : null}
            </TabsContent>
          ))}
        </Tabs>
      </main>
      <Footer />
      <Toaster />
      <ToolRegistrations />
      <AgentPanel backend={backend} />
    </div>
  )
}

function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}

export default App