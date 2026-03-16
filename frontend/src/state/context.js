import { create } from 'zustand'

function readJson(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeSelection(idKey, objKey, value) {
  if (value?.id != null) {
    localStorage.setItem(idKey, String(value.id))
    localStorage.setItem(objKey, JSON.stringify(value))
  } else {
    localStorage.removeItem(idKey)
    localStorage.removeItem(objKey)
  }
}

const initialFirm = readJson('firmCtx')
const initialFy = readJson('fyCtx')

export const useCtx = create(set => ({
  firm: initialFirm || null,
  fy: initialFy || null,
  setFirm: (firm) => { writeSelection('firmId', 'firmCtx', firm); set({ firm }) },
  setFy:   (fy)   => { writeSelection('fyId', 'fyCtx', fy); set({ fy }) },
}))
