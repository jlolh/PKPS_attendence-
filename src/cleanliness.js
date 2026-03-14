import { doc, getDoc, setDoc, deleteField } from 'firebase/firestore'
import { db } from './firebase.js'

/**
 * 讀取某班某日的清潔狀態
 * @returns {'pass' | 'fail' | null}
 */
export async function loadCleanliness(classId, dateStr) {
  try {
    const snap = await getDoc(doc(db, 'cleanliness', `${dateStr}_${classId}`))
    return snap.exists() ? snap.data().status : null
  } catch (err) {
    console.error('loadCleanliness error:', err)
    return null
  }
}

/**
 * 儲存清潔狀態。status = 'pass' | 'fail' | null（null = 清除）
 */
export async function saveCleanliness(classId, dateStr, status) {
  const ref = doc(db, 'cleanliness', `${dateStr}_${classId}`)
  if (status === null) {
    await setDoc(ref, { classId, date: dateStr, status: deleteField() }, { merge: true })
  } else {
    await setDoc(ref, { classId, date: dateStr, status })
  }
}
