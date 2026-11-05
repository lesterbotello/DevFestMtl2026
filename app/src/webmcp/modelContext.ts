// Minimal local typings for the WebMCP surface (document.modelContext).
// The API is experimental; these describe exactly the surface this app uses.
// If the `webmcp-types` package becomes current, prefer it.

import polyfillUrl from '@/webmcp/polyfill/webmcp-polyfill.js?url'

export interface WebMCPToolAnnotations {
  readOnlyHint?: boolean
  untrustedContentHint?: boolean
  consequentialHint?: boolean
  debugging?: boolean
}

export interface WebMCPToolDef {
  name: string
  description: string
  inputSchema: object
  annotations?: WebMCPToolAnnotations
  execute: (args: Record<string, unknown>, ctx: { signal: AbortSignal }) => Promise<string>
}

export interface ModelContextTool {
  name: string
  description: string
  inputSchema: object
  annotations?: WebMCPToolAnnotations & Record<string, unknown>
  /** Opaque handle needed to execute this tool via executeTool(). */
  ref?: unknown
}

export interface ModelContextEventMap {
  toolchange: 'toolchange'
  toolactivated: 'toolactivated'
  toolcancel: 'toolcancel'
}

export interface ModelContext {
  registerTool(tool: WebMCPToolDef, options?: { signal?: AbortSignal }): void
  getTools(): Promise<ModelContextTool[]>
  executeTool(tool: unknown, args: Record<string, unknown>): Promise<string>
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
}

/** Returns the browser-provided WebMCP context, or null when unsupported (test env, flags off). */
export function getModelContext(): ModelContext | null {
  const mc = (document as Document & { modelContext?: ModelContext }).modelContext
  return mc ?? null
}

let polyfillPromise: Promise<ModelContext | null> | null = null

/**
 * Returns the native WebMCP context if present; otherwise injects the vendored
 * polyfill via a one-time <script> tag and resolves with whatever it installed.
 * Resolves null if the polyfill fails to load or installs nothing.
 */
export function ensureModelContext(): Promise<ModelContext | null> {
  const native = getModelContext()
  if (native) return Promise.resolve(native)
  if (!polyfillPromise) {
    polyfillPromise = new Promise<ModelContext | null>((resolve) => {
      const script = document.createElement('script')
      script.src = polyfillUrl
      script.onload = () => resolve(getModelContext())
      script.onerror = () => resolve(null)
      document.head.appendChild(script)
    })
  }
  return polyfillPromise
}