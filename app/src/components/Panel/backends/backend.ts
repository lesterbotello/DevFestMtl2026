/** One exchange in the agent conversation. No system role: backends import SYSTEM_PROMPT themselves. */
export interface ChatTurn {
  role: 'user' | 'assistant' | 'tool'
  text: string
  /** Tool turns only: the tool's result string — rendered in the card and replayed to the model on later sends. */
  result?: string
}

/**
 * The text a backend feeds the model for one history turn. A tool turn seeds
 * as its card line; a stored result rides along so follow-up sends — each a
 * fresh model session — can still see what the tool returned (e.g. the
 * session ids needed by add_to_agenda).
 */
export function turnPromptText(turn: ChatTurn): string {
  return turn.role === 'tool' && turn.result ? `${turn.text}\n${turn.result}` : turn.text
}

/** A tool discovered via document.modelContext.getTools(), mapped for the backend. */
export interface DiscoveredTool {
  name: string
  description: string
  inputSchema: object
  annotations?: object
  /** Opaque handle needed to execute this tool via executeTool(). */
  ref: unknown
}

/**
 * A pluggable model backend for the agent panel.
 * `run` receives the full conversation, the discovered tools, and an onToolCall
 * callback that executes a registered WebMCP tool and returns its result string.
 */
export interface ModelBackend {
  id: 'on-device' | 'cloud'
  available(): Promise<boolean>
  run(
    conversation: ChatTurn[],
    tools: DiscoveredTool[],
    onToolCall: (name: string, args: Record<string, unknown>) => Promise<string>,
  ): Promise<string>
}