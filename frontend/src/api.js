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
