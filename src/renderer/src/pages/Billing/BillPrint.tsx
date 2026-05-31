import { useState, useEffect } from 'react'
import { X, Printer, Info } from 'lucide-react'
import { api } from '../../lib/ipc'
import { useAuthStore } from '../../stores/authStore'
import styles from './BillPrint.module.css'

interface BillPrintProps {
  bill: any
  settings: Record<string, string>
  onClose: () => void
}

export default function BillPrint({ bill, settings, onClose }: BillPrintProps) {
  const user = useAuthStore((s) => s.user)
  const [customer, setCustomer] = useState<any>(null)
  const [printHistory, setPrintHistory] = useState<{ count: number; prints: any[] }>({
    count: 0,
    prints: []
  })

  // Load customer details and print history
  const loadPrintHistory = async () => {
    const res = await api.invoke<any>('bills:print-history', bill.id)
    if (res?.success) {
      setPrintHistory(res.data)
    }
  }

  useEffect(() => {
    setCustomer(null)
    if (bill?.customer_id) {
      api.invoke<any>('customers:get', bill.customer_id).then((res) => {
        if (res?.success) {
          setCustomer(res.data)
        }
      })
    }
    loadPrintHistory()
  }, [bill?.id])

  const handlePrint = async () => {
    window.print()
    if (user?.id) {
      await api.invoke('bills:log-print', { billId: bill.id, userId: user.id })
      loadPrintHistory()
    }
  }

  // Convert amount to words
  const numberToWords = (num: number): string => {
    if (num === 0) return 'Rupees Zero Only'

    const parts = num.toFixed(2).split('.')
    const rupees = parseInt(parts[0], 10)
    const paisa = parseInt(parts[1], 10)

    const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
    const teenDigits = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
    const doubleDigits = ['', 'Ten', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

    const convertGroup = (val: number): string => {
      let str = ''
      if (val >= 100) {
        str += singleDigits[Math.floor(val / 100)] + ' Hundred '
        val %= 100
      }
      if (val >= 10 && val < 20) {
        str += teenDigits[val - 10] + ' '
      } else if (val >= 20) {
        str += doubleDigits[Math.floor(val / 10)] + ' '
        val %= 10
        if (val > 0) {
          str += singleDigits[val] + ' '
        }
      } else if (val > 0) {
        str += singleDigits[val] + ' '
      }
      return str.trim()
    }

    let words = ''
    let remaining = rupees

    // Crores
    if (remaining >= 10000000) {
      const crores = Math.floor(remaining / 10000000)
      words += convertGroup(crores) + ' Crore '
      remaining %= 10000000
    }

    // Lakhs
    if (remaining >= 100000) {
      const lakhs = Math.floor(remaining / 100000)
      words += convertGroup(lakhs) + ' Lakh '
      remaining %= 100000
    }

    // Thousands
    if (remaining >= 1000) {
      const thousands = Math.floor(remaining / 1000)
      words += convertGroup(thousands) + ' Thousand '
      remaining %= 1000
    }

    // Hundreds and units
    if (remaining > 0) {
      words += convertGroup(remaining) + ' '
    }

    words = words.trim()
    let result = 'Rupees ' + (words ? words : 'Zero')

    if (paisa > 0) {
      result += ' and ' + convertGroup(paisa) + ' Paisa'
    }

    result += ' Only'
    return result
  }

  // Formatting helpers
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  const formatTime = (dateTimeStr: string) => {
    if (!dateTimeStr) return ''
    try {
      const d = new Date(dateTimeStr)
      return d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    } catch {
      return ''
    }
  }

  const getCleanSetting = (key: string) => {
    return (settings[key] || '').replace(/"/g, '')
  }

  const getQrPath = (pathString: string) => {
    if (!pathString) return ''
    const cleanPath = pathString.replace(/"/g, '').replace(/\\/g, '/')
    return `file:///${cleanPath}`
  }

  // Extract shop info
  const shopName = getCleanSetting('shop_name')
  const shopAddress = getCleanSetting('shop_address')
  const shopPhone = getCleanSetting('shop_phone')
  const shopGstin = getCleanSetting('shop_gstin')
  const shopEmail = getCleanSetting('shop_email')
  const shopStateCode = getCleanSetting('shop_state_code')

  // Extract bank info
  const bankName = getCleanSetting('bank_name')
  const bankAccName = getCleanSetting('bank_account_name')
  const bankAccNum = getCleanSetting('bank_account_number')
  const bankIfsc = getCleanSetting('bank_ifsc')
  const bankUpi = getCleanSetting('bank_upi_id')
  const qrImagePath = getCleanSetting('qr_image_path')
  const invoiceTerms = getCleanSetting('invoice_terms')

  const hasBankDetails = bankName || bankAccName || bankAccNum || bankIfsc || bankUpi

  return (
    <div className={styles.overlay}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h2 className={styles.toolbarTitle}>Print Preview – Bill #{bill?.bill_number}</h2>
          {printHistory.count > 0 ? (
            <div className={styles.printMeta}>
              <Info size={16} />
              Printed <span>{printHistory.count} times</span>. Last: <span>{new Date(printHistory.prints[0].printed_at).toLocaleString('en-IN')}</span>
            </div>
          ) : (
            <div className={styles.printMeta}>
              <Info size={16} />
              Not printed yet.
            </div>
          )}
        </div>
        <div className={styles.toolbarRight}>
          <button className={styles.btnPrint} onClick={handlePrint}>
            <Printer size={16} /> Print Bill
          </button>
          <button className={styles.btnClose} onClick={onClose}>
            <X size={16} /> Close
          </button>
        </div>
      </div>

      <div id="bill-print-area" className={styles.printArea}>
        {/* Header Section */}
        <div className={styles.invoiceHeader}>
          <div className={styles.shopInfo}>
            <h1 className={styles.shopName}>{shopName || 'SHOP NAME'}</h1>
            {shopAddress && <p className={styles.shopDetail}>{shopAddress}</p>}
            {(shopPhone || shopEmail) && (
              <p className={styles.shopDetail}>
                {shopPhone && `Phone: ${shopPhone}`}
                {shopPhone && shopEmail && ' | '}
                {shopEmail && `Email: ${shopEmail}`}
              </p>
            )}
          </div>
          <div className={styles.gstinBox}>
            <div className={styles.gstinLabel}>GSTIN</div>
            <div className={styles.gstinValue}>{shopGstin || 'URD'}</div>
            {shopStateCode && <div className={styles.stateCode}>State Code: {shopStateCode}</div>}
          </div>
        </div>

        {/* Title */}
        <h2 className={styles.invoiceTitle}>Tax Invoice</h2>

        {/* Info Row */}
        <div className={styles.infoRow}>
          <div className={styles.infoGroup}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Invoice No:</span>
              <span className={styles.infoValue}>{bill.bill_number}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Date:</span>
              <span className={styles.infoValue}>{formatDate(bill.bill_date)}</span>
            </div>
            {bill.created_at && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Time:</span>
                <span className={styles.infoValue}>{formatTime(bill.created_at)}</span>
              </div>
            )}
          </div>
          <div className={styles.infoGroup}>
            {bill.vehicle_number && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Vehicle No:</span>
                <span className={styles.infoValue}>{bill.vehicle_number.toUpperCase()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Party Details */}
        <div className={styles.partyBox}>
          <div className={styles.partyTitle}>Billed To (Customer)</div>
          <div className={styles.partyName}>{bill.customer_name || 'Cash Customer'}</div>
          {bill.customer_phone && <div className={styles.partyDetail}>Phone: {bill.customer_phone}</div>}
          {customer?.address && (
            <div className={styles.partyDetail}>
              Address: {customer.address}
              {customer.city && `, ${customer.city}`}
              {customer.state && `, ${customer.state}`}
              {customer.pincode && ` - ${customer.pincode}`}
            </div>
          )}
          {customer?.gstin && <div className={styles.partyDetail}><strong>GSTIN:</strong> {customer.gstin}</div>}
        </div>

        {/* Items Table */}
        <table className={styles.itemsTable}>
          <thead>
            <tr>
              <th className={styles.colSr}>Sr.</th>
              <th className={styles.colItem}>Item Description</th>
              <th className={styles.colHsn}>HSN</th>
              <th className={styles.colQty}>Qty</th>
              <th className={styles.colUnit}>Unit</th>
              <th className={styles.colRate}>Rate</th>
              <th className={styles.colDisc}>Disc</th>
              <th className={styles.colTaxable}>Taxable Val</th>
              <th className={styles.colCgst}>CGST</th>
              <th className={styles.colSgst}>SGST</th>
              <th className={styles.colTotal}>Total</th>
            </tr>
          </thead>
          <tbody>
            {bill.items?.map((item: any, idx: number) => {
              const cgstRate = item.tax_rate / 2
              const sgstRate = item.tax_rate / 2
              return (
                <tr key={item.id || idx}>
                  <td>{idx + 1}</td>
                  <td className={styles.textLeft}>{item.item_name}</td>
                  <td>{item.hsn_code || '—'}</td>
                  <td>{item.quantity}</td>
                  <td>{item.unit || 'pcs'}</td>
                  <td className={styles.textRight}>{formatCurrency(item.rate)}</td>
                  <td className={styles.textRight}>{formatCurrency(item.discount_amount || 0)}</td>
                  <td className={styles.textRight}>{formatCurrency(item.taxable_amount)}</td>
                  <td className={styles.textRight}>
                    {item.cgst_amount > 0 ? (
                      <>
                        {cgstRate}%<br />
                        {formatCurrency(item.cgst_amount)}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={styles.textRight}>
                    {item.sgst_amount > 0 ? (
                      <>
                        {sgstRate}%<br />
                        {formatCurrency(item.sgst_amount)}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={styles.textRight}>{formatCurrency(item.line_total)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Summary Section */}
        <div className={styles.summarySection}>
          <table className={styles.summaryTable}>
            <tbody>
              <tr>
                <td>Subtotal</td>
                <td>{formatCurrency(bill.subtotal)}</td>
              </tr>
              {bill.discount_amount > 0 && (
                <tr>
                  <td>Total Discount</td>
                  <td>- {formatCurrency(bill.discount_amount)}</td>
                </tr>
              )}
              <tr>
                <td>Taxable Amount</td>
                <td>{formatCurrency(bill.taxable_amount)}</td>
              </tr>
              {bill.cgst_amount > 0 && (
                <tr>
                  <td>CGST Total</td>
                  <td>{formatCurrency(bill.cgst_amount)}</td>
                </tr>
              )}
              {bill.sgst_amount > 0 && (
                <tr>
                  <td>SGST Total</td>
                  <td>{formatCurrency(bill.sgst_amount)}</td>
                </tr>
              )}
              {bill.round_off !== 0 && (
                <tr>
                  <td>Round Off</td>
                  <td>{bill.round_off > 0 ? '+' : ''}{formatCurrency(bill.round_off)}</td>
                </tr>
              )}
              <tr className={styles.grandTotalRow}>
                <td>Grand Total</td>
                <td>₹ {formatCurrency(bill.grand_total)}</td>
              </tr>
              <tr>
                <td>Paid Amount</td>
                <td>{formatCurrency(bill.paid_amount)}</td>
              </tr>
              {bill.balance_due > 0 && (
                <tr style={{ color: 'var(--danger-500, #ef4444)', fontWeight: 'bold' }}>
                  <td>Balance Due</td>
                  <td>{formatCurrency(bill.balance_due)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Amount in Words */}
        <div className={styles.amountWords}>
          <strong>Amount in Words: </strong>
          <span className={styles.amountWordsValue}>{numberToWords(bill.grand_total)}</span>
        </div>

        {/* Bank & QR Details */}
        {(hasBankDetails || qrImagePath) && (
          <div className={styles.bankQrSection}>
            {hasBankDetails && (
              <div className={styles.bankDetails}>
                <div className={styles.bankTitle}>Bank Details</div>
                <table className={styles.bankTable}>
                  <tbody>
                    {bankAccName && (
                      <tr>
                        <td>Account Holder:</td>
                        <td>{bankAccName}</td>
                      </tr>
                    )}
                    {bankName && (
                      <tr>
                        <td>Bank Name:</td>
                        <td>{bankName}</td>
                      </tr>
                    )}
                    {bankAccNum && (
                      <tr>
                        <td>Account Number:</td>
                        <td>{bankAccNum}</td>
                      </tr>
                    )}
                    {bankIfsc && (
                      <tr>
                        <td>IFSC Code:</td>
                        <td>{bankIfsc}</td>
                      </tr>
                    )}
                    {bankUpi && (
                      <tr>
                        <td>UPI ID:</td>
                        <td>{bankUpi}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {qrImagePath && (
              <div className={styles.qrSection}>
                <img
                  className={styles.qrImage}
                  src={getQrPath(qrImagePath)}
                  alt="UPI QR Code"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
                <div className={styles.qrLabel}>Scan to Pay</div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            {invoiceTerms && (
              <div style={{ marginBottom: 10 }}>
                <strong>Terms &amp; Conditions:</strong>
                <p style={{ margin: '2px 0 0 0', whiteSpace: 'pre-line' }}>{invoiceTerms}</p>
              </div>
            )}
            <p>E. &amp; O.E.</p>
            <p>This is a computer-generated invoice.</p>
          </div>
          <div className={styles.footerRight}>
            <div className={styles.signatureShop}>For {shopName || 'Shop Name'}</div>
            <div className={styles.signatureLine}>Authorized Signatory</div>
          </div>
        </div>
      </div>
    </div>
  )
}
