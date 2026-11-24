import React, { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover } from "./popover";

export default function Pagination({
  total = 0,
  page = 1,
  pageSize = 10,
  onPage,
  onPageSize,
  pageSizeOptions = [10, 25, 50, 100],
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), pages);
  const canPrev = currentPage > 1;
  const canNext = currentPage < pages;

  const [jump, setJump] = useState(String(currentPage));
  useEffect(() => { setJump(String(currentPage)); }, [currentPage]);

  function goTo(value) {
    const n = value.trim() ? Number(value) : currentPage;
    const bounded = Number.isFinite(n) ? Math.min(pages, Math.max(1, Math.floor(n))) : currentPage;
    setJump(String(bounded));
    if (bounded !== currentPage) onPage?.(bounded);
  }

  return (
    <>
      <nav aria-label="Pagination" className="sticky bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-40 mt-2 rounded-xl border border-white/20 bg-slate-950/95 px-1 text-white/90 shadow-lg backdrop-blur md:mb-4 md:max-lg:rounded-2xl md:px-3 md:py-2 lg:py-1 lg:pointer-fine:[--field-height:2.25rem]">
        <div className="flex items-center justify-between gap-1 md:flex-wrap md:gap-3">
          <div className="sr-only text-xs md:not-sr-only">
            Page {currentPage} of {pages} - {total} item{total === 1 ? "" : "s"}
          </div>
          <div className="flex w-full min-w-0 items-center justify-end gap-0.5 md:w-auto md:flex-wrap md:gap-2">
            {onPageSize && (
              <RowsPicker
                value={pageSize}
                total={total}
                options={pageSizeOptions}
                onChange={onPageSize}
              />
            )}
            <button
              type="button"
              aria-label="Previous page"
              disabled={!canPrev}
              onClick={() => onPage?.(currentPage - 1)}
              className="grid size-11 shrink-0 place-items-center rounded-lg hover:enabled:bg-white/10 disabled:opacity-40 md:h-auto md:w-auto md:border md:border-white/20 md:px-2.5 md:py-1.5 md:text-sm"
            >
              <ChevronLeft className="md:hidden" size={18} /><span className="hidden md:inline">Prev</span>
            </button>
            <div className="flex min-w-0 items-center gap-1 text-xs tabular-nums">
              <span className="hidden opacity-80 md:inline">Go</span>
              <input
                value={jump}
                onChange={(e) => setJump(e.target.value.replace(/[^\d]/g, ""))}
                onBlur={() => goTo(jump)}
                onKeyDown={(e) => { if (e.key === "Enter") goTo(jump); }}
                className="w-11 rounded-lg border border-white/15 bg-white/5 px-1 text-center text-xs text-white outline-none focus:border-white/40 md:w-14"
                inputMode="numeric"
                aria-label="Go to page"
              />
              <span className="truncate text-white/65 md:hidden" title={`of ${pages} pages`}>/ {pages}</span>
            </div>
            <button type="button" aria-label="Next page" disabled={!canNext} onClick={() => onPage?.(currentPage + 1)}
              className="grid size-11 shrink-0 place-items-center rounded-lg hover:enabled:bg-white/10 disabled:opacity-40 md:h-auto md:w-auto md:border md:border-white/20 md:px-2.5 md:py-1.5 md:text-sm">
              <ChevronRight className="md:hidden" size={18} /><span className="hidden md:inline">Next</span>
            </button>
          </div>
        </div>
      </nav>
      <div className="mb-[env(safe-area-inset-bottom)] h-2 md:h-16" aria-hidden="true" />
    </>
  );
}

function RowsPicker({ value, options, onChange, total }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    (list.querySelector('[aria-selected="true"]') || list.querySelector("button"))?.focus({ preventScroll: true });
  }, [open]);

  function navigate(event) {
    if (event.key === "Tab") {
      // The menu lives in a portal; let Tab continue from its trigger in the toolbar.
      btnRef.current?.focus({ preventScroll: true });
      setOpen(false);
      return;
    }
    const buttons = Array.from(listRef.current.querySelectorAll("button"));
    const current = buttons.indexOf(event.target);
    const next = { ArrowUp: current - 1, ArrowDown: current + 1, Home: 0, End: buttons.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    buttons[Math.max(0, Math.min(next, buttons.length - 1))]?.focus();
  }

  return (
    <div className="mr-auto shrink-0 md:mr-0">
      <button ref={btnRef} type="button" onClick={() => setOpen(o => !o)}
        onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); }
        }}
        aria-label={`${value} rows per page`} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
        title={`Rows per page (${total.toLocaleString()} total)`}
        className="inline-flex min-h-11 w-24 items-center justify-center gap-1 rounded-lg text-sm tabular-nums text-white/80 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-white/60 md:min-h-9">
        {value} rows<ChevronDown size={12} aria-hidden="true" className={`text-white/55 motion-safe:transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <Popover compact open={open} onClose={() => setOpen(false)} anchorRef={btnRef} widthPx={null} placement="top-start">
        <div ref={listRef} id={listId} role="listbox" aria-label="Rows per page" onKeyDown={navigate}
          className="grid grid-cols-1">
          {options.map(n => (
            <button key={n} type="button" role="option" aria-selected={n === value} tabIndex={-1}
              onClick={() => { onChange(n); setOpen(false); btnRef.current?.focus({ preventScroll: true }); }}
              className="min-h-11 rounded-md text-sm tabular-nums text-white/65 hover:bg-white/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white/60 aria-selected:font-semibold aria-selected:text-white aria-selected:underline aria-selected:underline-offset-4">
              {n} rows
            </button>
          ))}
        </div>
      </Popover>
    </div>
  );
}
