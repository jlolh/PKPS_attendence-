import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export let db = null

export async function initFirebase() {
  if (!firebaseConfig.projectId) {
    throw new Error('Firebase 設定無效，請檢查環境變數是否已正確設定。')
  }
  const app = initializeApp(firebaseConfig)
  const auth = getAuth(app)
  db = getFirestore(app)
  await signInAnonymously(auth)
  console.log('Firebase 驗證成功。')
}
