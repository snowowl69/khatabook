/* ──────────────────────────────────────────────────────────────
   Khata – Auth Store  (Zustand)
   Manages authentication, session, and screen-lock state.
   ────────────────────────────────────────────────────────────── */

import { create } from 'zustand'
import type { User } from '../types'
import { api } from '../lib/ipc'

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLocked: boolean
  sessionToken: string | null

  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  lock: () => void
  unlockWithPin: (pin: string) => Promise<boolean>
  checkSession: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLocked: false,
  sessionToken: null,

  login: async (username: string, password: string): Promise<boolean> => {
    try {
      const result = await api.invoke<{
        success: boolean
        data?: {
          sessionToken: string
          user: { id: number; username: string; displayName: string; role: string }
        }
        error?: string
      }>('auth:login', { username, password })

      if (result?.success && result.data) {
        set({
          user: {
            id: result.data.user.id,
            username: result.data.user.username,
            displayName: result.data.user.displayName,
            role: result.data.user.role as 'owner' | 'manager',
          },
          isAuthenticated: true,
          isLocked: false,
          sessionToken: result.data.sessionToken,
        })
        // Persist session token for re-hydration
        localStorage.setItem('khata_session', result.data.sessionToken)
        return true
      }
      return false
    } catch (err) {
      console.error('[authStore] login failed:', err)
      return false
    }
  },

  logout: () => {
    const token = get().sessionToken
    if (token) {
      api.invoke('auth:logout', token).catch(() => {})
    }
    localStorage.removeItem('khata_session')
    set({
      user: null,
      isAuthenticated: false,
      isLocked: false,
      sessionToken: null,
    })
  },

  lock: () => {
    if (get().isAuthenticated) {
      set({ isLocked: true })
    }
  },

  unlockWithPin: async (pin: string): Promise<boolean> => {
    try {
      const { user } = get()
      if (!user) return false

      const result = await api.invoke<{ success: boolean }>('auth:verify-pin', {
        userId: user.id,
        pin,
      })

      if (result?.success) {
        set({ isLocked: false })
        return true
      }
      return false
    } catch (err) {
      console.error('[authStore] PIN unlock failed:', err)
      return false
    }
  },

  checkSession: async () => {
    try {
      const savedToken = localStorage.getItem('khata_session')
      if (!savedToken) return

      const result = await api.invoke<{
        success: boolean
        data?: {
          user: { id: number; username: string; displayName: string; role: string }
        }
        error?: string
      }>('auth:verify-session', savedToken)

      if (result?.success && result.data) {
        set({
          user: {
            id: result.data.user.id,
            username: result.data.user.username,
            displayName: result.data.user.displayName,
            role: result.data.user.role as 'owner' | 'manager',
          },
          isAuthenticated: true,
          isLocked: false,
          sessionToken: savedToken,
        })
      } else {
        localStorage.removeItem('khata_session')
      }
    } catch {
      // No valid session — stay logged out
    }
  },
}))
