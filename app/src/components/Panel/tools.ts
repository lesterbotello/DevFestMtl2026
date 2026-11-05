import type { Role } from '@/types'
import type { ModelContextTool } from '@/webmcp/modelContext'
import type { DiscoveredTool } from './backends/backend'

/**
 * Maps raw discovered tools to the backend-facing shape. Debugging tools
 * (organizer-only, e.g. run_av_check) are dropped for attendees — the panel
 * never offers them, mirroring the registration-time role gating.
 *
 * `ref`: native getTools() hands back objects carrying an opaque `ref` handle;
 * the vendored polyfill returns whole tool objects WITHOUT one (its
 * executeTool expects the full object). `?? tool` covers both shapes.
 */
export function mapDiscoveredTools(tools: ModelContextTool[], role: Role): DiscoveredTool[] {
  return tools
    .filter((tool) => !(role === 'attendee' && tool.annotations?.debugging === true))
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
      ref: tool.ref ?? tool,
    }))
}

/**
 * True only when the tool declares consequentialHint — the confirmation gate
 * keys off this. Accepts the raw discovered shape too (its ref is optional).
 */
export function isConsequential(tool: DiscoveredTool | ModelContextTool): boolean {
  const annotations = tool.annotations as { consequentialHint?: unknown } | undefined
  return annotations?.consequentialHint === true
}