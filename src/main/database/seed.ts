/**
 * Khata - Database Seeder
 *
 * Creates the default owner account if no users exist yet.
 * This ensures first-time users can log in immediately after install.
 */

import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'

/** Default owner credentials (user is expected to change the password on first login) */
const DEFAULT_OWNER = {
  username: 'owner',
  password: 'khata@123',
  displayName: 'Shop Owner',
  role: 'owner' as const
}

/**
 * Seeds the database with essential initial data.
 * Currently creates the default owner account only when
 * the `users` table is empty.
 *
 * @param db - An open better-sqlite3 database instance
 */
export function seedDatabase(db: Database.Database): void {
  console.log('[Seed] Checking if seeding is required…')

  // ── Check whether any users already exist ─────────────────────────
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as {
    count: number
  }

  if (userCount.count > 0) {
    console.log('[Seed] Users already exist — skipping seed')
    return
  }

  // ── Create the default owner account ──────────────────────────────
  console.log('[Seed] Creating default owner account…')

  const salt = bcrypt.genSaltSync(12)
  const passwordHash = bcrypt.hashSync(DEFAULT_OWNER.password, salt)

  const insertUser = db.prepare(`
    INSERT INTO users (username, password_hash, display_name, role, password_changed_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `)

  insertUser.run(
    DEFAULT_OWNER.username,
    passwordHash,
    DEFAULT_OWNER.displayName,
    DEFAULT_OWNER.role
  )

  console.log(
    `[Seed] ✓ Default owner created — username: "${DEFAULT_OWNER.username}", password: "${DEFAULT_OWNER.password}"`
  )
  console.log('[Seed]   ⚠ Please change the default password after first login!')
}
