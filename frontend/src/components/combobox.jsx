import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import SearchBox from "./search-box";
import { Popover } from "./popover";
import { useMediaQuery } from "../hooks/use-media-query";

export default function ComboBox({
  value, onChange, options, placeholder = "Select…", emptyText = "No matches", onFocus, label,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const trigger = useRef(null);
  const search = useRef(null);
  const list = useRef(null);
  const focusSearch = useRef(false);
  const inline = useMediaQuery("(max-width: 767px), (pointer: coarse)");
  const listId = useId();
  const selected = options.find((option) => option.value === value);
  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));
  const active = Math.min(activeIndex, filtered.length - 1);

  useEffect(() => {
    if (open && focusSearch.current) search.current?.focus({ preventScroll: true });
  }, [open]);

  function close() {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }
  function choose(option) {
    if (option) onChange(option.value);
    close();
    trigger.current?.focus({ preventScroll: true });
  }
  function openSearch(text = "") {
    focusSearch.current = true;
    setQuery(text);
    setActiveIndex(0);
    setOpen(true);
    if (open) search.current?.focus({ preventScroll: true });
  }
  function navigate(event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return openSearch();
      const next = Math.max(0, Math.min(active + (event.key === "ArrowDown" ? 1 : -1), filtered.length - 1));
      setActiveIndex(next);
      const item = list.current?.children[next];
      if (item && list.current) {
        const offset = item.getBoundingClientRect().top - list.current.getBoundingClientRect().top;
        if (offset < 0) list.current.scrollTop += offset;
        else if (offset + item.offsetHeight > list.current.clientHeight) {
          list.current.scrollTop += offset + item.offsetHeight - list.current.clientHeight;
        }
      }
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      if (filtered[active]) choose(filtered[active]);
    } else if (event.key === "Tab" && open) {
      // Return to the trigger before native Tab advances through the form.
      choose(filtered[active]);
    }
  }

  return (
    <div className="relative min-w-0">
      <button type="button" ref={trigger} onFocus={onFocus}
        aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? listId : undefined}
        onClick={(event) => {
          if (open) return close();
          focusSearch.current = event.detail === 0 || !window.matchMedia("(pointer: coarse)").matches;
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if ((event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.altKey && !event.metaKey) || event.key === "Backspace") {
            event.preventDefault();
            openSearch(event.key === "Backspace" ? "" : event.key);
          } else navigate(event);
        }}
        className="field-trigger flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 text-sm backdrop-blur-sm transition hover:bg-white/10 focus:ring-2 focus:ring-white/20">
        <span className={selected ? "truncate text-white" : "truncate text-white/60"}>{label && <span className="text-white/60">{label}: </span>}{selected?.label || placeholder}</span>
        <ChevronDown size={16} className="shrink-0 opacity-80" />
      </button>
      <Popover inline={inline} open={open} onClose={close} anchorRef={trigger} widthPx={null}>
        <SearchBox inset className="mb-1" inputRef={search} value={query} role="combobox" aria-expanded="true" aria-controls={listId}
          aria-label={`Search: ${label || placeholder}`} aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off" placeholder="Type to search…" onKeyDown={navigate}
          onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); if (list.current) list.current.scrollTop = 0; }} />
        <ul ref={list} id={listId} role="listbox" aria-label={label || placeholder}
          className="min-h-0 max-h-56 overflow-auto overscroll-contain">
          {filtered.map((option, index) => (
            <li key={option.value} role="option" id={`${listId}-${index}`} aria-selected={option.value === value}>
              <button type="button" tabIndex={-1} onClick={() => choose(option)} onMouseEnter={() => setActiveIndex(index)}
                className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm sm:min-h-0 ${index === active ? "bg-white/10" : ""}`}>
                <span className="break-words">{option.label}</span>
                {option.value === value && <Check size={16} className="shrink-0" />}
              </button>
            </li>
          ))}
        </ul>
        {!filtered.length && <div role="status" className="p-3 text-xs text-white/60">{emptyText}</div>}
      </Popover>
    </div>
  );
}
