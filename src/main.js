import './style.css'
import { initFirebase } from './firebase.js'
import { getTodayDateString, loadClasses, loadStudentData } from './attendance.js'
import { initCalendar } from './calendar.js'
import { showClassManagementModal } from './classes.js'
import { showStudentManagementModal } from './students.js'
import { showReportModal } from './report.js'
import { hideModal } from './ui.js'

async function main() {
  try {
    await initFirebase()
  } catch (error) {
    console.error('Firebase init failed:', error)
    document.body.innerHTML = `
      <div style="text-align:center; padding: 40px; color: #e11d48;">
        <h2>Firebase 連線失敗</h2>
        <p>${error.message}</p>
        <p style="font-size:0.85rem;color:#64748b;">請確認 Vercel 環境變數已正確設定，或本地 .env.local 檔案存在。</p>
      </div>`
    return
  }

  // --- 初始化日期、月曆與班級 ---
  const todayStr = getTodayDateString()
  const dateInput = document.getElementById('attendance-date')
  dateInput.value = todayStr
  dateInput.addEventListener('change', loadStudentData)

  initCalendar(todayStr)
  loadClasses()

  // --- 導覽列按鈕 (桌面 + 手機共用 handler) ---
  const onClasses  = e => { e.preventDefault(); showClassManagementModal() }
  const onStudents = e => { e.preventDefault(); showStudentManagementModal() }
  const onReport   = e => { e.preventDefault(); showReportModal() }

  document.getElementById('manage-classes-btn').addEventListener('click', onClasses)
  document.getElementById('manage-students-btn').addEventListener('click', onStudents)
  document.getElementById('view-report-btn').addEventListener('click', onReport)

  // 手機底部導覽
  document.getElementById('mobile-classes-btn')?.addEventListener('click', onClasses)
  document.getElementById('mobile-students-btn')?.addEventListener('click', onStudents)
  document.getElementById('mobile-report-btn')?.addEventListener('click', onReport)

  // --- Modal 關閉 ---
  const modalContainer = document.getElementById('modal-container')
  document.getElementById('modal-close-btn').addEventListener('click', hideModal)
  modalContainer.addEventListener('click', e => {
    if (e.target === modalContainer) hideModal()
  })

  // --- PWA Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('SW register failed:', err))
  }
}

main()
