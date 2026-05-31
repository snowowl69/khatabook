import { useState, useEffect } from 'react'
import { BookOpen, Loader2, TrendingUp, TrendingDown, Wallet, ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '../../lib/ipc'

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function DayBook() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [data, setData] = useState<any>(null); const [loading, setLoading] = useState(true)

  const load = async () => { setLoading(true); const r = await api.invoke<any>('daybook:get', date); if (r?.success) setData(r.data); setLoading(false) }
  useEffect(() => { load() }, [date])

  const changeDate = (d: number) => { const dt = new Date(date); dt.setDate(dt.getDate() + d); setDate(dt.toISOString().split('T')[0]) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn 0.4s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><BookOpen size={24} /> Day Book</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => changeDate(-1)}><ChevronLeft size={18} /></button>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ padding: '8px 12px', background: 'var(--bg-raised)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--fg-primary)' }} />
          <button className="btn btn-ghost btn-sm" onClick={() => changeDate(1)}><ChevronRight size={18} /></button>
        </div>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Loader2 size={24} className="spin" /></div> : data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[{ label: 'Sales', value: data.totals.sales, icon: <TrendingUp size={18}/>, color: 'var(--success-400)' },
              { label: 'Purchases', value: data.totals.purchases, icon: <TrendingDown size={18}/>, color: 'var(--warning-400)' },
              { label: 'Expenses', value: data.totals.expenses, icon: <Wallet size={18}/>, color: 'var(--accent-400)' },
              { label: 'Without Bill', value: data.totals.withoutBill, icon: <BookOpen size={18}/>, color: 'var(--danger-400)' }
            ].map((m, i) => (
              <div key={i} className="card-glass" style={{ padding: 16, textAlign: 'center' }}>
                <div style={{ color: m.color, marginBottom: 4 }}>{m.icon}</div>
                <p style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>{fmt(m.value)}</p>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-tertiary)' }}>{m.label}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card" style={{ padding: 'var(--sp-4)' }}>
              <h3 style={{ marginBottom: 8, fontWeight: 600, color: 'var(--success-400)' }}>Sales ({data.sales.length})</h3>
              {data.sales.length === 0 ? <p style={{ color: 'var(--fg-muted)' }}>No sales</p> :
              <div className="table-container"><table><thead><tr><th>Bill #</th><th>Customer</th><th>Amount</th><th>Status</th></tr></thead><tbody>
                {data.sales.map((s: any, i: number) => <tr key={i}><td style={{color:'var(--accent-400)',fontWeight:500}}>{s.ref}</td><td>{s.customer_name||'Walk-in'}</td><td style={{fontWeight:600}}>{fmt(s.amount)}</td><td><span className={`badge ${s.payment_status==='paid'?'badge-success':'badge-warning'}`}>{s.payment_status}</span></td></tr>)}
              </tbody></table></div>}
            </div>
            <div className="card" style={{ padding: 'var(--sp-4)' }}>
              <h3 style={{ marginBottom: 8, fontWeight: 600, color: 'var(--warning-400)' }}>Purchases ({data.purchases.length})</h3>
              {data.purchases.length === 0 ? <p style={{ color: 'var(--fg-muted)' }}>No purchases</p> :
              <div className="table-container"><table><thead><tr><th>Purchase #</th><th>Supplier</th><th>Amount</th><th>Status</th></tr></thead><tbody>
                {data.purchases.map((p: any, i: number) => <tr key={i}><td style={{color:'var(--accent-400)',fontWeight:500}}>{p.ref}</td><td>{p.supplier_name||'—'}</td><td style={{fontWeight:600}}>{fmt(p.amount)}</td><td><span className={`badge ${p.payment_status==='paid'?'badge-success':'badge-warning'}`}>{p.payment_status}</span></td></tr>)}
              </tbody></table></div>}
            </div>
            <div className="card" style={{ padding: 'var(--sp-4)' }}>
              <h3 style={{ marginBottom: 8, fontWeight: 600, color: 'var(--accent-400)' }}>Expenses ({data.expenses.length})</h3>
              {data.expenses.length === 0 ? <p style={{ color: 'var(--fg-muted)' }}>No expenses</p> :
              <div className="table-container"><table><thead><tr><th>Ref</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead><tbody>
                {data.expenses.map((e: any, i: number) => <tr key={i}><td>{e.ref}</td><td>{e.category}</td><td>{e.description||'—'}</td><td style={{fontWeight:600}}>{fmt(e.amount)}</td></tr>)}
              </tbody></table></div>}
            </div>
            <div className="card" style={{ padding: 'var(--sp-4)' }}>
              <h3 style={{ marginBottom: 8, fontWeight: 600, color: 'var(--danger-400)' }}>Without Bill ({data.withoutBill.length})</h3>
              {data.withoutBill.length === 0 ? <p style={{ color: 'var(--fg-muted)' }}>No entries</p> :
              <div className="table-container"><table><thead><tr><th>Ref</th><th>Category</th><th>Purpose</th><th>Amount</th></tr></thead><tbody>
                {data.withoutBill.map((w: any, i: number) => <tr key={i}><td>{w.ref}</td><td>{w.category}</td><td>{w.purpose}</td><td style={{fontWeight:600}}>{fmt(w.amount)}</td></tr>)}
              </tbody></table></div>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
