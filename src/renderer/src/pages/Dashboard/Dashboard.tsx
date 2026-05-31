import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Wallet, Landmark, Plus, FileText, ShoppingCart, Package, AlertTriangle, RefreshCw } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/ipc'
import styles from './Dashboard.module.css'

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening'

  const loadMetrics = async () => {
    setLoading(true)
    try {
      const res = await api.invoke<any>('dashboard:metrics')
      if (res?.success) setMetrics(res.data)
    } catch (err) { console.error('Dashboard load error:', err) }
    setLoading(false)
  }

  useEffect(() => { loadMetrics() }, [])

  const cards = [
    { label: "Today's Sales", value: fmt(metrics?.todaySales || 0), change: metrics?.salesChange ? `${metrics.salesChange > 0 ? '+' : ''}${metrics.salesChange}%` : '', up: (metrics?.salesChange || 0) >= 0, icon: <TrendingUp size={20} />, color: 'var(--success-400)' },
    { label: "Today's Purchases", value: fmt(metrics?.todayPurchases || 0), change: '', up: false, icon: <TrendingDown size={20} />, color: 'var(--warning-400)' },
    { label: 'Today\'s Expenses', value: fmt(metrics?.todayExpenses || 0), change: '', up: false, icon: <Wallet size={20} />, color: 'var(--accent-400)' },
    { label: 'Bank Balance', value: fmt(metrics?.bankBalance || 0), change: `${metrics?.billCount || 0} bills`, up: true, icon: <Landmark size={20} />, color: 'var(--violet-400, #8b5cf6)' },
  ]

  return (
    <div className={styles.dashboard}>
      <div className={styles.welcome}>
        <div>
          <h1 className={styles.greeting}>{greeting}, <span className="gradient-text">{user?.displayName || 'Owner'}</span></h1>
          <p className={styles.date}>{now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={loadMetrics} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      <div className={`${styles.metricsGrid} stagger`}>
        {cards.map((m, i) => (
          <div key={i} className={`card-glass ${styles.metricCard}`} style={{ '--accent': m.color } as React.CSSProperties}>
            <div className={styles.metricTop}>
              <span className={styles.metricIcon} style={{ color: m.color }}>{m.icon}</span>
              {m.change && <span className={`badge ${m.up ? 'badge-success' : 'badge-warning'}`}>{m.change}</span>}
            </div>
            <p className={styles.metricValue}>{loading ? '—' : m.value}</p>
            <p className={styles.metricLabel}>{m.label}</p>
          </div>
        ))}
      </div>

      <div className={styles.quickActions}>
        <button className={`btn btn-primary btn-lg ${styles.quickBtn}`} onClick={() => navigate('/billing/new')}>
          <Plus size={20} /> New Bill
        </button>
        <button className={`btn btn-secondary btn-lg ${styles.quickBtn}`} onClick={() => navigate('/purchases/new')}>
          <ShoppingCart size={20} /> New Purchase
        </button>
        <button className={`btn btn-secondary btn-lg ${styles.quickBtn}`} onClick={() => navigate('/inventory/items')}>
          <Package size={20} /> Manage Items
        </button>
      </div>

      <div className={styles.bottomGrid}>
        <div className={`card ${styles.recentSection}`}>
          <div className={styles.sectionHeader}>
            <h3><FileText size={18} /> Recent Bills</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/billing/history')}>View All</button>
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>Bill #</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {!loading && metrics?.recentBills?.length > 0 ? metrics.recentBills.map((bill: any, i: number) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500, color: 'var(--accent-400)' }}>{bill.bill_number}</td>
                    <td>{bill.customer_name || 'Walk-in'}</td>
                    <td className="currency" style={{ fontWeight: 600 }}>{fmt(bill.grand_total)}</td>
                    <td><span className={`badge ${bill.payment_status === 'paid' ? 'badge-success' : bill.payment_status === 'partial' ? 'badge-warning' : 'badge-danger'}`}>{bill.payment_status}</span></td>
                    <td style={{ color: 'var(--fg-tertiary)' }}>{bill.bill_date}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--fg-muted)', padding: 'var(--sp-8)' }}>{loading ? 'Loading...' : 'No bills yet — create your first bill!'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`card ${styles.alertSection}`}>
          <div className={styles.sectionHeader}>
            <h3><AlertTriangle size={18} style={{ color: 'var(--warning-400)' }} /> Low Stock Alerts</h3>
          </div>
          <div className={styles.alertList}>
            {!loading && metrics?.lowStockItems?.length > 0 ? metrics.lowStockItems.map((item: any, i: number) => (
              <div key={i} className={styles.alertItem}>
                <div>
                  <p className={styles.alertName}>{item.name}</p>
                  <p className={styles.alertMeta}>Reorder: {item.reorder_level}</p>
                </div>
                <span className="badge badge-danger">{item.current_stock} left</span>
              </div>
            )) : (
              <p style={{ textAlign: 'center', color: 'var(--fg-muted)', padding: 'var(--sp-6)' }}>{loading ? 'Loading...' : 'All items are well stocked!'}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
