import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from './firebase.js'
import { state } from './state.js'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const MONTHS_ZH = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

let viewYear = new Date().getFullYear()
let viewMonth = new Date().getMonth()
let selectedDateStr = ''
let markedDates = new Set()
let calendarOpen = false

export function initCalendar(todayStr) {
  selectedDateStr = todayStr
  const d = new Date(todayStr + 'T00:00:00')
  viewYear = d.getFullYear()
  viewMonth = d.getMonth()
  _renderTrigger()
  _renderGrid()
}

function _renderTrigger() {
  const wrapper = document.getElementById('date-picker-wrapper')
  if (!wrapper) return
  wrapper.innerHTML = `
    <div id="cal-trigger" class="cal-trigger">
      <i class="fas fa-calendar-alt"></i>
      <span id="cal-trigger-text">${_fmtZh(selectedDateStr)}</span>
      <i class="fas fa-chevron-down"></i>
    </div>
    <div id="calendar-popup" class="calendar-popup">
      <div class="cal-nav">
        <button id="cal-prev" class="cal-nav-btn">&#8249;</button>
        <span id="cal-month-label" class="cal-month-label"></span>
        <button id="cal-next" class="cal-nav-btn">&#8250;</button>
      </div>
      <div class="cal-weekdays">
        ${WEEKDAYS.map(w => `<div class="cal-wd">${w}</div>`).join('')}
      </div>
      <div id="cal-days" class="cal-days"></div>
    </div>
  `

  document.getElementById('cal-trigger').addEventListener('click', e => {
    e.stopPropagation()
    _toggle()
  })
  document.getElementById('cal-prev').addEventListener('click', e => {
    e.stopPropagation()
    viewMonth--
    if (viewMonth < 0) { viewMonth = 11; viewYear-- }
    refreshMonthDots()
  })
  document.getElementById('cal-next').addEventListener('click', e => {
    e.stopPropagation()
    viewMonth++
    if (viewMonth > 11) { viewMonth = 0; viewYear++ }
    refreshMonthDots()
  })
  document.addEventListener('click', e => {
    if (!wrapper.contains(e.target)) _close()
  })
}

function _toggle() {
  calendarOpen ? _close() : _open()
}

function _open() {
  document.getElementById('calendar-popup')?.classList.add('open')
  calendarOpen = true
  _renderGrid()
}

function _close() {
  document.getElementById('calendar-popup')?.classList.remove('open')
  calendarOpen = false
}

function _renderGrid() {
  const label = document.getElementById('cal-month-label')
  const daysEl = document.getElementById('cal-days')
  if (!label || !daysEl) return

  label.textContent = `${viewYear}年 ${MONTHS_ZH[viewMonth]}`

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const todayStr = _todayISO()

  let html = ''
  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day empty"></div>`
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const cls = [
      'cal-day',
      ds === selectedDateStr ? 'selected' : '',
      ds === todayStr ? 'today' : '',
    ].filter(Boolean).join(' ')
    html += `<div class="${cls}" data-date="${ds}">
      ${d}
      ${markedDates.has(ds) ? '<span class="cal-dot"></span>' : ''}
    </div>`
  }
  daysEl.innerHTML = html
  daysEl.querySelectorAll('.cal-day:not(.empty)').forEach(el =>
    el.addEventListener('click', () => _selectDate(el.dataset.date))
  )
}

function _selectDate(dateStr) {
  selectedDateStr = dateStr
  const hidden = document.getElementById('attendance-date')
  if (hidden) {
    hidden.value = dateStr
    hidden.dispatchEvent(new Event('change'))
  }
  const text = document.getElementById('cal-trigger-text')
  if (text) text.textContent = _fmtZh(dateStr)
  _renderGrid()
  _close()
}

export async function refreshMonthDots() {
  if (!state.currentClassId) { _renderGrid(); return }
  const mm = String(viewMonth + 1).padStart(2, '0')
  const start = `${viewYear}-${mm}-01`
  const end   = `${viewYear}-${mm}-31`
  try {
    const snap = await getDocs(query(
      collection(db, 'records'),
      where('classId', '==', state.currentClassId),
      where('date', '>=', start),
      where('date', '<=', end),
    ))
    markedDates = new Set()
    snap.forEach(d => markedDates.add(d.data().date))
  } catch (e) {
    console.error('Calendar dots fetch failed:', e)
  }
  _renderGrid()
}

function _fmtZh(ds) {
  if (!ds) return '選擇日期'
  const [y, m, d] = ds.split('-')
  return `${y}年${parseInt(m)}月${parseInt(d)}日`
}

function _todayISO() {
  const t = new Date()
  const off = t.getTimezoneOffset()
  return new Date(t.getTime() - off * 60000).toISOString().split('T')[0]
}
