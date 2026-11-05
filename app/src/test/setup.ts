import '@testing-library/jest-dom/vitest'
import type { ModelContextTool, WebMCPToolDef } from '@/webmcp/modelContext'

// jsdom does not implement matchMedia; sonner and Radix rely on it.
if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

/**
 * Installs a mock document.modelContext (deletable property). Returns the mock
 * so tests can assert on registerTool/getTools/executeTool/addEventListener calls.
 */
export function installMockModelContext() {
  const registerTool = vi.fn<(tool: WebMCPToolDef, options?: { signal?: AbortSignal }) => void>()
  const getTools = vi.fn<() => Promise<ModelContextTool[]>>()
  getTools.mockResolvedValue([])
  const executeTool = vi.fn<(tool: unknown, args: Record<string, unknown>) => Promise<string>>()
  executeTool.mockResolvedValue('executed')
  const addEventListener = vi.fn<(type: string, listener: () => void) => void>()
  const removeEventListener = vi.fn<(type: string, listener: () => void) => void>()

  const context = { registerTool, getTools, executeTool, addEventListener, removeEventListener }
  Object.defineProperty(document, 'modelContext', {
    value: context,
    configurable: true,
    writable: true,
  })
  return context
}

/** Removes document.modelContext entirely (native-absent simulation). */
export function removeModelContext(): void {
  delete (document as Document & { modelContext?: unknown }).modelContext
}

/**
 * Fills a form control exactly the way the vendored WebMCP polyfill does:
 * a plain property write plus dispatched input/change events. Whether React
 * controlled state syncs from these events is not guaranteed (empirically it
 * stays stale for some controls in this React version) — tests use this to
 * prove declarative submit handlers read the DOM (FormData), not React state.
 */
export function fillLikePolyfill(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string,
): void {
  element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}