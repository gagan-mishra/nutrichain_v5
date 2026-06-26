// src/components/toast.jsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";

const ToastCtx = createContext(null);

let _id = 0;
const nextId = () => ++_id;

const MAX_VISIBLE_TOASTS = 4;
const DEFAULT_DURATION = {
  success: 2800,
  info: 2600,
  error: 5000,
};

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
      variant,
      duration: opts.duration ?? DEFAULT_DURATION[variant] ?? 2200,
    };

    setToasts((xs) => [
      t,
      ...xs.filter((existing) => existing.message !== message || existing.variant !== variant),
    ].slice(0, MAX_VISIBLE_TOASTS));

    return id;
  }, []);

  const api = useMemo(
    () => ({
      success: (m, o) => push(m, "success", o),
      error: (m, o) => push(m, "error", o),
      info: (m, o) => push(m, "info", o),
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

function ToastViewport({ toasts, onRemove }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] flex items-start justify-center px-3 pt-12 sm:px-5 sm:pt-14">
      <div className="flex w-full max-w-sm flex-col gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t, i) => (
            <ToastItem key={t.id} toast={t} onRemove={() => onRemove(t.id)} index={i} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ToastItem({ toast, onRemove, index }) {
  const { message, variant, duration } = toast;
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setTimeout(onRemove, duration);
    return () => timerRef.current && clearTimeout(timerRef.current);
  }, [duration, onRemove]);

  const [progressKey] = useState(() => Math.random());

  const tone = {
    success: {
      wrap: "border-emerald-400/25 bg-slate-950/92 text-emerald-50 shadow-emerald-950/30",
      iconWrap: "bg-emerald-400/12 text-emerald-300 ring-emerald-300/20",
      bar: "bg-emerald-300",
      Icon: CheckCircle2,
    },
    error: {
      wrap: "border-rose-400/25 bg-slate-950/92 text-rose-50 shadow-rose-950/30",
      iconWrap: "bg-rose-400/12 text-rose-300 ring-rose-300/20",
      bar: "bg-rose-300",
      Icon: XCircle,
    },
    info: {
      wrap: "border-sky-400/25 bg-slate-950/92 text-sky-50 shadow-sky-950/30",
      iconWrap: "bg-sky-400/12 text-sky-300 ring-sky-300/20",
      bar: "bg-sky-300",
      Icon: Info,
    },
  }[variant] || {
    wrap: "border-white/15 bg-slate-950/92 text-white shadow-black/30",
    iconWrap: "bg-white/10 text-white ring-white/15",
    bar: "bg-white",
    Icon: Info,
  };

  const Icon = tone.Icon;

  return (
    <motion.div
      layout
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.12}
      onDragEnd={(_, info) => {
        if (info.offset.x > 40 || info.velocity.x > 450) onRemove();
      }}
      initial={{ opacity: 0, x: 22, scale: 0.98, filter: "blur(8px)" }}
      animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, x: 22, scale: 0.98, filter: "blur(8px)" }}
      transition={{
        type: "spring",
        stiffness: 520,
        damping: 36,
        mass: 0.7,
        delay: Math.min(index * 0.025, 0.075),
      }}
      className={`pointer-events-auto relative w-full overflow-hidden rounded-2xl border px-3.5 py-3 shadow-2xl backdrop-blur-xl ${tone.wrap}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 ${tone.iconWrap}`}>
          <Icon size={18} strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1 pt-1 text-sm font-medium leading-5 text-white/95">{message}</div>
        <button
          onClick={onRemove}
          className="rounded-lg p-1.5 text-white/55 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Dismiss"
        >
          <X size={15} />
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/10">
        <motion.div
          key={progressKey}
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: duration / 1000, ease: "linear" }}
          className={`h-full ${tone.bar}`}
        />
      </div>
    </motion.div>
  );
}
