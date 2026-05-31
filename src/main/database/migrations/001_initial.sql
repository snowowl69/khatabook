-- ============================================================================
-- Khata — Initial Database Schema  (Migration 001)
-- ============================================================================
-- This migration creates every table, index, and seed row required by v1.0
-- of the Khata billing & stock-management application.
-- ============================================================================

-- Enable WAL mode
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- ────────────────────────────────────────────────────────────────────────────
-- USERS & SESSIONS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  username            TEXT    UNIQUE NOT NULL,
  password_hash       TEXT    NOT NULL,
  display_name        TEXT    NOT NULL,
  role                TEXT    NOT NULL CHECK(role IN ('owner', 'manager')),
  pin_hash            TEXT,
  totp_secret         TEXT,
  totp_enabled        INTEGER DEFAULT 0,
  device_fingerprint  TEXT,
  is_active           INTEGER DEFAULT 1,
  failed_login_count  INTEGER DEFAULT 0,
  locked_until        TEXT,
  last_login_at       TEXT,
  password_changed_at TEXT,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  session_token   TEXT    UNIQUE NOT NULL,
  created_at      TEXT    DEFAULT (datetime('now')),
  expires_at      TEXT    NOT NULL,
  last_active_at  TEXT    DEFAULT (datetime('now')),
  is_active       INTEGER DEFAULT 1
);

-- ────────────────────────────────────────────────────────────────────────────
-- CUSTOMERS & SUPPLIERS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  phone           TEXT    UNIQUE,
  alt_phone       TEXT,
  email           TEXT,
  address         TEXT,
  city            TEXT,
  state           TEXT,
  pincode         TEXT,
  gstin           TEXT,
  customer_group  TEXT    DEFAULT 'retail',
  opening_balance REAL    DEFAULT 0,
  notes           TEXT,
  is_active       INTEGER DEFAULT 1,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suppliers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  city            TEXT,
  state           TEXT,
  gstin           TEXT,
  bank_name       TEXT,
  bank_account    TEXT,
  bank_ifsc       TEXT,
  opening_balance REAL    DEFAULT 0,
  notes           TEXT,
  is_active       INTEGER DEFAULT 1,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ────────────────────────────────────────────────────────────────────────────
