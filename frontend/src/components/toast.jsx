// src/components/toast.jsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const ToastCtx = createContext(null);

let _id = 0;
const nextId = () => ++_id;

/** Public hook */
export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx.api;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((xs) => xs.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((message, variant = "info", opts = {}) => {
    const id = nextId();
    const t = {
      id,
      message,
      variant,                       // "success" | "error" | "info"
      duration: opts.duration ?? 2500,
    };
    setToasts((xs) => [t, ...xs]);
    return id;
  }, []);

  const api = useMemo(
    () => ({
      success: (m, o) => push(m, "success", o),
      error:   (m, o) => push(m, "error",   o),
      info:    (m, o) => push(m, "info",    o),
    }),
    [push]
  );

  return (
    <ToastCtx.Provider value={{ api }}>
      {children}
      <ToastViewport toasts={toasts} onRemove={remove} />
    </ToastCtx.Provider>
  );
}

/* =========================
   Viewport + Item
========================= */
function ToastViewport({ toasts, onRemove }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] flex items-start justify-center p-4 sm:p-6">
      <div className="flex w-full max-w-md flex-col gap-2 items-center">
        <AnimatePresence initial={false}>
          {toasts.map((t, i) => (
            <ToastItem
              key={t.id}
              toast={t}
              onRemove={() => onRemove(t.id)}
              index={i}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ToastItem({ toast, onRemove, index }) {
  const { message, variant, duration } = toast;
  const timerRef = useRef(null);
  const startRef = useRef(null);
  const remainingRef = useRef(duration);

  // auto-dismiss w/ pause-on-hover
  const startTimer = useCallback(() => {
    startRef.current = Date.now();
    timerRef.current = setTimeout(onRemove, remainingRef.current);
  }, [onRemove]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      const elapsed = Date.now() - startRef.current;
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    }
  }, []);

  useEffect(() => {
    startTimer();
    return () => timerRef.current && clearTimeout(timerRef.current);
  }, [startTimer]);

  // progress bar width anim
  const [progressKey] = useState(() => Math.random()); // reset when remounted

  const colors =
    variant === "success"
      ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-50"
      : variant === "error"
      ? "bg-rose-500/15 border-rose-400/30 text-rose-50"
      : "bg-white/10 border-white/15 text-white";

  const icon =
    variant === "success" ? "✅" : variant === "error" ? "⛔" : "ℹ️";

  return (
    <motion.div
      layout
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.12}
      onDragEnd={(_, info) => {
        if (info.offset.y < -30 || info.velocity.y < -300) onRemove();
      }}
      onMouseEnter={pauseTimer}
      onMouseLeave={startTimer}
      initial={{ opacity: 0, y: -14, scale: 0.98, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -14, scale: 0.98, filter: "blur(8px)" }}
      transition={{
        type: "spring",
        stiffness: 420,
        damping: 32,
        mass: 0.8,
        delay: Math.min(index * 0.04, 0.16), // slight stagger
      }}
      className={`pointer-events-auto w-full rounded-xl border px-4 py-3 shadow-2xl backdrop-blur ${colors}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <div className="select-none text-lg leading-none">{icon}</div>
        <div className="flex-1 text-sm">{message}</div>
        <button
          onClick={onRemove}
          className="ml-2 rounded-md px-2 py-1 text-xs text-white/70 hover:bg-white/10"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>

      {/* progress bar */}
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          key={progressKey}
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: duration / 1000, ease: "linear" }}
          className={`h-full ${variant === "error" ? "bg-rose-400/70" : variant === "success" ? "bg-emerald-400/70" : "bg-white/70"}`}
        />
      </div>
    </motion.div>
  );
}
