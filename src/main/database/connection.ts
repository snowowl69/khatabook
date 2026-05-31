/**
 * Khata - Database Connection Manager
 *
 * Opens/creates the SQLite database in the user's app data directory.
 * Configures WAL mode for concurrent read performance and enables
 * foreign key constraint enforcement.
 */

import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'

/** Singleton database instance */
let db: Database.Database | null = null

/**
 * Returns the singleton better-sqlite3 database instance.
 * On first call, opens (or creates) `khata.db` inside Electron's
 * `userData` directory and applies performance/integrity pragmas.
 *
 * Subsequent calls return the same instance – better-sqlite3 is
 * synchronous, so a single connection is both safe and fast.
 */
export function getDatabase(): Database.Database {
  if (db) return db

  const dbPath = path.join(app.getPath('userData'), 'khata.db')
  console.log(`[Database] Opening database at: ${dbPath}`)

  db = new Database(dbPath)

  // --- Performance & integrity pragmas ---
  // WAL mode allows concurrent reads while writing
  db.pragma('journal_mode = WAL')
  // Enforce foreign key constraints (SQLite has them OFF by default)
  db.pragma('foreign_keys = ON')
  // Slightly less durable but significantly faster syncs
  db.pragma('synchronous = NORMAL')
  // Keep up to 64 MB of pages in memory
  db.pragma('cache_size = -64000')
  // Store temp tables in memory instead of on disk
  db.pragma('temp_store = MEMORY')

  console.log('[Database] Connection established with WAL mode and foreign keys enabled')

  return db
}

/**
 * Gracefully closes the database connection.
 * Call this during app shutdown to ensure all data is flushed.
 */
export function closeDatabase(): void {
  if (db) {
    console.log('[Database] Closing connection…')
    db.close()
    db = null
  }
}
