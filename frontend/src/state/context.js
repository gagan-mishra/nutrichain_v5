import { create } from 'zustand'

export const useCtx = create(set => ({
  firm: null,
  fy: null,
  setFirm: (firm) => { localStorage.setItem('firmId', firm?.id ?? ''); set({ firm }) },
  setFy:   (fy)   => { localStorage.setItem('fyId', fy?.id ?? '');   set({ fy }) },
}))
