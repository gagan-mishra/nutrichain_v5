import axios from 'axios'

// In production, always call '/api' so Vercel rewrites keep auth cookie first-party.
const envBase = import.meta.env.VITE_API_BASE
const baseURL = import.meta.env.PROD ? '/api' : (envBase || '/api')

if (import.meta.env.PROD && envBase && envBase !== '/api') {
  console.warn('Ignoring VITE_API_BASE in production; using /api for cookie auth compatibility.')
}

function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function prioritizeCurrentFyRows(rows) {
  const today = toDateStr(new Date())
  return [...rows].sort((a, b) => {
    const aStart = String(a?.startDate || '').slice(0, 10)
    const aEnd = String(a?.endDate || '').slice(0, 10)
    const bStart = String(b?.startDate || '').slice(0, 10)
    const bEnd = String(b?.endDate || '').slice(0, 10)

    const aCurrent = Boolean(aStart && aEnd && aStart <= today && today <= aEnd)
    const bCurrent = Boolean(bStart && bEnd && bStart <= today && today <= bEnd)
    if (aCurrent !== bCurrent) return aCurrent ? -1 : 1

    // otherwise keep latest FY first
    return bStart.localeCompare(aStart)
  })
}

export const api = axios.create({ baseURL, withCredentials: true })

// One-time cleanup of legacy token storage (cookie auth is now used).
try { localStorage.removeItem('token') } catch {}

api.interceptors.request.use((cfg) => {
  const fyId = localStorage.getItem('fyId')
  if (fyId) cfg.headers['X-Fy-Id'] = fyId
  return cfg
})

// Global 401/440 handler: auto-logout on expired/invalid session
let isLoggingOut = false
api.interceptors.response.use(
  (res) => {
    const url = String(res?.config?.url || '')
    if (url.includes('/firms/fiscal-years') && Array.isArray(res.data)) {
      res.data = prioritizeCurrentFyRows(res.data)
    }
    return res
  },
  (error) => {
    const status = error?.response?.status
    if (!isLoggingOut && (status === 401 || status === 440)) {
      try {
        isLoggingOut = true
        localStorage.removeItem('user')
        localStorage.removeItem('firmId')
        localStorage.removeItem('firmCtx')
        localStorage.removeItem('fyId')
        localStorage.removeItem('fyCtx')
      } finally {
        const url = new URL(window.location.href)
        if (url.pathname !== '/login') {
          window.location.replace('/login?expired=1')
        }
      }
    }
    return Promise.reject(error)
  }
)

// Auth helpers
export async function changePassword(currentPassword, newPassword) {
  return api.post('/auth/change-password', { currentPassword, newPassword })
}

export async function switchFirm(firmId) {
  return api.post('/auth/switch-firm', { firmId })
}

export async function logout() {
  try { await api.post('/auth/logout') } catch {}
  localStorage.removeItem('user')
  localStorage.removeItem('firmId')
  localStorage.removeItem('firmCtx')
  localStorage.removeItem('fyId')
  localStorage.removeItem('fyCtx')
}
