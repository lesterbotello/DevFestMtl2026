import { useEffect } from 'react'
import { getModelContext } from '@/webmcp/modelContext'
import type { WebMCPToolDef } from '@/webmcp/modelContext'

/**
 * Registers a WebMCP tool for the lifetime of the calling component.
 * No-ops when there is no model context (tests, unsupported browsers) or when
 * `enabled` is false; toggling enabled registers/aborts accordingly.
 */
export function useWebMCPTool(tool: WebMCPToolDef, enabled = true): void {
  useEffect(() => {
    const mc = getModelContext()
    if (!mc || !enabled) return
    const controller = new AbortController()
    mc.registerTool(tool, { signal: controller.signal })
    return () => controller.abort()
  }, [tool, enabled])
}