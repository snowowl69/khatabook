/* ──────────────────────────────────────────────────────────────
   Khata – Shared TypeScript Types
   All domain models used across the renderer process.
   ────────────────────────────────────────────────────────────── */

/* ── Auth & Users ─────────────────────────────────────────── */

export type UserRole = 'owner' | 'manager'

export interface User {
  id: number
  username: string
  displayName: string
  role: UserRole
  pin?: string
  avatar?: string
  phone?: string
  email?: string
  isActive: boolean
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

/* ── Items & Inventory ────────────────────────────────────── */

export interface Category {
  id: number
  name: string
  parentId?: number
  description?: string
  createdAt: string
}

export interface Unit {
  id: number
  name: string        // e.g. "Kilogram"
  shortName: string   // e.g. "kg"
}

export interface Item {
  id: number
  name: string
  sku: string
  barcode?: string
  categoryId?: number
  category?: Category
  unitId: number
  unit?: Unit
  purchasePrice: number
  sellingPrice: number
  mrp: number
  gstRate: number        // e.g. 5, 12, 18, 28
  hsnCode?: string
  currentStock: number
  lowStockThreshold: number
  isActive: boolean
  description?: string
  createdAt: string
  updatedAt: string
}

export interface StockMovement {
  id: number
  itemId: number
  item?: Item
  type: 'in' | 'out' | 'adjustment'
  quantity: number
  reason: string
  referenceId?: number
  referenceType?: 'bill' | 'purchase' | 'manual'
  createdAt: string
  createdBy: number
}

/* ── Customers ────────────────────────────────────────────── */

export interface Customer {
  id: number
  name: string
  phone?: string
  email?: string
  address?: string
  gstin?: string
  balance: number        // positive = customer owes us
  creditLimit: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/* ── Suppliers ────────────────────────────────────────────── */

export interface Supplier {
  id: number
  name: string
  phone?: string
  email?: string
  address?: string
  gstin?: string
  balance: number        // positive = we owe supplier
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/* ── Bills / Sales ────────────────────────────────────────── */

export type PaymentMode = 'cash' | 'upi' | 'card' | 'credit' | 'bank_transfer'

export interface BillItem {
  id: number
  billId: number
  itemId: number
  item?: Item
  quantity: number
  unitPrice: number
  discount: number       // percentage
  gstRate: number
  gstAmount: number
  totalAmount: number
}

export interface Bill {
  id: number
  billNumber: string
  customerId?: number
  customer?: Customer
  billDate: string
  items: BillItem[]
  subtotal: number
  totalDiscount: number
  totalGst: number
  grandTotal: number
  paymentMode: PaymentMode
  amountPaid: number
  balanceDue: number
  status: 'completed' | 'pending' | 'cancelled' | 'returned'
  notes?: string
  createdBy: number
  createdAt: string
  updatedAt: string
}

/* ── Purchases ────────────────────────────────────────────── */

export interface PurchaseItem {
  id: number
  purchaseId: number
  itemId: number
  item?: Item
  quantity: number
  unitPrice: number
  gstRate: number
  gstAmount: number
  totalAmount: number
}

export interface Purchase {
  id: number
  purchaseNumber: string
  supplierId: number
  supplier?: Supplier
  purchaseDate: string
  items: PurchaseItem[]
  subtotal: number
  totalGst: number
  grandTotal: number
  paymentMode: PaymentMode
  amountPaid: number
  balanceDue: number
  status: 'completed' | 'pending' | 'cancelled'
  invoiceNumber?: string
  notes?: string
  createdBy: number
  createdAt: string
  updatedAt: string
}

/* ── Accounts ─────────────────────────────────────────────── */

export type TransactionType = 'income' | 'expense' | 'transfer'

export interface Transaction {
  id: number
  type: TransactionType
  amount: number
  description: string
  category: string
  paymentMode: PaymentMode
  referenceId?: number
  referenceType?: 'bill' | 'purchase' | 'expense' | 'manual'
  date: string
  createdBy: number
  createdAt: string
}

export interface BankAccount {
  id: number
  bankName: string
  accountNumber: string
  ifscCode: string
  balance: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Expense {
  id: number
  description: string
  amount: number
  category: string
  paymentMode: PaymentMode
  date: string
  receipt?: string
  createdBy: number
  createdAt: string
}

/* ── Dashboard ────────────────────────────────────────────── */

export interface DashboardMetrics {
  todaySales: number
  todayPurchases: number
  cashInHand: number
  bankBalance: number
  salesChange: number      // percentage change from yesterday
  purchasesChange: number
  pendingBills: number
  lowStockItems: number
}

/* ── Notifications ────────────────────────────────────────── */

export interface AppNotification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  createdAt: string
}
