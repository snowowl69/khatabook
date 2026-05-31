import { useState, useEffect } from 'react'
import { RotateCcw, Search, Loader2 } from 'lucide-react'
import { api } from '../../lib/ipc'
import { useAuthStore } from '../../stores/authStore'

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function Returns() {
  const user = useAuthStore(s => s.user)
  const [returns, setReturns] = useState<any[]>([])
  const [billSearch, setBillSearch] = useState('')
  const [bill, setBill] = useState<any>(null)
  const [returnItems, setReturnItems] = useState<any[]>([])
  const [reason, setReason] = useState('')
  const [refundMode, setRefundMode] = useState('cash')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadReturns = async () => { setLoading(true); const r = await api.invoke<any>('returns:list'); if (r?.success) setReturns(r.data); setLoading(false) }
  useEffect(() => { loadReturns() }, [])

  const searchBill = async () => {
    if (!billSearch.trim()) return
    const r = await api.invoke<any>('bills:list', { search: billSearch })
    if (r?.success && r.data.length > 0) {
      const detail = await api.invoke<any>('bills:get', r.data[0].id)
      if (detail?.success) { setBill(detail.data); setReturnItems(detail.data.items.map((i: any) => ({ ...i, returnQty: 0 }))) }
    }
  }

  const createReturn = async () => {
    const items = returnItems.filter(i => i.returnQty > 0)
    if (items.length === 0 || !reason) return
    setSaving(true)
    const totalAmount = items.reduce((s, i) => s + (i.rate * i.returnQty), 0)
    await api.invoke('returns:create', { returnType: 'sales_return', originalBillId: bill.id, customerId: bill.customer_id, totalAmount, refundMode, reason, userId: user?.id || 1, returnDate: new Date().toISOString().split('T')[0], items: items.map(i => ({ itemId: i.item_id, itemName: i.item_name, quantity: i.returnQty, rate: i.rate, lineTotal: i.rate * i.returnQty })) })
    setBill(null); setReturnItems([]); setBillSearch(''); setReason(''); loadReturns()
    setSaving(false)
  }

  const css = { page: { display: 'flex', flexDirection: 'column' as const, gap: 20, animation: 'fadeIn 0.4s ease-out' }, title: { fontSize: 'var(--text-2xl)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 } }
  const inp = { width: '100%', padding: '8px 12px', background: 'var(--bg-raised)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--fg-primary)', fontSize: 'var(--text-base)' }

  return (
    <div style={css.page}>
      <h1 style={css.title}><RotateCcw size={24} /> Sales Returns</h1>
      <div className="card" style={{ padding: 'var(--sp-5)' }}>
        <h3 style={{ marginBottom: 12, fontWeight: 600 }}>Find Bill to Return</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={inp} placeholder="Enter bill number..." value={billSearch} onChange={e => setBillSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchBill()} />
          <button className="btn btn-secondary" onClick={searchBill}><Search size={16} /> Search</button>
        </div>
        {bill && (<div style={{ marginTop: 16 }}>
          <p style={{ marginBottom: 8 }}><strong>Bill {bill.bill_number}</strong> • {bill.customer_name || 'Walk-in'} • Total: {fmt(bill.grand_total)}</p>
          <div className="table-container"><table><thead><tr><th>Item</th><th>Qty Sold</th><th>Rate</th><th>Return Qty</th></tr></thead><tbody>
            {returnItems.map((item, i) => (
              <tr key={i}><td>{item.item_name}</td><td>{item.quantity}</td><td>{fmt(item.rate)}</td>
              <td><input type="number" min="0" max={item.quantity} value={item.returnQty} onChange={e => { const v = [...returnItems]; v[i] = { ...v[i], returnQty: parseInt(e.target.value) || 0 }; setReturnItems(v) }} style={{ ...inp, width: 80 }} /></td></tr>
            ))}
          </tbody></table></div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}><label style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Reason *</label><input style={inp} value={reason} onChange={e => setReason(e.target.value)} placeholder="Damaged, wrong item, etc." /></div>
            <div><label style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Refund Mode</label><select style={inp} value={refundMode} onChange={e => setRefundMode(e.target.value)}><option value="cash">Cash</option><option value="upi">UPI</option><option value="credit">Credit</option></select></div>
            <button className="btn btn-primary" onClick={createReturn} disabled={saving}>{saving ? 'Processing...' : 'Process Return'}</button>
          </div>
        </div>)}
      </div>
      <div className="card" style={{ padding: 'var(--sp-5)' }}>
        <h3 style={{ marginBottom: 12, fontWeight: 600 }}>Returns History</h3>
        <div className="table-container"><table><thead><tr><th>Return #</th><th>Date</th><th>Type</th><th>Amount</th><th>Reason</th><th>By</th></tr></thead><tbody>
          {loading ? <tr><td colSpan={6} style={{textAlign:'center',padding:'var(--sp-8)',color:'var(--fg-muted)'}}><Loader2 size={20} className="spin" style={{display:'inline'}} /></td></tr> :
          returns.length === 0 ? <tr><td colSpan={6} style={{textAlign:'center',padding:'var(--sp-8)',color:'var(--fg-muted)'}}>No returns yet</td></tr> :
          returns.map(r => (
            <tr key={r.id}><td style={{fontWeight:500,color:'var(--accent-400)'}}>{r.return_number}</td><td>{r.return_date}</td><td><span className="badge badge-warning">{r.return_type}</span></td><td style={{fontWeight:600}}>{fmt(r.total_amount)}</td><td>{r.reason}</td><td>{r.user_name}</td></tr>
          ))}
        </tbody></table></div>
      </div>
    </div>
  )
}
