import './style.css'
import { initFirebase } from './firebase.js'
import { getTodayDateString, loadClasses, loadStudentData } from './attendance.js'
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
      <div style="text-align:center; padding: 40px; color: #f43f5e;">
        <h2>Firebase 連線失敗</h2>
        <p>${error.message}</p>
        <p style="font-size:0.85rem;color:#64748b;">請確認 Vercel 環境變數已正確設定，或本地 .env.local 檔案存在。</p>
      </div>`
    return
  }

  // --- 初始化日期與班級 ---
  const dateInput = document.getElementById('attendance-date')
  dateInput.value = getTodayDateString()
  dateInput.addEventListener('change', loadStudentData)
  loadClasses()

  // --- 導覽列按鈕 ---
  document.getElementById('manage-classes-btn').addEventListener('click', e => {
    e.preventDefault()
    showClassManagementModal()
  })
  document.getElementById('manage-students-btn').addEventListener('click', e => {
    e.preventDefault()
    showStudentManagementModal()
  })
  document.getElementById('view-report-btn').addEventListener('click', e => {
    e.preventDefault()
    showReportModal()
  })

  // --- Modal 關閉 ---
  const modalContainer = document.getElementById('modal-container')
  document.getElementById('modal-close-btn').addEventListener('click', hideModal)
  modalContainer.addEventListener('click', e => {
    if (e.target === modalContainer) hideModal()
  })
}

main()
