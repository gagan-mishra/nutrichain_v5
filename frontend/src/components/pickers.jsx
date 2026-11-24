import React, { useId, useRef, useState } from "react";
import { Building2, CalendarDays, ChevronDown, Check } from "lucide-react";
import { Popover } from "./popover";
import SearchBox from "./search-box";
import SidebarDisclosure from "./sidebar-disclosure";

export function DrawerContext({ firm, firms = [], fy, fys = [], onFirm, onFy, disabled, duration }) {
  const [expanded, setExpanded] = useState(null);
  const [query, setQuery] = useState("");
  const id = useId();
  const fields = [
    { key: "firm", label: "Firm", selected: firm, options: firms, text: "name", pick: onFirm },
    { key: "fy", label: "Financial year", selected: fy, options: fys, text: "label", pick: onFy },
  ];

  return (
    <div className="mb-3 space-y-1 rounded-2xl border border-white/10 bg-white/5 p-2">
      {fields.map(({ key, label, selected, options, text, pick }) => {
        const open = expanded === key;
        const fieldId = id + key;
        const shown = key === "firm" && open
          ? options.filter(option => option.name.toLowerCase().includes(query.trim().toLowerCase()))
          : options;
        return (
          <div key={key} onKeyDown={event => {
            if (open && event.key === "Escape") {
              event.stopPropagation();
              setExpanded(null);
              event.currentTarget.querySelector("button").focus({ preventScroll: true });
            }
          }}>
            <button type="button" disabled={disabled} aria-expanded={open} aria-controls={fieldId}
              onClick={() => { setExpanded(open ? null : key); setQuery(""); }}
              className="flex min-h-12 w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left hover:bg-white/5 disabled:opacity-60">
              <span className="min-w-0">
                <span className="block text-xs text-white/60">{label}</span>
                <span className="block break-words text-sm font-semibold">{selected?.[text] || "Select"}</span>
              </span>
              <ChevronDown size={16} aria-hidden="true" className={`shrink-0 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
            </button>
            <SidebarDisclosure open={open} id={fieldId} duration={duration}>
              <div className="rounded-xl border border-white/10 bg-slate-950/70 p-1">
                {key === "firm" && (
                  <SearchBox inset className="mb-1" placeholder="Search firms" type="search" value={query}
                    onChange={event => setQuery(event.target.value)} />
                )}
                <ul aria-label={label} className="max-h-[min(14rem,40dvh)] overflow-y-auto overscroll-contain">
                  {shown.map(option => {
                    const current = String(option.id) === String(selected?.id);
                    return (
                      <li key={option.id}>
                        <button type="button" disabled={disabled} aria-current={current || undefined}
                          className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10 ${current ? "bg-white/10" : ""}`}
                          onClick={() => { setExpanded(null); pick(option); }}>
                          <span className="min-w-0 break-words">{option[text]}</span>
                          {current && <Check size={16} aria-hidden="true" className="shrink-0" />}
                        </button>
                      </li>
                    );
                  })}
                  {!shown.length && <li className="px-3 py-2 text-sm text-white/60">{key === "firm" ? "No matching firms" : "No financial years"}</li>}
                </ul>
              </div>
            </SidebarDisclosure>
          </div>
        );
      })}
    </div>
  );
}

export function FirmPill({ firm, firms, onPick, disabled = false }) {
  return <DesktopContextPicker label="Firm" icon={<Building2 size={14} />} textKey="name" width="w-max min-w-44 max-w-[clamp(14rem,21vw,20rem)]" searchable
    selected={firm} options={firms} onPick={onPick} disabled={disabled} />;
}

export function FyPill({ fy, fys, onPick, disabled = false }) {
  return <DesktopContextPicker label="Financial year" icon={<CalendarDays size={14} />} textKey="label" width="w-28 shrink-0"
    selected={fy} options={fys} onPick={onPick} disabled={disabled} />;
}

function DesktopContextPicker({ label, icon, textKey, width, searchable, selected, options, onPick, disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const btnRef = useRef(null);
  const id = useId();
  const caption = selected?.[textKey] || (searchable ? "Select firm" : "Select FY");
  const term = query.trim().toLowerCase();
  const shown = term ? options.filter(item => item[textKey].toLowerCase().includes(term)) : options;

  return (
    <div className={`relative ${width}`}>
      <button ref={btnRef} type="button" disabled={disabled} aria-label={`${label}: ${caption}`} title={caption}
        aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => { setQuery(""); setOpen(o => !o); }}
        className="flex min-h-9 w-full items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/25 aria-expanded:border-white/30 disabled:cursor-wait disabled:opacity-60">
        <span aria-hidden="true" className="shrink-0 text-white/65">{icon}</span>
        <span className={`min-w-0 flex-1 text-left font-medium tabular-nums ${searchable ? "leading-snug [overflow-wrap:anywhere]" : "truncate"}`}>{caption}</span>
        <ChevronDown size={12} aria-hidden="true" className={`shrink-0 text-white/60 motion-safe:transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <Popover compact scrollPanel={false} fitContent={searchable} id={id} open={open} onClose={() => setOpen(false)} anchorRef={btnRef} widthPx={null} placement="bottom-start">
        {searchable && <SearchBox inset className="mb-1" placeholder="Search firms"
          value={query} onChange={event => setQuery(event.target.value)} />}
        <ul aria-label={label} className="context-menu-scrollbar min-h-0 max-h-48 divide-y divide-white/15 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
          {shown.map(item => {
            const current = String(item.id) === String(selected?.id);
            return (
              <li key={item.id}>
                <button type="button" disabled={disabled} aria-current={current || undefined}
                  onClick={() => { setOpen(false); btnRef.current?.focus({ preventScroll: true }); onPick(item); }}
                  className={`flex w-full items-center justify-between gap-1.5 rounded-md px-2 text-left text-sm leading-snug focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/25 ${current ? "font-medium text-cyan-200" : "text-white/85 hover:bg-white/5 hover:text-white"} ${searchable ? "min-h-9 py-1.5" : "min-h-8 py-1"}`}>
                  <span className="min-w-0 [overflow-wrap:anywhere]">{item[textKey]}</span>
                  {current && <Check size={13} aria-hidden="true" className="shrink-0" />}
                </button>
              </li>
            );
          })}
          {!shown.length && <li className="px-2 py-1.5 text-xs text-white/60">{searchable ? "No matching firms" : "No financial years"}</li>}
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
