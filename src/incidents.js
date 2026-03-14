import {
  collection, query, orderBy,
  getDocs, addDoc, deleteDoc, doc,
} from 'firebase/firestore'
import { db } from './firebase.js'
import { showModal } from './ui.js'

const STAFF_PASSWORD = '4501'

function _esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDatetime(datetimeStr) {
  if (!datetimeStr) return ''
  const d = new Date(datetimeStr)
  return d.toLocaleString('zh-HK', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// --- 密碼登入 ---

export function showStaffLoginModal() {
  showModal('職員專區', `
    <div class="staff-login">
      <div class="staff-login-icon"><i class="fas fa-lock"></i></div>
      <p class="staff-login-hint">請輸入職員密碼</p>
      <div class="form-group">
        <input type="password" id="staff-password" class="form-control"
          placeholder="密碼" autocomplete="current-password" style="text-align:center;letter-spacing:4px;font-size:1.2rem;">
      </div>
      <div id="staff-login-error" style="color:var(--danger);font-size:0.85rem;text-align:center;min-height:1.2em;"></div>
      <div style="display:flex;justify-content:center;margin-top:0.75rem;">
        <button id="staff-login-btn" class="btn btn-primary" style="min-width:120px;">
          <i class="fas fa-sign-in-alt"></i> 登入
        </button>
      </div>
    </div>
  `)

  const input = document.getElementById('staff-password')
  const btn   = document.getElementById('staff-login-btn')
  const errEl = document.getElementById('staff-login-error')
  input.focus()

  const tryLogin = () => {
    if (input.value === STAFF_PASSWORD) {
      showStaffPanel()
    } else {
      input.value = ''
      errEl.textContent = '密碼錯誤，請重試'
      input.focus()
    }
  }

  btn.addEventListener('click', tryLogin)
  input.addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin() })
}

// --- 職員面板 ---

async function showStaffPanel() {
  const now = new Date()
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 16)

  showModal('職員專區 — 突發情況紀錄', `
    <form id="add-incident-form" class="incident-form">
      <div class="incident-form-grid">
        <div class="form-group">
          <label>發生日期時間</label>
          <input type="datetime-local" id="incident-datetime" class="form-control" value="${localNow}" required>
        </div>
        <div class="form-group">
          <label>學生姓名</label>
          <input type="text" id="incident-student" class="form-control" placeholder="學生姓名" required>
        </div>
      </div>
      <div class="form-group">
        <label>突發情況描述</label>
        <textarea id="incident-desc" class="form-control" rows="2" placeholder="描述突發情況…" required></textarea>
      </div>
      <div class="form-group">
        <label>處理方式</label>
        <textarea id="incident-handling" class="form-control" rows="2" placeholder="描述處理方式…" required></textarea>
      </div>
      <div class="incident-form-actions">
        <button type="button" id="export-incidents-btn" class="btn btn-secondary">
          <i class="fas fa-file-alt"></i> 匯出 TXT
        </button>
        <button type="submit" class="btn btn-primary">
          <i class="fas fa-plus"></i> 新增紀錄
        </button>
      </div>
    </form>
    <div id="incidents-list" class="incidents-list"></div>
  `)

  await renderIncidents()

  document.getElementById('add-incident-form').addEventListener('submit', async e => {
    e.preventDefault()
    const btn = e.submitter
    btn.disabled = true

    const datetime = document.getElementById('incident-datetime').value
    const student  = document.getElementById('incident-student').value.trim()
    const desc     = document.getElementById('incident-desc').value.trim()
    const handling = document.getElementById('incident-handling').value.trim()

    try {
      await addDoc(collection(db, 'incidents'), {
        datetime,
        studentName: student,
        description: desc,
        handling,
        createdAt: new Date().toISOString(),
      })
      document.getElementById('incident-student').value = ''
      document.getElementById('incident-desc').value = ''
      document.getElementById('incident-handling').value = ''
      await renderIncidents()
    } catch (err) {
      console.error('Error adding incident:', err)
      alert('新增失敗，請重試。')
    } finally {
      btn.disabled = false
    }
  })

  document.getElementById('export-incidents-btn').addEventListener('click', exportIncidentsTxt)
}

// --- 渲染紀錄列表 ---

async function renderIncidents() {
  const listEl = document.getElementById('incidents-list')
  if (!listEl) return
  listEl.innerHTML = '<div class="loader">載入中…</div>'

  try {
    const snap = await getDocs(query(collection(db, 'incidents'), orderBy('datetime', 'desc')))

    if (snap.empty) {
      listEl.innerHTML = '<div class="empty-state">尚無突發情況紀錄。</div>'
      return
    }

    listEl.innerHTML = ''
    snap.docs.forEach(d => {
      const data = { id: d.id, ...d.data() }
      const item = document.createElement('div')
      item.className = 'incident-item'
      item.innerHTML = `
        <div class="incident-item-header">
          <div class="incident-meta">
            <span class="incident-datetime"><i class="fas fa-clock"></i> ${formatDatetime(data.datetime)}</span>
            <span class="incident-student"><i class="fas fa-user"></i> ${_esc(data.studentName)}</span>
          </div>
          <button class="btn btn-danger btn-sm del-incident-btn" data-id="${_esc(data.id)}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
        <div class="incident-item-body">
          <div class="incident-field">
            <span class="incident-field-label">突發情況</span>
            <span class="incident-field-value">${_esc(data.description)}</span>
          </div>
          <div class="incident-field">
            <span class="incident-field-label">處理方式</span>
            <span class="incident-field-value">${_esc(data.handling)}</span>
          </div>
        </div>
      `
      item.querySelector('.del-incident-btn').addEventListener('click', async e => {
        if (!confirm('確定刪除此突發情況紀錄？')) return
        const btn = e.currentTarget
        btn.disabled = true
        try {
          await deleteDoc(doc(db, 'incidents', btn.dataset.id))
          await renderIncidents()
        } catch (err) {
          console.error('Delete incident error:', err)
          alert('刪除失敗。')
          btn.disabled = false
        }
      })
      listEl.appendChild(item)
    })
  } catch (err) {
    console.error('renderIncidents error:', err)
    listEl.innerHTML = '<div class="empty-state" style="color:var(--danger);">載入失敗。</div>'
  }
}

// --- 匯出 TXT ---

async function exportIncidentsTxt() {
  try {
    const snap = await getDocs(query(collection(db, 'incidents'), orderBy('datetime', 'desc')))
    if (snap.empty) { alert('沒有紀錄可匯出。'); return }

    const sep = '─'.repeat(42)
    const lines = [
      'PKPS 突發情況紀錄',
      `匯出時間：${formatDatetime(new Date().toISOString().slice(0, 16))}`,
      sep,
      '',
    ]

    snap.docs.forEach((d, i) => {
      const data = d.data()
      lines.push(`紀錄 #${i + 1}`)
      lines.push(`日期時間：${formatDatetime(data.datetime)}`)
      lines.push(`學生姓名：${data.studentName}`)
      lines.push(`突發情況：${data.description}`)
      lines.push(`處理方式：${data.handling}`)
      lines.push(sep)
    })

    const content = lines.join('\n')
    const blob = new Blob(['\uFEFF' + content], { type: 'text/plain;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `突發情況紀錄_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Export failed:', err)
    alert('匯出失敗。')
  }
}
