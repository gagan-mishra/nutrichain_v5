import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { glass } from './primitives'
import { useToast } from './toast'
import { changePassword as changePasswordApi } from '../api'

export default function ChangePasswordDialog({ open, onClose }) {
  const toast = useToast()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e) => {
    e?.preventDefault()
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill all fields')
      return
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirm do not match')
      return
    }
    try {
      setSubmitting(true)
      await changePasswordApi(currentPassword, newPassword)
      toast.success('Password changed')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      onClose?.()
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || 'Failed to change password'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const onCancel = () => {
    if (submitting) return
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    onClose?.()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/60"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.form onSubmit={onSubmit}
                       initial={{ scale: .95, opacity: 0 }}
                       animate={{ scale: 1, opacity: 1 }}
                       exit={{ scale: .95, opacity: 0 }}
                       transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                       className={`w-full max-w-md rounded-2xl p-5 text-white ${glass}`}>
            <h3 className="text-base font-semibold">Change Password</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs text-white/70 mb-1">Current Password</label>
                <input type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}
                       className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20" />
              </div>
              <div>
                <label className="block text-xs text-white/70 mb-1">New Password</label>
                <input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)}
                       className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20" />
              </div>
              <div>
                <label className="block text-xs text-white/70 mb-1">Confirm New Password</label>
                <input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}
                       className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onCancel}
                      className={`rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/5 ${glass}`} disabled={submitting}>
                Cancel
              </button>
              <button type="submit"
                      className={`rounded-lg px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 ${glass} bg-white/10`}
                      disabled={submitting}>
                {submitting ? 'Saving…' : 'Change Password'}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

