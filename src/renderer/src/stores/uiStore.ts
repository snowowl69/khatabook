/* ──────────────────────────────────────────────────────────────
   Khata – UI Store  (Zustand)
   Global UI preferences: theme, sidebar, global search.
   ────────────────────────────────────────────────────────────── */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface UIState {
  /** Active colour theme */
  theme: 'dark' | 'light'
  /** Whether the sidebar is collapsed to icons-only */
  sidebarCollapsed: boolean
  /** Whether the ⌘K / Ctrl+K global search modal is open */
  globalSearchOpen: boolean

  /* ── actions ─────────────────────────────────────────────── */
  toggleTheme: () => void
  toggleSidebar: () => void
  setGlobalSearchOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      sidebarCollapsed: false,
      globalSearchOpen: false,

      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark'
        document.documentElement.setAttribute('data-theme', next)
        set({ theme: next })
      },

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      setGlobalSearchOpen: (open: boolean) => set({ globalSearchOpen: open }),
    }),
    {
      name: 'khata-ui',
      partialize: (s) => ({ theme: s.theme, sidebarCollapsed: s.sidebarCollapsed }),
      onRehydrateStorage: () => (state) => {
        // Sync the DOM attribute when the persisted theme is loaded
        if (state?.theme) {
          document.documentElement.setAttribute('data-theme', state.theme)
        }
      },
    },
  ),
)
