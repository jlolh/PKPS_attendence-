import {
  collection, query, orderBy,
  getDocs, doc, addDoc, updateDoc, deleteDoc,
} from 'firebase/firestore'
import { db } from './firebase.js'
import { state } from './state.js'
import { showModal, hideModal, showConfirmationModal } from './ui.js'
import { loadStudentData } from './attendance.js'

// --- 編輯學生 ---

export function showEditStudentModal(id, currentName, currentClassId, currentOrder) {
  const options = state.classesCache.map(c =>
    `<option value="${c.id}" ${c.id === currentClassId ? 'selected' : ''}>${c.name}</option>`
  ).join('')

  showModal('編輯學生', `
    <div class="form-group">
      <label for="edit-student-name">學生姓名</label>
      <input type="text" id="edit-student-name" class="form-control" value="${currentName}" required>
    </div>
    <div class="form-group">
      <label for="edit-student-class">班級</label>
      <select id="edit-student-class" class="form-control">${options}</select>
    </div>
    <div class="form-group">
      <label for="edit-student-order">排序</label>
      <input type="number" id="edit-student-order" class="form-control" value="${currentOrder}" required>
    </div>
    <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
      <button id="save-edit-student-btn" class="btn btn-primary"><i class="fas fa-save"></i> 儲存</button>
    </div>
  `)

  document.getElementById('save-edit-student-btn').addEventListener('click', async () => {
    const newName = document.getElementById('edit-student-name').value.trim()
    const newClassId = document.getElementById('edit-student-class').value
    const newOrderInput = document.getElementById('edit-student-order').value
    const newOrder = parseInt(newOrderInput, 10)

    if (!newName || !newClassId || newOrderInput.trim() === '' || isNaN(newOrder)) {
      alert('學生姓名、班級和排序（必須是數字）為必填項。')
      return
    }
    try {
      await updateDoc(doc(db, 'students', id), { name: newName, classId: newClassId, order: newOrder })
      await loadStudentData()
      hideModal()
    } catch (err) {
      console.error('Error updating student:', err)
      alert('儲存失敗，請檢查主控台錯誤。')
    }
  })
}

// --- 學生管理 Modal ---

export async function showStudentManagementModal() {
  if (state.classesCache.length === 0) {
    showModal('學生管理', `
      <div class="empty-state">
        <i class="fas fa-chalkboard"></i>
        <p>請先在「班級管理」中建立至少一個班級，然後才能新增學生。</p>
      </div>`)
    return
  }

  const options = state.classesCache.map(c => `<option value="${c.id}">${c.name}</option>`).join('')

  showModal('學生管理', `
    <div id="student-management-list" style="max-height: 420px; overflow-y: auto;"></div>
    <form id="add-student-form" class="management-form">
      <input type="text" id="new-student-name" class="form-control" placeholder="新學生姓名" required style="flex-grow: 1; min-width: 120px;">
      <select id="new-student-class" class="form-control" style="width: 140px;">${options}</select>
      <input type="number" id="new-student-order" class="form-control" placeholder="排序" value="0" required style="width: 80px;">
      <button type="submit" class="btn btn-primary"><i class="fas fa-plus"></i> 新增</button>
    </form>
  `)
  await renderStudentList()

  document.getElementById('add-student-form').addEventListener('submit', async e => {
    e.preventDefault()
    const nameInput = document.getElementById('new-student-name')
    const classId = document.getElementById('new-student-class').value
    const orderInput = document.getElementById('new-student-order')
    const name = nameInput.value.trim()
    const order = parseInt(orderInput.value, 10)

    if (!name || !classId || isNaN(order)) { alert('請輸入有效的學生姓名、班級和排序數字。'); return }

    try {
      await addDoc(collection(db, 'students'), { name, classId, order })
      nameInput.value = ''
      orderInput.value = 0
      await renderStudentList()
      await loadStudentData()
      const listEl = document.getElementById('student-management-list')
      if (listEl) listEl.scrollTop = listEl.scrollHeight
    } catch (err) {
      console.error('Error adding student:', err)
    }
  })
}

async function renderStudentList() {
  const listEl = document.getElementById('student-management-list')
  listEl.innerHTML = '<div class="loader">載入中...</div>'

  try {
    const snap = await getDocs(query(collection(db, 'students'), orderBy('order')))
    listEl.innerHTML = ''

    if (snap.empty) {
      listEl.innerHTML = '<div class="empty-state">尚未建立任何學生。</div>'
      return
    }

    snap.docs.forEach(d => {
      const student = { id: d.id, ...d.data() }
      const className = state.classesCache.find(c => c.id === student.classId)?.name ?? '未知班級'
      const item = document.createElement('div')
      item.className = 'management-list-item'
      item.innerHTML = `
        <span class="management-list-item-name">
          ${student.name} <span style="color:var(--text-muted-color);font-size:0.8rem;">(${className} / 排序: ${student.order})</span>
        </span>
        <div class="management-list-item-actions">
          <button class="btn btn-primary btn-sm edit-stu-btn"
            data-id="${student.id}" data-name="${student.name}"
            data-class-id="${student.classId}" data-order="${student.order}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-danger btn-sm del-stu-btn" data-id="${student.id}" data-name="${student.name}">
            <i class="fas fa-trash"></i>
          </button>
        </div>`

      item.querySelector('.edit-stu-btn').addEventListener('click', e => {
        const { id, name, classId, order } = e.currentTarget.dataset
        showEditStudentModal(id, name, classId, order)
      })

      item.querySelector('.del-stu-btn').addEventListener('click', e => {
        const { id, name } = e.currentTarget.dataset
        showConfirmationModal('刪除學生', `確定要刪除學生「${name}」嗎？`, async () => {
          try {
            await deleteDoc(doc(db, 'students', id))
            await loadStudentData()
            hideModal()
          } catch (err) {
            console.error('Error deleting student:', err)
            alert('刪除失敗。')
            hideModal()
          }
        })
      })

      listEl.appendChild(item)
    })
  } catch (err) {
    console.error('Error rendering student list:', err)
    listEl.innerHTML = '<div class="empty-state" style="color:var(--danger-color);">無法載入學生列表。</div>'
  }
}
