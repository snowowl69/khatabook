import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { useUIStore } from './stores/uiStore'
import { useEffect } from 'react'

import MainLayout from './components/Layout/MainLayout'
import Login from './pages/Login/Login'
import PinLock from './pages/PinLock/PinLock'
import Dashboard from './pages/Dashboard/Dashboard'
import NewBill from './pages/Billing/NewBill'
import BillHistory from './pages/Billing/BillHistory'
import Returns from './pages/Billing/Returns'
import ItemList from './pages/Inventory/ItemList'
import StockMovement from './pages/Inventory/StockMovement'
import Categories from './pages/Inventory/Categories'
import NewPurchase from './pages/Purchases/NewPurchase'
import PurchaseHistory from './pages/Purchases/PurchaseHistory'
import Customers from './pages/Customers/Customers'
import Suppliers from './pages/Suppliers/Suppliers'
import DayBook from './pages/Accounts/DayBook'
import CashRegister from './pages/Accounts/CashRegister'
import BankAccounts from './pages/Accounts/BankAccounts'
import WithoutBill from './pages/Accounts/WithoutBill'
import Expenses from './pages/Accounts/Expenses'
import Reports from './pages/Reports/Reports'
import Settings from './pages/Settings/Settings'

function App() {
  const { isAuthenticated, isLocked, checkSession } = useAuthStore()
  const { theme } = useUIStore()

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Check session on app load
  useEffect(() => {
    checkSession()
  }, [checkSession])

  // Not authenticated → Login
  if (!isAuthenticated) {
    return <Login />
  }

  // Authenticated but locked → PIN Lock
  if (isLocked) {
    return <PinLock />
  }

  // Authenticated and unlocked → Main app
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/billing/new" element={<NewBill />} />
        <Route path="/billing/history" element={<BillHistory />} />
        <Route path="/billing/returns" element={<Returns />} />
        <Route path="/inventory/items" element={<ItemList />} />
        <Route path="/inventory/stock-movement" element={<StockMovement />} />
        <Route path="/inventory/categories" element={<Categories />} />
        <Route path="/purchases/new" element={<NewPurchase />} />
        <Route path="/purchases/history" element={<PurchaseHistory />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/accounts/daybook" element={<DayBook />} />
        <Route path="/accounts/cash-register" element={<CashRegister />} />
        <Route path="/accounts/bank-accounts" element={<BankAccounts />} />
        <Route path="/accounts/without-bill" element={<WithoutBill />} />
        <Route path="/accounts/expenses" element={<Expenses />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