-- INVENTORY
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  parent_id   INTEGER REFERENCES categories(id),
  description TEXT,
  is_active   INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS brands (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT    UNIQUE NOT NULL,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  sku             TEXT    UNIQUE,
  barcode         TEXT    UNIQUE,
  hsn_code        TEXT,
  category_id     INTEGER REFERENCES categories(id),
  brand_id        INTEGER REFERENCES brands(id),
  unit            TEXT    NOT NULL DEFAULT 'pieces',
  mrp             REAL,
  selling_price   REAL    NOT NULL,
  wholesale_price REAL,
  purchase_price  REAL,
  tax_rate        REAL    DEFAULT 0,
  current_stock   REAL    DEFAULT 0,
  reorder_level   REAL    DEFAULT 0,
  image_path      TEXT,
  description     TEXT,
  is_active       INTEGER DEFAULT 1,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ────────────────────────────────────────────────────────────────────────────
-- BILLING (SALES)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bills (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_number     TEXT    UNIQUE NOT NULL,
  bill_hash       TEXT    NOT NULL,
  prev_bill_hash  TEXT,
  financial_year  TEXT    NOT NULL,
  customer_id     INTEGER REFERENCES customers(id),
  customer_name   TEXT,
  customer_phone  TEXT,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  bill_date       TEXT    NOT NULL,
  subtotal        REAL    NOT NULL,
  discount_type   TEXT,
  discount_value  REAL    DEFAULT 0,
  discount_amount REAL    DEFAULT 0,
  taxable_amount  REAL    NOT NULL,
  cgst_amount     REAL    DEFAULT 0,
  sgst_amount     REAL    DEFAULT 0,
  igst_amount     REAL    DEFAULT 0,
  tax_amount      REAL    DEFAULT 0,
  round_off       REAL    DEFAULT 0,
  grand_total     REAL    NOT NULL,
  paid_amount     REAL    DEFAULT 0,
  balance_due     REAL    DEFAULT 0,
  payment_status  TEXT    NOT NULL CHECK(payment_status IN ('paid', 'partial', 'unpaid')),
  bill_status     TEXT    DEFAULT 'active' CHECK(bill_status IN ('active', 'cancelled', 'returned')),
  cancel_reason   TEXT,
  cancelled_by    INTEGER REFERENCES users(id),
  cancelled_at    TEXT,
  notes           TEXT,
  pdf_path        TEXT,
  is_locked       INTEGER DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bill_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id         INTEGER NOT NULL REFERENCES bills(id),
  item_id         INTEGER REFERENCES items(id),
  item_name       TEXT    NOT NULL,
  item_sku        TEXT,
  hsn_code        TEXT,
  quantity        REAL    NOT NULL,
  unit            TEXT    NOT NULL,
  rate            REAL    NOT NULL,
  discount_type   TEXT,
  discount_value  REAL    DEFAULT 0,
  discount_amount REAL    DEFAULT 0,
  taxable_amount  REAL    NOT NULL,
  tax_rate        REAL,
  cgst_amount     REAL    DEFAULT 0,
  sgst_amount     REAL    DEFAULT 0,
  igst_amount     REAL    DEFAULT 0,
  tax_amount      REAL    DEFAULT 0,
  line_total      REAL    NOT NULL,
  batch_number    TEXT
);

-- ────────────────────────────────────────────────────────────────────────────
-- PURCHASES
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS purchases (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_number  TEXT    UNIQUE NOT NULL,
  supplier_id      INTEGER REFERENCES suppliers(id),
  supplier_name    TEXT,
  supplier_bill_no TEXT,
  user_id          INTEGER NOT NULL REFERENCES users(id),
  purchase_date    TEXT    NOT NULL,
  subtotal         REAL    NOT NULL,
  discount_amount  REAL    DEFAULT 0,
  tax_amount       REAL    DEFAULT 0,
  grand_total      REAL    NOT NULL,
  paid_amount      REAL    DEFAULT 0,
  balance_due      REAL    DEFAULT 0,
  payment_status   TEXT    NOT NULL CHECK(payment_status IN ('paid', 'partial', 'unpaid')),
  purchase_status  TEXT    DEFAULT 'active',
  notes            TEXT,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id        INTEGER NOT NULL REFERENCES purchases(id),
  item_id            INTEGER REFERENCES items(id),
  item_name          TEXT    NOT NULL,
  quantity           REAL    NOT NULL,
  unit               TEXT    NOT NULL,
  rate               REAL    NOT NULL,
  tax_rate           REAL,
  tax_amount         REAL    DEFAULT 0,
  line_total         REAL    NOT NULL,
  batch_number       TEXT,
  manufacturing_date TEXT,
  expiry_date        TEXT
);

-- ────────────────────────────────────────────────────────────────────────────
-- STOCK MOVEMENTS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_movements (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id         INTEGER NOT NULL REFERENCES items(id),
  movement_type   TEXT    NOT NULL,
  reference_type  TEXT,
  reference_id    INTEGER,
  quantity_change REAL    NOT NULL,
  quantity_before REAL    NOT NULL,
  quantity_after  REAL    NOT NULL,
  reason          TEXT,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ────────────────────────────────────────────────────────────────────────────
-- BANKING & PAYMENTS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bank_accounts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  account_name    TEXT    NOT NULL,
  bank_name       TEXT    NOT NULL,
  account_number  TEXT,
  ifsc_code       TEXT,
  upi_id          TEXT,
  account_type    TEXT    DEFAULT 'savings',
  is_default      INTEGER DEFAULT 0,
  opening_balance REAL    DEFAULT 0,
  current_balance REAL    DEFAULT 0,
  is_active       INTEGER DEFAULT 1,
  created_by      INTEGER REFERENCES users(id),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_number  TEXT    UNIQUE NOT NULL,
  payment_type    TEXT    NOT NULL CHECK(payment_type IN ('receipt', 'voucher', 'refund')),
  payment_mode    TEXT    NOT NULL,
  amount          REAL    NOT NULL,
  reference_type  TEXT,
  reference_id    INTEGER,
  customer_id     INTEGER REFERENCES customers(id),
  supplier_id     INTEGER REFERENCES suppliers(id),
  bank_account_id INTEGER REFERENCES bank_accounts(id),
  transaction_ref TEXT,
  notes           TEXT,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  payment_date    TEXT    NOT NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ────────────────────────────────────────────────────────────────────────────
-- ACCOUNTING
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS account_entries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_date      TEXT    NOT NULL,
  account_type    TEXT    NOT NULL,
  account_id      INTEGER,
  debit           REAL    DEFAULT 0,
  credit          REAL    DEFAULT 0,
  balance_after   REAL,
  reference_type  TEXT,
  reference_id    INTEGER,
  narration       TEXT,
  user_id         INTEGER REFERENCES users(id),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expenses (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_number  TEXT    UNIQUE,
  category        TEXT    NOT NULL,
  amount          REAL    NOT NULL,
  payment_mode    TEXT    NOT NULL,
  bank_account_id INTEGER REFERENCES bank_accounts(id),
  description     TEXT,
  expense_date    TEXT    NOT NULL,
  user_id         INTEGER REFERENCES users(id),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ────────────────────────────────────────────────────────────────────────────
-- RETURNS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS returns (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  return_number        TEXT    UNIQUE NOT NULL,
  return_type          TEXT    NOT NULL CHECK(return_type IN ('sales_return', 'purchase_return')),
  original_bill_id     INTEGER REFERENCES bills(id),
  original_purchase_id INTEGER REFERENCES purchases(id),
  customer_id          INTEGER REFERENCES customers(id),
  supplier_id          INTEGER REFERENCES suppliers(id),
  total_amount         REAL    NOT NULL,
  refund_mode          TEXT,
  reason               TEXT    NOT NULL,
  user_id              INTEGER NOT NULL REFERENCES users(id),
  return_date          TEXT    NOT NULL,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS return_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id   INTEGER NOT NULL REFERENCES returns(id),
  item_id     INTEGER REFERENCES items(id),
  item_name   TEXT    NOT NULL,
  quantity    REAL    NOT NULL,
  rate        REAL    NOT NULL,
  line_total  REAL    NOT NULL
);

-- ────────────────────────────────────────────────────────────────────────────
-- WITHOUT-BILL PAYMENTS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS without_bill_payments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_number  TEXT    UNIQUE NOT NULL,
  amount          REAL    NOT NULL,
  payment_mode    TEXT    NOT NULL,
  bank_account_id INTEGER REFERENCES bank_accounts(id),
  transaction_ref TEXT,
  category        TEXT    NOT NULL,
  recipient_name  TEXT,
  recipient_phone TEXT,
  purpose         TEXT    NOT NULL,
  payment_date    TEXT    NOT NULL,
  is_recurring    INTEGER DEFAULT 0,
  attached_photo  TEXT,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  approved_by     INTEGER REFERENCES users(id),
  notes           TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS without_bill_categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    UNIQUE NOT NULL,
  icon       TEXT,
  is_system  INTEGER DEFAULT 0,
  is_active  INTEGER DEFAULT 1,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ────────────────────────────────────────────────────────────────────────────
-- COUPONS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coupons (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  code            TEXT    UNIQUE NOT NULL,
  discount_type   TEXT    NOT NULL,
  discount_value  REAL    NOT NULL,
  min_bill_amount REAL    DEFAULT 0,
  max_discount    REAL,
  valid_from      TEXT,
  valid_until     TEXT,
  usage_limit     INTEGER,
  used_count      INTEGER DEFAULT 0,
  is_active       INTEGER DEFAULT 1,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ────────────────────────────────────────────────────────────────────────────
-- AUDIT & LOGGING
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pdf_access_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id   INTEGER NOT NULL REFERENCES bills(id),
  action    TEXT    NOT NULL,
  user_id   INTEGER REFERENCES users(id),
  ip_address TEXT,
  file_path TEXT,
  timestamp TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id),
  action      TEXT    NOT NULL,
  entity_type TEXT,
  entity_id   INTEGER,
  old_value   TEXT,
  new_value   TEXT,
  metadata    TEXT,
  ip_address  TEXT,
  timestamp   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ────────────────────────────────────────────────────────────────────────────
-- SETTINGS & SYSTEM
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS settings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  key        TEXT    UNIQUE NOT NULL,
  value      TEXT,
  category   TEXT,
  updated_at TEXT,
  updated_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS backups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  backup_type TEXT    NOT NULL,
  file_path   TEXT    NOT NULL,
  file_size   INTEGER,
  checksum    TEXT,
  status      TEXT    NOT NULL,
  user_id     INTEGER REFERENCES users(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  notes       TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  type         TEXT    NOT NULL,
  title        TEXT    NOT NULL,
  message      TEXT    NOT NULL,
  entity_type  TEXT,
  entity_id    INTEGER,
  is_read      INTEGER DEFAULT 0,
  is_dismissed INTEGER DEFAULT 0,
  user_id      INTEGER REFERENCES users(id),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cash_register (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  register_date   TEXT    UNIQUE NOT NULL,
  opening_balance REAL    NOT NULL,
  cash_in         REAL    DEFAULT 0,
  cash_out        REAL    DEFAULT 0,
  closing_balance REAL,
  is_closed       INTEGER DEFAULT 0,
  closed_by       INTEGER REFERENCES users(id),
  closed_at       TEXT,
  notes           TEXT
);

-- ────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ────────────────────────────────────────────────────────────────────────────

-- Bills
CREATE INDEX IF NOT EXISTS idx_bills_date       ON bills(bill_date);
CREATE INDEX IF NOT EXISTS idx_bills_customer    ON bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_bills_status      ON bills(bill_status);
CREATE INDEX IF NOT EXISTS idx_bills_number      ON bills(bill_number);

-- Bill Items
CREATE INDEX IF NOT EXISTS idx_bill_items_bill   ON bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_item   ON bill_items(item_id);

-- Items
CREATE INDEX IF NOT EXISTS idx_items_barcode      ON items(barcode);
CREATE INDEX IF NOT EXISTS idx_items_category      ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_name          ON items(name);
CREATE INDEX IF NOT EXISTS idx_items_active_stock  ON items(is_active, current_stock);

-- Stock Movements
CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_date     ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_supplier ON payments(supplier_id);

-- Purchases
CREATE INDEX IF NOT EXISTS idx_purchases_date     ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);

-- Audit Log
CREATE INDEX IF NOT EXISTS idx_audit_log_user      ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action    ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity    ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);

-- Customers
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name  ON customers(name);

-- Account Entries
CREATE INDEX IF NOT EXISTS idx_account_entries_type ON account_entries(account_type, account_id);
CREATE INDEX IF NOT EXISTS idx_account_entries_date ON account_entries(entry_date);

-- PDF Access Log
CREATE INDEX IF NOT EXISTS idx_pdf_access_bill ON pdf_access_log(bill_id);

-- Without-Bill Payments
CREATE INDEX IF NOT EXISTS idx_without_bill_date     ON without_bill_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_without_bill_category  ON without_bill_payments(category);
CREATE INDEX IF NOT EXISTS idx_without_bill_mode      ON without_bill_payments(payment_mode);
CREATE INDEX IF NOT EXISTS idx_without_bill_bank      ON without_bill_payments(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_without_bill_user      ON without_bill_payments(user_id);

-- Bank Accounts
CREATE INDEX IF NOT EXISTS idx_bank_accounts_default ON bank_accounts(is_default, is_active);

-- ────────────────────────────────────────────────────────────────────────────
-- SEED DATA
-- ────────────────────────────────────────────────────────────────────────────

-- Default without-bill payment categories
INSERT OR IGNORE INTO without_bill_categories (name, icon, is_system) VALUES
  ('Labour',        'hard-hat',    1),
  ('Transport',     'truck',       1),
  ('Petty Cash',    'coins',       1),
  ('Maintenance',   'wrench',      1),
  ('Tips',          'hand-coins',  1),
  ('Food & Chai',   'coffee',      1),
  ('Miscellaneous', 'package',     1);

-- Default application settings
INSERT OR IGNORE INTO settings (key, value, category) VALUES
  ('shop_name',              '"My Shop"',      'general'),
  ('shop_address',           '""',             'general'),
  ('shop_phone',             '""',             'general'),
  ('shop_gstin',             '""',             'general'),
  ('shop_logo',              '""',             'general'),
  ('financial_year',         '"2026-27"',      'general'),
  ('bill_prefix',            '"INV"',          'billing'),
  ('bill_start_number',      '1',              'billing'),
  ('purchase_prefix',        '"PUR"',          'billing'),
  ('default_tax_rate',       '0',              'billing'),
  ('bill_edit_window_hours', '24',             'billing'),
  ('auto_lock_minutes',      '5',              'security'),
  ('max_failed_logins',      '5',              'security'),
  ('password_min_length',    '8',              'security'),
  ('theme',                  '"dark"',         'general'),
  ('language',               '"en"',           'general'),
  ('currency_symbol',        '"₹"',            'general'),
  ('date_format',            '"dd/MM/yyyy"',   'general'),
  ('auto_backup_enabled',    '0',              'backup'),
  ('backup_interval_hours',  '24',             'backup');
