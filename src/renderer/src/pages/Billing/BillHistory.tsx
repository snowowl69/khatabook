import { useState, useEffect } from 'react'
import { FileSearch, Search, ChevronDown, ChevronUp, XCircle, Loader2, Printer } from 'lucide-react'
import { api } from '../../lib/ipc'
import { useAuthStore } from '../../stores/authStore'
import styles from './BillHistory.module.css'
import BillPrint from './BillPrint'

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function BillHistory() {
  const user = useAuthStore((s) => s.user)
  const [bills, setBills] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [payFilter, setPayFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [detail, setDetail] = useState<any>(null)

  const [showPrint, setShowPrint] = useState(false)
  const [printBill, setPrintBill] = useState<any>(null)
  const [printSettings, setPrintSettings] = useState<Record<string, string>>({})

  const load = async () => {
    setLoading(true)
    const filters: any = {}
    if (search) filters.search = search
    if (dateFrom) filters.dateFrom = dateFrom
    if (dateTo) filters.dateTo = dateTo
    if (statusFilter) filters.status = statusFilter
    if (payFilter) filters.paymentStatus = payFilter
    const r = await api.invoke<any>('bills:list', filters)
    if (r?.success) setBills(r.data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [search, dateFrom, dateTo, statusFilter, payFilter])

  const toggleExpand = async (id: number) => {
    if (expanded === id) {
      setExpanded(null)
      setDetail(null)
      return
    }
    setExpanded(id)
    const [billRes, historyRes] = await Promise.all([
      api.invoke<any>('bills:get', id),
      api.invoke<any>('bills:print-history', id)
    ])
    if (billRes?.success) {
      setDetail({
        ...billRes.data,
        printHistory: historyRes?.success ? historyRes.data : { count: 0, prints: [] }
      })
    }
  }

  const cancelBill = async (billId: number) => {
    const reason = prompt('Enter cancellation reason:')
    if (!reason) return
    await api.invoke('bills:cancel', { billId, reason, userId: user?.id || 1 })
    load()
    setExpanded(null)
  }

  const openPrint = async (billId: number) => {
    const [billRes, settingsRes] = await Promise.all([
      api.invoke<any>('bills:get', billId),
      api.invoke<any>('db:get-settings')
    ])
    if (billRes?.success && settingsRes?.success) {
      setPrintBill(billRes.data)
      const flat: Record<string, string> = {}
      for (const [k, v] of Object.entries(settingsRes.data as any)) {
        flat[k] = ((v as any).value || '').replace(/"/g, '')
      }
      setPrintSettings(flat)
      setShowPrint(true)
    }
  }

  const handlePrintClose = async () => {
    setShowPrint(false)
    setPrintBill(null)
    // Refresh history in expanded detail if active
    if (expanded !== null) {
      const historyRes = await api.invoke<any>('bills:print-history', expanded)
      if (historyRes?.success && detail) {
        setDetail((prev: any) => ({
          ...prev,
          printHistory: historyRes.data
        }))
      }
    }
  }

  return (
    <>
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            <FileSearch size={24} /> Bill History
          </h1>
          <p className={styles.subtitle}>{bills.length} bills</p>
        </div>
        <div className={styles.filters}>
          <div className={styles.searchBox}>
            <Search size={16} />
            <input
              placeholder="Search bill #, customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={styles.dateInput}
          />
          <span style={{ color: 'var(--fg-muted)' }}>to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={styles.dateInput}
          />
          <select
            value={payFilter}
            onChange={(e) => setPayFilter(e.target.value)}
            className={styles.select}
          >
            <option value="">All Payment</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.select}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className={`card ${styles.tableCard}`}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Bill #</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Grand Total</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={9}
                      style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--fg-muted)' }}
                    >
                      <Loader2 size={20} className="spin" style={{ display: 'inline' }} /> Loading...
                    </td>
                  </tr>
                ) : bills.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--fg-muted)' }}
                    >
                      No bills found
                    </td>
                  </tr>
                ) : (
                  bills.map((b) => (
                    <>
                      <tr key={b.id} onClick={() => toggleExpand(b.id)} style={{ cursor: 'pointer' }}>
                        <td style={{ fontWeight: 600, color: 'var(--accent-400)' }}>{b.bill_number}</td>
                        <td>{b.bill_date}</td>
                        <td>{b.customer_name || 'Walk-in'}</td>
                        <td style={{ fontWeight: 600 }}>{fmt(b.grand_total)}</td>
                        <td>{fmt(b.paid_amount)}</td>
                        <td
                          style={{
                            color: b.balance_due > 0 ? 'var(--danger-400)' : 'var(--fg-tertiary)'
                          }}
                        >
                          {fmt(b.balance_due)}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              b.payment_status === 'paid'
                                ? 'badge-success'
                                : b.payment_status === 'partial'
                                ? 'badge-warning'
                                : 'badge-danger'
                            }`}
                          >
                            {b.payment_status}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              b.bill_status === 'active' ? 'badge-accent' : 'badge-danger'
                            }`}
                          >
                            {b.bill_status}
                          </span>
                        </td>
                        <td>{expanded === b.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</td>
                      </tr>
                      {expanded === b.id && detail && (
                        <tr key={`detail-${b.id}`}>
                          <td colSpan={9}>
                            <div className={styles.detailPanel}>
                              <table className={styles.detailTable}>
                                <thead>
                                  <tr>
                                    <th>Item</th>
                                    <th>Qty</th>
                                    <th>Rate</th>
                                    <th>Discount</th>
                                    <th>Tax</th>
                                    <th>Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {detail.items?.map((item: any, i: number) => (
                                    <tr key={i}>
                                      <td>{item.item_name}</td>
                                      <td>
                                        {item.quantity} {item.unit}
                                      </td>
                                      <td>{fmt(item.rate)}</td>
                                      <td>{item.discount_amount > 0 ? fmt(item.discount_amount) : '—'}</td>
                                      <td>{item.tax_rate}%</td>
                                      <td style={{ fontWeight: 600 }}>{fmt(item.line_total)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 8,
                                  marginTop: 12,
                                  paddingTop: 12,
                                  borderTop: '1px solid var(--border-subtle)'
                                }}
                              >
                                {detail.vehicle_number && (
                                  <div style={{ fontSize: 'var(--text-sm)' }}>
                                    <strong>Vehicle Number:</strong> {detail.vehicle_number.toUpperCase()}
                                  </div>
                                )}
                                {detail.printHistory && (
                                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-secondary)' }}>
                                    <strong>Print Audit:</strong>{' '}
                                    {detail.printHistory.count === 0 ? (
                                      'Never printed'
                                    ) : (
                                      <span>Printed {detail.printHistory.count} times</span>
                                    )}
                                    {detail.printHistory.count > 0 && (
                                      <ul style={{ margin: '6px 0 0 16px', padding: 0, listStyle: 'disc' }}>
                                        {detail.printHistory.prints.map((p: any, idx: number) => (
                                          <li key={idx} style={{ color: 'var(--fg-tertiary)', fontSize: 'var(--text-xs)', marginTop: 2 }}>
                                            {new Date(p.printed_at).toLocaleString('en-IN')} by{' '}
                                            <span style={{ color: 'var(--fg-secondary)', fontWeight: 500 }}>
                                              {p.user_name || 'System'}
                                            </span>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className={styles.detailFooter}>
                                <span>Created by: {detail.created_by_name || '—'}</span>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => openPrint(b.id)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                                  >
                                    <Printer size={14} /> Print Bill
                                  </button>
                                  {b.bill_status === 'active' && (
                                    <button
                                      className="btn btn-danger btn-sm"
                                      onClick={() => cancelBill(b.id)}
                                      style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                                    >
                                      <XCircle size={14} /> Cancel Bill
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showPrint && printBill && (
        <BillPrint bill={printBill} settings={printSettings} onClose={handlePrintClose} />
      )}
    </>
  )
}
