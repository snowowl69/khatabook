import { useState, useEffect, useRef } from 'react'
import { ShoppingCart, Search, Plus, Minus, Trash2, Loader2, Check } from 'lucide-react'
import { api } from '../../lib/ipc'
import { useAuthStore } from '../../stores/authStore'

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', background: 'var(--bg-raised)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--fg-primary)', fontSize: 'var(--text-base)' }

export default function NewPurchase() {
  const user = useAuthStore(s => s.user)
  const [supSearch, setSupSearch] = useState(''); const [supResults, setSupResults] = useState<any[]>([])
  const [supplier, setSupplier] = useState<any>(null); const [supplierBillNo, setSupplierBillNo] = useState('')
  const [itemSearch, setItemSearch] = useState(''); const [itemResults, setItemResults] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [payMode, setPayMode] = useState('cash'); const [bankAccounts, setBankAccounts] = useState<any[]>([]); const [bankId, setBankId] = useState('')
  const [paidAmt, setPaidAmt] = useState(''); const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false); const [success, setSuccess] = useState<string|null>(null); const [error, setError] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { api.invoke<any>('bank-accounts:list').then(r => { if (r?.success) setBankAccounts(r.data) }) }, [])
  useEffect(() => { if (!supSearch.trim() || supSearch.length < 2) { setSupResults([]); return }; const t = setTimeout(async () => { const r = await api.invoke<any>('suppliers:search', supSearch); if (r?.success) setSupResults(r.data) }, 300); return () => clearTimeout(t) }, [supSearch])
  useEffect(() => { if (!itemSearch.trim()) { setItemResults([]); return }; const t = setTimeout(async () => { const r = await api.invoke<any>('items:search', itemSearch); if (r?.success) setItemResults(r.data) }, 200); return () => clearTimeout(t) }, [itemSearch])

  const addItem = (item: any) => {
    const existing = items.find(i => i.itemId === item.id)
    if (existing) { setItems(prev => prev.map(i => i.itemId === item.id ? { ...i, quantity: i.quantity + 1, lineTotal: (i.quantity + 1) * i.rate } : i)); setItemSearch(''); setItemResults([]); return }
    setItems([...items, { itemId: item.id, itemName: item.name, quantity: 1, unit: item.unit || 'pieces', rate: item.purchase_price || item.selling_price, taxRate: item.tax_rate || 0, taxAmount: 0, lineTotal: item.purchase_price || item.selling_price, batchNumber: '', expiryDate: '' }])
    setItemSearch(''); setItemResults([]); ref.current?.focus()
  }

  const updateItem = (idx: number, field: string, value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: value }
      updated.lineTotal = updated.quantity * updated.rate
      updated.taxAmount = updated.lineTotal * updated.taxRate / 100
      return updated
    }))
  }

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0)
  const totalTax = items.reduce((s, i) => s + (i.taxAmount || 0), 0)
  const grandTotal = Math.round(subtotal + totalTax)
  const paid = parseFloat(paidAmt) || 0
  const balance = grandTotal - paid

  const createPurchase = async () => {
    if (items.length === 0) { setError('Add items'); return }
    setSaving(true); setError('')
    const res = await api.invoke<any>('purchases:create', {
      supplierId: supplier?.id, supplierName: supplier?.name || 'Unknown', supplierBillNo, userId: user?.id || 1,
      purchaseDate: new Date().toISOString().split('T')[0], subtotal, taxAmount: totalTax, grandTotal, paidAmount: paid,
      balanceDue: balance > 0 ? balance : 0, paymentMode: payMode, bankAccountId: bankId ? parseInt(bankId) : null, notes, items
    })
    if (res?.success) { setSuccess(res.data.purchaseNumber); setItems([]); setSupplier(null); setPaidAmt(''); setNotes(''); setSupplierBillNo('') }
    else setError(res?.error || 'Failed'); setSaving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn 0.4s ease-out' }}>
      <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><ShoppingCart size={24} /> New Purchase</h1>
      {success && <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-lg)', color: 'var(--success-400)' }}><Check size={20} /> Purchase <strong>{success}</strong> created! <button className="btn btn-ghost btn-sm" onClick={() => setSuccess(null)}>New</button></div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Supplier */}
          <div className="card" style={{ padding: 'var(--sp-4)' }}>
            <h3 style={{ marginBottom: 8, fontWeight: 600 }}>Supplier</h3>
            {supplier ? <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, background: 'rgba(99,102,241,0.08)', borderRadius: 'var(--radius-md)' }}><strong>{supplier.name}</strong> {supplier.phone && <span style={{ color: 'var(--fg-tertiary)' }}>{supplier.phone}</span>}<button className="btn-icon" onClick={() => setSupplier(null)}>×</button></div> :
              <div style={{ position: 'relative' }}><input style={inp} placeholder="Search suppliers..." value={supSearch} onChange={e => setSupSearch(e.target.value)} />
                {supResults.length > 0 && <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 30px rgba(0,0,0,0.3)', zIndex: 50 }}>
                  {supResults.map(s => <div key={s.id} style={{ padding: 8, cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }} onClick={() => { setSupplier(s); setSupSearch(''); setSupResults([]) }} onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-raised)')} onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>{s.name} <span style={{ color: 'var(--fg-muted)' }}>{s.phone}</span></div>)}
                </div>}
              </div>}
            <input style={{ ...inp, marginTop: 8 }} placeholder="Supplier bill / invoice no." value={supplierBillNo} onChange={e => setSupplierBillNo(e.target.value)} />
          </div>

          {/* Items */}
          <div className="card" style={{ padding: 'var(--sp-4)' }}>
            <h3 style={{ marginBottom: 8, fontWeight: 600 }}>Items</h3>
            <div style={{ position: 'relative' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: 'var(--bg-raised)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }}><Search size={16} style={{ color: 'var(--fg-muted)' }} /><input ref={ref} style={{ border: 'none', background: 'transparent', padding: '8px 0', color: 'var(--fg-primary)', width: '100%' }} placeholder="Search items..." value={itemSearch} onChange={e => setItemSearch(e.target.value)} /></div>
              {itemResults.length > 0 && <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 30px rgba(0,0,0,0.3)', zIndex: 50, maxHeight: 200, overflowY: 'auto' }}>
                {itemResults.map(item => <div key={item.id} style={{ padding: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)' }} onClick={() => addItem(item)} onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-raised)')} onMouseOut={e => (e.currentTarget.style.background = 'transparent')}><strong>{item.name}</strong> <span>{fmt(item.selling_price)}</span></div>)}
              </div>}
            </div>
            {items.length > 0 && <div className="table-container" style={{ marginTop: 12 }}><table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Tax%</th><th>Total</th><th></th></tr></thead><tbody>
              {items.map((item, i) => (
                <tr key={i}><td>{item.itemName}</td>
                <td><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><button style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-raised)', border: '1px solid var(--border-default)', borderRadius: 4, cursor: 'pointer', color: 'var(--fg-primary)' }} onClick={() => updateItem(i, 'quantity', Math.max(1, item.quantity - 1))}><Minus size={12}/></button><span style={{ minWidth: 28, textAlign: 'center', fontWeight: 600 }}>{item.quantity}</span><button style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-raised)', border: '1px solid var(--border-default)', borderRadius: 4, cursor: 'pointer', color: 'var(--fg-primary)' }} onClick={() => updateItem(i, 'quantity', item.quantity + 1)}><Plus size={12}/></button></div></td>
                <td><input type="number" value={item.rate} onChange={e => updateItem(i, 'rate', parseFloat(e.target.value)||0)} style={{ width: 80, padding: '4px 8px', background: 'var(--bg-raised)', border: '1px solid var(--border-default)', borderRadius: 4, color: 'var(--fg-primary)', textAlign: 'center' }} /></td>
                <td>{item.taxRate}%</td><td style={{fontWeight:600}}>{fmt(item.lineTotal)}</td>
                <td><button className="btn-icon" style={{color:'var(--danger-400)'}} onClick={() => setItems(prev => prev.filter((_,j)=>j!==i))}><Trash2 size={14}/></button></td></tr>
              ))}</tbody></table></div>}
          </div>
        </div>

        {/* Summary */}
        <div className="card-glass" style={{ padding: 'var(--sp-5)', position: 'sticky', top: 16 }}>
          <h3 style={{ marginBottom: 12, fontWeight: 600 }}>Purchase Summary</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tax</span><span>{fmt(totalTax)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xl)', fontWeight: 700, paddingTop: 12, borderTop: '2px solid var(--accent-400)' }}><span>Total</span><span>{fmt(grandTotal)}</span></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Payment Mode</label>
            <select style={inp} value={payMode} onChange={e => setPayMode(e.target.value)}><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank_transfer">Bank Transfer</option><option value="credit">Credit</option></select>
            {payMode !== 'cash' && payMode !== 'credit' && <><label style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Bank Account</label><select style={inp} value={bankId} onChange={e => setBankId(e.target.value)}><option value="">Select</option>{bankAccounts.map(b => <option key={b.id} value={b.id}>{b.account_name}</option>)}</select></>}
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Paid Amount</label><input type="number" style={inp} value={paidAmt} onChange={e => setPaidAmt(e.target.value)} placeholder={grandTotal.toString()} />
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Notes</label><input style={inp} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          {error && <p style={{ color: 'var(--danger-400)', fontSize: 'var(--text-sm)', marginTop: 8 }}>{error}</p>}
          <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} onClick={createPurchase} disabled={saving || items.length === 0}>
            {saving ? <><Loader2 size={18} className="spin" /> Saving...</> : `Record Purchase — ${fmt(grandTotal)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
