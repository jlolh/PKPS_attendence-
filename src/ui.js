// --- Modal ---

export function showModal(title, content) {
  document.getElementById('modal-title').textContent = title
  document.getElementById('modal-body').innerHTML = content
  document.getElementById('modal-container').classList.add('show')
}

export function hideModal() {
  document.getElementById('modal-container').classList.remove('show')
}

export function showConfirmationModal(title, message, onConfirm) {
  showModal(title, `
    <p style="color: var(--text-muted-color); margin-top: 0;">${message}</p>
    <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
      <button id="confirm-cancel-btn" class="btn btn-ghost">取消</button>
      <button id="confirm-ok-btn" class="btn btn-danger">確定刪除</button>
    </div>
  `)
  document.getElementById('confirm-ok-btn').addEventListener('click', onConfirm)
  document.getElementById('confirm-cancel-btn').addEventListener('click', hideModal)
}

// --- 通知 Toast ---

export function showNotification(message, type = 'success', duration = 3000) {
  const colorMap = {
    success: 'var(--success-color)',
    error: 'var(--danger-color)',
    info: 'var(--info-color)',
  }
  const el = document.createElement('div')
  el.style.cssText = `
    position: fixed; top: 20px; right: 20px;
    padding: 0.85rem 1.25rem;
    background-color: ${colorMap[type] ?? colorMap.info};
    color: white; border-radius: 0.6rem;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    z-index: 2000; font-weight: 500; font-size: 0.9rem;
    animation: slideIn 0.3s ease;
  `
  el.textContent = message
  document.body.appendChild(el)

  if (duration > 0) {
    setTimeout(() => {
      el.style.animation = 'slideOut 0.3s ease'
      setTimeout(() => el.remove(), 300)
    }, duration)
  }
}
