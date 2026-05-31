/**
 * Khata — IPC Handler Registration (Complete)
 * All CRUD operations for every module.
 */

import { ipcMain, dialog, BrowserWindow } from 'electron'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import path from 'path'

export function registerIpcHandlers(db: Database.Database): void {
  console.log('[IPC] Registering handlers…')

  // ═══════════════════════════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════════════════════════

  ipcMain.handle('auth:login', async (_event, { username, password }: { username: string; password: string }) => {
    try {
      const user = db.prepare(
        'SELECT id, username, password_hash, display_name, role, is_active, failed_login_count, locked_until FROM users WHERE username = ?'
      ).get(username) as any
      if (!user) return { success: false, error: 'Invalid username or password' }
      if (!user.is_active) return { success: false, error: 'Account is deactivated' }
      if (user.locked_until) {
        const lockedUntil = new Date(user.locked_until)
        if (lockedUntil > new Date()) return { success: false, error: `Account locked until ${lockedUntil.toLocaleString()}` }
        db.prepare('UPDATE users SET locked_until = NULL, failed_login_count = 0 WHERE id = ?').run(user.id)
      }
      const valid = bcrypt.compareSync(password, user.password_hash)
      if (!valid) {
        const newCount = user.failed_login_count + 1
        const maxRow = db.prepare("SELECT value FROM settings WHERE key = 'max_failed_logins'").get() as any
        const max = maxRow ? parseInt(maxRow.value, 10) : 5
        if (newCount >= max) {
          const lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString()
          db.prepare('UPDATE users SET failed_login_count = ?, locked_until = ? WHERE id = ?').run(newCount, lockUntil, user.id)
          return { success: false, error: 'Too many failed attempts. Account locked for 15 minutes.' }
        }
        db.prepare('UPDATE users SET failed_login_count = ? WHERE id = ?').run(newCount, user.id)
        return { success: false, error: 'Invalid username or password' }
      }
      db.prepare("UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = datetime('now') WHERE id = ?").run(user.id)
      const sessionToken = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      db.prepare('INSERT INTO sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)').run(user.id, sessionToken, expiresAt)
      db.prepare("INSERT INTO audit_log (user_id, action, entity_type, entity_id, timestamp) VALUES (?, 'login', 'user', ?, datetime('now'))").run(user.id, user.id)
      return { success: true, data: { sessionToken, user: { id: user.id, username: user.username, displayName: user.display_name, role: user.role } } }
    } catch (err) { console.error('[IPC] auth:login error:', err); return { success: false, error: 'An unexpected error occurred' } }
  })

  ipcMain.handle('auth:verify-session', async (_event, sessionToken: string) => {
    try {
      const session = db.prepare(`SELECT s.*, u.id as uid, u.username, u.display_name, u.role, u.is_active FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.session_token = ? AND s.is_active = 1`).get(sessionToken) as any
      if (!session) return { success: false, error: 'Invalid session' }
      if (new Date(session.expires_at) < new Date()) { db.prepare('UPDATE sessions SET is_active = 0 WHERE session_token = ?').run(sessionToken); return { success: false, error: 'Session expired' } }
      if (!session.is_active) return { success: false, error: 'User account deactivated' }
      db.prepare("UPDATE sessions SET last_active_at = datetime('now') WHERE session_token = ?").run(sessionToken)
      return { success: true, data: { user: { id: session.uid, username: session.username, displayName: session.display_name, role: session.role } } }
    } catch (err) { return { success: false, error: 'An unexpected error occurred' } }
  })

  ipcMain.handle('auth:logout', async (_event, sessionToken: string) => {
    try { db.prepare('UPDATE sessions SET is_active = 0 WHERE session_token = ?').run(sessionToken); return { success: true } }
    catch (err) { return { success: false, error: 'An unexpected error occurred' } }
  })

  ipcMain.handle('auth:verify-pin', async (_event, { userId, pin }: { userId: number; pin: string }) => {
    try {
      const user = db.prepare('SELECT pin_hash FROM users WHERE id = ? AND is_active = 1').get(userId) as any
      if (!user || !user.pin_hash) return { success: false, error: 'PIN not set' }
      return bcrypt.compareSync(pin, user.pin_hash) ? { success: true } : { success: false, error: 'Invalid PIN' }
    } catch (err) { return { success: false, error: 'An unexpected error occurred' } }
  })

  // ═══════════════════════════════════════════════════════════════
  // USERS (Manager management)
  // ═══════════════════════════════════════════════════════════════

  ipcMain.handle('users:list', async () => {
    try {
      const users = db.prepare('SELECT id, username, display_name, role, is_active, last_login_at, created_at FROM users ORDER BY created_at DESC').all()
      return { success: true, data: users }
    } catch (err) { return { success: false, error: 'Failed to fetch users' } }
  })

  ipcMain.handle('users:create', async (_e, data: any) => {
    try {
      const hash = bcrypt.hashSync(data.password, 10)
      const pinHash = data.pin ? bcrypt.hashSync(data.pin, 10) : null
      const result = db.prepare('INSERT INTO users (username, password_hash, display_name, role, pin_hash) VALUES (?, ?, ?, ?, ?)').run(data.username, hash, data.displayName, data.role || 'manager', pinHash)
      db.prepare("INSERT INTO audit_log (user_id, action, entity_type, entity_id, metadata, timestamp) VALUES (?, 'create_user', 'user', ?, ?, datetime('now'))").run(data.createdBy || null, result.lastInsertRowid, JSON.stringify({ username: data.username }))
      return { success: true, data: { id: result.lastInsertRowid } }
    } catch (err: any) {
      if (err.message?.includes('UNIQUE')) return { success: false, error: 'Username already exists' }
      return { success: false, error: 'Failed to create user' }
    }
  })

  ipcMain.handle('users:update', async (_e, data: any) => {
    try {
      const updates: string[] = []
      const values: any[] = []
      if (data.displayName) { updates.push('display_name = ?'); values.push(data.displayName) }
      if (data.password) { updates.push('password_hash = ?'); values.push(bcrypt.hashSync(data.password, 10)) }
      if (data.pin) { updates.push('pin_hash = ?'); values.push(bcrypt.hashSync(data.pin, 10)) }
      if (typeof data.isActive === 'number') { updates.push('is_active = ?'); values.push(data.isActive) }
      if (updates.length === 0) return { success: true }
      updates.push("updated_at = datetime('now')")
      values.push(data.id)
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values)
      return { success: true }
    } catch (err) { return { success: false, error: 'Failed to update user' } }
  })

  // ═══════════════════════════════════════════════════════════════
  // SETTINGS
  // ═══════════════════════════════════════════════════════════════

  ipcMain.handle('db:get-settings', async () => {
    try {
      const rows = db.prepare('SELECT key, value, category FROM settings').all() as any[]
      const settings: Record<string, any> = {}
      for (const r of rows) settings[r.key] = { value: r.value, category: r.category }
      return { success: true, data: settings }
    } catch (err) { return { success: false, error: 'Failed to fetch settings' } }
  })

  ipcMain.handle('db:update-setting', async (_e, { key, value, category, userId }: any) => {
    try {
      const existing = db.prepare('SELECT id FROM settings WHERE key = ?').get(key) as any
      if (existing) db.prepare("UPDATE settings SET value = ?, updated_at = datetime('now'), updated_by = ? WHERE key = ?").run(value, userId ?? null, key)
      else db.prepare('INSERT INTO settings (key, value, category, updated_by) VALUES (?, ?, ?, ?)').run(key, value, category ?? 'general', userId ?? null)
      return { success: true }
    } catch (err) { return { success: false, error: 'Failed to update setting' } }
  })

  ipcMain.handle('db:update-settings-bulk', async (_e, { settings, userId }: { settings: Record<string, string>; userId?: number }) => {
    try {
      const upsert = db.prepare("INSERT INTO settings (key, value, category, updated_by, updated_at) VALUES (?, ?, 'general', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at")
      const tx = db.transaction(() => { for (const [k, v] of Object.entries(settings)) upsert.run(k, v, userId ?? null) })
      tx()
      return { success: true }
    } catch (err) { return { success: false, error: 'Failed to update settings' } }
  })

  // ═══════════════════════════════════════════════════════════════
  // ITEMS (Inventory)
  // ═══════════════════════════════════════════════════════════════

  ipcMain.handle('items:list', async (_e, filters?: any) => {
    try {
      let sql = 'SELECT i.*, c.name as category_name, b.name as brand_name FROM items i LEFT JOIN categories c ON c.id = i.category_id LEFT JOIN brands b ON b.id = i.brand_id'
      const conditions: string[] = []
      const values: any[] = []
      if (filters?.search) { conditions.push("(i.name LIKE ? OR i.sku LIKE ? OR i.barcode LIKE ?)"); const s = `%${filters.search}%`; values.push(s, s, s) }
      if (filters?.categoryId) { conditions.push('i.category_id = ?'); values.push(filters.categoryId) }
      if (filters?.isActive !== undefined) { conditions.push('i.is_active = ?'); values.push(filters.isActive) }
      if (filters?.lowStock) { conditions.push('i.current_stock <= i.reorder_level AND i.reorder_level > 0') }
      if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ')
      sql += ' ORDER BY i.name ASC'
      if (filters?.limit) { sql += ' LIMIT ?'; values.push(filters.limit) }
      return { success: true, data: db.prepare(sql).all(...values) }
    } catch (err) { return { success: false, error: 'Failed to fetch items' } }
  })

  ipcMain.handle('items:get', async (_e, id: number) => {
    try {
      const item = db.prepare('SELECT i.*, c.name as category_name, b.name as brand_name FROM items i LEFT JOIN categories c ON c.id = i.category_id LEFT JOIN brands b ON b.id = i.brand_id WHERE i.id = ?').get(id)
      return item ? { success: true, data: item } : { success: false, error: 'Item not found' }
    } catch (err) { return { success: false, error: 'Failed to fetch item' } }
  })

  ipcMain.handle('items:create', async (_e, data: any) => {
    try {
      const result = db.prepare('INSERT INTO items (name, sku, barcode, hsn_code, category_id, brand_id, unit, mrp, selling_price, wholesale_price, purchase_price, tax_rate, current_stock, reorder_level, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
        data.name, data.sku || null, data.barcode || null, data.hsnCode || null, data.categoryId || null, data.brandId || null, data.unit || 'pieces', data.mrp || null, data.sellingPrice, data.wholesalePrice || null, data.purchasePrice || null, data.taxRate || 0, data.currentStock || 0, data.reorderLevel || 0, data.description || null
      )
      if (data.currentStock > 0) {
        db.prepare("INSERT INTO stock_movements (item_id, movement_type, quantity_change, quantity_before, quantity_after, reason, user_id, created_at) VALUES (?, 'opening_stock', ?, 0, ?, 'Opening stock', ?, datetime('now'))").run(result.lastInsertRowid, data.currentStock, data.currentStock, data.userId || 1)
      }
      return { success: true, data: { id: result.lastInsertRowid } }
    } catch (err: any) {
      if (err.message?.includes('UNIQUE')) return { success: false, error: 'Item with this SKU or barcode already exists' }
      return { success: false, error: 'Failed to create item' }
    }
  })

  ipcMain.handle('items:update', async (_e, data: any) => {
    try {
      const old = db.prepare('SELECT * FROM items WHERE id = ?').get(data.id) as any
      if (!old) return { success: false, error: 'Item not found' }
      db.prepare("UPDATE items SET name=?, sku=?, barcode=?, hsn_code=?, category_id=?, brand_id=?, unit=?, mrp=?, selling_price=?, wholesale_price=?, purchase_price=?, tax_rate=?, reorder_level=?, description=?, is_active=?, updated_at=datetime('now') WHERE id=?").run(
        data.name, data.sku||null, data.barcode||null, data.hsnCode||null, data.categoryId||null, data.brandId||null, data.unit||'pieces', data.mrp||null, data.sellingPrice, data.wholesalePrice||null, data.purchasePrice||null, data.taxRate||0, data.reorderLevel||0, data.description||null, data.isActive ?? 1, data.id
      )
      return { success: true }
    } catch (err: any) {
      if (err.message?.includes('UNIQUE')) return { success: false, error: 'SKU or barcode already exists' }
      return { success: false, error: 'Failed to update item' }
    }
  })

  ipcMain.handle('items:delete', async (_e, id: number) => {
    try { db.prepare("UPDATE items SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id); return { success: true } }
    catch (err) { return { success: false, error: 'Failed to delete item' } }
  })

  ipcMain.handle('items:adjust-stock', async (_e, { itemId, quantity, reason, userId }: any) => {
    try {
      const item = db.prepare('SELECT current_stock FROM items WHERE id = ?').get(itemId) as any
      if (!item) return { success: false, error: 'Item not found' }
      const newStock = item.current_stock + quantity
      db.prepare("UPDATE items SET current_stock = ?, updated_at = datetime('now') WHERE id = ?").run(newStock, itemId)
      db.prepare("INSERT INTO stock_movements (item_id, movement_type, quantity_change, quantity_before, quantity_after, reason, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)").run(itemId, quantity > 0 ? 'adjustment_in' : 'adjustment_out', quantity, item.current_stock, newStock, reason || 'Manual adjustment', userId || 1)
      return { success: true, data: { newStock } }
    } catch (err) { return { success: false, error: 'Failed to adjust stock' } }
  })

  ipcMain.handle('items:search', async (_e, query: string) => {
    try {
      const items = db.prepare("SELECT id, name, sku, barcode, selling_price, mrp, current_stock, unit, tax_rate FROM items WHERE is_active = 1 AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ?) LIMIT 20").all(`%${query}%`, `%${query}%`, `%${query}%`)
      return { success: true, data: items }
    } catch (err) { return { success: false, error: 'Search failed' } }
  })

  // ═══════════════════════════════════════════════════════════════
  // CATEGORIES & BRANDS
  // ═══════════════════════════════════════════════════════════════

  ipcMain.handle('categories:list', async () => {
    try { return { success: true, data: db.prepare('SELECT * FROM categories WHERE is_active = 1 ORDER BY name').all() } }
    catch (err) { return { success: false, error: 'Failed to fetch categories' } }
  })

  ipcMain.handle('categories:create', async (_e, data: any) => {
    try {
      const r = db.prepare('INSERT INTO categories (name, parent_id, description) VALUES (?, ?, ?)').run(data.name, data.parentId || null, data.description || null)
      return { success: true, data: { id: r.lastInsertRowid } }
    } catch (err) { return { success: false, error: 'Failed to create category' } }
  })

  ipcMain.handle('categories:update', async (_e, data: any) => {
    try { db.prepare('UPDATE categories SET name = ?, description = ? WHERE id = ?').run(data.name, data.description || null, data.id); return { success: true } }
    catch (err) { return { success: false, error: 'Failed to update category' } }
  })

  ipcMain.handle('categories:delete', async (_e, id: number) => {
    try { db.prepare('UPDATE categories SET is_active = 0 WHERE id = ?').run(id); return { success: true } }
    catch (err) { return { success: false, error: 'Failed to delete category' } }
  })

  ipcMain.handle('brands:list', async () => {
    try { return { success: true, data: db.prepare('SELECT * FROM brands WHERE is_active = 1 ORDER BY name').all() } }
    catch (err) { return { success: false, error: 'Failed to fetch brands' } }
  })

  ipcMain.handle('brands:create', async (_e, data: any) => {
    try { const r = db.prepare('INSERT INTO brands (name) VALUES (?)').run(data.name); return { success: true, data: { id: r.lastInsertRowid } } }
    catch (err: any) { if (err.message?.includes('UNIQUE')) return { success: false, error: 'Brand already exists' }; return { success: false, error: 'Failed to create brand' } }
  })

  ipcMain.handle('brands:delete', async (_e, id: number) => {
    try { db.prepare('UPDATE brands SET is_active = 0 WHERE id = ?').run(id); return { success: true } }
    catch (err) { return { success: false, error: 'Failed to delete brand' } }
  })

  // ═══════════════════════════════════════════════════════════════
  // CUSTOMERS
  // ═══════════════════════════════════════════════════════════════

  ipcMain.handle('customers:list', async (_e, filters?: any) => {
    try {
      let sql = 'SELECT * FROM customers'
      const conds: string[] = []; const vals: any[] = []
      if (filters?.search) { conds.push("(name LIKE ? OR phone LIKE ? OR email LIKE ?)"); const s = `%${filters.search}%`; vals.push(s, s, s) }
      if (filters?.isActive !== undefined) { conds.push('is_active = ?'); vals.push(filters.isActive) }
      if (conds.length) sql += ' WHERE ' + conds.join(' AND ')
      sql += ' ORDER BY name ASC'
      return { success: true, data: db.prepare(sql).all(...vals) }
    } catch (err) { return { success: false, error: 'Failed to fetch customers' } }
  })

  ipcMain.handle('customers:get', async (_e, id: number) => {
    try { const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(id); return c ? { success: true, data: c } : { success: false, error: 'Customer not found' } }
    catch (err) { return { success: false, error: 'Failed to fetch customer' } }
  })

  ipcMain.handle('customers:create', async (_e, data: any) => {
    try {
      const r = db.prepare('INSERT INTO customers (name, phone, alt_phone, email, address, city, state, pincode, gstin, customer_group, opening_balance, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(
        data.name, data.phone||null, data.altPhone||null, data.email||null, data.address||null, data.city||null, data.state||null, data.pincode||null, data.gstin||null, data.customerGroup||'retail', data.openingBalance||0, data.notes||null
      )
      return { success: true, data: { id: r.lastInsertRowid } }
    } catch (err: any) { if (err.message?.includes('UNIQUE')) return { success: false, error: 'Customer with this phone already exists' }; return { success: false, error: 'Failed to create customer' } }
  })

  ipcMain.handle('customers:update', async (_e, data: any) => {
    try {
      db.prepare("UPDATE customers SET name=?, phone=?, alt_phone=?, email=?, address=?, city=?, state=?, pincode=?, gstin=?, customer_group=?, notes=?, is_active=?, updated_at=datetime('now') WHERE id=?").run(
        data.name, data.phone||null, data.altPhone||null, data.email||null, data.address||null, data.city||null, data.state||null, data.pincode||null, data.gstin||null, data.customerGroup||'retail', data.notes||null, data.isActive??1, data.id
      )
      return { success: true }
    } catch (err: any) { if (err.message?.includes('UNIQUE')) return { success: false, error: 'Phone number already exists' }; return { success: false, error: 'Failed to update customer' } }
  })

  ipcMain.handle('customers:delete', async (_e, id: number) => {
    try { db.prepare("UPDATE customers SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id); return { success: true } }
    catch (err) { return { success: false, error: 'Failed to delete customer' } }
  })

  ipcMain.handle('customers:search', async (_e, query: string) => {
    try { return { success: true, data: db.prepare("SELECT id, name, phone, gstin FROM customers WHERE is_active = 1 AND (name LIKE ? OR phone LIKE ?) LIMIT 15").all(`%${query}%`, `%${query}%`) } }
    catch (err) { return { success: false, error: 'Search failed' } }
  })

  ipcMain.handle('customers:ledger', async (_e, customerId: number) => {
    try {
      const bills = db.prepare("SELECT bill_number as ref, bill_date as date, grand_total as amount, 'sale' as type FROM bills WHERE customer_id = ? ORDER BY bill_date DESC LIMIT 50").all(customerId)
      const payments = db.prepare("SELECT payment_number as ref, payment_date as date, amount, payment_type as type FROM payments WHERE customer_id = ? ORDER BY payment_date DESC LIMIT 50").all(customerId)
      return { success: true, data: { bills, payments } }
    } catch (err) { return { success: false, error: 'Failed to fetch ledger' } }
  })

  // ═══════════════════════════════════════════════════════════════
  // SUPPLIERS
  // ═══════════════════════════════════════════════════════════════

  ipcMain.handle('suppliers:list', async (_e, filters?: any) => {
    try {
      let sql = 'SELECT * FROM suppliers'
      const conds: string[] = []; const vals: any[] = []
      if (filters?.search) { conds.push("(name LIKE ? OR phone LIKE ?)"); const s = `%${filters.search}%`; vals.push(s, s) }
      if (filters?.isActive !== undefined) { conds.push('is_active = ?'); vals.push(filters.isActive) }
      if (conds.length) sql += ' WHERE ' + conds.join(' AND ')
      sql += ' ORDER BY name ASC'
      return { success: true, data: db.prepare(sql).all(...vals) }
    } catch (err) { return { success: false, error: 'Failed to fetch suppliers' } }
  })

  ipcMain.handle('suppliers:create', async (_e, data: any) => {
    try {
      const r = db.prepare('INSERT INTO suppliers (name, phone, email, address, city, state, gstin, bank_name, bank_account, bank_ifsc, opening_balance, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(
        data.name, data.phone||null, data.email||null, data.address||null, data.city||null, data.state||null, data.gstin||null, data.bankName||null, data.bankAccount||null, data.bankIfsc||null, data.openingBalance||0, data.notes||null
      )
      return { success: true, data: { id: r.lastInsertRowid } }
    } catch (err) { return { success: false, error: 'Failed to create supplier' } }
  })

  ipcMain.handle('suppliers:update', async (_e, data: any) => {
    try {
      db.prepare("UPDATE suppliers SET name=?, phone=?, email=?, address=?, city=?, state=?, gstin=?, bank_name=?, bank_account=?, bank_ifsc=?, notes=?, is_active=?, updated_at=datetime('now') WHERE id=?").run(
        data.name, data.phone||null, data.email||null, data.address||null, data.city||null, data.state||null, data.gstin||null, data.bankName||null, data.bankAccount||null, data.bankIfsc||null, data.notes||null, data.isActive??1, data.id
      )
      return { success: true }
    } catch (err) { return { success: false, error: 'Failed to update supplier' } }
  })

  ipcMain.handle('suppliers:delete', async (_e, id: number) => {
    try { db.prepare("UPDATE suppliers SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id); return { success: true } }
    catch (err) { return { success: false, error: 'Failed to delete supplier' } }
  })

  ipcMain.handle('suppliers:search', async (_e, query: string) => {
    try { return { success: true, data: db.prepare("SELECT id, name, phone, gstin FROM suppliers WHERE is_active = 1 AND (name LIKE ? OR phone LIKE ?) LIMIT 15").all(`%${query}%`, `%${query}%`) } }
    catch (err) { return { success: false, error: 'Search failed' } }
  })

  // ═══════════════════════════════════════════════════════════════
  // BILLS (Sales Invoices)
  // ═══════════════════════════════════════════════════════════════

  ipcMain.handle('bills:create', async (_e, data: any) => {
    try {
      const tx = db.transaction(() => {
        // Get next bill number
        const prefix = (db.prepare("SELECT value FROM settings WHERE key = 'bill_prefix'").get() as any)?.value?.replace(/"/g, '') || 'INV'
        const fy = (db.prepare("SELECT value FROM settings WHERE key = 'financial_year'").get() as any)?.value?.replace(/"/g, '') || '2026-27'
        const lastBill = db.prepare("SELECT bill_number FROM bills WHERE financial_year = ? ORDER BY id DESC LIMIT 1").get(fy) as any
        let nextNum = 1
        if (lastBill) { const parts = lastBill.bill_number.split('-'); nextNum = parseInt(parts[parts.length - 1], 10) + 1 }
        const billNumber = `${prefix}-${fy.split('-')[0].slice(2)}${fy.split('-')[1]}-${String(nextNum).padStart(4, '0')}`

        // Hash chain
        const prevHash = (db.prepare("SELECT bill_hash FROM bills ORDER BY id DESC LIMIT 1").get() as any)?.bill_hash || 'GENESIS'
        const billHash = crypto.createHash('sha256').update(`${billNumber}|${data.grandTotal}|${prevHash}`).digest('hex')

        const r = db.prepare('INSERT INTO bills (bill_number, bill_hash, prev_bill_hash, financial_year, customer_id, customer_name, customer_phone, user_id, bill_date, subtotal, discount_type, discount_value, discount_amount, taxable_amount, cgst_amount, sgst_amount, tax_amount, round_off, grand_total, paid_amount, balance_due, payment_status, notes, vehicle_number) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
          billNumber, billHash, prevHash, fy, data.customerId||null, data.customerName||null, data.customerPhone||null, data.userId, data.billDate || new Date().toISOString().split('T')[0],
          data.subtotal, data.discountType||null, data.discountValue||0, data.discountAmount||0, data.taxableAmount, data.cgstAmount||0, data.sgstAmount||0, data.taxAmount||0, data.roundOff||0, data.grandTotal, data.paidAmount||0, data.balanceDue||0,
          data.paidAmount >= data.grandTotal ? 'paid' : data.paidAmount > 0 ? 'partial' : 'unpaid', data.notes||null, data.vehicleNumber||null
        )
        const billId = r.lastInsertRowid

        // Insert bill items and update stock
        const insertItem = db.prepare('INSERT INTO bill_items (bill_id, item_id, item_name, item_sku, hsn_code, quantity, unit, rate, discount_type, discount_value, discount_amount, taxable_amount, tax_rate, cgst_amount, sgst_amount, tax_amount, line_total) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        const updateStock = db.prepare("UPDATE items SET current_stock = current_stock - ?, updated_at = datetime('now') WHERE id = ?")
        const insertMovement = db.prepare("INSERT INTO stock_movements (item_id, movement_type, reference_type, reference_id, quantity_change, quantity_before, quantity_after, reason, user_id) VALUES (?, 'sale', 'bill', ?, ?, ?, ?, 'Sale', ?)")

        for (const item of data.items) {
          insertItem.run(billId, item.itemId||null, item.itemName, item.itemSku||null, item.hsnCode||null, item.quantity, item.unit||'pieces', item.rate, item.discountType||null, item.discountValue||0, item.discountAmount||0, item.taxableAmount, item.taxRate||0, item.cgstAmount||0, item.sgstAmount||0, item.taxAmount||0, item.lineTotal)
          if (item.itemId) {
            const stock = (db.prepare('SELECT current_stock FROM items WHERE id = ?').get(item.itemId) as any)?.current_stock || 0
            updateStock.run(item.quantity, item.itemId)
            insertMovement.run(item.itemId, billId, -item.quantity, stock, stock - item.quantity, data.userId)
          }
        }

        // Payment record
        if (data.paidAmount > 0) {
          const payNum = `PAY-${billNumber}`
          db.prepare("INSERT INTO payments (payment_number, payment_type, payment_mode, amount, reference_type, reference_id, customer_id, bank_account_id, user_id, payment_date) VALUES (?, 'receipt', ?, ?, 'bill', ?, ?, ?, ?, ?)").run(
            payNum, data.paymentMode || 'cash', data.paidAmount, billId, data.customerId||null, data.bankAccountId||null, data.userId, data.billDate || new Date().toISOString().split('T')[0]
          )
        }

        // Audit
        db.prepare("INSERT INTO audit_log (user_id, action, entity_type, entity_id, metadata, timestamp) VALUES (?, 'create_bill', 'bill', ?, ?, datetime('now'))").run(data.userId, billId, JSON.stringify({ billNumber, grandTotal: data.grandTotal }))

        return { billId, billNumber }
      })
      const result = tx()
      return { success: true, data: result }
    } catch (err) { console.error('[IPC] bills:create error:', err); return { success: false, error: 'Failed to create bill' } }
  })

  ipcMain.handle('bills:list', async (_e, filters?: any) => {
    try {
      let sql = 'SELECT b.*, u.display_name as created_by_name FROM bills b LEFT JOIN users u ON u.id = b.user_id'
      const conds: string[] = []; const vals: any[] = []
      if (filters?.search) { conds.push("(b.bill_number LIKE ? OR b.customer_name LIKE ?)"); const s = `%${filters.search}%`; vals.push(s, s) }
      if (filters?.status) { conds.push('b.bill_status = ?'); vals.push(filters.status) }
      if (filters?.paymentStatus) { conds.push('b.payment_status = ?'); vals.push(filters.paymentStatus) }
      if (filters?.dateFrom) { conds.push('b.bill_date >= ?'); vals.push(filters.dateFrom) }
      if (filters?.dateTo) { conds.push('b.bill_date <= ?'); vals.push(filters.dateTo) }
      if (filters?.customerId) { conds.push('b.customer_id = ?'); vals.push(filters.customerId) }
      if (conds.length) sql += ' WHERE ' + conds.join(' AND ')
      sql += ' ORDER BY b.id DESC'
      if (filters?.limit) { sql += ' LIMIT ?'; vals.push(filters.limit) }
      return { success: true, data: db.prepare(sql).all(...vals) }
    } catch (err) { return { success: false, error: 'Failed to fetch bills' } }
  })

  ipcMain.handle('bills:get', async (_e, id: number) => {
    try {
      const bill = db.prepare('SELECT b.*, u.display_name as created_by_name FROM bills b LEFT JOIN users u ON u.id = b.user_id WHERE b.id = ?').get(id) as any
      if (!bill) return { success: false, error: 'Bill not found' }
      const items = db.prepare('SELECT * FROM bill_items WHERE bill_id = ?').all(id)
      const payments = db.prepare("SELECT * FROM payments WHERE reference_type = 'bill' AND reference_id = ?").all(id)
      return { success: true, data: { ...bill, items, payments } }
    } catch (err) { return { success: false, error: 'Failed to fetch bill' } }
  })

  ipcMain.handle('bills:cancel', async (_e, { billId, reason, userId }: any) => {
    try {
      const tx = db.transaction(() => {
        db.prepare("UPDATE bills SET bill_status = 'cancelled', cancel_reason = ?, cancelled_by = ?, cancelled_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(reason, userId, billId)
        // Restore stock
        const items = db.prepare('SELECT * FROM bill_items WHERE bill_id = ?').all(billId) as any[]
        for (const item of items) {
          if (item.item_id) {
            const stock = (db.prepare('SELECT current_stock FROM items WHERE id = ?').get(item.item_id) as any)?.current_stock || 0
            db.prepare("UPDATE items SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ?").run(item.quantity, item.item_id)
            db.prepare("INSERT INTO stock_movements (item_id, movement_type, reference_type, reference_id, quantity_change, quantity_before, quantity_after, reason, user_id) VALUES (?, 'cancel_restore', 'bill', ?, ?, ?, ?, 'Bill cancelled', ?)").run(item.item_id, billId, item.quantity, stock, stock + item.quantity, userId)
          }
        }
        db.prepare("INSERT INTO audit_log (user_id, action, entity_type, entity_id, metadata, timestamp) VALUES (?, 'cancel_bill', 'bill', ?, ?, datetime('now'))").run(userId, billId, JSON.stringify({ reason }))
      })
      tx()
      return { success: true }
    } catch (err) { return { success: false, error: 'Failed to cancel bill' } }
  })

  // ── Bill Print Logging ──────────────────────────────────────────

  ipcMain.handle('bills:log-print', async (_e, { billId, userId }: { billId: number; userId: number }) => {
    try {
      db.prepare("INSERT INTO bill_print_log (bill_id, user_id, printed_at) VALUES (?, ?, datetime('now'))").run(billId, userId)
      db.prepare("INSERT INTO audit_log (user_id, action, entity_type, entity_id, timestamp) VALUES (?, 'print_bill', 'bill', ?, datetime('now'))").run(userId, billId)
      return { success: true }
    } catch (err) { return { success: false, error: 'Failed to log print' } }
  })

  ipcMain.handle('bills:print-history', async (_e, billId: number) => {
    try {
      const prints = db.prepare('SELECT bpl.*, u.display_name as user_name FROM bill_print_log bpl LEFT JOIN users u ON u.id = bpl.user_id WHERE bpl.bill_id = ? ORDER BY bpl.printed_at DESC').all(billId) as any[]
      return { success: true, data: { count: prints.length, prints } }
    } catch (err) { return { success: false, error: 'Failed to fetch print history' } }
  })

  // ═══════════════════════════════════════════════════════════════
  // PURCHASES
  // ═══════════════════════════════════════════════════════════════

  ipcMain.handle('purchases:create', async (_e, data: any) => {
    try {
      const tx = db.transaction(() => {
        const prefix = (db.prepare("SELECT value FROM settings WHERE key = 'purchase_prefix'").get() as any)?.value?.replace(/"/g, '') || 'PUR'
        const lastPur = db.prepare("SELECT purchase_number FROM purchases ORDER BY id DESC LIMIT 1").get() as any
        let nextNum = 1
        if (lastPur) { const parts = lastPur.purchase_number.split('-'); nextNum = parseInt(parts[parts.length - 1], 10) + 1 }
        const purchaseNumber = `${prefix}-${String(nextNum).padStart(4, '0')}`

        const r = db.prepare('INSERT INTO purchases (purchase_number, supplier_id, supplier_name, supplier_bill_no, user_id, purchase_date, subtotal, discount_amount, tax_amount, grand_total, paid_amount, balance_due, payment_status, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
          purchaseNumber, data.supplierId||null, data.supplierName||null, data.supplierBillNo||null, data.userId, data.purchaseDate || new Date().toISOString().split('T')[0],
          data.subtotal, data.discountAmount||0, data.taxAmount||0, data.grandTotal, data.paidAmount||0, data.balanceDue||0,
          data.paidAmount >= data.grandTotal ? 'paid' : data.paidAmount > 0 ? 'partial' : 'unpaid', data.notes||null
        )
        const purchaseId = r.lastInsertRowid

        const insertItem = db.prepare('INSERT INTO purchase_items (purchase_id, item_id, item_name, quantity, unit, rate, tax_rate, tax_amount, line_total, batch_number, expiry_date) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        const updateStock = db.prepare("UPDATE items SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ?")
        const insertMovement = db.prepare("INSERT INTO stock_movements (item_id, movement_type, reference_type, reference_id, quantity_change, quantity_before, quantity_after, reason, user_id) VALUES (?, 'purchase', 'purchase', ?, ?, ?, ?, 'Purchase', ?)")

        for (const item of data.items) {
          insertItem.run(purchaseId, item.itemId||null, item.itemName, item.quantity, item.unit||'pieces', item.rate, item.taxRate||0, item.taxAmount||0, item.lineTotal, item.batchNumber||null, item.expiryDate||null)
          if (item.itemId) {
            const stock = (db.prepare('SELECT current_stock FROM items WHERE id = ?').get(item.itemId) as any)?.current_stock || 0
            updateStock.run(item.quantity, item.itemId)
            insertMovement.run(item.itemId, purchaseId, item.quantity, stock, stock + item.quantity, data.userId)
          }
        }

        if (data.paidAmount > 0) {
          db.prepare("INSERT INTO payments (payment_number, payment_type, payment_mode, amount, reference_type, reference_id, supplier_id, bank_account_id, user_id, payment_date) VALUES (?, 'voucher', ?, ?, 'purchase', ?, ?, ?, ?, ?)").run(
            `VPAY-${purchaseNumber}`, data.paymentMode||'cash', data.paidAmount, purchaseId, data.supplierId||null, data.bankAccountId||null, data.userId, data.purchaseDate || new Date().toISOString().split('T')[0]
          )
        }

        return { purchaseId, purchaseNumber }
      })
      const result = tx()
      return { success: true, data: result }
    } catch (err) { console.error('[IPC] purchases:create error:', err); return { success: false, error: 'Failed to create purchase' } }
  })

  ipcMain.handle('purchases:list', async (_e, filters?: any) => {
    try {
      let sql = 'SELECT p.*, u.display_name as created_by_name FROM purchases p LEFT JOIN users u ON u.id = p.user_id'
      const conds: string[] = []; const vals: any[] = []
      if (filters?.search) { conds.push("(p.purchase_number LIKE ? OR p.supplier_name LIKE ?)"); const s = `%${filters.search}%`; vals.push(s, s) }
      if (filters?.dateFrom) { conds.push('p.purchase_date >= ?'); vals.push(filters.dateFrom) }
      if (filters?.dateTo) { conds.push('p.purchase_date <= ?'); vals.push(filters.dateTo) }
      if (conds.length) sql += ' WHERE ' + conds.join(' AND ')
      sql += ' ORDER BY p.id DESC'
      return { success: true, data: db.prepare(sql).all(...vals) }
    } catch (err) { return { success: false, error: 'Failed to fetch purchases' } }
  })

  ipcMain.handle('purchases:get', async (_e, id: number) => {
    try {
      const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(id) as any
      if (!purchase) return { success: false, error: 'Purchase not found' }
      const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(id)
      return { success: true, data: { ...purchase, items } }
    } catch (err) { return { success: false, error: 'Failed to fetch purchase' } }
  })

  // ═══════════════════════════════════════════════════════════════
  // STOCK MOVEMENTS
  // ═══════════════════════════════════════════════════════════════

  ipcMain.handle('stock:movements', async (_e, filters?: any) => {
    try {
      let sql = 'SELECT sm.*, i.name as item_name, i.sku as item_sku, u.display_name as user_name FROM stock_movements sm LEFT JOIN items i ON i.id = sm.item_id LEFT JOIN users u ON u.id = sm.user_id'
      const conds: string[] = []; const vals: any[] = []
      if (filters?.itemId) { conds.push('sm.item_id = ?'); vals.push(filters.itemId) }
      if (filters?.type) { conds.push('sm.movement_type = ?'); vals.push(filters.type) }
      if (filters?.dateFrom) { conds.push('sm.created_at >= ?'); vals.push(filters.dateFrom) }
      if (filters?.dateTo) { conds.push('sm.created_at <= ?'); vals.push(filters.dateTo) }
      if (conds.length) sql += ' WHERE ' + conds.join(' AND ')
      sql += ' ORDER BY sm.id DESC LIMIT 200'
      return { success: true, data: db.prepare(sql).all(...vals) }
    } catch (err) { return { success: false, error: 'Failed to fetch stock movements' } }
  })

  // ═══════════════════════════════════════════════════════════════
  // BANK ACCOUNTS
  // ═══════════════════════════════════════════════════════════════

  ipcMain.handle('bank-accounts:list', async () => {
    try { return { success: true, data: db.prepare('SELECT * FROM bank_accounts WHERE is_active = 1 ORDER BY is_default DESC, account_name ASC').all() } }
    catch (err) { return { success: false, error: 'Failed to fetch bank accounts' } }
  })

  ipcMain.handle('bank-accounts:create', async (_e, data: any) => {
    try {
      if (data.isDefault) db.prepare('UPDATE bank_accounts SET is_default = 0').run()
      const r = db.prepare('INSERT INTO bank_accounts (account_name, bank_name, account_number, ifsc_code, upi_id, account_type, is_default, opening_balance, current_balance, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)').run(
        data.accountName, data.bankName, data.accountNumber||null, data.ifscCode||null, data.upiId||null, data.accountType||'savings', data.isDefault?1:0, data.openingBalance||0, data.openingBalance||0, data.createdBy||null
      )
      return { success: true, data: { id: r.lastInsertRowid } }
    } catch (err) { return { success: false, error: 'Failed to create bank account' } }
  })

  ipcMain.handle('bank-accounts:update', async (_e, data: any) => {
    try {
      if (data.isDefault) db.prepare('UPDATE bank_accounts SET is_default = 0').run()
      db.prepare("UPDATE bank_accounts SET account_name=?, bank_name=?, account_number=?, ifsc_code=?, upi_id=?, account_type=?, is_default=?, updated_at=datetime('now') WHERE id=?").run(
        data.accountName, data.bankName, data.accountNumber||null, data.ifscCode||null, data.upiId||null, data.accountType||'savings', data.isDefault?1:0, data.id
      )
      return { success: true }
    } catch (err) { return { success: false, error: 'Failed to update bank account' } }
  })

  ipcMain.handle('bank-accounts:delete', async (_e, id: number) => {
    try { db.prepare("UPDATE bank_accounts SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id); return { success: true } }
    catch (err) { return { success: false, error: 'Failed to delete bank account' } }
  })

  // ═══════════════════════════════════════════════════════════════
  // EXPENSES
  // ═══════════════════════════════════════════════════════════════

  ipcMain.handle('expenses:list', async (_e, filters?: any) => {
    try {
      let sql = 'SELECT e.*, ba.account_name as bank_account_name FROM expenses e LEFT JOIN bank_accounts ba ON ba.id = e.bank_account_id'
      const conds: string[] = []; const vals: any[] = []
      if (filters?.dateFrom) { conds.push('e.expense_date >= ?'); vals.push(filters.dateFrom) }
      if (filters?.dateTo) { conds.push('e.expense_date <= ?'); vals.push(filters.dateTo) }
      if (filters?.category) { conds.push('e.category = ?'); vals.push(filters.category) }
      if (conds.length) sql += ' WHERE ' + conds.join(' AND ')
      sql += ' ORDER BY e.id DESC'
      return { success: true, data: db.prepare(sql).all(...vals) }
    } catch (err) { return { success: false, error: 'Failed to fetch expenses' } }
  })

  ipcMain.handle('expenses:create', async (_e, data: any) => {
    try {
      const last = db.prepare('SELECT expense_number FROM expenses ORDER BY id DESC LIMIT 1').get() as any
      let num = 1; if (last) { const p = last.expense_number.split('-'); num = parseInt(p[p.length - 1], 10) + 1 }
      const expNum = `EXP-${String(num).padStart(4, '0')}`
      const r = db.prepare('INSERT INTO expenses (expense_number, category, amount, payment_mode, bank_account_id, description, expense_date, user_id) VALUES (?,?,?,?,?,?,?,?)').run(
        expNum, data.category, data.amount, data.paymentMode||'cash', data.bankAccountId||null, data.description||null, data.expenseDate || new Date().toISOString().split('T')[0], data.userId||null
      )
      return { success: true, data: { id: r.lastInsertRowid, expenseNumber: expNum } }
    } catch (err) { return { success: false, error: 'Failed to create expense' } }
  })

  // ═══════════════════════════════════════════════════════════════
  // WITHOUT BILL PAYMENTS
  // ═══════════════════════════════════════════════════════════════

  ipcMain.handle('without-bill:list', async (_e, filters?: any) => {
    try {
      let sql = 'SELECT wb.*, ba.account_name as bank_account_name, u.display_name as user_name FROM without_bill_payments wb LEFT JOIN bank_accounts ba ON ba.id = wb.bank_account_id LEFT JOIN users u ON u.id = wb.user_id'
      const conds: string[] = []; const vals: any[] = []
      if (filters?.dateFrom) { conds.push('wb.payment_date >= ?'); vals.push(filters.dateFrom) }
      if (filters?.dateTo) { conds.push('wb.payment_date <= ?'); vals.push(filters.dateTo) }
      if (filters?.category) { conds.push('wb.category = ?'); vals.push(filters.category) }
      if (conds.length) sql += ' WHERE ' + conds.join(' AND ')
      sql += ' ORDER BY wb.id DESC'
      return { success: true, data: db.prepare(sql).all(...vals) }
    } catch (err) { return { success: false, error: 'Failed to fetch without-bill payments' } }
  })

  ipcMain.handle('without-bill:create', async (_e, data: any) => {
    try {
      const last = db.prepare('SELECT payment_number FROM without_bill_payments ORDER BY id DESC LIMIT 1').get() as any
      let num = 1; if (last) { const p = last.payment_number.split('-'); num = parseInt(p[p.length - 1], 10) + 1 }
      const payNum = `WB-${String(num).padStart(4, '0')}`
      const r = db.prepare('INSERT INTO without_bill_payments (payment_number, amount, payment_mode, bank_account_id, transaction_ref, category, recipient_name, recipient_phone, purpose, payment_date, is_recurring, notes, user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
        payNum, data.amount, data.paymentMode||'cash', data.bankAccountId||null, data.transactionRef||null, data.category, data.recipientName||null, data.recipientPhone||null, data.purpose, data.paymentDate || new Date().toISOString().split('T')[0], data.isRecurring?1:0, data.notes||null, data.userId||null
      )
      return { success: true, data: { id: r.lastInsertRowid, paymentNumber: payNum } }
    } catch (err) { return { success: false, error: 'Failed to create without-bill payment' } }
  })

  ipcMain.handle('without-bill:categories', async () => {
    try { return { success: true, data: db.prepare('SELECT * FROM without_bill_categories WHERE is_active = 1 ORDER BY name').all() } }
    catch (err) { return { success: false, error: 'Failed to fetch categories' } }
  })

  // ═══════════════════════════════════════════════════════════════
  // RETURNS
  // ═══════════════════════════════════════════════════════════════

  ipcMain.handle('returns:create', async (_e, data: any) => {
    try {
      const tx = db.transaction(() => {
        const last = db.prepare('SELECT return_number FROM returns ORDER BY id DESC LIMIT 1').get() as any
        let num = 1; if (last) { const p = last.return_number.split('-'); num = parseInt(p[p.length - 1], 10) + 1 }
        const returnNumber = `RET-${String(num).padStart(4, '0')}`
        const r = db.prepare('INSERT INTO returns (return_number, return_type, original_bill_id, original_purchase_id, customer_id, supplier_id, total_amount, refund_mode, reason, user_id, return_date) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
          returnNumber, data.returnType, data.originalBillId||null, data.originalPurchaseId||null, data.customerId||null, data.supplierId||null, data.totalAmount, data.refundMode||'cash', data.reason, data.userId, data.returnDate || new Date().toISOString().split('T')[0]
        )
        const returnId = r.lastInsertRowid
        for (const item of data.items) {
          db.prepare('INSERT INTO return_items (return_id, item_id, item_name, quantity, rate, line_total) VALUES (?,?,?,?,?,?)').run(returnId, item.itemId||null, item.itemName, item.quantity, item.rate, item.lineTotal)
          if (item.itemId && data.returnType === 'sales_return') {
            const stock = (db.prepare('SELECT current_stock FROM items WHERE id = ?').get(item.itemId) as any)?.current_stock || 0
            db.prepare("UPDATE items SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ?").run(item.quantity, item.itemId)
            db.prepare("INSERT INTO stock_movements (item_id, movement_type, reference_type, reference_id, quantity_change, quantity_before, quantity_after, reason, user_id) VALUES (?, 'return_in', 'return', ?, ?, ?, ?, 'Sales return', ?)").run(item.itemId, returnId, item.quantity, stock, stock + item.quantity, data.userId)
          }
        }
        return { returnId, returnNumber }
      })
      const result = tx()
      return { success: true, data: result }
    } catch (err) { return { success: false, error: 'Failed to create return' } }
  })

  ipcMain.handle('returns:list', async () => {
    try { return { success: true, data: db.prepare('SELECT r.*, u.display_name as user_name FROM returns r LEFT JOIN users u ON u.id = r.user_id ORDER BY r.id DESC').all() } }
    catch (err) { return { success: false, error: 'Failed to fetch returns' } }
  })

  // ═══════════════════════════════════════════════════════════════
  // DAY BOOK & CASH REGISTER
  // ═══════════════════════════════════════════════════════════════

  ipcMain.handle('daybook:get', async (_e, date: string) => {
    try {
      const sales = db.prepare("SELECT bill_number as ref, grand_total as amount, payment_status, customer_name FROM bills WHERE bill_date = ? AND bill_status = 'active' ORDER BY id").all(date)
      const purchases = db.prepare("SELECT purchase_number as ref, grand_total as amount, payment_status, supplier_name FROM purchases WHERE purchase_date = ? AND purchase_status = 'active' ORDER BY id").all(date)
      const expenses = db.prepare('SELECT expense_number as ref, amount, category, description FROM expenses WHERE expense_date = ? ORDER BY id').all(date)
      const withoutBill = db.prepare('SELECT payment_number as ref, amount, category, purpose FROM without_bill_payments WHERE payment_date = ? ORDER BY id').all(date)
      const payments = db.prepare('SELECT payment_number as ref, amount, payment_type, payment_mode FROM payments WHERE payment_date = ? ORDER BY id').all(date)
      const totalSales = (db.prepare("SELECT COALESCE(SUM(grand_total), 0) as total FROM bills WHERE bill_date = ? AND bill_status = 'active'").get(date) as any).total
      const totalPurchases = (db.prepare("SELECT COALESCE(SUM(grand_total), 0) as total FROM purchases WHERE purchase_date = ? AND purchase_status = 'active'").get(date) as any).total
      const totalExpenses = (db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE expense_date = ?").get(date) as any).total
      const totalWB = (db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM without_bill_payments WHERE payment_date = ?").get(date) as any).total
      return { success: true, data: { sales, purchases, expenses, withoutBill, payments, totals: { sales: totalSales, purchases: totalPurchases, expenses: totalExpenses, withoutBill: totalWB } } }
    } catch (err) { return { success: false, error: 'Failed to fetch day book' } }
  })

  ipcMain.handle('cash-register:get', async (_e, date: string) => {
    try {
      let register = db.prepare('SELECT * FROM cash_register WHERE register_date = ?').get(date) as any
      if (!register) {
        const prev = db.prepare('SELECT closing_balance FROM cash_register WHERE register_date < ? ORDER BY register_date DESC LIMIT 1').get(date) as any
        const opening = prev?.closing_balance || 0
        db.prepare('INSERT OR IGNORE INTO cash_register (register_date, opening_balance) VALUES (?, ?)').run(date, opening)
        register = db.prepare('SELECT * FROM cash_register WHERE register_date = ?').get(date) as any
      }
      const cashIn = (db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE payment_date = ? AND payment_mode = 'cash' AND payment_type = 'receipt'").get(date) as any).total
      const cashOut = (db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE payment_date = ? AND payment_mode = 'cash' AND payment_type = 'voucher'").get(date) as any).total
      const expenseCash = (db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE expense_date = ? AND payment_mode = 'cash'").get(date) as any).total
      const wbCash = (db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM without_bill_payments WHERE payment_date = ? AND payment_mode = 'cash'").get(date) as any).total
      return { success: true, data: { ...register, calculatedCashIn: cashIn, calculatedCashOut: cashOut + expenseCash + wbCash } }
    } catch (err) { return { success: false, error: 'Failed to fetch cash register' } }
  })

  // ═══════════════════════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════════════════════

  ipcMain.handle('dashboard:metrics', async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      const todaySales = (db.prepare("SELECT COALESCE(SUM(grand_total), 0) as t FROM bills WHERE bill_date = ? AND bill_status = 'active'").get(today) as any).t
      const yesterdaySales = (db.prepare("SELECT COALESCE(SUM(grand_total), 0) as t FROM bills WHERE bill_date = ? AND bill_status = 'active'").get(yesterday) as any).t
      const todayPurchases = (db.prepare("SELECT COALESCE(SUM(grand_total), 0) as t FROM purchases WHERE purchase_date = ? AND purchase_status = 'active'").get(today) as any).t
      const todayExpenses = (db.prepare("SELECT COALESCE(SUM(amount), 0) as t FROM expenses WHERE expense_date = ?").get(today) as any).t
      const bankBalance = (db.prepare("SELECT COALESCE(SUM(current_balance), 0) as t FROM bank_accounts WHERE is_active = 1").get() as any).t
      const billCount = (db.prepare("SELECT COUNT(*) as c FROM bills WHERE bill_date = ? AND bill_status = 'active'").get(today) as any).c
      const lowStockItems = db.prepare("SELECT id, name, current_stock, reorder_level FROM items WHERE is_active = 1 AND current_stock <= reorder_level AND reorder_level > 0 ORDER BY current_stock ASC LIMIT 10").all()
      const recentBills = db.prepare("SELECT bill_number, customer_name, grand_total, payment_status, bill_date, created_at FROM bills WHERE bill_status = 'active' ORDER BY id DESC LIMIT 8").all()
      const salesChange = yesterdaySales > 0 ? Math.round((todaySales - yesterdaySales) / yesterdaySales * 100) : 0
      return { success: true, data: { todaySales, todayPurchases, todayExpenses, bankBalance, billCount, lowStockItems, recentBills, salesChange } }
    } catch (err) { return { success: false, error: 'Failed to fetch dashboard metrics' } }
  })

  // ═══════════════════════════════════════════════════════════════
  // REPORTS
  // ═══════════════════════════════════════════════════════════════

  ipcMain.handle('reports:sales-summary', async (_e, { dateFrom, dateTo }: any) => {
    try {
      const summary = db.prepare("SELECT bill_date, COUNT(*) as bill_count, SUM(grand_total) as total_sales, SUM(tax_amount) as total_tax, SUM(discount_amount) as total_discount FROM bills WHERE bill_date >= ? AND bill_date <= ? AND bill_status = 'active' GROUP BY bill_date ORDER BY bill_date").all(dateFrom, dateTo)
      const totals = db.prepare("SELECT COUNT(*) as bill_count, COALESCE(SUM(grand_total), 0) as total_sales, COALESCE(SUM(tax_amount), 0) as total_tax, COALESCE(SUM(paid_amount), 0) as total_received, COALESCE(SUM(balance_due), 0) as total_pending FROM bills WHERE bill_date >= ? AND bill_date <= ? AND bill_status = 'active'").get(dateFrom, dateTo)
      const topItems = db.prepare("SELECT bi.item_name, SUM(bi.quantity) as total_qty, SUM(bi.line_total) as total_amount FROM bill_items bi JOIN bills b ON b.id = bi.bill_id WHERE b.bill_date >= ? AND b.bill_date <= ? AND b.bill_status = 'active' GROUP BY bi.item_name ORDER BY total_amount DESC LIMIT 10").all(dateFrom, dateTo)
      return { success: true, data: { summary, totals, topItems } }
    } catch (err) { return { success: false, error: 'Failed to generate sales report' } }
  })

  ipcMain.handle('reports:profit-loss', async (_e, { dateFrom, dateTo }: any) => {
    try {
      const sales = (db.prepare("SELECT COALESCE(SUM(grand_total), 0) as t FROM bills WHERE bill_date >= ? AND bill_date <= ? AND bill_status = 'active'").get(dateFrom, dateTo) as any).t
      const purchases = (db.prepare("SELECT COALESCE(SUM(grand_total), 0) as t FROM purchases WHERE purchase_date >= ? AND purchase_date <= ? AND purchase_status = 'active'").get(dateFrom, dateTo) as any).t
      const expenses = (db.prepare("SELECT COALESCE(SUM(amount), 0) as t FROM expenses WHERE expense_date >= ? AND expense_date <= ?").get(dateFrom, dateTo) as any).t
      const withoutBill = (db.prepare("SELECT COALESCE(SUM(amount), 0) as t FROM without_bill_payments WHERE payment_date >= ? AND payment_date <= ?").get(dateFrom, dateTo) as any).t
      const grossProfit = sales - purchases
      const netProfit = grossProfit - expenses - withoutBill
      return { success: true, data: { sales, purchases, expenses, withoutBill, grossProfit, netProfit } }
    } catch (err) { return { success: false, error: 'Failed to generate P&L report' } }
  })

  ipcMain.handle('reports:stock-summary', async () => {
    try {
      const items = db.prepare("SELECT name, sku, current_stock, reorder_level, selling_price, purchase_price, (current_stock * COALESCE(purchase_price, selling_price)) as stock_value FROM items WHERE is_active = 1 ORDER BY name").all()
      const totalValue = (db.prepare("SELECT COALESCE(SUM(current_stock * COALESCE(purchase_price, selling_price)), 0) as t FROM items WHERE is_active = 1").get() as any).t
      return { success: true, data: { items, totalValue } }
    } catch (err) { return { success: false, error: 'Failed to generate stock report' } }
  })

  // ═══════════════════════════════════════════════════════════════
  // AUDIT LOG
  // ═══════════════════════════════════════════════════════════════

  ipcMain.handle('audit:list', async (_e, filters?: any) => {
    try {
      let sql = 'SELECT a.*, u.display_name as user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id'
      const conds: string[] = []; const vals: any[] = []
      if (filters?.userId) { conds.push('a.user_id = ?'); vals.push(filters.userId) }
      if (filters?.action) { conds.push('a.action = ?'); vals.push(filters.action) }
      if (conds.length) sql += ' WHERE ' + conds.join(' AND ')
      sql += ' ORDER BY a.id DESC LIMIT 100'
      return { success: true, data: db.prepare(sql).all(...vals) }
    } catch (err) { return { success: false, error: 'Failed to fetch audit log' } }
  })

  // ═══════════════════════════════════════════════════════════════
  // FILE DIALOGS (for QR image etc.)
  // ═══════════════════════════════════════════════════════════════

  ipcMain.handle('app:select-image', async () => {
    try {
      const win = BrowserWindow.getFocusedWindow()
      if (!win) return { success: false, error: 'No window' }
      const result = await dialog.showOpenDialog(win, {
        title: 'Select QR Code Image',
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'webp'] }],
        properties: ['openFile']
      })
      if (result.canceled || result.filePaths.length === 0) return { success: false, error: 'Cancelled' }
      return { success: true, data: { filePath: result.filePaths[0] } }
    } catch (err) { return { success: false, error: 'Failed to open file dialog' } }
  })

  console.log('[IPC] ✓ All handlers registered')
}
