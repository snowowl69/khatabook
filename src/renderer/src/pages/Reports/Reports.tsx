import { useState } from 'react'
import { BarChart3, TrendingUp, Package, Loader2 } from 'lucide-react'
import { api } from '../../lib/ipc'

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function Reports() {
  const [tab, setTab] = useState<'sales'|'pnl'|'stock'>('sales')
  const [dateFrom, setDateFrom] = useState(new Date(Date.now()-30*86400000).toISOString().split('T')[0])
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])
  const [data, setData] = useState<any>(null); const [loading, setLoading] = useState(false)

  const loadReport = async () => {
    setLoading(true); setData(null)
    if (tab === 'sales') {
      const r = await api.invoke<any>('reports:sales-summary', { dateFrom, dateTo }); if (r?.success) setData(r.data)
    } else if (tab === 'pnl') {
      const r = await api.invoke<any>('reports:profit-loss', { dateFrom, dateTo }); if (r?.success) setData(r.data)
    } else {
      const r = await api.invoke<any>('reports:stock-summary'); if (r?.success) setData(r.data)
    }
    setLoading(false)
  }

  const inp: React.CSSProperties = { padding: '8px 12px', background: 'var(--bg-raised)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--fg-primary)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn 0.4s ease-out' }}>
      <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><BarChart3 size={24} /> Reports</h1>
      <div style={{ display: 'flex', gap: 8 }}>
        {[{ key: 'sales', label: 'Sales Summary', icon: <TrendingUp size={16}/> }, { key: 'pnl', label: 'Profit & Loss', icon: <BarChart3 size={16}/> }, { key: 'stock', label: 'Stock Report', icon: <Package size={16}/> }].map(t => (
          <button key={t.key} className={`btn ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t.key as any)}>{t.icon} {t.label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {tab !== 'stock' && <><input type="date" style={inp} value={dateFrom} onChange={e => setDateFrom(e.target.value)} /><span style={{ color: 'var(--fg-muted)' }}>to</span><input type="date" style={inp} value={dateTo} onChange={e => setDateTo(e.target.value)} /></>}
        <button className="btn btn-secondary" onClick={loadReport}>Generate Report</button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40 }}><Loader2 size={24} className="spin" /></div>}

      {!loading && data && tab === 'sales' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[{ label: 'Total Bills', value: data.totals.bill_count, isCurr: false }, { label: 'Total Sales', value: data.totals.total_sales, isCurr: true }, { label: 'Received', value: data.totals.total_received, isCurr: true }, { label: 'Pending', value: data.totals.total_pending, isCurr: true }].map((m, i) => (
              <div key={i} className="card-glass" style={{ padding: 16, textAlign: 'center' }}><p style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>{m.isCurr ? fmt(m.value) : m.value}</p><p style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-tertiary)' }}>{m.label}</p></div>
            ))}
          </div>
          <div className="card" style={{ padding: 'var(--sp-4)' }}>
            <h3 style={{ marginBottom: 8, fontWeight: 600 }}>Top Selling Items</h3>
            <div className="table-container"><table><thead><tr><th>Item</th><th>Qty Sold</th><th>Revenue</th></tr></thead><tbody>
              {data.topItems?.map((item: any, i: number) => <tr key={i}><td style={{fontWeight:500}}>{item.item_name}</td><td>{item.total_qty}</td><td style={{fontWeight:600}}>{fmt(item.total_amount)}</td></tr>)}
            </tbody></table></div>
          </div>
          <div className="card" style={{ padding: 'var(--sp-4)' }}>
            <h3 style={{ marginBottom: 8, fontWeight: 600 }}>Daily Breakdown</h3>
            <div className="table-container"><table><thead><tr><th>Date</th><th>Bills</th><th>Sales</th><th>Tax</th><th>Discount</th></tr></thead><tbody>
              {data.summary?.map((d: any, i: number) => <tr key={i}><td>{d.bill_date}</td><td>{d.bill_count}</td><td style={{fontWeight:600}}>{fmt(d.total_sales)}</td><td>{fmt(d.total_tax)}</td><td>{fmt(d.total_discount)}</td></tr>)}
            </tbody></table></div>
          </div>
        </div>
      )}

      {!loading && data && tab === 'pnl' && (
        <div className="card" style={{ padding: 'var(--sp-5)', maxWidth: 500 }}>
          <h3 style={{ marginBottom: 16, fontWeight: 600 }}>Profit & Loss Statement</h3>
          {[{ label: 'Revenue (Sales)', value: data.sales, color: 'var(--success-400)', bold: true },
            { label: 'Less: Purchases', value: -data.purchases, color: 'var(--danger-400)', bold: false },
            { label: 'Gross Profit', value: data.grossProfit, color: data.grossProfit >= 0 ? 'var(--success-400)' : 'var(--danger-400)', bold: true },
            { label: 'Less: Expenses', value: -data.expenses, color: 'var(--danger-400)', bold: false },
            { label: 'Less: Without Bill', value: -data.withoutBill, color: 'var(--danger-400)', bold: false },
            { label: 'Net Profit', value: data.netProfit, color: data.netProfit >= 0 ? 'var(--success-400)' : 'var(--danger-400)', bold: true },
          ].map((row, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: row.bold ? '2px solid var(--border-default)' : '1px solid var(--border-subtle)', fontWeight: row.bold ? 700 : 400, color: row.bold ? row.color : 'var(--fg-secondary)', fontSize: row.bold ? 'var(--text-lg)' : 'var(--text-base)' }}>
              <span>{row.label}</span><span>{fmt(Math.abs(row.value))}</span>
            </div>
          ))}
        </div>
      )}

      {!loading && data && tab === 'stock' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card-glass" style={{ padding: 20, textAlign: 'center', maxWidth: 300 }}>
            <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--accent-400)' }}>{fmt(data.totalValue)}</p>
            <p style={{ color: 'var(--fg-tertiary)', fontSize: 'var(--text-sm)' }}>Total Stock Value</p>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}><div className="table-container"><table>
            <thead><tr><th>Item</th><th>SKU</th><th>Stock</th><th>Reorder</th><th>Sell Price</th><th>Cost Price</th><th>Stock Value</th></tr></thead>
            <tbody>{data.items?.map((item: any, i: number) => (
              <tr key={i}><td style={{fontWeight:500}}>{item.name}</td><td style={{fontFamily:'monospace',fontSize:'var(--text-sm)'}}>{item.sku||'—'}</td>
              <td style={{color:item.current_stock<=item.reorder_level&&item.reorder_level>0?'var(--danger-400)':'var(--success-400)',fontWeight:600}}>{item.current_stock}</td>
              <td>{item.reorder_level}</td><td>{fmt(item.selling_price)}</td><td>{fmt(item.purchase_price)}</td><td style={{fontWeight:600}}>{fmt(item.stock_value)}</td></tr>
            ))}</tbody>
          </table></div></div>
        </div>
      )}
    </div>
  )
}
