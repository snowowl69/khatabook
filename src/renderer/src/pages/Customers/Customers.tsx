import { useState, useEffect } from 'react'
import { Users, Plus, Search, Edit2, Trash2, X, Save, Loader2, Phone, Mail, MapPin } from 'lucide-react'
import { api } from '../../lib/ipc'
import styles from './Customers.module.css'

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN')
const EMPTY = { name: '', phone: '', altPhone: '', email: '', address: '', city: '', state: '', pincode: '', gstin: '', customerGroup: 'retail', openingBalance: '0', notes: '' }

export default function Customers() {
  const [list, setList] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    const res = await api.invoke<any>('customers:list', { search, isActive: 1 })
    if (res?.success) setList(res.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [search])

  const openAdd = () => { setEditId(null); setForm(EMPTY); setError(''); setShowModal(true) }
  const openEdit = (c: any) => {
    setEditId(c.id); setError('')
    setForm({ name: c.name, phone: c.phone || '', altPhone: c.alt_phone || '', email: c.email || '', address: c.address || '', city: c.city || '', state: c.state || '', pincode: c.pincode || '', gstin: c.gstin || '', customerGroup: c.customer_group || 'retail', openingBalance: c.opening_balance?.toString() || '0', notes: c.notes || '' })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    const data = { ...form, openingBalance: parseFloat(form.openingBalance || '0') }
    const res = editId ? await api.invoke<any>('customers:update', { ...data, id: editId }) : await api.invoke<any>('customers:create', data)
    if (res?.success) { setShowModal(false); load() } else setError(res?.error || 'Failed to save')
    setSaving(false)
  }

  const del = async (id: number) => { if (confirm('Remove this customer?')) { await api.invoke('customers:delete', id); load() } }
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div><h1 className={styles.title}><Users size={24} /> Customers</h1><p className={styles.subtitle}>{list.length} customers</p></div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Add Customer</button>
      </div>
      <div className={styles.searchBox}><Search size={18} className={styles.searchIcon} /><input placeholder="Search by name, phone, email..." value={search} onChange={e => setSearch(e.target.value)} className={styles.searchInput} /></div>
      <div className={`card ${styles.tableCard}`}><div className="table-container"><table>
        <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>City</th><th>GSTIN</th><th>Balance</th><th>Actions</th></tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={7} style={{ textAlign:'center', padding:'var(--sp-8)', color:'var(--fg-muted)' }}><Loader2 size={20} className="spin" style={{display:'inline'}} /> Loading...</td></tr> :
          list.length === 0 ? <tr><td colSpan={7} style={{ textAlign:'center', padding:'var(--sp-8)', color:'var(--fg-muted)' }}>No customers found</td></tr> :
          list.map(c => (
            <tr key={c.id}>
              <td style={{ fontWeight: 500 }}>{c.name}</td>
              <td><span style={{ display:'flex', alignItems:'center', gap:4 }}><Phone size={14} style={{ color:'var(--fg-muted)' }} />{c.phone || '—'}</span></td>
              <td><span style={{ display:'flex', alignItems:'center', gap:4 }}><Mail size={14} style={{ color:'var(--fg-muted)' }} />{c.email || '—'}</span></td>
              <td><span style={{ display:'flex', alignItems:'center', gap:4 }}><MapPin size={14} style={{ color:'var(--fg-muted)' }} />{c.city || '—'}</span></td>
              <td style={{ fontFamily:'monospace', fontSize:'var(--text-sm)' }}>{c.gstin || '—'}</td>
              <td style={{ fontWeight: 600, color: c.opening_balance > 0 ? 'var(--danger-400)' : 'var(--success-400)' }}>{fmt(c.opening_balance)}</td>
              <td><div style={{ display:'flex', gap:4 }}><button className="btn-icon" onClick={() => openEdit(c)}><Edit2 size={16} /></button><button className="btn-icon" style={{ color:'var(--danger-400)' }} onClick={() => del(c.id)}><Trash2 size={16} /></button></div></td>
            </tr>
          ))}
        </tbody>
      </table></div></div>

      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}><h2>{editId ? 'Edit Customer' : 'Add Customer'}</h2><button className="btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button></div>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.formGrid}>
              <div className={styles.fieldFull}><label>Name *</label><input value={form.name} onChange={e => f('name', e.target.value)} placeholder="Customer name" /></div>
              <div><label>Phone</label><input value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="10-digit phone" /></div>
              <div><label>Alt Phone</label><input value={form.altPhone} onChange={e => f('altPhone', e.target.value)} /></div>
              <div><label>Email</label><input value={form.email} onChange={e => f('email', e.target.value)} /></div>
              <div><label>GSTIN</label><input value={form.gstin} onChange={e => f('gstin', e.target.value)} placeholder="22AAAAA0000A1Z5" /></div>
              <div className={styles.fieldFull}><label>Address</label><input value={form.address} onChange={e => f('address', e.target.value)} /></div>
              <div><label>City</label><input value={form.city} onChange={e => f('city', e.target.value)} /></div>
              <div><label>State</label><input value={form.state} onChange={e => f('state', e.target.value)} /></div>
              <div><label>Pincode</label><input value={form.pincode} onChange={e => f('pincode', e.target.value)} /></div>
              <div><label>Group</label><select value={form.customerGroup} onChange={e => f('customerGroup', e.target.value)}><option value="retail">Retail</option><option value="wholesale">Wholesale</option></select></div>
              <div><label>Opening Balance</label><input type="number" value={form.openingBalance} onChange={e => f('openingBalance', e.target.value)} /></div>
              <div className={styles.fieldFull}><label>Notes</label><textarea value={form.notes} onChange={e => f('notes', e.target.value)} rows={2} /></div>
            </div>
            <div className={styles.modalFooter}><button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? <><Loader2 size={16} className="spin" /> Saving...</> : <><Save size={16} /> {editId ? 'Update' : 'Add'}</>}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
