import {
  collection, query, orderBy,
  getDocs, doc, addDoc, updateDoc, deleteDoc,
} from 'firebase/firestore'
import { db } from './firebase.js'
import { showModal, hideModal, showConfirmationModal } from './ui.js'
import { loadClasses } from './attendance.js'

// --- 編輯班級 ---

export function showEditClassModal(id, currentName, currentOrder) {
  showModal('編輯班級', `
    <div class="form-group">
      <label for="edit-class-name">班級名稱</label>
      <input type="text" id="edit-class-name" class="form-control" value="${currentName}" required>
    </div>
    <div class="form-group">
      <label for="edit-class-order">排序</label>
      <input type="number" id="edit-class-order" class="form-control" value="${currentOrder}" required>
    </div>
    <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
      <button id="save-edit-class-btn" class="btn btn-primary"><i class="fas fa-save"></i> 儲存</button>
    </div>
  `)

  document.getElementById('save-edit-class-btn').addEventListener('click', async () => {
    const newName = document.getElementById('edit-class-name').value.trim()
    const newOrderInput = document.getElementById('edit-class-order').value
    const newOrder = parseInt(newOrderInput, 10)

    if (!newName || newOrderInput.trim() === '' || isNaN(newOrder)) {
      alert('班級名稱和排序（必須是數字）為必填項。')
      return
    }
    try {
      await updateDoc(doc(db, 'classes', id), { name: newName, order: newOrder })
      await loadClasses()
      hideModal()
    } catch (err) {
      console.error('Error updating class:', err)
      alert('儲存失敗，請檢查主控台錯誤。')
    }
  })
}

// --- 班級管理 Modal ---

export async function showClassManagementModal() {
  showModal('班級管理', `
    <div id="class-management-list" style="max-height: 420px; overflow-y: auto;"></div>
    <form id="add-class-form" class="management-form">
      <input type="text" id="new-class-name" class="form-control" placeholder="新班級名稱" required style="flex-grow: 1;">
      <input type="number" id="new-class-order" class="form-control" placeholder="排序" value="0" required style="width: 90px;">
      <button type="submit" class="btn btn-primary"><i class="fas fa-plus"></i> 新增</button>
    </form>
  `)
  await renderClassList()

  document.getElementById('add-class-form').addEventListener('submit', async e => {
    e.preventDefault()
    const nameInput = document.getElementById('new-class-name')
    const orderInput = document.getElementById('new-class-order')
    const name = nameInput.value.trim()
    const order = parseInt(orderInput.value, 10)

    if (!name || isNaN(order)) { alert('請輸入有效的班級名稱和排序數字。'); return }

    try {
      await addDoc(collection(db, 'classes'), { name, order })
      nameInput.value = ''
      orderInput.value = 0
      await renderClassList()
      await loadClasses()
      const listEl = document.getElementById('class-management-list')
      if (listEl) listEl.scrollTop = listEl.scrollHeight
    } catch (err) {
      console.error('Error adding class:', err)
    }
  })
}

async function renderClassList() {
  const listEl = document.getElementById('class-management-list')
  listEl.innerHTML = '<div class="loader">載入中...</div>'

  try {
    const snap = await getDocs(query(collection(db, 'classes'), orderBy('order')))
    listEl.innerHTML = ''

    if (snap.empty) {
      listEl.innerHTML = '<div class="empty-state">尚未建立任何班級。</div>'
      return
    }

    snap.docs.forEach(d => {
      const cls = { id: d.id, ...d.data() }
      const item = document.createElement('div')
      item.className = 'management-list-item'
      item.innerHTML = `
        <span class="management-list-item-name">
          ${cls.name} <span style="color:var(--text-muted-color);font-size:0.8rem;">(排序: ${cls.order})</span>
        </span>
        <div class="management-list-item-actions">
          <button class="btn btn-primary btn-sm edit-cls-btn" data-id="${cls.id}" data-name="${cls.name}" data-order="${cls.order}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-danger btn-sm del-cls-btn" data-id="${cls.id}" data-name="${cls.name}">
            <i class="fas fa-trash"></i>
          </button>
        </div>`

      item.querySelector('.edit-cls-btn').addEventListener('click', e => {
        const { id, name, order } = e.currentTarget.dataset
        showEditClassModal(id, name, order)
      })

      item.querySelector('.del-cls-btn').addEventListener('click', e => {
        const { id, name } = e.currentTarget.dataset
        showConfirmationModal('刪除班級', `確定要刪除班級「${name}」嗎？此操作無法復原。`, async () => {
          try {
            await deleteDoc(doc(db, 'classes', id))
            await loadClasses()
            hideModal()
          } catch (err) {
            console.error('Error deleting class:', err)
            alert('刪除失敗。')
            hideModal()
          }
        })
      })

      listEl.appendChild(item)
    })
  } catch (err) {
    console.error('Error rendering class list:', err)
    listEl.innerHTML = '<div class="empty-state" style="color:var(--danger-color);">無法載入班級列表。</div>'
  }
}
