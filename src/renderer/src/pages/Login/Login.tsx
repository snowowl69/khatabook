import { useState } from 'react'
import { User, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import styles from './Login.module.css'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const login = useAuthStore((s) => s.login)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password')
      triggerShake()
      return
    }

    setLoading(true)
    setError('')

    try {
      const success = await login(username, password)
      if (!success) {
        setError('Invalid username or password')
        triggerShake()
      }
    } catch {
      setError('An unexpected error occurred')
      triggerShake()
    } finally {
      setLoading(false)
    }
  }

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 600)
  }

  return (
    <div className={styles.container}>
      {/* Animated gradient orbs in background */}
      <div className={styles.bgOrb1} />
      <div className={styles.bgOrb2} />
      <div className={styles.bgOrb3} />

      <form
        className={`${styles.card} ${shake ? styles.shake : ''}`}
        onSubmit={handleSubmit}
      >
        {/* Logo */}
        <div className={styles.logoSection}>
          <h1 className={styles.logo}>Khata</h1>
          <p className={styles.tagline}>Smart Billing for Smart Shopkeepers</p>
        </div>

        {/* Username */}
        <div className={styles.inputGroup}>
          <User size={18} className={styles.inputIcon} />
          <input
            type="text"
            className={styles.input}
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            disabled={loading}
          />
        </div>

        {/* Password */}
        <div className={styles.inputGroup}>
          <Lock size={18} className={styles.inputIcon} />
          <input
            type={showPassword ? 'text' : 'password'}
            className={styles.input}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          <button
            type="button"
            className={styles.eyeBtn}
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {/* Error */}
        {error && <p className={styles.error}>{error}</p>}

        {/* Submit */}
        <button type="submit" className={styles.loginBtn} disabled={loading}>
          {loading ? (
            <Loader2 size={20} className={styles.spinner} />
          ) : (
            'Login'
          )}
        </button>

        {/* Footer */}
        <p className={styles.footer}>Secure • Fast • Reliable</p>
        <p className={styles.hint}>Default: owner / khata@123</p>
      </form>
    </div>
  )
}
