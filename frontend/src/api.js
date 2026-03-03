import axios from 'axios'

// Always use /api prefix — Vite proxy (dev) and Vercel rewrite (prod) both strip it
const baseURL = import.meta.env.VITE_API_BASE || '/api'
export const api = axios.create({ baseURL, withCredentials: true })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  const fyId = localStorage.getItem('fyId')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  if (fyId) cfg.headers['X-Fy-Id'] = fyId
  return cfg
})

// Global 401/440 handler: auto-logout on expired/invalid session
let isLoggingOut = false
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status
    if (!isLoggingOut && (status === 401 || status === 440)) {
      try {
        isLoggingOut = true
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        localStorage.removeItem('firmId')
        localStorage.removeItem('fyId')
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
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  localStorage.removeItem('firmId')
  localStorage.removeItem('fyId')
}
