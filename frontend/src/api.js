import axios from 'axios'
// Prefer VITE_API_BASE; fall back to legacy VITE_API_URL; default to localhost in dev
const baseURL = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || 'http://localhost:4000'
export const api = axios.create({ baseURL })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  const fyId = localStorage.getItem('fyId')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  // Firm is derived from JWT server-side for tenant isolation; only send FY filter
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
