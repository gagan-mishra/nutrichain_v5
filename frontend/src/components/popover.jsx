import React, { useRef, useEffect, useLayoutEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

export function useOutsideClick(ref, onClick) {
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClick?.();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onClick]);
}

function useFloating(triggerRef, panelRef, open, widthPx = 288) {
  const [style, setStyle] = useState({ left: 0, top: 0, width: widthPx });

  useLayoutEffect(() => {
    let raf = 0;

    function place() {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const gap = 8;
      const w = widthPx || r.width;

      // Try to keep inside viewport; prefer aligning right edges if near right side
      let left = Math.min(r.left, Math.max(8, window.innerWidth - w - 8));
      if (r.right - w >= 8) left = r.right - w;

      // Measure panel height if available; fallback to a reasonable estimate.
      const ph = panelRef.current?.offsetHeight || Math.min(360, Math.floor(window.innerHeight * 0.5));
      const downTop = r.bottom + gap;
      const upTop = r.top - ph - gap;
      let top;
      if (downTop + ph <= window.innerHeight - 8) {
        // fits below
        top = downTop;
      } else if (upTop >= 8) {
        // fits above
        top = upTop;
      } else {
        // clamp within viewport
        top = Math.max(8, Math.min(downTop, window.innerHeight - ph - 8));
      }

      setStyle((prev) => {
        if (prev.left !== left || prev.top !== top || prev.width !== w) {
          return { left, top, width: w };
        }
        return prev;
      });
      raf = requestAnimationFrame(place);
    }

    if (open) {
      place();
      const onResize = () => cancelAnimationFrame(raf) || (raf = requestAnimationFrame(place));
      window.addEventListener("resize", onResize, { passive: true });
      return () => {
        window.removeEventListener("resize", onResize);
        cancelAnimationFrame(raf);
      };
    }
  }, [triggerRef, open, widthPx]);

  return style;
}

export function Popover({ open, onClose, anchorRef, widthPx = 288, children }) {
  const panelRef = useRef(null);
  useOutsideClick(panelRef, onClose);
  const style = useFloating(anchorRef, panelRef, open, widthPx);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="
            fixed z-[100000] rounded-2xl p-2 text-white
            bg-white/10 backdrop-blur-2xl backdrop-saturate-200
            border border-white/10 ring-1 ring-white/20
            shadow-[0_10px_50px_rgba(0,0,0,0.45)]
            max-h-[calc(100vh-16px)] overflow-auto
          "
          style={style}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
