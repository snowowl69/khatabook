import { useState, useEffect } from 'react'
import { Factory, Plus, Search, Edit2, Trash2, X, Save, Loader2 } from 'lucide-react'
import { api } from '../../lib/ipc'
import styles from './Suppliers.module.css'

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN')
const EMPTY = { name: '', phone: '', email: '', address: '', city: '', state: '', gstin: '', bankName: '', bankAccount: '', bankIfsc: '', openingBalance: '0', notes: '' }

export default function Suppliers() {
  const [list, setList] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => { setLoading(true); const r = await api.invoke<any>('suppliers:list', { search, isActive: 1 }); if (r?.success) setList(r.data); setLoading(false) }
  useEffect(() => { load() }, [search])

  const openAdd = () => { setEditId(null); setForm(EMPTY); setError(''); setShowModal(true) }
  const openEdit = (s: any) => { setEditId(s.id); setError(''); setForm({ name: s.name, phone: s.phone||'', email: s.email||'', address: s.address||'', city: s.city||'', state: s.state||'', gstin: s.gstin||'', bankName: s.bank_name||'', bankAccount: s.bank_account||'', bankIfsc: s.bank_ifsc||'', openingBalance: s.opening_balance?.toString()||'0', notes: s.notes||'' }); setShowModal(true) }

  const save = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    const data = { ...form, openingBalance: parseFloat(form.openingBalance || '0') }
    const res = editId ? await api.invoke<any>('suppliers:update', { ...data, id: editId }) : await api.invoke<any>('suppliers:create', data)
    if (res?.success) { setShowModal(false); load() } else setError(res?.error || 'Failed to save')
    setSaving(false)
  }

  const del = async (id: number) => { if (confirm('Remove this supplier?')) { await api.invoke('suppliers:delete', id); load() } }
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className={styles.page}>
      <div className={styles.header}><div><h1 className={styles.title}><Factory size={24} /> Suppliers</h1><p className={styles.subtitle}>{list.length} suppliers</p></div><button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Add Supplier</button></div>
      <div className={styles.searchBox}><Search size={18} className={styles.searchIcon} /><input placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} className={styles.searchInput} /></div>
      <div className={`card ${styles.tableCard}`}><div className="table-container"><table>
        <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>City</th><th>GSTIN</th><th>Bank</th><th>Balance</th><th>Actions</th></tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={8} style={{textAlign:'center',padding:'var(--sp-8)',color:'var(--fg-muted)'}}><Loader2 size={20} className="spin" style={{display:'inline'}} /> Loading...</td></tr> :
          list.length === 0 ? <tr><td colSpan={8} style={{textAlign:'center',padding:'var(--sp-8)',color:'var(--fg-muted)'}}>No suppliers found</td></tr> :
          list.map(s => (
            <tr key={s.id}>
              <td style={{ fontWeight: 500 }}>{s.name}</td><td>{s.phone||'—'}</td><td>{s.email||'—'}</td><td>{s.city||'—'}</td>
              <td style={{fontFamily:'monospace',fontSize:'var(--text-sm)'}}>{s.gstin||'—'}</td><td style={{fontSize:'var(--text-sm)'}}>{s.bank_name||'—'}</td>
              <td style={{ fontWeight: 600, color: s.opening_balance > 0 ? 'var(--warning-400)' : 'var(--success-400)' }}>{fmt(s.opening_balance)}</td>
              <td><div style={{display:'flex',gap:4}}><button className="btn-icon" onClick={() => openEdit(s)}><Edit2 size={16} /></button><button className="btn-icon" style={{color:'var(--danger-400)'}} onClick={() => del(s.id)}><Trash2 size={16} /></button></div></td>
            </tr>
          ))}
        </tbody>
      </table></div></div>

      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}><div className={styles.modal} onClick={e => e.stopPropagation()}>
          <div className={styles.modalHeader}><h2>{editId ? 'Edit Supplier' : 'Add Supplier'}</h2><button className="btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button></div>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.formGrid}>
            <div className={styles.fieldFull}><label>Name *</label><input value={form.name} onChange={e=>f('name',e.target.value)} /></div>
            <div><label>Phone</label><input value={form.phone} onChange={e=>f('phone',e.target.value)} /></div>
            <div><label>Email</label><input value={form.email} onChange={e=>f('email',e.target.value)} /></div>
            <div className={styles.fieldFull}><label>Address</label><input value={form.address} onChange={e=>f('address',e.target.value)} /></div>
            <div><label>City</label><input value={form.city} onChange={e=>f('city',e.target.value)} /></div>
            <div><label>State</label><input value={form.state} onChange={e=>f('state',e.target.value)} /></div>
            <div><label>GSTIN</label><input value={form.gstin} onChange={e=>f('gstin',e.target.value)} /></div>
            <div><label>Opening Balance</label><input type="number" value={form.openingBalance} onChange={e=>f('openingBalance',e.target.value)} /></div>
            <div><label>Bank Name</label><input value={form.bankName} onChange={e=>f('bankName',e.target.value)} /></div>
            <div><label>Account No.</label><input value={form.bankAccount} onChange={e=>f('bankAccount',e.target.value)} /></div>
            <div><label>IFSC</label><input value={form.bankIfsc} onChange={e=>f('bankIfsc',e.target.value)} /></div>
            <div className={styles.fieldFull}><label>Notes</label><textarea value={form.notes} onChange={e=>f('notes',e.target.value)} rows={2} /></div>
          </div>
          <div className={styles.modalFooter}><button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? <><Loader2 size={16} className="spin" /> Saving...</> : <><Save size={16} /> {editId?'Update':'Add'}</>}</button></div>
        </div></div>
      )}
    </div>
  )
}
