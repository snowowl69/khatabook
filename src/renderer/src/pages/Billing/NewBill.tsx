import { useState, useRef, useEffect } from 'react'
import { FilePlus, Search, X, Plus, Minus, Trash2, Check, Loader2, CreditCard, Printer } from 'lucide-react'
import { api } from '../../lib/ipc'
import { useAuthStore } from '../../stores/authStore'
import styles from './NewBill.module.css'
import BillPrint from './BillPrint'

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface BillItem { itemId: number; itemName: string; itemSku: string; hsnCode: string; quantity: number; unit: string; rate: number; taxRate: number; discountType: string; discountValue: number; discountAmount: number; taxableAmount: number; cgstAmount: number; sgstAmount: number; taxAmount: number; lineTotal: number; stock: number }

export default function NewBill() {
  const user = useAuthStore(s => s.user)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [walkInName, setWalkInName] = useState('')
  const [walkInPhone, setWalkInPhone] = useState('')
  const [isWalkIn, setIsWalkIn] = useState(true)

  const [itemSearch, setItemSearch] = useState('')
  const [itemResults, setItemResults] = useState<any[]>([])
  const [billItems, setBillItems] = useState<BillItem[]>([])

  const [paymentMode, setPaymentMode] = useState('cash')
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [bankAccountId, setBankAccountId] = useState('')
  const [paidAmount, setPaidAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')

  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<{ billNumber: string; billId: number } | null>(null)
  const [error, setError] = useState('')
  const itemSearchRef = useRef<HTMLInputElement>(null)

  const [showPrint, setShowPrint] = useState(false)
  const [printBill, setPrintBill] = useState<any>(null)
  const [printSettings, setPrintSettings] = useState<Record<string, string>>({})

  useEffect(() => { api.invoke<any>('bank-accounts:list').then(r => { if (r?.success) setBankAccounts(r.data) }) }, [])

  // Customer search
  useEffect(() => {
    if (!customerSearch.trim() || customerSearch.length < 2) { setCustomerResults([]); return }
    const t = setTimeout(async () => {
      const r = await api.invoke<any>('customers:search', customerSearch)
      if (r?.success) setCustomerResults(r.data)
    }, 300)
    return () => clearTimeout(t)
  }, [customerSearch])

  // Item search
  useEffect(() => {
    if (!itemSearch.trim() || itemSearch.length < 1) { setItemResults([]); return }
    const t = setTimeout(async () => {
      const r = await api.invoke<any>('items:search', itemSearch)
      if (r?.success) setItemResults(r.data)
    }, 200)
    return () => clearTimeout(t)
  }, [itemSearch])

  const selectCustomer = (c: any) => { setSelectedCustomer(c); setIsWalkIn(false); setCustomerSearch(''); setCustomerResults([]) }
  const clearCustomer = () => { setSelectedCustomer(null); setIsWalkIn(true) }

  const addItem = (item: any) => {
    const existing = billItems.find(b => b.itemId === item.id)
    if (existing) { updateQty(item.id, existing.quantity + 1); setItemSearch(''); setItemResults([]); return }
    const taxRate = item.tax_rate || 0
    const taxable = item.selling_price
    const tax = taxable * taxRate / 100
    const bi: BillItem = { itemId: item.id, itemName: item.name, itemSku: item.sku || '', hsnCode: '', quantity: 1, unit: item.unit || 'pieces', rate: item.selling_price, taxRate, discountType: '', discountValue: 0, discountAmount: 0, taxableAmount: taxable, cgstAmount: tax / 2, sgstAmount: tax / 2, taxAmount: tax, lineTotal: taxable + tax, stock: item.current_stock }
    setBillItems([...billItems, bi])
    setItemSearch(''); setItemResults([])
    itemSearchRef.current?.focus()
  }

  const updateQty = (itemId: number, qty: number) => {
    if (qty < 1) return
    setBillItems(prev => prev.map(b => {
      if (b.itemId !== itemId) return b
      const disc = b.discountType === 'percent' ? b.rate * qty * b.discountValue / 100 : b.discountValue
      const taxable = b.rate * qty - disc
      const tax = taxable * b.taxRate / 100
      return { ...b, quantity: qty, discountAmount: disc, taxableAmount: taxable, cgstAmount: tax / 2, sgstAmount: tax / 2, taxAmount: tax, lineTotal: taxable + tax }
    }))
  }

  const updateDiscount = (itemId: number, val: string) => {
    setBillItems(prev => prev.map(b => {
      if (b.itemId !== itemId) return b
      const dv = parseFloat(val) || 0
      const disc = b.rate * b.quantity * dv / 100
      const taxable = b.rate * b.quantity - disc
      const tax = taxable * b.taxRate / 100
      return { ...b, discountType: 'percent', discountValue: dv, discountAmount: disc, taxableAmount: taxable, cgstAmount: tax / 2, sgstAmount: tax / 2, taxAmount: tax, lineTotal: taxable + tax }
    }))
  }

  const removeItem = (itemId: number) => setBillItems(prev => prev.filter(b => b.itemId !== itemId))

  // Calculations
  const subtotal = billItems.reduce((s, b) => s + b.rate * b.quantity, 0)
  const totalDiscount = billItems.reduce((s, b) => s + b.discountAmount, 0)
  const taxableAmount = billItems.reduce((s, b) => s + b.taxableAmount, 0)
  const totalTax = billItems.reduce((s, b) => s + b.taxAmount, 0)
  const grandTotal = Math.round(taxableAmount + totalTax)
  const roundOff = grandTotal - (taxableAmount + totalTax)
  const paid = parseFloat(paidAmount) || 0
  const balanceDue = grandTotal - paid

  const createBill = async () => {
    if (billItems.length === 0) { setError('Add at least one item'); return }
    if (paymentMode !== 'cash' && paymentMode !== 'credit' && !bankAccountId) { setError('Select a bank account for non-cash payment'); return }
    setSaving(true); setError('')
    const data = {
      customerId: selectedCustomer?.id || null,
      customerName: selectedCustomer?.name || walkInName || 'Walk-in',
      customerPhone: selectedCustomer?.phone || walkInPhone || null,
      userId: user?.id || 1,
      billDate: new Date().toISOString().split('T')[0],
      subtotal, discountAmount: totalDiscount, taxableAmount, cgstAmount: totalTax / 2, sgstAmount: totalTax / 2, taxAmount: totalTax, roundOff, grandTotal,
      paidAmount: paid, balanceDue: balanceDue > 0 ? balanceDue : 0,
      paymentMode, bankAccountId: bankAccountId ? parseInt(bankAccountId) : null, notes, vehicleNumber: vehicleNumber || null,
      items: billItems.map(b => ({ itemId: b.itemId, itemName: b.itemName, itemSku: b.itemSku, hsnCode: b.hsnCode, quantity: b.quantity, unit: b.unit, rate: b.rate, discountType: b.discountType, discountValue: b.discountValue, discountAmount: b.discountAmount, taxableAmount: b.taxableAmount, taxRate: b.taxRate, cgstAmount: b.cgstAmount, sgstAmount: b.sgstAmount, taxAmount: b.taxAmount, lineTotal: b.lineTotal }))
    }
    const res = await api.invoke<any>('bills:create', data)
    if (res?.success) {
      setSuccess({ billNumber: res.data.billNumber, billId: res.data.billId as number })
      setBillItems([]); setSelectedCustomer(null); setIsWalkIn(true); setWalkInName(''); setWalkInPhone(''); setPaidAmount(''); setNotes(''); setVehicleNumber('')
    } else setError(res?.error || 'Failed to create bill')
    setSaving(false)
  }

  const openPrint = async (billId: number) => {
    const [billRes, settingsRes] = await Promise.all([
      api.invoke<any>('bills:get', billId),
      api.invoke<any>('db:get-settings')
    ])
    if (billRes?.success && settingsRes?.success) {
      setPrintBill(billRes.data)
      const flat: Record<string, string> = {}
      for (const [k, v] of Object.entries(settingsRes.data as any)) { flat[k] = ((v as any).value || '').replace(/"/g, '') }
      setPrintSettings(flat)
      setShowPrint(true)
    }
  }

  return (
    <>
    <div className={styles.page}>
      <div className={styles.header}><h1 className={styles.title}><FilePlus size={24} /> New Bill / Invoice</h1></div>

      {success && (
        <div className={styles.successBanner}>
          <Check size={20} /> Bill <strong>{success.billNumber}</strong> created successfully!
          <button className="btn btn-ghost btn-sm" onClick={() => openPrint(success.billId)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Printer size={16} /> Print Bill</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSuccess(null)}>Create Another</button>
        </div>
      )}

      <div className={styles.billLayout}>
        {/* Left: Items */}
        <div className={styles.leftPanel}>
          {/* Customer Selection */}
          <div className={`card ${styles.section}`}>
            <h3 className={styles.sectionTitle}>Customer</h3>
            {selectedCustomer ? (
              <div className={styles.selectedCustomer}>
                <div><strong>{selectedCustomer.name}</strong> {selectedCustomer.phone && <span style={{ color: 'var(--fg-tertiary)' }}> • {selectedCustomer.phone}</span>}</div>
                <button className="btn-icon" onClick={clearCustomer}><X size={16} /></button>
              </div>
            ) : (
              <div>
                <div className={styles.customerToggle}>
                  <button className={`btn btn-sm ${isWalkIn ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setIsWalkIn(true)}>Walk-in</button>
                  <button className={`btn btn-sm ${!isWalkIn ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setIsWalkIn(false)}>Search</button>
                </div>
                {isWalkIn ? (
                  <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
                    <input placeholder="Name (optional)" value={walkInName} onChange={e => setWalkInName(e.target.value)} className={styles.input} />
                    <input placeholder="Phone (optional)" value={walkInPhone} onChange={e => setWalkInPhone(e.target.value)} className={styles.input} />
                  </div>
                ) : (
                  <div style={{ position: 'relative', marginTop: 'var(--sp-2)' }}>
                    <input placeholder="Search customers..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} className={styles.input} />
                    {customerResults.length > 0 && (
                      <div className={styles.dropdown}>{customerResults.map(c => (
                        <div key={c.id} className={styles.dropdownItem} onClick={() => selectCustomer(c)}>{c.name} <span style={{ color: 'var(--fg-muted)' }}>{c.phone}</span></div>
                      ))}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Vehicle Number */}
          <div className={`card ${styles.section}`} style={{ padding: 'var(--sp-3) var(--sp-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
              <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--fg-secondary)', whiteSpace: 'nowrap' }}>Vehicle No.</label>
              <input placeholder="e.g. RJ14 AB 1234" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value.toUpperCase())} className={styles.input} style={{ flex: 1 }} />
            </div>
          </div>

          {/* Item Search */}
          <div className={`card ${styles.section}`}>
            <h3 className={styles.sectionTitle}>Add Items</h3>
            <div style={{ position: 'relative' }}>
              <div className={styles.itemSearchBox}><Search size={16} /><input ref={itemSearchRef} placeholder="Search by name, SKU, barcode..." value={itemSearch} onChange={e => setItemSearch(e.target.value)} className={styles.input} autoFocus /></div>
              {itemResults.length > 0 && (
                <div className={styles.dropdown}>{itemResults.map(item => (
                  <div key={item.id} className={styles.dropdownItem} onClick={() => addItem(item)}>
                    <div><strong>{item.name}</strong> <span className={styles.sku}>{item.sku}</span></div>
                    <div style={{ display: 'flex', gap: 'var(--sp-4)', fontSize: 'var(--text-sm)' }}><span style={{ fontWeight: 600 }}>{fmt(item.selling_price)}</span><span style={{ color: item.current_stock > 0 ? 'var(--success-400)' : 'var(--danger-400)' }}>Stock: {item.current_stock}</span></div>
                  </div>
                ))}</div>
              )}
            </div>
          </div>

          {/* Bill Items Table */}
          <div className={`card ${styles.section}`}>
            <h3 className={styles.sectionTitle}>Bill Items ({billItems.length})</h3>
            {billItems.length === 0 ? <p style={{ color: 'var(--fg-muted)', textAlign: 'center', padding: 'var(--sp-6)' }}>Search and add items above</p> : (
              <div className="table-container"><table>
                <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Disc %</th><th>Tax</th><th>Total</th><th></th></tr></thead>
                <tbody>{billItems.map(b => (
                  <tr key={b.itemId}>
                    <td><div className={styles.itemName}>{b.itemName}<br/><span className={styles.sku}>{b.itemSku}</span></div></td>
                    <td><div className={styles.qtyControl}><button onClick={() => updateQty(b.itemId, b.quantity - 1)}><Minus size={14} /></button><span>{b.quantity}</span><button onClick={() => updateQty(b.itemId, b.quantity + 1)}><Plus size={14} /></button></div></td>
                    <td>{fmt(b.rate)}</td>
                    <td><input type="number" value={b.discountValue || ''} onChange={e => updateDiscount(b.itemId, e.target.value)} className={styles.discInput} placeholder="0" /></td>
                    <td style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-tertiary)' }}>{b.taxRate}%</td>
                    <td style={{ fontWeight: 600 }}>{fmt(b.lineTotal)}</td>
                    <td><button className="btn-icon" style={{ color: 'var(--danger-400)' }} onClick={() => removeItem(b.itemId)}><Trash2 size={14} /></button></td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </div>
        </div>

        {/* Right: Summary */}
        <div className={styles.rightPanel}>
          <div className={`card-glass ${styles.summaryCard}`}>
            <h3 className={styles.sectionTitle}>Bill Summary</h3>
            <div className={styles.summaryRows}>
              <div className={styles.summaryRow}><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
              {totalDiscount > 0 && <div className={styles.summaryRow}><span>Discount</span><span style={{ color: 'var(--success-400)' }}>-{fmt(totalDiscount)}</span></div>}
              <div className={styles.summaryRow}><span>Taxable Amount</span><span>{fmt(taxableAmount)}</span></div>
              <div className={styles.summaryRow}><span>CGST</span><span>{fmt(totalTax / 2)}</span></div>
              <div className={styles.summaryRow}><span>SGST</span><span>{fmt(totalTax / 2)}</span></div>
              {roundOff !== 0 && <div className={styles.summaryRow}><span>Round Off</span><span>{fmt(roundOff)}</span></div>}
              <div className={`${styles.summaryRow} ${styles.grandTotal}`}><span>Grand Total</span><span>{fmt(grandTotal)}</span></div>
            </div>

            <div className={styles.paymentSection}>
              <label>Payment Mode</label>
              <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className={styles.input}>
                <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank_transfer">Bank Transfer</option><option value="credit">Credit (Udhaar)</option>
              </select>

              {paymentMode !== 'cash' && paymentMode !== 'credit' && (
                <><label>Bank Account *</label><select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)} className={styles.input}>
                  <option value="">Select Bank Account</option>{bankAccounts.map(ba => <option key={ba.id} value={ba.id}>{ba.account_name} - {ba.bank_name}</option>)}
                </select></>
              )}

              <label>Paid Amount</label>
              <input type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} placeholder={grandTotal.toString()} className={styles.input} />

              {balanceDue > 0 && paid > 0 && <div className={styles.balanceDue}>Balance Due: <strong>{fmt(balanceDue)}</strong></div>}

              <label>Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." className={styles.input} />
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button className={`btn btn-primary btn-lg ${styles.createBtn}`} onClick={createBill} disabled={saving || billItems.length === 0}>
              {saving ? <><Loader2 size={18} className="spin" /> Creating...</> : <><CreditCard size={18} /> Create Bill — {fmt(grandTotal)}</>}
            </button>
          </div>
        </div>
      </div>
    </div>

    {showPrint && printBill && (
      <BillPrint bill={printBill} settings={printSettings} onClose={() => { setShowPrint(false); setPrintBill(null) }} />
    )}
    </>
  )
}
