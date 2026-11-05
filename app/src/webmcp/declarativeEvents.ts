import { toast } from 'sonner'
import { getModelContext } from '@/webmcp/modelContext'

/**
 * Installs sonner toasts for WebMCP declarative form lifecycle events:
 * toolactivated → "Agent is filling this form…", toolcancel → "Agent cancelled".
 * Returns an uninstall function; no-ops when there is no model context.
 */
export function installDeclarativeToasts(): () => void {
  const mc = getModelContext()
  if (!mc) return () => {}

  const onActivated = () => {
    toast('Agent is filling this form…')
  }
  const onCancel = () => {
    toast('Agent cancelled')
  }

  mc.addEventListener('toolactivated', onActivated)
  mc.addEventListener('toolcancel', onCancel)

  return () => {
    mc.removeEventListener('toolactivated', onActivated)
    mc.removeEventListener('toolcancel', onCancel)
  }
}