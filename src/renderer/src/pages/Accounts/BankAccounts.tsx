import { useState, useEffect } from 'react'
import { Landmark, Plus, Edit2, Trash2, X, Save, Loader2, Star } from 'lucide-react'
import { api } from '../../lib/ipc'
import { useAuthStore } from '../../stores/authStore'

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN')
const EMPTY = { accountName: '', bankName: '', accountNumber: '', ifscCode: '', upiId: '', accountType: 'savings', isDefault: false, openingBalance: '0' }

export default function BankAccounts() {
  const user = useAuthStore(s => s.user)
  const [accounts, setAccounts] = useState<any[]>([]); const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false); const [editId, setEditId] = useState<number|null>(null)
  const [form, setForm] = useState(EMPTY); const [saving, setSaving] = useState(false); const [error, setError] = useState('')

  const load = async () => { setLoading(true); const r = await api.invoke<any>('bank-accounts:list'); if (r?.success) setAccounts(r.data); setLoading(false) }
  useEffect(() => { load() }, [])

  const openAdd = () => { setEditId(null); setForm(EMPTY); setError(''); setShowModal(true) }
  const openEdit = (a: any) => { setEditId(a.id); setError(''); setForm({ accountName: a.account_name, bankName: a.bank_name, accountNumber: a.account_number||'', ifscCode: a.ifsc_code||'', upiId: a.upi_id||'', accountType: a.account_type, isDefault: !!a.is_default, openingBalance: a.opening_balance?.toString()||'0' }); setShowModal(true) }

  const save = async () => {
    if (!form.accountName || !form.bankName) { setError('Name and bank are required'); return }
    setSaving(true); setError('')
    const data = { ...form, openingBalance: parseFloat(form.openingBalance||'0'), createdBy: user?.id }
    const res = editId ? await api.invoke<any>('bank-accounts:update', { ...data, id: editId }) : await api.invoke<any>('bank-accounts:create', data)
    if (res?.success) { setShowModal(false); load() } else setError(res?.error || 'Failed')
    setSaving(false)
  }

  const del = async (id: number) => { if (confirm('Remove this account?')) { await api.invoke('bank-accounts:delete', id); load() } }
  const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))
  const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', background: 'var(--bg-raised)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--fg-primary)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn 0.4s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><Landmark size={24} /> Bank Accounts</h1>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Add Account</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {loading ? <Loader2 size={24} className="spin" /> : accounts.length === 0 ? <p style={{ color: 'var(--fg-muted)' }}>No bank accounts. Add one to start tracking payments.</p> :
        accounts.map(a => (
          <div key={a.id} className="card-glass" style={{ padding: 20, position: 'relative' }}>
            {a.is_default ? <Star size={16} style={{ position: 'absolute', top: 12, right: 12, color: 'var(--warning-400)', fill: 'var(--warning-400)' }} /> : null}
            <h3 style={{ fontWeight: 600, marginBottom: 4 }}>{a.account_name}</h3>
            <p style={{ color: 'var(--fg-tertiary)', fontSize: 'var(--text-sm)' }}>{a.bank_name} • {a.account_type}</p>
            {a.account_number && <p style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', marginTop: 4 }}>A/C: ****{a.account_number.slice(-4)}</p>}
            {a.upi_id && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-tertiary)', marginTop: 2 }}>UPI: {a.upi_id}</p>}
            <p style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginTop: 12, color: 'var(--success-400)' }}>{fmt(a.current_balance)}</p>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>Current Balance</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => openEdit(a)}><Edit2 size={14} /> Edit</button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger-400)' }} onClick={() => del(a.id)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowModal(false)}>
          <div style={{ width: '90%', maxWidth: 500, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-2xl)', padding: 24, animation: 'scaleIn 0.3s' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}><h2 style={{fontSize:'var(--text-xl)',fontWeight:600}}>{editId ? 'Edit' : 'Add'} Bank Account</h2><button className="btn-icon" onClick={() => setShowModal(false)}><X size={20}/></button></div>
            {error && <p style={{ color: 'var(--danger-400)', fontSize: 'var(--text-sm)', marginBottom: 8 }}>{error}</p>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}><label style={{fontSize:'var(--text-sm)',fontWeight:500}}>Account Name *</label><input style={inp} value={form.accountName} onChange={e=>f('accountName',e.target.value)} placeholder="e.g. Main Business" /></div>
              <div><label style={{fontSize:'var(--text-sm)',fontWeight:500}}>Bank Name *</label><input style={inp} value={form.bankName} onChange={e=>f('bankName',e.target.value)} /></div>
              <div><label style={{fontSize:'var(--text-sm)',fontWeight:500}}>Account Type</label><select style={inp} value={form.accountType} onChange={e=>f('accountType',e.target.value)}><option value="savings">Savings</option><option value="current">Current</option></select></div>
              <div><label style={{fontSize:'var(--text-sm)',fontWeight:500}}>Account No.</label><input style={inp} value={form.accountNumber} onChange={e=>f('accountNumber',e.target.value)} /></div>
              <div><label style={{fontSize:'var(--text-sm)',fontWeight:500}}>IFSC</label><input style={inp} value={form.ifscCode} onChange={e=>f('ifscCode',e.target.value)} /></div>
              <div><label style={{fontSize:'var(--text-sm)',fontWeight:500}}>UPI ID</label><input style={inp} value={form.upiId} onChange={e=>f('upiId',e.target.value)} /></div>
              <div><label style={{fontSize:'var(--text-sm)',fontWeight:500}}>Opening Balance</label><input type="number" style={inp} value={form.openingBalance} onChange={e=>f('openingBalance',e.target.value)} /></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20 }}><input type="checkbox" checked={form.isDefault as boolean} onChange={e=>f('isDefault',e.target.checked)} style={{ accentColor: 'var(--accent-500)' }} /><label>Default Account</label></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}><button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?<Loader2 size={16} className="spin"/>:<Save size={16}/>} {editId?'Update':'Add'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
