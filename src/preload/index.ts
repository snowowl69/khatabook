/**
 * Khata - Preload Script
 *
 * Runs in the renderer's isolated preload context. Uses contextBridge
 * to safely expose a minimal IPC API to the renderer without granting
 * full Node.js access.
 *
 * The renderer accesses these methods via `window.api`.
 */

import { contextBridge, ipcRenderer } from 'electron'

/**
 * Whitelist of IPC channel prefixes the renderer is allowed to invoke.
 * Any channel that doesn't start with one of these is silently blocked.
 */
const ALLOWED_CHANNEL_PREFIXES = [
  'auth:',
  'db:',
  'bills:',
  'items:',
  'categories:',
  'brands:',
  'customers:',
  'suppliers:',
  'purchases:',
  'payments:',
  'stock:',
  'bank-accounts:',
  'expenses:',
  'without-bill:',
  'returns:',
  'daybook:',
  'cash-register:',
  'dashboard:',
  'reports:',
  'audit:',
  'users:',
  'backup:',
  'settings:',
  'app:'
]

/**
 * Returns true when the channel starts with an allowed prefix.
 */
function isChannelAllowed(channel: string): boolean {
  return ALLOWED_CHANNEL_PREFIXES.some((prefix) => channel.startsWith(prefix))
}

// ── Expose the API to the renderer ─────────────────────────────────
contextBridge.exposeInMainWorld('api', {
  /**
   * Invoke an IPC handler in the main process and return its result.
   *
   * @param channel - The handler channel name (e.g. `auth:login`)
   * @param args    - Arguments forwarded to the handler
   */
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    if (!isChannelAllowed(channel)) {
      console.warn(`[Preload] Blocked invoke on disallowed channel: ${channel}`)
      return Promise.reject(new Error(`Channel "${channel}" is not allowed`))
    }
    return ipcRenderer.invoke(channel, ...args)
  },

  /**
   * Listen for messages pushed from the main process.
   * Returns an unsubscribe function.
   *
   * @param channel  - The event channel name
   * @param callback - Callback invoked with the event payload(s)
   */
  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    if (!isChannelAllowed(channel)) {
      console.warn(`[Preload] Blocked listener on disallowed channel: ${channel}`)
      return () => {}
    }

    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void => {
      callback(...args)
    }

    ipcRenderer.on(channel, handler)

    // Return a cleanup function that removes *this specific* listener
    return () => {
      ipcRenderer.removeListener(channel, handler)
    }
  }
})
