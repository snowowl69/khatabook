import { useState, useEffect, useCallback } from 'react'
import { Package, Plus, Search, Edit2, Trash2, ArrowUpDown, X, Save, Loader2 } from 'lucide-react'
import { api } from '../../lib/ipc'
import { useAuthStore } from '../../stores/authStore'
import styles from './ItemList.module.css'

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN')

interface Item {
  id: number; name: string; sku: string; barcode: string; hsn_code: string
  category_id: number; brand_id: number; category_name: string; brand_name: string
  unit: string; mrp: number; selling_price: number; wholesale_price: number
  purchase_price: number; tax_rate: number; current_stock: number
  reorder_level: number; description: string; is_active: number
}

const EMPTY_FORM = { name: '', sku: '', barcode: '', hsnCode: '', categoryId: '', brandId: '', unit: 'pieces', mrp: '', sellingPrice: '', wholesalePrice: '', purchasePrice: '', taxRate: '0', currentStock: '0', reorderLevel: '0', description: '' }

export default function ItemList() {
  const user = useAuthStore(s => s.user)
  const [items, setItems] = useState<Item[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [brands, setBrands] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [lowStock, setLowStock] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showAdjust, setShowAdjust] = useState<Item | null>(null)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [adjQty, setAdjQty] = useState(''); const [adjReason, setAdjReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [itemsRes, catsRes, brandsRes] = await Promise.all([
      api.invoke<any>('items:list', { search, categoryId: catFilter ? parseInt(catFilter) : undefined, lowStock: lowStock || undefined, isActive: 1 }),
      api.invoke<any>('categories:list'),
      api.invoke<any>('brands:list')
    ])
    if (itemsRes?.success) setItems(itemsRes.data)
    if (catsRes?.success) setCategories(catsRes.data)
    if (brandsRes?.success) setBrands(brandsRes.data)
    setLoading(false)
  }, [search, catFilter, lowStock])

  useEffect(() => { load() }, [load])

  const openAdd = () => { setEditId(null); setForm(EMPTY_FORM); setError(''); setShowModal(true) }
  const openEdit = (item: Item) => {
    setEditId(item.id)
    setForm({ name: item.name, sku: item.sku || '', barcode: item.barcode || '', hsnCode: item.hsn_code || '', categoryId: item.category_id?.toString() || '', brandId: item.brand_id?.toString() || '', unit: item.unit, mrp: item.mrp?.toString() || '', sellingPrice: item.selling_price.toString(), wholesalePrice: item.wholesale_price?.toString() || '', purchasePrice: item.purchase_price?.toString() || '', taxRate: item.tax_rate?.toString() || '0', currentStock: item.current_stock.toString(), reorderLevel: item.reorder_level?.toString() || '0', description: item.description || '' })
    setError(''); setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.sellingPrice) { setError('Name and selling price are required'); return }
    setSaving(true); setError('')
    const payload = { ...form, sellingPrice: parseFloat(form.sellingPrice), mrp: form.mrp ? parseFloat(form.mrp) : null, wholesalePrice: form.wholesalePrice ? parseFloat(form.wholesalePrice) : null, purchasePrice: form.purchasePrice ? parseFloat(form.purchasePrice) : null, taxRate: parseFloat(form.taxRate || '0'), currentStock: parseFloat(form.currentStock || '0'), reorderLevel: parseFloat(form.reorderLevel || '0'), categoryId: form.categoryId ? parseInt(form.categoryId) : null, brandId: form.brandId ? parseInt(form.brandId) : null, userId: user?.id }
    const res = editId ? await api.invoke<any>('items:update', { ...payload, id: editId }) : await api.invoke<any>('items:create', payload)
    if (res?.success) { setShowModal(false); load() } else { setError(res?.error || 'Failed to save') }
    setSaving(false)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Deactivate this item?')) return
    await api.invoke('items:delete', id); load()
  }

  const handleAdjust = async () => {
    if (!adjQty || !showAdjust) return
    setSaving(true)
    const res = await api.invoke<any>('items:adjust-stock', { itemId: showAdjust.id, quantity: parseFloat(adjQty), reason: adjReason || 'Manual adjustment', userId: user?.id })
    if (res?.success) { setShowAdjust(null); setAdjQty(''); setAdjReason(''); load() }
    setSaving(false)
  }

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div><h1 className={styles.title}><Package size={24} /> Inventory Items</h1><p className={styles.subtitle}>{items.length} items total</p></div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Add Item</button>
      </div>

      <div className={styles.filters}>
        <div className={styles.searchBox}><Search size={18} className={styles.searchIcon} /><input type="text" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} className={styles.searchInput} /></div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className={styles.select}><option value="">All Categories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <label className={styles.toggle}><input type="checkbox" checked={lowStock} onChange={e => setLowStock(e.target.checked)} /><span>Low Stock Only</span></label>
      </div>

      <div className={`card ${styles.tableCard}`}>
        <div className="table-container">
          <table>
            <thead><tr><th>Name</th><th>SKU</th><th>Category</th><th>Sell Price</th><th>MRP</th><th>Stock</th><th>Tax %</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--fg-muted)' }}><Loader2 size={20} className="spin" style={{ display: 'inline' }} /> Loading...</td></tr> :
              items.length === 0 ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--fg-muted)' }}>No items found. Add your first item!</td></tr> :
              items.map(item => (
                <tr key={item.id}>
                  <td><div className={styles.itemName}>{item.name}<br/><span className={styles.barcode}>{item.barcode || '—'}</span></div></td>
                  <td style={{ fontFamily: 'monospace', color: 'var(--fg-tertiary)' }}>{item.sku || '—'}</td>
                  <td>{item.category_name || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{fmt(item.selling_price)}</td>
                  <td style={{ color: 'var(--fg-tertiary)' }}>{item.mrp ? fmt(item.mrp) : '—'}</td>
                  <td><span className={item.current_stock <= (item.reorder_level || 0) && item.reorder_level > 0 ? styles.lowStock : styles.goodStock}>{item.current_stock} {item.unit}</span></td>
                  <td>{item.tax_rate}%</td>
                  <td>
                    <div className={styles.actions}>
                      <button className="btn-icon" title="Adjust Stock" onClick={() => { setShowAdjust(item); setAdjQty(''); setAdjReason('') }}><ArrowUpDown size={16} /></button>
                      <button className="btn-icon" title="Edit" onClick={() => openEdit(item)}><Edit2 size={16} /></button>
                      <button className="btn-icon" title="Delete" onClick={() => handleDelete(item.id)} style={{ color: 'var(--danger-400)' }}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}><h2>{editId ? 'Edit Item' : 'Add New Item'}</h2><button className="btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button></div>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.formGrid}>
              <div className={styles.fieldFull}><label>Item Name *</label><input value={form.name} onChange={e => f('name', e.target.value)} placeholder="e.g. Toor Dal 1kg" /></div>
              <div><label>SKU</label><input value={form.sku} onChange={e => f('sku', e.target.value)} placeholder="e.g. TD-001" /></div>
              <div><label>Barcode</label><input value={form.barcode} onChange={e => f('barcode', e.target.value)} placeholder="Scan or type" /></div>
              <div><label>HSN Code</label><input value={form.hsnCode} onChange={e => f('hsnCode', e.target.value)} /></div>
              <div><label>Unit</label><select value={form.unit} onChange={e => f('unit', e.target.value)}><option value="pieces">Pieces</option><option value="kg">Kg</option><option value="g">Grams</option><option value="l">Litre</option><option value="ml">ML</option><option value="m">Metre</option><option value="box">Box</option><option value="pack">Pack</option><option value="dozen">Dozen</option></select></div>
              <div><label>Category</label><select value={form.categoryId} onChange={e => f('categoryId', e.target.value)}><option value="">None</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><label>Brand</label><select value={form.brandId} onChange={e => f('brandId', e.target.value)}><option value="">None</option>{brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
              <div><label>Tax Rate (%)</label><select value={form.taxRate} onChange={e => f('taxRate', e.target.value)}><option value="0">0%</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option></select></div>
              <div><label>Selling Price *</label><input type="number" value={form.sellingPrice} onChange={e => f('sellingPrice', e.target.value)} placeholder="₹" /></div>
              <div><label>MRP</label><input type="number" value={form.mrp} onChange={e => f('mrp', e.target.value)} placeholder="₹" /></div>
              <div><label>Purchase Price</label><input type="number" value={form.purchasePrice} onChange={e => f('purchasePrice', e.target.value)} placeholder="₹" /></div>
              <div><label>Wholesale Price</label><input type="number" value={form.wholesalePrice} onChange={e => f('wholesalePrice', e.target.value)} placeholder="₹" /></div>
              {!editId && <div><label>Opening Stock</label><input type="number" value={form.currentStock} onChange={e => f('currentStock', e.target.value)} /></div>}
              <div><label>Reorder Level</label><input type="number" value={form.reorderLevel} onChange={e => f('reorderLevel', e.target.value)} /></div>
              <div className={styles.fieldFull}><label>Description</label><textarea value={form.description} onChange={e => f('description', e.target.value)} rows={2} /></div>
            </div>
            <div className={styles.modalFooter}><button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? <><Loader2 size={16} className="spin" /> Saving...</> : <><Save size={16} /> {editId ? 'Update' : 'Add Item'}</>}</button></div>
          </div>
        </div>
      )}

      {/* Stock Adjust Modal */}
      {showAdjust && (
        <div className={styles.overlay} onClick={() => setShowAdjust(null)}>
          <div className={styles.modal} style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}><h2>Adjust Stock: {showAdjust.name}</h2><button className="btn-icon" onClick={() => setShowAdjust(null)}><X size={20} /></button></div>
            <p style={{ color: 'var(--fg-tertiary)', marginBottom: 'var(--sp-4)' }}>Current stock: <strong>{showAdjust.current_stock} {showAdjust.unit}</strong></p>
            <div className={styles.formGrid}>
              <div className={styles.fieldFull}><label>Quantity (+/-)</label><input type="number" value={adjQty} onChange={e => setAdjQty(e.target.value)} placeholder="e.g. +10 or -5" autoFocus /></div>
              <div className={styles.fieldFull}><label>Reason</label><input value={adjReason} onChange={e => setAdjReason(e.target.value)} placeholder="e.g. Damaged, Count correction" /></div>
            </div>
            <div className={styles.modalFooter}><button className="btn btn-ghost" onClick={() => setShowAdjust(null)}>Cancel</button><button className="btn btn-primary" onClick={handleAdjust} disabled={saving || !adjQty}>{saving ? 'Saving...' : 'Adjust Stock'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
