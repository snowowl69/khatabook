import { useState, useEffect } from 'react'
import { ClipboardList, Search, Loader2 } from 'lucide-react'
import { api } from '../../lib/ipc'

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function PurchaseHistory() {
  const [purchases, setPurchases] = useState<any[]>([])
  const [search, setSearch] = useState(''); const [dateFrom, setDateFrom] = useState(''); const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => { setLoading(true); const r = await api.invoke<any>('purchases:list', { search: search || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }); if (r?.success) setPurchases(r.data); setLoading(false) }
  useEffect(() => { load() }, [search, dateFrom, dateTo])

  const inp: React.CSSProperties = { padding: '8px 12px', background: 'var(--bg-raised)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--fg-primary)', fontSize: 'var(--text-sm)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn 0.4s ease-out' }}>
      <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><ClipboardList size={24} /> Purchase History</h1>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200, ...inp, padding: '0 12px' }}><Search size={16} style={{color:'var(--fg-muted)'}} /><input style={{ border:'none', background:'transparent', padding:'8px 0', color:'var(--fg-primary)', width:'100%' }} placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} /></div>
        <input type="date" style={inp} value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
        <span style={{color:'var(--fg-muted)'}}>to</span>
        <input type="date" style={inp} value={dateTo} onChange={e=>setDateTo(e.target.value)} />
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}><div className="table-container"><table>
        <thead><tr><th>Purchase #</th><th>Date</th><th>Supplier</th><th>Supplier Bill</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={8} style={{textAlign:'center',padding:'var(--sp-8)',color:'var(--fg-muted)'}}><Loader2 size={20} className="spin" style={{display:'inline'}} /></td></tr> :
          purchases.length === 0 ? <tr><td colSpan={8} style={{textAlign:'center',padding:'var(--sp-8)',color:'var(--fg-muted)'}}>No purchases found</td></tr> :
          purchases.map(p => (
            <tr key={p.id}>
              <td style={{fontWeight:600,color:'var(--accent-400)'}}>{p.purchase_number}</td>
              <td>{p.purchase_date}</td><td>{p.supplier_name||'—'}</td><td style={{fontFamily:'monospace',fontSize:'var(--text-sm)'}}>{p.supplier_bill_no||'—'}</td>
              <td style={{fontWeight:600}}>{fmt(p.grand_total)}</td><td>{fmt(p.paid_amount)}</td>
              <td style={{color:p.balance_due>0?'var(--warning-400)':'var(--fg-tertiary)'}}>{fmt(p.balance_due)}</td>
              <td><span className={`badge ${p.payment_status==='paid'?'badge-success':p.payment_status==='partial'?'badge-warning':'badge-danger'}`}>{p.payment_status}</span></td>
            </tr>
          ))}
        </tbody>
      </table></div></div>
    </div>
  )
}
