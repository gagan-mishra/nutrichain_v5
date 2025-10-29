import axios from 'axios'
export const api = axios.create({ baseURL: 'http://localhost:4000' })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  const firmId = localStorage.getItem('firmId')
  const fyId = localStorage.getItem('fyId')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  if (firmId) cfg.headers['X-Firm-Id'] = firmId
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
