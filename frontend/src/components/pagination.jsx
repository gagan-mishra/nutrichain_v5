import React, { useRef, useState } from "react";
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
  const canPrev = page > 1;
  const canNext = page < pages;
  const showNav = pages > 1;

  return (
    <>
      <div className="mt-3 mb-6 flex flex-wrap items-center justify-between gap-3 text-white/80">
        <div className="text-xs">
          Page {Math.min(page, pages)} of {pages} • {total} item{total === 1 ? '' : 's'}
        </div>
        <div className="flex items-center gap-3">
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
            onClick={() => canPrev && onPage(page - 1)}
            className={`rounded-lg px-3 py-1.5 text-sm border ${showNav && canPrev ? "hover:bg-white/10 border-white/20" : "opacity-50 border-white/10 cursor-not-allowed"}`}
          >
            Prev
          </button>
          <button
            type="button"
            disabled={!showNav || !canNext}
            onClick={() => canNext && onPage(page + 1)}
            className={`rounded-lg px-3 py-1.5 text-sm border ${showNav && canNext ? "hover:bg-white/10 border-white/20" : "opacity-50 border-white/10 cursor-not-allowed"}`}
          >
            Next
          </button>
        </div>
      </div>
      {/* bottom spacer to avoid hugging viewport/taskbar; keep even when one page */}
      <div className="h-20 sm:h-24 mb-[env(safe-area-inset-bottom)]" aria-hidden="true" />
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
          className="rounded-xl bg-white/10 border border-white/20 px-3 py-1.5 text-xs text-white hover:bg-white/15"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {value} ▾
        </button>
        <Popover open={open} onClose={() => setOpen(false)} anchorRef={btnRef} widthPx={140}>
          <ul className="max-h-60 overflow-auto p-1" role="listbox">
            {options.map((n) => (
              <li key={n}>
                <button
                  className={`w-full text-left rounded-lg px-3 py-2 text-xs hover:bg-white/10 ${n === value ? 'bg-white/10 text-white' : 'text-white'}`}
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
