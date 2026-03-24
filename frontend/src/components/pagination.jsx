import React, { useEffect, useRef, useState } from "react";
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
  const showNav = pages > 1;

  const [jump, setJump] = useState(String(currentPage));
  useEffect(() => { setJump(String(currentPage)); }, [currentPage]);

  function goTo(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    const bounded = Math.min(pages, Math.max(1, Math.floor(n)));
    if (bounded !== currentPage) onPage?.(bounded);
  }

  return (
    <>
      <div className="sticky bottom-2 z-40 mb-4 mt-2 rounded-2xl border border-white/20 bg-slate-950/95 px-3 py-2 text-white/90 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs">
            Page {currentPage} of {pages} - {total} item{total === 1 ? "" : "s"}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onPageSize && (
              <RowsPicker
                value={pageSize}
                options={pageSizeOptions}
                onChange={onPageSize}
              />
            )}
            <button
              type="button"
              disabled={!showNav || !canPrev}
              onClick={() => canPrev && onPage(currentPage - 1)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs sm:text-sm ${showNav && canPrev ? "border-white/25 hover:bg-white/10" : "cursor-not-allowed border-white/10 opacity-50"}`}
            >
              Prev
            </button>
            <button
              type="button"
              disabled={!showNav || !canNext}
              onClick={() => canNext && onPage(currentPage + 1)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs sm:text-sm ${showNav && canNext ? "border-white/25 hover:bg-white/10" : "cursor-not-allowed border-white/10 opacity-50"}`}
            >
              Next
            </button>
            <div className="flex items-center gap-1 text-xs">
              <span className="opacity-80">Go</span>
              <input
                value={jump}
                onChange={(e) => setJump(e.target.value.replace(/[^\d]/g, ""))}
                onBlur={() => goTo(jump)}
                onKeyDown={(e) => { if (e.key === "Enter") goTo(jump); }}
                className="w-14 rounded-md border border-white/20 bg-black/25 px-2 py-1 text-center text-xs text-white outline-none focus:border-white/40"
                inputMode="numeric"
                aria-label="Go to page"
              />
            </div>
          </div>
        </div>
      </div>
      <div className="mb-[env(safe-area-inset-bottom)] h-14 sm:h-16" aria-hidden="true" />
    </>
  );
}

function RowsPicker({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="opacity-80">Rows</span>
      <div className="relative">
        <button
          ref={btnRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/15"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {value} v
        </button>
        <Popover open={open} onClose={() => setOpen(false)} anchorRef={btnRef} widthPx={140}>
          <ul className="max-h-60 overflow-auto p-1" role="listbox">
            {options.map((n) => (
              <li key={n}>
                <button
                  className={`w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-white/10 ${n === value ? "bg-white/10 text-white" : "text-white"}`}
                  onClick={() => { onChange(n); setOpen(false); }}
                  role="option"
                  aria-selected={n === value}
                >
                  {n} per page
                </button>
              </li>
            ))}
          </ul>
        </Popover>
      </div>
    </div>
  );
}
