import { useState } from 'react'
import { Delete, User } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import styles from './PinLock.module.css'

export default function PinLock() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const { user, unlockWithPin, logout } = useAuthStore()

  const handleDigit = async (digit: string) => {
    if (pin.length >= 6) return
    const newPin = pin + digit
    setPin(newPin)
    setError('')

    if (newPin.length === 6) {
      const success = await unlockWithPin(newPin)
      if (!success) {
        setError('Invalid PIN')
        setShake(true)
        setTimeout(() => { setShake(false); setPin('') }, 600)
      }
    }
  }

  const handleBackspace = () => {
    setPin(pin.slice(0, -1))
    setError('')
  }

  const handleClear = () => {
    setPin('')
    setError('')
  }

  return (
    <div className={styles.container}>
      <div className={`${styles.card} ${shake ? styles.shake : ''}`}>
        <div className={styles.avatar}>
          <User size={32} />
        </div>
        <h2 className={styles.userName}>{user?.displayName || 'User'}</h2>
        <p className={styles.subtitle}>Enter PIN to unlock</p>

        <div className={styles.pinDisplay}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`${styles.pinDot} ${i < pin.length ? styles.filled : ''}`}>
              {i < pin.length && <span className={styles.dot} />}
            </div>
          ))}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.keypad}>
          {['1','2','3','4','5','6','7','8','9','clear','0','back'].map((key) => (
            <button
              key={key}
              className={`${styles.key} ${key === 'clear' || key === 'back' ? styles.keyAction : ''}`}
              onClick={() => {
                if (key === 'back') handleBackspace()
                else if (key === 'clear') handleClear()
                else handleDigit(key)
              }}
            >
              {key === 'back' ? <Delete size={20} /> : key === 'clear' ? 'C' : key}
            </button>
          ))}
        </div>

        <button className={styles.switchUser} onClick={logout}>
          Switch User
        </button>
      </div>
    </div>
  )
}
