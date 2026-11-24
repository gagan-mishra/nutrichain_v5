import { Search } from "lucide-react";

export default function SearchBox({ inset = false, className = "", inputRef, placeholder, ...inputProps }) {
  return (
    <div className={`field-shell flex w-full shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-white focus-within:border-white/35 focus-within:ring-2 focus-within:ring-white/15 ${inset ? "" : "toolbar-field max-lg:bg-black/20"} ${className}`}>
      <Search size={16} className="text-white/60" aria-hidden="true" />
      <input ref={inputRef} aria-label={placeholder} placeholder={placeholder}
        className="w-0 min-w-0 bg-transparent text-sm outline-none placeholder:text-white/50" {...inputProps} />
    </div>
  );
}
