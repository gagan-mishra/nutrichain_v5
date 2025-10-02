import React, { useRef, useState } from "react";
import { Building2, ChevronDown, Check } from "lucide-react";
import { Popover } from "./popover";

export function FirmPill({ firm, firms, onPick }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const btnRef = useRef(null);
  const filtered = firms.filter((f) =>
    f.name.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm
                   bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10"
      >
        <Building2 size={16} />
        <span className="font-medium truncate max-w-[180px]">
          {firm?.name || "Select Firm"}
        </span>
        <ChevronDown size={14} className="opacity-70" />
      </button>

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={btnRef} widthPx={288}>
        <div className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2 bg-white/10 border border-white/10">
          <span className="text-xs text-white/70">🔎</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search firms…"
            className="bg-transparent text-sm outline-none placeholder:text-white/60 flex-1"
          />
        </div>
        <ul className="max-h-64 overflow-auto">
          {filtered.map((f) => (
            <li key={f.id}>
              <button
                onClick={() => {
                  onPick(f);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm hover:bg-white/10"
              >
                <span className="truncate">{f.name}</span>
                {firm?.id === f.id && <Check size={16} className="opacity-90" />}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-xs text-white/60">No firms</div>
          )}
        </ul>
      </Popover>
    </div>
  );
}

export function FyPill({ fy, fys, onPick }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm
                   bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10"
      >
        <CalendarBadge fy={fy} />
        <ChevronDown size={14} className="opacity-70" />
      </button>

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={btnRef} widthPx={288}>
        <ul className="max-h-64 overflow-auto">
          {fys.map((f) => (
            <li key={f.id}>
              <button
                onClick={() => {
                  onPick(f);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm hover:bg-white/10"
              >
                <span>FY {f.label}</span>
                {fy?.id === f.id && <Check size={16} className="opacity-90" />}
              </button>
            </li>
          ))}
        </ul>
      </Popover>
    </div>
  );
}

export function CalendarBadge({ fy }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="17" rx="3" stroke="currentColor" opacity="0.85" />
        <path d="M3 9H21" stroke="currentColor" opacity="0.85" />
      </svg>
      <span className="font-semibold tracking-wide">{fy?.label || "Select FY"}</span>
    </div>
  );
}
