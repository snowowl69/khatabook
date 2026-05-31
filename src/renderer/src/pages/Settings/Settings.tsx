import { useState, useEffect } from 'react'
import { Settings2, Save, Loader2, Plus, Edit2, Trash2, X, Shield, Store, Users, FileText, Upload } from 'lucide-react'
import { api } from '../../lib/ipc'
import { useAuthStore } from '../../stores/authStore'

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user)
  const [tab, setTab] = useState<'shop' | 'billing' | 'users' | 'security' | 'audit'>('shop')
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [showUserModal, setShowUserModal] = useState(false)
  const [editUserId, setEditUserId] = useState<number | null>(null)
  const [userForm, setUserForm] = useState({ username: '', displayName: '', password: '', pin: '', role: 'manager' })
  const [audit, setAudit] = useState<any[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const loadSettings = async () => {
    setLoading(true)
    const r = await api.invoke<any>('db:get-settings')
    if (r?.success) {
      const flat: Record<string, string> = {}
      for (const [k, v] of Object.entries(r.data as any)) {
        flat[k] = (v as any).value
      }
      setSettings(flat)
    }
    setLoading(false)
  }

  const loadUsers = async () => {
    const r = await api.invoke<any>('users:list')
    if (r?.success) setUsers(r.data)
  }

  const loadAudit = async () => {
    setAuditLoading(true)
    const r = await api.invoke<any>('audit:list')
    if (r?.success) setAudit(r.data)
    setAuditLoading(false)
  }

  useEffect(() => {
    loadSettings()
    loadUsers()
  }, [])

  useEffect(() => {
    if (tab === 'audit') loadAudit()
  }, [tab])

  const saveSetting = async (key: string, value: string) => {
    setSettings((p) => ({ ...p, [key]: value }))
  }

  const saveAll = async () => {
    setSaving(true)
    setSuccessMsg('')
    const r = await api.invoke<any>('db:update-settings-bulk', { settings, userId: user?.id })
    if (r?.success) {
      setSuccessMsg('Settings saved successfully!')
      loadSettings() // Reload settings to apply values cleanly
    } else {
      setError(r?.error || 'Failed to save settings')
    }
    setTimeout(() => {
      setSuccessMsg('')
      setError('')
    }, 3000)
    setSaving(false)
  }

  const selectQrImage = async () => {
    const res = await api.invoke<any>('app:select-image')
    if (res?.success && res.data?.filePath) {
      saveSetting('qr_image_path', `"${res.data.filePath}"`)
    }
  }

  const clearQrImage = () => {
    saveSetting('qr_image_path', '""')
  }

  const saveUser = async () => {
    if (!userForm.username || !userForm.displayName) {
      setError('Username and name required')
      return
    }
    setSaving(true)
    setError('')
    const res = editUserId
      ? await api.invoke<any>('users:update', {
          id: editUserId,
          displayName: userForm.displayName,
          password: userForm.password || undefined,
          pin: userForm.pin || undefined
        })
      : await api.invoke<any>('users:create', { ...userForm, createdBy: user?.id })
    if (res?.success) {
      setShowUserModal(false)
      loadUsers()
    } else setError(res?.error || 'Failed')
    setSaving(false)
  }

  const toggleUser = async (id: number, active: number) => {
    await api.invoke('users:update', { id, isActive: active ? 0 : 1 })
    loadUsers()
  }

  const inp: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    background: 'var(--bg-raised)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--fg-primary)'
  }

  const textarea: React.CSSProperties = {
    width: '100%',
    minHeight: '80px',
    padding: '8px 12px',
    background: 'var(--bg-raised)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--fg-primary)',
    fontFamily: 'inherit',
    resize: 'vertical'
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--text-sm)',
    fontWeight: 500,
    color: 'var(--fg-secondary)',
    marginBottom: 4,
    display: 'block'
  }

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: 'var(--text-base)',
    fontWeight: 600,
    color: 'var(--accent-400)',
    marginTop: 16,
    marginBottom: 8,
    gridColumn: '1/-1',
    borderBottom: '1px solid var(--border-subtle)',
    paddingBottom: 6
  }

  const getCleanValue = (key: string) => {
    return (settings[key] || '').replace(/"/g, '')
  }

  const getPreviewUrl = (pathString: string) => {
    if (!pathString) return ''
    const cleanPath = pathString.replace(/"/g, '').replace(/\\/g, '/')
    return `file:///${cleanPath}`
  }

  const uf = (k: string, v: string) => setUserForm((p) => ({ ...p, [k]: v }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn 0.4s ease-out' }}>
      <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Settings2 size={24} /> Settings
      </h1>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          { key: 'shop', label: 'Shop Details', icon: <Store size={16} /> },
          { key: 'billing', label: 'Billing', icon: <FileText size={16} /> },
          { key: 'users', label: 'User Management', icon: <Users size={16} /> },
          { key: 'security', label: 'Security', icon: <Shield size={16} /> },
          { key: 'audit', label: 'Audit Log', icon: <FileText size={16} /> }
        ].map((t) => (
          <button
            key={t.key}
            className={`btn ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(t.key as any)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {successMsg && (
        <div
          style={{
            padding: '8px 16px',
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--success-400)'
          }}
        >
          {successMsg}
        </div>
      )}
      {error && (
        <div
          style={{
            padding: '8px 16px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--danger-400)'
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Loader2 size={24} className="spin" />
        </div>
      ) : (
        <>
          {tab === 'shop' && (
            <div className="card" style={{ padding: 'var(--sp-5)', maxWidth: 650 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={sectionHeaderStyle}>Business Profile</div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Shop Name</label>
                  <input
                    style={inp}
                    value={getCleanValue('shop_name')}
                    onChange={(e) => saveSetting('shop_name', `"${e.target.value}"`)}
                  />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Address</label>
                  <input
                    style={inp}
                    value={getCleanValue('shop_address')}
                    onChange={(e) => saveSetting('shop_address', `"${e.target.value}"`)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input
                    style={inp}
                    value={getCleanValue('shop_phone')}
                    onChange={(e) => saveSetting('shop_phone', `"${e.target.value}"`)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Email Address</label>
                  <input
                    style={inp}
                    type="email"
                    value={getCleanValue('shop_email')}
                    onChange={(e) => saveSetting('shop_email', `"${e.target.value}"`)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>GSTIN</label>
                  <input
                    style={inp}
                    value={getCleanValue('shop_gstin')}
                    onChange={(e) => saveSetting('shop_gstin', `"${e.target.value}"`)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>State Code (e.g. 08 for Rajasthan)</label>
                  <input
                    style={inp}
                    value={getCleanValue('shop_state_code')}
                    onChange={(e) => saveSetting('shop_state_code', `"${e.target.value}"`)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Financial Year</label>
                  <input
                    style={inp}
                    value={getCleanValue('financial_year')}
                    onChange={(e) => saveSetting('financial_year', `"${e.target.value}"`)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Currency Symbol</label>
                  <input
                    style={inp}
                    value={getCleanValue('currency_symbol')}
                    onChange={(e) => saveSetting('currency_symbol', `"${e.target.value}"`)}
                  />
                </div>

                <div style={sectionHeaderStyle}>Owner's Bank Account Details (for A4 Invoice)</div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Account Holder Name</label>
                  <input
                    style={inp}
                    value={getCleanValue('bank_account_name')}
                    onChange={(e) => saveSetting('bank_account_name', `"${e.target.value}"`)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Bank Name</label>
                  <input
                    style={inp}
                    value={getCleanValue('bank_name')}
                    onChange={(e) => saveSetting('bank_name', `"${e.target.value}"`)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Account Number</label>
                  <input
                    style={inp}
                    value={getCleanValue('bank_account_number')}
                    onChange={(e) => saveSetting('bank_account_number', `"${e.target.value}"`)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>IFSC Code</label>
                  <input
                    style={inp}
                    value={getCleanValue('bank_ifsc')}
                    onChange={(e) => saveSetting('bank_ifsc', `"${e.target.value}"`)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>UPI ID (for payments)</label>
                  <input
                    style={inp}
                    placeholder="e.g. shopname@okaxis"
                    value={getCleanValue('bank_upi_id')}
                    onChange={(e) => saveSetting('bank_upi_id', `"${e.target.value}"`)}
                  />
                </div>

                <div style={sectionHeaderStyle}>Invoice Printing Configurations</div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Invoice Terms &amp; Conditions</label>
                  <textarea
                    style={textarea}
                    placeholder="Enter terms and conditions (one per line)..."
                    value={getCleanValue('invoice_terms')}
                    onChange={(e) => saveSetting('invoice_terms', `"${e.target.value}"`)}
                  />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>UPI QR Code Image (for printing on Bill)</label>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    {getCleanValue('qr_image_path') ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                        <img
                          src={getPreviewUrl(getCleanValue('qr_image_path'))}
                          alt="QR Code Preview"
                          style={{
                            width: 100,
                            height: 100,
                            objectFit: 'contain',
                            border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-md)',
                            background: '#fff',
                            padding: 4
                          }}
                        />
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--danger-400)' }}
                          onClick={clearQrImage}
                        >
                          Clear Image
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{
                          width: 100,
                          height: 100,
                          border: '2px dashed var(--border-default)',
                          borderRadius: 'var(--radius-md)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--fg-muted)'
                        }}
                      >
                        No QR Code
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button className="btn btn-ghost" onClick={selectQrImage}>
                        <Upload size={16} /> Select Image
                      </button>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>
                        Select a PNG/JPG QR image of your UPI QR code. It will be printed at the bottom of the invoice.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={saveAll} disabled={saving}>
                {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />} Save Settings
              </button>
            </div>
          )}

          {tab === 'billing' && (
            <div className="card" style={{ padding: 'var(--sp-5)', maxWidth: 600 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Bill Prefix</label>
                  <input
                    style={inp}
                    value={getCleanValue('bill_prefix')}
                    onChange={(e) => saveSetting('bill_prefix', `"${e.target.value}"`)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Purchase Prefix</label>
                  <input
                    style={inp}
                    value={getCleanValue('purchase_prefix')}
                    onChange={(e) => saveSetting('purchase_prefix', `"${e.target.value}"`)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Default Tax Rate (%)</label>
                  <input
                    type="number"
                    style={inp}
                    value={settings.default_tax_rate || '0'}
                    onChange={(e) => saveSetting('default_tax_rate', e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Bill Edit Window (hours)</label>
                  <input
                    type="number"
                    style={inp}
                    value={settings.bill_edit_window_hours || '24'}
                    onChange={(e) => saveSetting('bill_edit_window_hours', e.target.value)}
                  />
                </div>
              </div>
              <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={saveAll} disabled={saving}>
                {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />} Save
              </button>
            </div>
          )}

          {tab === 'users' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setEditUserId(null)
                    setUserForm({ username: '', displayName: '', password: '', pin: '', role: 'manager' })
                    setError('')
                    setShowUserModal(true)
                  }}
                >
                  <Plus size={18} /> Add Manager
                </button>
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Display Name</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Last Login</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td style={{ fontWeight: 500 }}>{u.username}</td>
                          <td>{u.display_name}</td>
                          <td>
                            <span className={`badge ${u.role === 'owner' ? 'badge-accent' : 'badge-success'}`}>
                              {u.role}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                              {u.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-tertiary)' }}>
                            {u.last_login_at || 'Never'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                className="btn-icon"
                                onClick={() => {
                                  setEditUserId(u.id)
                                  setUserForm({
                                    username: u.username,
                                    displayName: u.display_name,
                                    password: '',
                                    pin: '',
                                    role: u.role
                                  })
                                  setError('')
                                  setShowUserModal(true)
                                }}
                              >
                                <Edit2 size={16} />
                              </button>
                              {u.role !== 'owner' && (
                                <button
                                  className="btn-icon"
                                  style={{ color: u.is_active ? 'var(--danger-400)' : 'var(--success-400)' }}
                                  onClick={() => toggleUser(u.id, u.is_active)}
                                >
                                  {u.is_active ? <Trash2 size={16} /> : '✓'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {showUserModal && (
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                  }}
                  onClick={() => setShowUserModal(false)}
                >
                  <div
                    style={{
                      width: '90%',
                      maxWidth: 420,
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-2xl)',
                      padding: 24,
                      animation: 'scaleIn 0.3s'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                      <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>{editUserId ? 'Edit' : 'Add'} User</h2>
                      <button className="btn-icon" onClick={() => setShowUserModal(false)}>
                        <X size={20} />
                      </button>
                    </div>
                    {error && (
                      <p style={{ color: 'var(--danger-400)', fontSize: 'var(--text-sm)', marginBottom: 8 }}>
                        {error}
                      </p>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {!editUserId && (
                        <div>
                          <label style={labelStyle}>Username *</label>
                          <input
                            style={inp}
                            value={userForm.username}
                            onChange={(e) => uf('username', e.target.value)}
                          />
                        </div>
                      )}
                      <div>
                        <label style={labelStyle}>Display Name *</label>
                        <input
                          style={inp}
                          value={userForm.displayName}
                          onChange={(e) => uf('displayName', e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>
                          {editUserId ? 'New Password (leave blank to keep)' : 'Password *'}
                        </label>
                        <input
                          type="password"
                          style={inp}
                          value={userForm.password}
                          onChange={(e) => uf('password', e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>PIN (6 digits, optional)</label>
                        <input
                          style={inp}
                          maxLength={6}
                          value={userForm.pin}
                          onChange={(e) => uf('pin', e.target.value)}
                        />
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 12,
                        marginTop: 20,
                        paddingTop: 16,
                        borderTop: '1px solid var(--border-subtle)'
                      }}
                    >
                      <button className="btn btn-ghost" onClick={() => setShowUserModal(false)}>
                        Cancel
                      </button>
                      <button className="btn btn-primary" onClick={saveUser} disabled={saving}>
                        <Save size={16} /> {editUserId ? 'Update' : 'Create'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'security' && (
            <div className="card" style={{ padding: 'var(--sp-5)', maxWidth: 500 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Auto-Lock Timer (minutes)</label>
                  <input
                    type="number"
                    style={inp}
                    value={settings.auto_lock_minutes || '5'}
                    onChange={(e) => saveSetting('auto_lock_minutes', e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Max Failed Login Attempts</label>
                  <input
                    type="number"
                    style={inp}
                    value={settings.max_failed_logins || '5'}
                    onChange={(e) => saveSetting('max_failed_logins', e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Min Password Length</label>
                  <input
                    type="number"
                    style={inp}
                    value={settings.password_min_length || '8'}
                    onChange={(e) => saveSetting('password_min_length', e.target.value)}
                  />
                </div>
              </div>
              <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={saveAll} disabled={saving}>
                <Save size={16} /> Save
              </button>
            </div>
          )}

          {tab === 'audit' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>User</th>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>ID</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLoading ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--sp-8)' }}>
                          <Loader2 size={20} className="spin" style={{ display: 'inline' }} />
                        </td>
                      </tr>
                    ) : audit.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--fg-muted)' }}>
                          No audit entries
                        </td>
                      </tr>
                    ) : (
                      audit.map((a) => (
                        <tr key={a.id}>
                          <td style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-tertiary)' }}>
                            {a.timestamp}
                          </td>
                          <td>{a.user_name || 'System'}</td>
                          <td>
                            <span className="badge badge-accent">{a.action}</span>
                          </td>
                          <td>{a.entity_type || '—'}</td>
                          <td>{a.entity_id || '—'}</td>
                          <td
                            style={{
                              fontSize: 'var(--text-sm)',
                              maxWidth: 200,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {a.metadata || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
