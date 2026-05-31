import { Search, Bell, Sun, Moon, Lock, User } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { useAuthStore } from '../../stores/authStore'
import styles from './TopBar.module.css'

export default function TopBar() {
  const { theme, toggleTheme } = useUIStore()
  const { user, lock } = useAuthStore()

  return (
    <header className={styles.topbar}>
      <div className={styles.searchContainer}>
        <Search size={18} className={styles.searchIcon} />
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search bills, items, customers... (Ctrl+K)"
        />
        <kbd className={styles.kbd}>Ctrl+K</kbd>
      </div>

      <div className={styles.actions}>
        <button className={`btn-icon ${styles.actionBtn}`} title="Notifications">
          <Bell size={20} />
          <span className={styles.notifBadge}>3</span>
        </button>

        <button className={`btn-icon ${styles.actionBtn}`} onClick={toggleTheme} title="Toggle Theme">
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <button className={`btn-icon ${styles.actionBtn}`} onClick={lock} title="Lock App">
          <Lock size={20} />
        </button>

        <div className={styles.userSection}>
          <div className={styles.userAvatar}>
            <User size={18} />
          </div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.displayName || 'User'}</span>
            <span className={`badge badge-accent ${styles.userRole}`}>{user?.role || 'owner'}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
