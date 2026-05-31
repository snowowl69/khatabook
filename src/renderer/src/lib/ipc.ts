/* ──────────────────────────────────────────────────────────────
   Khata – Type-safe IPC Wrapper
   Provides a clean interface over the electron preload bridge.
   ────────────────────────────────────────────────────────────── */

/**
 * Reference to the preload-exposed API.
 * In production the `window.api` object is injected by the
 * preload script via contextBridge.  During development without
 * the Electron shell we fall back to a no-op so the UI can still
 * render in a browser for rapid iteration.
 */
function getApi(): Record<string, (...args: unknown[]) => unknown> | undefined {
  return (window as Record<string, unknown>).api as
    | Record<string, (...args: unknown[]) => unknown>
    | undefined
}

/**
 * Invoke a main-process handler and return the typed result.
 *
 * @example
 * const user = await api.invoke<User>('auth:login', username, password)
 */
export const api = {
  invoke: async <T>(channel: string, ...args: unknown[]): Promise<T> => {
    const bridge = getApi()
    if (!bridge?.invoke) {
      console.warn(`[ipc] api.invoke("${channel}") – bridge not available (running outside Electron?)`)
      return undefined as unknown as T
    }
    return bridge.invoke(channel, ...args) as Promise<T>
  },

  /**
   * Register a listener for events pushed from the main process.
   * Returns an unsubscribe function.
   */
  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    const bridge = getApi()
    if (!bridge?.on) {
      console.warn(`[ipc] api.on("${channel}") – bridge not available`)
      return () => {}
    }
    bridge.on(channel, callback)
    return () => {
      bridge.off?.(channel, callback)
    }
  },
}
