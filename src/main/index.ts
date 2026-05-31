/**
 * Khata - Electron Main Process Entry Point
 *
 * Bootstraps the entire desktop application:
 *  1. Initialises the SQLite database (connection → migrations → seed)
 *  2. Registers IPC handlers so the renderer can talk to the DB
 *  3. Creates the main BrowserWindow with secure defaults
 *  4. Loads the renderer (Vite dev server in dev, built files in prod)
 *  5. Manages the standard Electron lifecycle events
 */

import { app, BrowserWindow, shell } from 'electron'
import path from 'path'
import { getDatabase, closeDatabase } from './database/connection'
import { runMigrations } from './database/migrate'
import { seedDatabase } from './database/seed'
import { registerIpcHandlers } from './ipc'

// ── Resolve paths used across the module ────────────────────────────
const isDev = !app.isPackaged

/**
 * Path to the preload script.
 * electron-vite compiles preload into `out/preload/index.js`.
 */
const preloadPath = path.join(__dirname, '../preload/index.js')

/**
 * Path to the renderer's index.html (production only).
 * In dev mode we point at the Vite dev server instead.
 */
const rendererHtmlPath = path.join(__dirname, '../renderer/index.html')

/**
 * Optional app icon — lives in the project resources directory.
 * electron-builder copies this during packaging.
 */
const iconPath = path.join(app.getAppPath(), 'resources', 'icon.png')

// ── Keep a global reference to prevent garbage-collection ───────────
let mainWindow: BrowserWindow | null = null

// ────────────────────────────────────────────────────────────────────
// DATABASE INITIALISATION
// ────────────────────────────────────────────────────────────────────

function initializeDatabase(): void {
  console.log('[Main] Initialising database…')

  const db = getDatabase()

  // Run pending migrations (creates tables, indexes, seed settings)
  runMigrations(db)

  // Seed the default owner account if this is a fresh install
  seedDatabase(db)

  // Wire up IPC so the renderer can query / mutate data
  registerIpcHandlers(db)

  console.log('[Main] ✓ Database ready')
}

// ────────────────────────────────────────────────────────────────────
// WINDOW CREATION
// ────────────────────────────────────────────────────────────────────

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    title: 'KhataBook',
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false, // Shown after 'ready-to-show' to avoid white flash
    icon: iconPath,
    backgroundColor: '#0a0a0f', // Matches the dark theme background
    titleBarStyle: 'default',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Required for better-sqlite3 native module in preload
      webSecurity: true
    }
  })

  // Maximise on first open for a spacious shopkeeper-friendly layout
  mainWindow.maximize()

  // Graceful show — avoids a white/blank flash before React mounts
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })

  // Open external links in the system browser, not inside the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // ── Load the renderer ─────────────────────────────────────────────
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    // Dev server (electron-vite injects this env var)
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    // Open DevTools in dev for convenience
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    // Production — load the built HTML
    mainWindow.loadFile(rendererHtmlPath)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ────────────────────────────────────────────────────────────────────
// APP LIFECYCLE
// ────────────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  console.log('[Main] Electron app is ready')

  // 1. Database first — everything depends on it
  initializeDatabase()

  // 2. Create the window
  createMainWindow()

  // macOS: re-create the window when the dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Clean up the database connection before the process exits
app.on('before-quit', () => {
  console.log('[Main] Shutting down — closing database…')
  closeDatabase()
})

// Prevent multiple instances of the app
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // Focus the existing window when a second instance is attempted
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}
