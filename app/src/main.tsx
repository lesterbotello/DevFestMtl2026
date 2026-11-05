import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ensureModelContext } from './webmcp/modelContext'
import './index.css'
import App from './App.tsx'

function boot() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

// Make sure document.modelContext exists — native Chrome, or the vendored
// polyfill on flag-less browsers — BEFORE React mounts and tools start
// registering. The app still boots if the polyfill fails to load; it just
// won't be agent-actuated.
ensureModelContext().then(boot)