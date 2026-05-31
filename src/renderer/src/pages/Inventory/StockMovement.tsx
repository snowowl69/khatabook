import { useState, useEffect } from 'react'
import { ArrowRightLeft, Loader2 } from 'lucide-react'
import { api } from '../../lib/ipc'

export default function StockMovement() {
  const [movements, setMovements] = useState<any[]>([]); const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState(''); const [dateFrom, setDateFrom] = useState(''); const [dateTo, setDateTo] = useState('')
  const load = async () => { setLoading(true); const r = await api.invoke<any>('stock:movements', { type: typeFilter||undefined, dateFrom: dateFrom||undefined, dateTo: dateTo||undefined }); if (r?.success) setMovements(r.data); setLoading(false) }
  useEffect(() => { load() }, [typeFilter, dateFrom, dateTo])
  const inp: React.CSSProperties = { padding: '8px 12px', background: 'var(--bg-raised)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--fg-primary)', fontSize: 'var(--text-sm)' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn 0.4s ease-out' }}>
      <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><ArrowRightLeft size={24} /> Stock Movement</h1>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <select style={inp} value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="">All Types</option><option value="sale">Sale</option><option value="purchase">Purchase</option><option value="adjustment_in">Adjustment In</option><option value="adjustment_out">Adjustment Out</option><option value="return_in">Return In</option><option value="opening_stock">Opening</option></select>
        <input type="date" style={inp} value={dateFrom} onChange={e=>setDateFrom(e.target.value)} /><span style={{color:'var(--fg-muted)'}}>to</span><input type="date" style={inp} value={dateTo} onChange={e=>setDateTo(e.target.value)} />
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}><div className="table-container"><table>
        <thead><tr><th>Date</th><th>Item</th><th>SKU</th><th>Type</th><th>Change</th><th>Before</th><th>After</th><th>Reason</th><th>By</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={9} style={{textAlign:'center',padding:'var(--sp-8)',color:'var(--fg-muted)'}}><Loader2 size={20} className="spin" style={{display:'inline'}}/></td></tr> :
        movements.length === 0 ? <tr><td colSpan={9} style={{textAlign:'center',padding:'var(--sp-8)',color:'var(--fg-muted)'}}>No movements</td></tr> :
        movements.map(m => (
          <tr key={m.id}><td style={{fontSize:'var(--text-sm)',color:'var(--fg-tertiary)'}}>{m.created_at?.slice(0,16)}</td><td style={{fontWeight:500}}>{m.item_name}</td><td style={{fontFamily:'monospace',fontSize:'var(--text-sm)'}}>{m.item_sku||'—'}</td>
          <td><span className={`badge ${m.quantity_change>0?'badge-success':'badge-danger'}`}>{m.movement_type}</span></td>
          <td style={{fontWeight:600,color:m.quantity_change>0?'var(--success-400)':'var(--danger-400)'}}>{m.quantity_change>0?'+':''}{m.quantity_change}</td>
          <td>{m.quantity_before}</td><td>{m.quantity_after}</td><td style={{fontSize:'var(--text-sm)'}}>{m.reason||'—'}</td><td>{m.user_name||'—'}</td></tr>
        ))}</tbody>
      </table></div></div>
    </div>
  )
}
