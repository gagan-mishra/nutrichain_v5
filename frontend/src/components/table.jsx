import React from "react";
import { Printer, Mail, Pencil, Trash2, Download, Banknote } from "lucide-react";
import { glass } from "./primitives";
import { IconButton } from "./primitives";

export default function DataTable({
  columns,
  rows,
  onAction,
  allowedActions = ["print","mail","edit","delete"],
  indexColumn = false,          // 👈 NEW
  indexStart = 1,               // 👈 NEW
}) {
  return (
    <div className={`overflow-x-auto ${glass} rounded-2xl mb-10`}>
      <table className="min-w-full text-left text-xs sm:text-sm text-white">
        <thead className="border-b border-white/10 text-white/70">
          <tr>
            {indexColumn && <th className="px-2 sm:px-3 py-2 font-semibold w-10 sm:w-12">#</th>}
            {columns.map((c) => (
              <th key={c.key} className="px-2 sm:px-3 py-2 font-semibold whitespace-nowrap">{c.label}</th>
            ))}
            <th className="px-2 sm:px-3 py-2 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={(indexColumn ? 1 : 0) + columns.length + 1} className="px-3 py-6 text-center text-white/60">
                No records yet.
              </td>
            </tr>
          )}

          {rows.map((r, i) => (
            <tr key={r.id ?? i} className="border-t border-white/10 hover:bg-white/5">
              {indexColumn && <td className="px-2 sm:px-3 py-2">{indexStart + i}</td>}

              {columns.map((c) => (
                <td key={c.key} className="px-2 sm:px-3 py-2 whitespace-nowrap">
                  {c.render ? c.render(r[c.key], r, i) : r[c.key]}
                </td>
              ))}

              <td className="px-2 sm:px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  {allowedActions.includes("download") && (
                    <IconButton title="Download" onClick={() => onAction?.("download", r)}><Download size={16}/></IconButton>
                  )}
                  {allowedActions.includes("print") && (
                    <IconButton title="Print" onClick={() => onAction?.("print", r)}><Printer size={16}/></IconButton>
                  )}
                  {allowedActions.includes("mail") && (
                    <IconButton title="Mail" onClick={() => onAction?.("mail", r)}><Mail size={16}/></IconButton>
                  )}
                  {allowedActions.includes("edit") && (
                    <IconButton title="Edit" onClick={() => onAction?.("edit", r)}><Pencil size={16}/></IconButton>
                  )}
                  {allowedActions.includes("receive") && (
                    <IconButton title="Receive" onClick={() => onAction?.("receive", r)}><Banknote size={16}/></IconButton>
                  )}
                  {allowedActions.includes("delete") && (
                    <IconButton title="Delete" onClick={() => onAction?.("delete", r)}><Trash2 size={16}/></IconButton>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
