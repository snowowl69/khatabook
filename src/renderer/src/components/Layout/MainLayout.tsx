import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { useUIStore } from '../../stores/uiStore'
import styles from './MainLayout.module.css'

export default function MainLayout() {
  const { sidebarCollapsed } = useUIStore()

  return (
    <div className={`${styles.layout} ${sidebarCollapsed ? styles.collapsed : ''}`}>
      <Sidebar />
      <div className={styles.mainArea}>
        <TopBar />
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
