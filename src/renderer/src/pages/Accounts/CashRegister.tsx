import { useState, useEffect } from 'react'
import { Calculator, Loader2 } from 'lucide-react'
import { api } from '../../lib/ipc'

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function CashRegister() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [data, setData] = useState<any>(null); const [loading, setLoading] = useState(true)

  const load = async () => { setLoading(true); const r = await api.invoke<any>('cash-register:get', date); if (r?.success) setData(r.data); setLoading(false) }
  useEffect(() => { load() }, [date])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn 0.4s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><Calculator size={24} /> Cash Register</h1>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ padding: '8px 12px', background: 'var(--bg-raised)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--fg-primary)' }} />
      </div>
      {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Loader2 size={24} className="spin" /></div> : data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[{ label: 'Opening Balance', value: data.opening_balance, color: 'var(--fg-primary)' },
            { label: 'Cash In (Sales)', value: data.calculatedCashIn, color: 'var(--success-400)' },
            { label: 'Cash Out (Payments)', value: data.calculatedCashOut, color: 'var(--danger-400)' },
            { label: 'Expected Closing', value: data.opening_balance + data.calculatedCashIn - data.calculatedCashOut, color: 'var(--accent-400)' }
          ].map((m, i) => (
            <div key={i} className="card-glass" style={{ padding: 24, textAlign: 'center' }}>
              <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: m.color }}>{fmt(m.value)}</p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-tertiary)', marginTop: 4 }}>{m.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
