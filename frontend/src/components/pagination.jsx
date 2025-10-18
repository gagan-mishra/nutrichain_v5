import React from "react";

export default function Pagination({ total = 0, page = 1, pageSize = 10, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < pages;

  if (total <= pageSize) return null;

  return (
    <>
      <div className="mt-3 mb-6 flex flex-wrap items-center justify-between gap-3 text-white/80">
        <div className="text-xs">
          Page {page} of {pages} • {total} items
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => canPrev && onPage(page - 1)}
            className={`rounded-lg px-3 py-1.5 text-sm border ${canPrev ? "hover:bg-white/10 border-white/20" : "opacity-50 border-white/10 cursor-not-allowed"}`}
          >
            Prev
          </button>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => canNext && onPage(page + 1)}
            className={`rounded-lg px-3 py-1.5 text-sm border ${canNext ? "hover:bg-white/10 border-white/20" : "opacity-50 border-white/10 cursor-not-allowed"}`}
          >
            Next
          </button>
        </div>
      </div>
      {/* bottom spacer to avoid hugging viewport/taskbar */}
      <div className="h-14 sm:h-16 mb-[env(safe-area-inset-bottom)]" aria-hidden="true" />
    </>
  );
}
