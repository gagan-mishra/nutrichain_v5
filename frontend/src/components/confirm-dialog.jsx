import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Trash2 } from 'lucide-react'
import { glass } from './primitives'

export default function ConfirmationDialog({ open, title, message, confirmLabel="Confirm", cancelLabel="Cancel", onConfirm, onCancel }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/60">
          <motion.div initial={{ scale: .95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: .95, opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 20 }} className={`w-full max-w-md rounded-2xl p-5 text-white ${glass}`}>
            <h3 className="text-base font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-white/80">{message}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={onCancel} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/5 ${glass}`}><X size={16}/> {cancelLabel}</button>
              <button onClick={onConfirm} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 ${glass} bg-white/10`}><Trash2 size={16}/> {confirmLabel}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
