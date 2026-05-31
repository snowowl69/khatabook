/* ──────────────────────────────────────────────────────────────
   Khata – Sidebar Component
   Glassmorphic navigation with collapsible sub-menus.
   ────────────────────────────────────────────────────────────── */

import React, { useState, useCallback } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Receipt,
  Package,
  ShoppingCart,
  Users,
  Factory,
  Wallet,
  BarChart3,
  Settings,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  FilePlus,
  History,
  Undo2,
  ListOrdered,
  ArrowRightLeft,
  FolderTree,
  BookOpen,
  Landmark,
  Banknote,
  FileX,
  CreditCard,
} from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import css from './Sidebar.module.css'

/* ── Types ─────────────────────────────────────────────────── */

interface NavChild {
  label: string
  path: string
  icon: React.ReactNode
}

interface NavEntry {
  label: string
  path: string
  icon: React.ReactNode
  children?: NavChild[]
}

/* ── Navigation Config ─────────────────────────────────────── */

const NAV: NavEntry[] = [
  {
    label: 'Dashboard',
    path: '/',
    icon: <LayoutDashboard size={20} />,
  },
  {
    label: 'Billing',
    path: '/billing',
    icon: <Receipt size={20} />,
    children: [
      { label: 'New Bill', path: '/billing/new', icon: <FilePlus size={16} /> },
      { label: 'Bill History', path: '/billing/history', icon: <History size={16} /> },
      { label: 'Returns', path: '/billing/returns', icon: <Undo2 size={16} /> },
    ],
  },
  {
    label: 'Inventory',
    path: '/inventory',
    icon: <Package size={20} />,
    children: [
      { label: 'Items', path: '/inventory/items', icon: <ListOrdered size={16} /> },
      { label: 'Stock Movement', path: '/inventory/stock-movement', icon: <ArrowRightLeft size={16} /> },
      { label: 'Categories', path: '/inventory/categories', icon: <FolderTree size={16} /> },
    ],
  },
  {
    label: 'Purchases',
    path: '/purchases',
    icon: <ShoppingCart size={20} />,
    children: [
      { label: 'New Purchase', path: '/purchases/new', icon: <FilePlus size={16} /> },
      { label: 'Purchase History', path: '/purchases/history', icon: <History size={16} /> },
    ],
  },
  {
    label: 'Customers',
    path: '/customers',
    icon: <Users size={20} />,
  },
  {
    label: 'Suppliers',
    path: '/suppliers',
    icon: <Factory size={20} />,
  },
  {
    label: 'Accounts',
    path: '/accounts',
    icon: <Wallet size={20} />,
    children: [
      { label: 'Day Book', path: '/accounts/daybook', icon: <BookOpen size={16} /> },
      { label: 'Cash Register', path: '/accounts/cash-register', icon: <Banknote size={16} /> },
      { label: 'Bank Accounts', path: '/accounts/bank-accounts', icon: <Landmark size={16} /> },
      { label: 'Without Bill', path: '/accounts/without-bill', icon: <FileX size={16} /> },
      { label: 'Expenses', path: '/accounts/expenses', icon: <CreditCard size={16} /> },
    ],
  },
  {
    label: 'Reports',
    path: '/reports',
    icon: <BarChart3 size={20} />,
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: <Settings size={20} />,
  },
]

/* ── Component ─────────────────────────────────────────────── */

const Sidebar: React.FC = () => {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const location = useLocation()

  // Track which parent items are expanded
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    // Auto-open the menu that contains the current route
    const init: Record<string, boolean> = {}
    for (const entry of NAV) {
      if (entry.children?.some((c) => location.pathname.startsWith(c.path))) {
        init[entry.path] = true
      }
    }
    return init
  })

  const toggle = useCallback((path: string) => {
    setOpenMenus((prev) => ({ ...prev, [path]: !prev[path] }))
  }, [])

  return (
    <aside className={`${css.sidebar} ${collapsed ? css.collapsed : ''}`}>
      {/* ── Brand ──────────────────────────────────────────── */}
      <div className={css.brand}>
        <div className={css.brandIcon}>K</div>
        <div className={css.brandText}>
          <span className={css.brandName}>Khata</span>
          <span className={css.brandTag}>Billing &amp; Stock</span>
        </div>
      </div>

      {/* ── Nav Items ──────────────────────────────────────── */}
      <nav className={css.nav}>
        {NAV.map((entry) => (
          <div className={css.navSection} key={entry.path}>
            {entry.children ? (
              /* Parent with children — toggleable */
              <>
                <button
                  className={`${css.navItem} ${
                    location.pathname.startsWith(entry.path) &&
                    entry.path !== '/'
                      ? css.active
                      : ''
                  }`}
                  onClick={() => toggle(entry.path)}
                  title={entry.label}
                >
                  <span className={css.navItemIcon}>{entry.icon}</span>
                  <span className={css.navItemLabel}>{entry.label}</span>
                  <ChevronRight
                    size={16}
                    className={`${css.navItemChevron} ${
                      openMenus[entry.path] ? css.open : ''
                    }`}
                  />
                </button>

                <div
                  className={`${css.subMenu} ${openMenus[entry.path] ? css.open : ''}`}
                >
                  {entry.children.map((child) => (
                    <NavLink
                      key={child.path}
                      to={child.path}
                      className={({ isActive }) =>
                        `${css.subItem} ${isActive ? css.active : ''}`
                      }
                      title={child.label}
                    >
                      {child.icon}
                      <span className={css.navItemLabel}>{child.label}</span>
                    </NavLink>
                  ))}
                </div>
              </>
            ) : (
              /* Leaf item */
              <NavLink
                to={entry.path}
                end={entry.path === '/'}
                className={({ isActive }) =>
                  `${css.navItem} ${isActive ? css.active : ''}`
                }
                title={entry.label}
              >
                <span className={css.navItemIcon}>{entry.icon}</span>
                <span className={css.navItemLabel}>{entry.label}</span>
              </NavLink>
            )}
          </div>
        ))}
      </nav>

      {/* ── Collapse Toggle ────────────────────────────────── */}
      <button className={css.collapseBtn} onClick={toggleSidebar} title="Toggle sidebar">
        {collapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
      </button>
    </aside>
  )
}

export default Sidebar
