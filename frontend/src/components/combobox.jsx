import React, { useRef, useState, useLayoutEffect, useEffect } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useOutsideClick } from "./popover";

function useFloating(triggerRef, open) {
  const [style, setStyle] = useState({ left: 0, top: 0, width: 0 });

  useLayoutEffect(() => {
    let raf = 0;

    function place() {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const gap = 8;

      const left = Math.max(8, Math.min(r.left, window.innerWidth - r.width - 8));
      const top = Math.min(r.bottom + gap, window.innerHeight - 8);

      setStyle((prev) => {
        if (prev.left !== left || prev.top !== top || prev.width !== r.width) {
          return { left, top, width: r.width };
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
  }, [triggerRef, open]);

  return style;
}

export default function ComboBox({
  value,
  onChange,
  options,
  placeholder = "Select…",
  emptyText = "No matches",
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);
  useOutsideClick(panelRef, () => setOpen(false));
  const [activeIdx, setActiveIdx] = useState(0);

  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(q.toLowerCase())
  );

  const style = useFloating(btnRef, open);

  // Auto-focus search when opening
  useEffect(() => {
    if (open) {
      // give portal time to render
      const t = setTimeout(() => {
        try {
          searchRef.current?.focus();
          // place cursor at end
          const el = searchRef.current;
          if (el && typeof el.setSelectionRange === 'function') {
            const len = el.value?.length ?? 0;
            el.setSelectionRange(len, len);
          }
        } catch (_) {}
      }, 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Reset active index when query or open changes
  useEffect(() => { if (open) setActiveIdx(0); }, [q, open]);

  function scrollActiveIntoView() {
    try {
      const el = panelRef.current?.querySelector?.(`li[data-idx="${activeIdx}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    } catch(_) {}
  }

  return (
    <div className="relative z-[1] overflow-visible">
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          // typing should open and feed search
          const isChar = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
          if (isChar) {
            if (!open) setOpen(true);
            setQ((prev) => prev + e.key);
            e.preventDefault();
            return;
          }
          if (e.key === 'Backspace') {
            if (!open) setOpen(true);
            setQ((prev) => prev.slice(0, -1));
            e.preventDefault();
            return;
          }
          if (e.key === 'ArrowDown') {
            if (!open) setOpen(true);
            setActiveIdx((i) => {
              const ni = Math.min((filtered.length ? filtered.length - 1 : 0), i + 1);
              setTimeout(scrollActiveIntoView, 0);
              return ni;
            });
            e.preventDefault();
          }
          if (e.key === 'ArrowUp') {
            if (!open) setOpen(true);
            setActiveIdx((i) => {
              const ni = Math.max(0, i - 1);
              setTimeout(scrollActiveIntoView, 0);
              return ni;
            });
            e.preventDefault();
          }
        }}
        className="flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm
                   bg-white/5 backdrop-blur-sm border border-white/10
                   hover:bg-white/10 focus:ring-2 focus:ring-white/20 transition"
      >
        <span
          className={`truncate ${selected ? "text-white" : "text-white/60"}`}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} className="opacity-80" />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="
                fixed z-[100000] mt-2 rounded-2xl overflow-hidden
                bg-white/10 backdrop-blur-2xl backdrop-saturate-200
                border border-white/10 ring-1 ring-white/20
                shadow-[0_10px_50px_rgba(0,0,0,0.45)]
              "
              style={{ left: style.left, top: style.top, width: style.width }}
            >
              {/* Search header */}
              <div className="p-2">
                <div className="flex items-center gap-2 rounded-xl bg-white/10 border border-white/10 px-3 py-2">
                  <Search size={16} className="opacity-80" />
                  <input
                    ref={searchRef}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') { setOpen(false); }
                      if (e.key === 'Enter') {
                        const pick = filtered[Math.min(activeIdx, filtered.length-1)] || filtered[0];
                        if (pick) {
                          onChange(pick.value);
                          setOpen(false);
                          setQ("");
                          // Keep focus anchored on trigger so subsequent Tab advances correctly
                          setTimeout(() => { try { btnRef.current?.focus(); } catch(_){} }, 0);
                          e.preventDefault();
                        }
                      }
                      if (e.key === 'ArrowDown') {
                        setActiveIdx((i) => {
                          const ni = Math.min((filtered.length ? filtered.length - 1 : 0), i + 1);
                          setTimeout(scrollActiveIntoView, 0);
                          return ni;
                        });
                        e.preventDefault();
                      }
                      if (e.key === 'ArrowUp') {
                        setActiveIdx((i) => {
                          const ni = Math.max(0, i - 1);
                          setTimeout(scrollActiveIntoView, 0);
                          return ni;
                        });
                        e.preventDefault();
                      }
                      // Custom Tab handling: move to next/prev focusable relative to trigger button
                      if (e.key === 'Tab') {
                        e.preventDefault();
                        setOpen(false);
                        setTimeout(() => {
                          try {
                            // Select active match before moving on
                            const pick = filtered[Math.min(activeIdx, filtered.length-1)] || filtered[0];
                            if (pick) onChange(pick.value);
                            setQ("");
                            const selector = 'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
                            const form = btnRef.current?.closest('form');
                            const scope = form || document.getElementById('app-content') || document;
                            const all = Array.from(scope.querySelectorAll(selector))
                              .filter(el => !el.hasAttribute('disabled') && el.tabIndex !== -1 && el.offsetParent !== null);
                            const idx = all.indexOf(btnRef.current);
                            const nextIdx = e.shiftKey ? idx - 1 : idx + 1;
                            const target = all[nextIdx] || null;
                            target?.focus();
                          } catch (_) {}
                        }, 0);
                      }
                    }}
                    placeholder="Type to search…"
                    className="
    bg-transparent text-sm text-white placeholder:text-white/60
    outline-none flex-1
  "
                  />
                </div>
              </div>

              <div className="h-px bg-white/10 mx-2" />

              {/* Options */}
              <ul className="max-h-56 overflow-auto p-1">
                {filtered.map((o, i) => {
                  const active = value === o.value;
                  const hot = i === activeIdx;
                  return (
                    <li key={o.value} data-idx={i}>
                      <button
                        onClick={() => {
                          onChange(o.value);
                          setOpen(false);
                          setQ("");
                          // Return focus to trigger after mouse selection
                          setTimeout(() => { try { btnRef.current?.focus(); } catch(_){} }, 0);
                        }}
                        onMouseEnter={() => setActiveIdx(i)}
                        className={`
    w-full text-left rounded-xl px-3 py-2.5 text-sm
    flex items-center justify-between
    hover:bg-white/10 focus:bg-white/10
    ${hot ? 'bg-white/10' : ''}
    ${active ? "text-white" : "text-white"}
  `}
                      >
                        <span className="truncate">{o.label}</span>
                        {active && <Check size={16} className="opacity-90" />}
                      </button>
                    </li>
                  );
                })}

                {filtered.length === 0 && (
                  <li className="px-3 py-3 text-xs text-white/60">
                    {emptyText}
                  </li>
                )}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
