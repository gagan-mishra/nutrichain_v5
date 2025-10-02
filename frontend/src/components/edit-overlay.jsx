// src/components/edit-overlay.jsx
import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export default function EditOverlay({ open, title, onClose, children, footer }) {
  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="edit-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xl"
          onMouseDown={onClose}
        >
          <motion.div
            onMouseDown={(e) => e.stopPropagation()}
            initial={{ y: 16, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 8, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="mx-auto mt-10 w-[min(960px,92vw)] rounded-2xl border border-yellow-400/30 bg-white/10 text-white shadow-[0_20px_80px_rgba(0,0,0,0.55)]"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="text-sm font-semibold">
                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-yellow-400" /> {title}
              </div>
              <button
                onClick={onClose}
                className="rounded-lg px-2 py-1 text-white/80 hover:bg-white/10 border border-white/10"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-4 py-4">{children}</div>

            {footer && (
              <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
