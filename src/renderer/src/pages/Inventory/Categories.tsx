import { useState, useEffect } from 'react'
import { Tags, Plus, Trash2, Loader2 } from 'lucide-react'
import { api } from '../../lib/ipc'

export default function Categories() {
  const [categories, setCategories] = useState<any[]>([]); const [brands, setBrands] = useState<any[]>([])
  const [catName, setCatName] = useState(''); const [catDesc, setCatDesc] = useState('')
  const [brandName, setBrandName] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => { setLoading(true); const [c, b] = await Promise.all([api.invoke<any>('categories:list'), api.invoke<any>('brands:list')]); if (c?.success) setCategories(c.data); if (b?.success) setBrands(b.data); setLoading(false) }
  useEffect(() => { load() }, [])

  const addCat = async () => { if (!catName.trim()) return; await api.invoke('categories:create', { name: catName, description: catDesc }); setCatName(''); setCatDesc(''); load() }
  const delCat = async (id: number) => { if (confirm('Delete category?')) { await api.invoke('categories:delete', id); load() } }
  const addBrand = async () => { if (!brandName.trim()) return; await api.invoke('brands:create', { name: brandName }); setBrandName(''); load() }
  const delBrand = async (id: number) => { if (confirm('Delete brand?')) { await api.invoke('brands:delete', id); load() } }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', background: 'var(--bg-raised)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--fg-primary)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn 0.4s ease-out' }}>
      <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><Tags size={24} /> Categories & Brands</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card" style={{ padding: 'var(--sp-5)' }}>
          <h3 style={{ marginBottom: 12, fontWeight: 600 }}>Categories ({categories.length})</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input style={inp} placeholder="Category name" value={catName} onChange={e => setCatName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCat()} />
            <button className="btn btn-primary" onClick={addCat}><Plus size={16} /></button>
          </div>
          {loading ? <Loader2 size={20} className="spin" /> : categories.length === 0 ? <p style={{ color: 'var(--fg-muted)', textAlign: 'center' }}>No categories</p> :
            categories.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-raised)', borderRadius: 'var(--radius-md)', marginBottom: 6, border: '1px solid var(--border-subtle)' }}>
                <div><strong>{c.name}</strong>{c.description && <span style={{ color: 'var(--fg-muted)', fontSize: 'var(--text-sm)', marginLeft: 8 }}>{c.description}</span>}</div>
                <button className="btn-icon" style={{ color: 'var(--danger-400)' }} onClick={() => delCat(c.id)}><Trash2 size={14} /></button>
              </div>
            ))
          }
        </div>
        <div className="card" style={{ padding: 'var(--sp-5)' }}>
          <h3 style={{ marginBottom: 12, fontWeight: 600 }}>Brands ({brands.length})</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input style={inp} placeholder="Brand name" value={brandName} onChange={e => setBrandName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addBrand()} />
            <button className="btn btn-primary" onClick={addBrand}><Plus size={16} /></button>
          </div>
          {loading ? <Loader2 size={20} className="spin" /> : brands.length === 0 ? <p style={{ color: 'var(--fg-muted)', textAlign: 'center' }}>No brands</p> :
            brands.map(b => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-raised)', borderRadius: 'var(--radius-md)', marginBottom: 6, border: '1px solid var(--border-subtle)' }}>
                <strong>{b.name}</strong>
                <button className="btn-icon" style={{ color: 'var(--danger-400)' }} onClick={() => delBrand(b.id)}><Trash2 size={14} /></button>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}
