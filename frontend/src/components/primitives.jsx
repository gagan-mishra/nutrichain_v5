import React from 'react'
export const glass = "bg-white/5 backdrop-blur border border-white/10"

export function Field({ label, help, children, full }) {
  return (
    <div className={full ? "md:col-span-2 overflow-visible" : "overflow-visible"}>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/60">{label}</label>
      {children}
      {help && <p className="mt-1 text-xs text-white/50">{help}</p>}
    </div>
  )
}
export function Input({ type="text", value, onChange, placeholder, name, autoComplete, id, ...rest }) {
  return (
    <input type={type} id={id} name={name} autoComplete={autoComplete} className={`w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20 ${glass} bg-black/20`} placeholder={placeholder} value={value ?? ""} onChange={e=>onChange(e.target.value)} {...rest} />
  )
}
export function TextArea({ value, onChange, rows=3, placeholder, name, autoComplete, id, ...rest }) {
  return (
    <textarea id={id} name={name} autoComplete={autoComplete} className={`w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20 ${glass} bg-black/20`} rows={rows} placeholder={placeholder} value={value ?? ""} onChange={e=>onChange(e.target.value)} {...rest} />
  )
}
export function Tabs({ tabs, value, onChange }) {
  return (
    <div className={`mb-4 flex flex-wrap gap-1 p-1 ${glass} rounded-xl text-white`}>
      {tabs.map(t => {
        const active = value === t.key
        return (
          <button key={t.key} onClick={()=>onChange(t.key)} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${active ? "bg-white/10" : "hover:bg-white/5 text-white/80 hover:text-white"}`}>
            {t.icon}<span className="font-medium">{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}
export function Card({ title, children, actions }) {
  return (
    <div className={`rounded-2xl p-4 text-white ${glass} overflow-visible relative`}>
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-white/90">{title}</h3>{actions}</div>
      {children}
    </div>
  )
}
export function IconButton({ title, onClick, children }) {
  return (
    <button title={title} onClick={onClick} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-white/90 transition-colors hover:bg-white/10 ${glass} bg-black/20`}>
      {children}<span className="hidden md:inline">{title}</span>
    </button>
  )
}
