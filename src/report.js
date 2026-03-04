import { collection, query, orderBy, where, getDocs } from 'firebase/firestore'
import * as XLSX from 'xlsx'
import { db } from './firebase.js'
import { showModal } from './ui.js'

// --- 報告 Modal ---

export function showReportModal() {
  const today = new Date()
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  showModal('全校月度報告', `
    <div style="display: flex; gap: 0.75rem; margin-bottom: 1rem;">
      <input type="month" id="report-month" class="date-picker" value="${currentMonth}" style="flex: 1;">
      <button id="generate-report-btn" class="btn btn-primary"><i class="fas fa-chart-bar"></i> 產生報告</button>
    </div>
    <div id="report-output" style="max-height: 60vh; overflow-y: auto;"></div>
  `)
  document.getElementById('generate-report-btn').addEventListener('click', generateReport)
}

// --- 產生報告 ---

async function generateReport() {
  const reportOutput = document.getElementById('report-output')
  const monthInput = document.getElementById('report-month').value
  if (!monthInput) { alert('請先選擇月份'); return }

  reportOutput.innerHTML = '<div class="loader">報告產生中...</div>'

  const [year, month] = monthInput.split('-').map(Number)
  const startDate = `${monthInput}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${monthInput}-${String(lastDay).padStart(2, '0')}`

  try {
    const [classesSnap, studentsSnap, recordsSnap] = await Promise.all([
      getDocs(query(collection(db, 'classes'), orderBy('order'))),
      getDocs(query(collection(db, 'students'), orderBy('order'))),
      getDocs(query(collection(db, 'records'), where('date', '>=', startDate), where('date', '<=', endDate))),
    ])

    if (recordsSnap.empty) {
      reportOutput.innerHTML = '<div class="empty-state"><i class="fas fa-file-alt"></i><p>該月份沒有任何記錄。</p></div>'
      return
    }

    const studentMap = new Map(studentsSnap.docs.map(d => [d.id, d.data()]))
    const allClasses = classesSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    // 建立 { classId: { studentId: { dateStr: {status, score} } } } 結構
    const reportData = {}
    recordsSnap.forEach(d => {
      const { classId, studentId, date, status, score } = d.data()
      if (!classId || !studentId || !date) return
      if (!reportData[classId]) reportData[classId] = {}
      if (!reportData[classId][studentId]) reportData[classId][studentId] = {}
      reportData[classId][studentId][date] = { status, score }
    })

    let grandAttendance = 0
    let grandScore = 0
    const excelAtt = {}
    const excelScore = {}
    let attHtml = '<h2>出席報告</h2>'
    let scoreHtml = '<h2 style="margin-top: 2.5rem;">得分報告</h2>'

    allClasses.forEach(cls => {
      const classData = reportData[cls.id]
      if (!classData || Object.keys(classData).length === 0) return

      const lastDataCol = XLSX.utils.encode_col(lastDay)
      const firstDataCol = 'B'

      const studentsInClass = Object.keys(classData).map(sid => {
        const info = studentMap.get(sid)
        return {
          id: sid,
          name: info ? info.name : `(已刪除學生 ID: ${sid.substring(0, 5)})`,
          order: info ? info.order : 999,
        }
      }).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))

      if (studentsInClass.length === 0) return

      const dayHeaders = Array.from({ length: lastDay }, (_, i) => String(i + 1))
      const attSheet = [['學生姓名', ...dayHeaders, '出席總計']]
      const scoreSheet = [['學生姓名', ...dayHeaders, '得分總計']]

      const dayTH = dayHeaders.map(d => `<th>${d}</th>`).join('')
      let attBody = `<h3 style="margin-top:24px;margin-bottom:12px;text-align:center;">${cls.name} - 出席報告</h3>
        <table class="report-table"><thead><tr><th>學生姓名</th>${dayTH}<th>出席總計</th></tr></thead><tbody>`
      let scoreBody = `<h3 style="margin-top:24px;margin-bottom:12px;text-align:center;">${cls.name} - 得分報告</h3>
        <table class="report-table"><thead><tr><th>學生姓名</th>${dayTH}<th>得分總計</th></tr></thead><tbody>`

      const dailyAtt = Array(lastDay + 1).fill(0)
      const dailyScore = Array(lastDay + 1).fill(0)
      let classAtt = 0
      let classScore = 0

      studentsInClass.forEach((student, i) => {
        const rowIdx = i + 2
        let attRow = `<tr><td>${student.name}</td>`
        let scoreRow = `<tr><td>${student.name}</td>`
        let stuAtt = 0
        let stuScore = 0
        const attExcel = [student.name]
        const scoreExcel = [student.name]

        for (let day = 1; day <= lastDay; day++) {
          const dateStr = `${monthInput}-${String(day).padStart(2, '0')}`
          const rec = classData[student.id]?.[dateStr]
          let attCell = '', scoreCell = '', scoreVal = null

          if (rec?.status === 'present') {
            attCell = '✓'
            stuAtt++
            dailyAtt[day]++
            if (typeof rec.score === 'number') {
              scoreCell = String(rec.score)
              scoreVal = rec.score
              stuScore += rec.score
              dailyScore[day] += rec.score
            }
          }
          attRow += `<td>${attCell}</td>`
          attExcel.push(attCell)
          scoreRow += `<td>${scoreCell}</td>`
          scoreExcel.push(scoreVal)
        }

        attRow += `<td>${stuAtt}</td></tr>`
        scoreRow += `<td>${stuScore}</td></tr>`
        attExcel.push({ f: `COUNTIF(${firstDataCol}${rowIdx}:${lastDataCol}${rowIdx},"✓")` })
        scoreExcel.push({ f: `SUM(${firstDataCol}${rowIdx}:${lastDataCol}${rowIdx})` })
        attSheet.push(attExcel)
        scoreSheet.push(scoreExcel)
        attBody += attRow
        scoreBody += scoreRow
        classAtt += stuAtt
        classScore += stuScore
      })

      const totalRow = studentsInClass.length + 2
      const firstDataRow = 2
      const lastDataRow = totalRow - 1
      const totalCol = XLSX.utils.encode_col(lastDay + 1)

      const attTotalExcel = ['當日出席總計',
        ...Array.from({ length: lastDay }, (_, i) => ({ f: `COUNTIF(${XLSX.utils.encode_col(i + 1)}${firstDataRow}:${XLSX.utils.encode_col(i + 1)}${lastDataRow},"✓")` })),
        { f: `SUM(${totalCol}${firstDataRow}:${totalCol}${lastDataRow})` },
      ]
      const scoreTotalExcel = ['當日得分總計',
        ...Array.from({ length: lastDay }, (_, i) => ({ f: `SUM(${XLSX.utils.encode_col(i + 1)}${firstDataRow}:${XLSX.utils.encode_col(i + 1)}${lastDataRow})` })),
        { f: `SUM(${totalCol}${firstDataRow}:${totalCol}${lastDataRow})` },
      ]
      attSheet.push(attTotalExcel)
      scoreSheet.push(scoreTotalExcel)

      const attDayTotals = Array.from({ length: lastDay }, (_, i) => `<td>${dailyAtt[i + 1]}</td>`).join('')
      const scoreDayTotals = Array.from({ length: lastDay }, (_, i) => `<td>${dailyScore[i + 1]}</td>`).join('')

      attBody += `<tr style="font-weight:bold;background-color:#eef2ff;"><td>當日出席總計</td>${attDayTotals}<td>${classAtt}</td></tr></tbody></table>`
      scoreBody += `<tr style="font-weight:bold;background-color:#eef2ff;"><td>當日得分總計</td>${scoreDayTotals}<td>${classScore}</td></tr></tbody></table>`

      excelAtt[cls.name] = attSheet
      excelScore[cls.name] = scoreSheet
      attHtml += attBody
      scoreHtml += scoreBody
      grandAttendance += classAtt
      grandScore += classScore
    })

    if (grandAttendance === 0 && grandScore === 0) {
      reportOutput.innerHTML = '<div class="empty-state"><i class="fas fa-file-alt"></i><p>該月份沒有任何記錄。</p></div>'
      return
    }

    const summary = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding:10px 0 16px;">
        <div style="font-size:0.95rem;font-weight:600;">
          全校總出席: <span style="color:var(--success-color);">${grandAttendance}</span> &nbsp;|&nbsp;
          總得分: <span style="color:var(--primary-color);">${grandScore}</span>
        </div>
        <button id="export-excel-btn" class="btn btn-success"><i class="fas fa-file-excel"></i> 匯出 Excel</button>
      </div>`
    reportOutput.innerHTML = summary + attHtml + scoreHtml
    document.getElementById('export-excel-btn').addEventListener('click', () => exportToExcel(excelAtt, excelScore, monthInput))

  } catch (error) {
    console.error('Error generating report:', error)
    reportOutput.innerHTML = '<div class="empty-state"><p style="color:var(--danger-color);">報告產生失敗，請稍後再試。</p></div>'
  }
}

// --- 匯出 Excel ---

function exportToExcel(attendanceData, scoreData, monthInput) {
  if (!Object.keys(attendanceData).length && !Object.keys(scoreData).length) {
    alert('沒有報告資料可匯出')
    return
  }

  const wb = XLSX.utils.book_new()

  for (const [name, data] of Object.entries(attendanceData)) {
    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = [{ wch: 20 }, ...Array(data[0].length - 2).fill({ wch: 4 }), { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws, `${name.substring(0, 20)} - 出席報告`)
  }

  for (const [name, data] of Object.entries(scoreData)) {
    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = [{ wch: 20 }, ...Array(data[0].length - 2).fill({ wch: 4 }), { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws, `${name.substring(0, 20)} - 得分報告`)
  }

  XLSX.writeFile(wb, `全校月度報告-${monthInput}.xlsx`)
}
