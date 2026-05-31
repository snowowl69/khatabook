/**
 * Khata - Preload API Type Declarations
 *
 * Provides TypeScript types for the `window.api` object exposed
 * by the preload script via contextBridge.
 */

export interface KhataApi {
  /**
   * Invoke an IPC handler registered in the main process.
   *
   * @param channel - Handler channel name (e.g. `auth:login`)
   * @param args    - Arguments forwarded to the handler
   * @returns The value returned by the main-process handler
   */
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>

  /**
   * Subscribe to events pushed from the main process.
   *
   * @param channel  - Event channel name
   * @param callback - Invoked with the event payload(s)
   * @returns An unsubscribe function
   */
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void
}

declare global {
  interface Window {
    api: KhataApi
  }
}
