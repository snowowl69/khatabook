import { useState, useEffect } from 'react'
import { HandCoins, Plus, Loader2, X, Save } from 'lucide-react'
import { api } from '../../lib/ipc'
import { useAuthStore } from '../../stores/authStore'

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
const EMPTY = { category: '', amount: '', paymentMode: 'cash', bankAccountId: '', transactionRef: '', recipientName: '', recipientPhone: '', purpose: '', paymentDate: new Date().toISOString().split('T')[0], notes: '' }

export default function WithoutBill() {
  const user = useAuthStore(s => s.user)
  const [list, setList] = useState<any[]>([]); const [categories, setCategories] = useState<any[]>([])
  const [bankAccounts, setBankAccounts] = useState<any[]>([]); const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false); const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  const [dateFrom, setDateFrom] = useState(''); const [dateTo, setDateTo] = useState(''); const [catFilter, setCatFilter] = useState('')

  const load = async () => { setLoading(true); const r = await api.invoke<any>('without-bill:list', { dateFrom: dateFrom||undefined, dateTo: dateTo||undefined, category: catFilter||undefined }); if (r?.success) setList(r.data); setLoading(false) }
  useEffect(() => { load() }, [dateFrom, dateTo, catFilter])
  useEffect(() => {
    api.invoke<any>('without-bill:categories').then(r => { if (r?.success) setCategories(r.data) })
    api.invoke<any>('bank-accounts:list').then(r => { if (r?.success) setBankAccounts(r.data) })
  }, [])

  const save = async () => {
    if (!form.category || !form.amount || !form.purpose) { setError('Category, amount, and purpose required'); return }
    setSaving(true); setError('')
    const res = await api.invoke<any>('without-bill:create', { ...form, amount: parseFloat(form.amount), bankAccountId: form.bankAccountId ? parseInt(form.bankAccountId) : null, userId: user?.id })
    if (res?.success) { setShowModal(false); setForm(EMPTY); load() } else setError(res?.error || 'Failed')
    setSaving(false)
  }

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', background: 'var(--bg-raised)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--fg-primary)' }
  const total = list.reduce((s, e) => s + e.amount, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn 0.4s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><HandCoins size={24} /> Without Bill Payments</h1><p style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-tertiary)' }}>Track payments without invoices • Total: {fmt(total)}</p></div>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setError(''); setShowModal(true) }}><Plus size={18} /> Record Payment</button>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <select style={{ ...inp, width: 'auto', minWidth: 160 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}><option value="">All Categories</option>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
        <input type="date" style={{ ...inp, width: 'auto' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} /><span style={{color:'var(--fg-muted)',alignSelf:'center'}}>to</span><input type="date" style={{ ...inp, width: 'auto' }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}><div className="table-container"><table>
        <thead><tr><th>Payment #</th><th>Date</th><th>Category</th><th>Purpose</th><th>Recipient</th><th>Mode</th><th>Account</th><th>Amount</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={8} style={{textAlign:'center',padding:'var(--sp-8)',color:'var(--fg-muted)'}}><Loader2 size={20} className="spin" style={{display:'inline'}}/></td></tr> :
        list.length === 0 ? <tr><td colSpan={8} style={{textAlign:'center',padding:'var(--sp-8)',color:'var(--fg-muted)'}}>No without-bill payments</td></tr> :
        list.map(e => (
          <tr key={e.id}><td style={{fontWeight:500,color:'var(--accent-400)'}}>{e.payment_number}</td><td>{e.payment_date}</td><td><span className="badge badge-warning">{e.category}</span></td><td>{e.purpose}</td><td>{e.recipient_name||'—'}</td><td>{e.payment_mode}</td><td style={{fontSize:'var(--text-sm)'}}>{e.bank_account_name||'—'}</td><td style={{fontWeight:600}}>{fmt(e.amount)}</td></tr>
        ))}</tbody>
      </table></div></div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowModal(false)}>
          <div style={{ width: '90%', maxWidth: 500, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-2xl)', padding: 24, animation: 'scaleIn 0.3s' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}><h2 style={{fontSize:'var(--text-xl)',fontWeight:600}}>Record Without-Bill Payment</h2><button className="btn-icon" onClick={() => setShowModal(false)}><X size={20}/></button></div>
            {error && <p style={{ color: 'var(--danger-400)', fontSize: 'var(--text-sm)', marginBottom: 8 }}>{error}</p>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={{fontSize:'var(--text-sm)',fontWeight:500}}>Category *</label><select style={inp} value={form.category} onChange={e=>f('category',e.target.value)}><option value="">Select</option>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
              <div><label style={{fontSize:'var(--text-sm)',fontWeight:500}}>Amount *</label><input type="number" style={inp} value={form.amount} onChange={e=>f('amount',e.target.value)} placeholder="₹" /></div>
              <div style={{gridColumn:'1/-1'}}><label style={{fontSize:'var(--text-sm)',fontWeight:500}}>Purpose *</label><input style={inp} value={form.purpose} onChange={e=>f('purpose',e.target.value)} placeholder="What was this for?" /></div>
              <div><label style={{fontSize:'var(--text-sm)',fontWeight:500}}>Recipient Name</label><input style={inp} value={form.recipientName} onChange={e=>f('recipientName',e.target.value)} /></div>
              <div><label style={{fontSize:'var(--text-sm)',fontWeight:500}}>Recipient Phone</label><input style={inp} value={form.recipientPhone} onChange={e=>f('recipientPhone',e.target.value)} /></div>
              <div><label style={{fontSize:'var(--text-sm)',fontWeight:500}}>Payment Mode</label><select style={inp} value={form.paymentMode} onChange={e=>f('paymentMode',e.target.value)}><option value="cash">Cash</option><option value="upi">UPI</option></select></div>
              {form.paymentMode !== 'cash' && <div><label style={{fontSize:'var(--text-sm)',fontWeight:500}}>Bank Account</label><select style={inp} value={form.bankAccountId} onChange={e=>f('bankAccountId',e.target.value)}><option value="">Select</option>{bankAccounts.map(b => <option key={b.id} value={b.id}>{b.account_name}</option>)}</select></div>}
              <div><label style={{fontSize:'var(--text-sm)',fontWeight:500}}>Date</label><input type="date" style={inp} value={form.paymentDate} onChange={e=>f('paymentDate',e.target.value)} /></div>
              <div style={{gridColumn:'1/-1'}}><label style={{fontSize:'var(--text-sm)',fontWeight:500}}>Notes</label><input style={inp} value={form.notes} onChange={e=>f('notes',e.target.value)} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}><button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?<Loader2 size={16} className="spin"/>:<Save size={16}/>} Record</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
