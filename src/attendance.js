import {
  collection, query, where, orderBy,
  getDocs, doc, setDoc, updateDoc, deleteField,
} from 'firebase/firestore'
import { db } from './firebase.js'
import { state } from './state.js'
import { showNotification } from './ui.js'

// --- 日期工具 ---

export function getTodayDateString() {
  const today = new Date()
  const offset = today.getTimezoneOffset()
  const local = new Date(today.getTime() - offset * 60 * 1000)
  return local.toISOString().split('T')[0]
}

// --- 載入班級按鈕 ---

export async function loadClasses() {
  const container = document.getElementById('class-buttons-container')
  const listContainer = document.getElementById('attendance-list-container')
  container.innerHTML = '<div class="loader">載入中...</div>'

  try {
    const snap = await getDocs(query(collection(db, 'classes'), orderBy('order')))
    state.classesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))

    container.innerHTML = ''
    if (state.classesCache.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-chalkboard"></i>
          <p>沒有班級資料。請先「班級管理」新增。</p>
        </div>`
      return
    }

    state.classesCache.forEach(cls => {
      const btn = document.createElement('button')
      btn.className = 'class-btn'
      btn.textContent = cls.name
      btn.dataset.classId = cls.id
      btn.addEventListener('click', handleClassButtonClick)
      container.appendChild(btn)
    })

    container.querySelector('.class-btn')?.click()
  } catch (error) {
    console.error('Error loading classes:', error)
    container.innerHTML = `<div class="empty-state" style="color:var(--danger-color);">${_classErrorMsg(error)}</div>`
  }
}

function handleClassButtonClick(event) {
  const btn = event.currentTarget
  state.currentClassId = btn.dataset.classId
  document.querySelectorAll('.class-btn').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  loadStudentData()
}

// --- 載入學生出席資料 ---

export async function loadStudentData() {
  const dateInput = document.getElementById('attendance-date')
  const listContainer = document.getElementById('attendance-list-container')
  const selectedDate = dateInput.value

  if (!state.currentClassId) {
    listContainer.innerHTML = `<div class="empty-state"><i class="fas fa-chalkboard"></i><p>請先選擇一個班級。</p></div>`
    return
  }
  if (!selectedDate) {
    listContainer.innerHTML = `<div class="empty-state"><i class="fas fa-calendar-alt"></i><p>請選擇點名日期。</p></div>`
    return
  }

  listContainer.innerHTML = '<div class="loader">載入中...</div>'

  try {
    const studentsSnap = await getDocs(
      query(collection(db, 'students'), where('classId', '==', state.currentClassId), orderBy('order'))
    )
    const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    if (students.length === 0) {
      listContainer.innerHTML = `<div class="empty-state"><i class="fas fa-user-graduate"></i><p>這個班級目前沒有學生。</p></div>`
      return
    }

    const recordsSnap = await getDocs(
      query(collection(db, 'records'),
        where('date', '==', selectedDate),
        where('studentId', 'in', students.map(s => s.id))
      )
    )

    const recordsMap = {}
    recordsSnap.forEach(d => {
      const data = d.data()
      recordsMap[data.studentId] = data
    })

    renderStudentList(students, recordsMap)
  } catch (error) {
    console.error('Error loading students:', error)
    listContainer.innerHTML = `<div class="empty-state" style="color:var(--danger-color);">${_studentErrorMsg(error)}</div>`
  }
}

// --- 渲染學生名單 ---

function renderStudentList(students, recordsMap) {
  const listContainer = document.getElementById('attendance-list-container')
  listContainer.innerHTML = '<div class="student-list"></div>'
  const listEl = listContainer.querySelector('.student-list')

  students.forEach(student => {
    const record = recordsMap[student.id] ?? {}
    const status = record.status ?? 'unknown'
    const score = record.score

    let scoreBtns = ''
    for (let i = 0; i <= 4; i++) {
      scoreBtns += `<button class="score-btn ${score === i ? 'active' : ''}" data-student-id="${student.id}" data-score="${i}">${i}</button>`
    }

    const item = document.createElement('div')
    item.className = 'student-card'
    item.innerHTML = `
      <div class="student-name">${student.name}</div>
      <div class="attendance-toggle">
        <button class="toggle-btn present ${status === 'present' ? 'active' : ''}" data-student-id="${student.id}" data-status="present">
          <i class="fas fa-check"></i> 出席
        </button>
        <button class="toggle-btn absent ${status === 'absent' ? 'active' : ''}" data-student-id="${student.id}" data-status="absent">
          <i class="fas fa-times"></i> 缺席
        </button>
      </div>
      <div class="score-buttons">${scoreBtns}</div>`
    listEl.appendChild(item)
  })

  listContainer.querySelectorAll('.toggle-btn').forEach(btn => btn.addEventListener('click', handleAttendanceClick))
  listContainer.querySelectorAll('.score-btn').forEach(btn => btn.addEventListener('click', handleScoreClick))
}

// --- 出席點擊 ---

async function handleAttendanceClick(event) {
  const button = event.currentTarget
  const { studentId, status } = button.dataset
  const selectedDate = document.getElementById('attendance-date').value
  const recordRef = doc(db, 'records', `${selectedDate}_${studentId}`)
  const parent = button.parentElement

  if (button.classList.contains('active')) {
    button.classList.remove('active')
    try {
      await updateDoc(recordRef, { status: deleteField() })
      showNotification('已取消出席記錄', 'info', 2000)
    } catch (err) {
      console.error(err)
      showNotification('操作失敗，請重試', 'error')
    }
    return
  }

  parent.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'))
  button.classList.add('active')

  try {
    await setDoc(recordRef, {
      studentId, date: selectedDate, classId: state.currentClassId, status,
    }, { merge: true })
    showNotification(`已標記為${status === 'present' ? '出席' : '缺席'}`, 'success', 2000)
  } catch (err) {
    console.error(err)
    button.classList.remove('active')
    showNotification('無法更新，網絡異常', 'error')
  }
}

// --- 得分點擊 ---

async function handleScoreClick(event) {
  const button = event.currentTarget
  const studentId = button.dataset.studentId
  const score = parseInt(button.dataset.score, 10)
  const selectedDate = document.getElementById('attendance-date').value
  const recordRef = doc(db, 'records', `${selectedDate}_${studentId}`)
  const parent = button.parentElement

  if (button.classList.contains('active')) {
    button.classList.remove('active')
    try {
      await updateDoc(recordRef, { score: deleteField() })
      showNotification('已移除得分', 'info', 2000)
    } catch (err) {
      console.error(err)
      showNotification('操作失敗', 'error')
    }
  } else {
    parent.querySelectorAll('.score-btn').forEach(b => b.classList.remove('active'))
    button.classList.add('active')
    try {
      await setDoc(recordRef, {
        studentId, date: selectedDate, classId: state.currentClassId, score,
      }, { merge: true })
      showNotification(`得分已設定為 ${score}`, 'success', 2000)
    } catch (err) {
      console.error(err)
      button.classList.remove('active')
      showNotification('無法更新得分', 'error')
    }
  }
}

// --- 錯誤訊息 ---

function _classErrorMsg(error) {
  if (error.code === 'permission-denied' || error.code === 'unauthenticated')
    return '<p><b>權限不足</b></p><p>請檢查 Firestore 安全性規則。</p>'
  if (error.code === 'failed-precondition')
    return '<p><b>缺少索引</b></p><p>請在瀏覽器 Console 點擊 Firebase 提供的索引建立連結。</p>'
  return '<p>班級加載失敗，請檢查網絡連線。</p>'
}

function _studentErrorMsg(error) {
  if (error.code === 'failed-precondition')
    return '<p><b>缺少索引</b></p><p>請在瀏覽器 Console 點擊 Firebase 提供的索引建立連結。</p>'
  if (error.code === 'permission-denied')
    return '<p><b>權限不足</b></p><p>請檢查 Firestore 安全性規則。</p>'
  return '<p>學生資料加載失敗，請檢查網絡連線。</p>'
}
