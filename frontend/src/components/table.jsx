import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Printer,
  Mail,
  Pencil,
  Trash2,
  Download,
  Banknote,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { glass } from "./primitives";
import { IconButton } from "./primitives";

export default function DataTable({
  columns,
  rows,
  onAction,
  allowedActions = ["print", "mail", "edit", "delete"],
  indexColumn = false,
  indexStart = 1,
}) {
  const [sortBy, setSortBy] = useState({ key: null, dir: "asc" });
  const [xOverflow, setXOverflow] = useState(false);
  const [scrollTrackWidth, setScrollTrackWidth] = useState(0);
  const showActions = Array.isArray(allowedActions) && allowedActions.length > 0;
  const bodyScrollRef = useRef(null);
  const topScrollRef = useRef(null);
  const syncLockRef = useRef(false);

  function isSortable(col) {
    return col?.sortable !== false && !!col?.key;
  }

  function getSortValue(col, row) {
    if (typeof col?.sortValue === "function") return col.sortValue(row);
    return row?.[col?.key];
  }

  function compareValues(a, b) {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;

    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;

    const da = new Date(a).getTime();
    const db = new Date(b).getTime();
    if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db;

    return String(a).localeCompare(String(b), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  }

  const activeSortCol = useMemo(
    () => columns.find((c) => c.key === sortBy.key) || null,
    [columns, sortBy.key],
  );

  const displayRows = useMemo(() => {
    if (!activeSortCol) return rows;
    const dir = sortBy.dir === "desc" ? -1 : 1;
    return [...rows].sort((ra, rb) => {
      const av = getSortValue(activeSortCol, ra);
      const bv = getSortValue(activeSortCol, rb);
      return compareValues(av, bv) * dir;
    });
  }, [rows, activeSortCol, sortBy.dir]);

  function toggleSort(col) {
    if (!isSortable(col)) return;
    setSortBy((prev) => {
      if (prev.key !== col.key) return { key: col.key, dir: "asc" };
      if (prev.dir === "asc") return { key: col.key, dir: "desc" };
      return { key: null, dir: "asc" };
    });
  }

  function SortIcon({ col }) {
    if (!isSortable(col)) return null;
    if (sortBy.key !== col.key) return <ArrowUpDown size={13} className="opacity-60" />;
    return sortBy.dir === "asc"
      ? <ChevronUp size={14} className="text-white" />
      : <ChevronDown size={14} className="text-white" />;
  }

  useEffect(() => {
    const bodyEl = bodyScrollRef.current;
    if (!bodyEl) return undefined;

    const updateMetrics = () => {
      const sw = bodyEl.scrollWidth || 0;
      const cw = bodyEl.clientWidth || 0;
      setScrollTrackWidth(sw);
      setXOverflow(sw > cw + 1);
      if (topScrollRef.current) topScrollRef.current.scrollLeft = bodyEl.scrollLeft;
    };

    updateMetrics();
    window.addEventListener("resize", updateMetrics);

    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(updateMetrics);
      ro.observe(bodyEl);
      const tableEl = bodyEl.querySelector("table");
      if (tableEl) ro.observe(tableEl);
    }

    return () => {
      window.removeEventListener("resize", updateMetrics);
      if (ro) ro.disconnect();
    };
  }, [columns, displayRows.length, showActions, indexColumn]);

  function syncTopFromBody() {
    const bodyEl = bodyScrollRef.current;
    const topEl = topScrollRef.current;
    if (!bodyEl || !topEl || syncLockRef.current) return;
    syncLockRef.current = true;
    topEl.scrollLeft = bodyEl.scrollLeft;
    requestAnimationFrame(() => { syncLockRef.current = false; });
  }

  function syncBodyFromTop() {
    const bodyEl = bodyScrollRef.current;
    const topEl = topScrollRef.current;
    if (!bodyEl || !topEl || syncLockRef.current) return;
    syncLockRef.current = true;
    bodyEl.scrollLeft = topEl.scrollLeft;
    requestAnimationFrame(() => { syncLockRef.current = false; });
  }

  return (
    <div className={`${glass} mb-6 rounded-2xl border border-white/15 bg-black/20`}>
      {xOverflow && (
        <div className="border-b border-white/10 px-2 py-1.5">
          <div
            ref={topScrollRef}
            onScroll={syncBodyFromTop}
            className="table-scrollbar overflow-x-auto overflow-y-hidden rounded-md bg-slate-900/50"
            aria-label="Horizontal table scroll"
          >
            <div style={{ width: scrollTrackWidth, height: 8 }} />
          </div>
        </div>
      )}
      <div
        ref={bodyScrollRef}
        onScroll={syncTopFromBody}
        className={`table-scrollbar overflow-x-auto ${xOverflow ? "rounded-b-2xl" : "rounded-2xl"}`}
      >
        <table className="min-w-full text-left text-xs text-white sm:text-sm">
          <thead className="border-b border-white/15 bg-slate-900/70 text-white/80">
            <tr>
              {indexColumn && <th className="w-10 px-2 py-2 font-semibold sm:w-12 sm:px-3">#</th>}
              {columns.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-2 py-2 font-semibold sm:px-3">
                  <button
                    type="button"
                    className={`inline-flex items-center gap-1 ${isSortable(c) ? "cursor-pointer hover:text-white" : "cursor-default"}`}
                    onClick={() => toggleSort(c)}
                  >
                    <span>{c.label}</span>
                    <SortIcon col={c} />
                  </button>
                </th>
              ))}
              {showActions && <th className="px-2 py-2 font-semibold sm:px-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 && (
              <tr>
                <td
                  colSpan={(indexColumn ? 1 : 0) + columns.length + (showActions ? 1 : 0)}
                  className="px-3 py-8 text-center text-white/60"
                >
                  No records yet.
                </td>
              </tr>
            )}

            {displayRows.map((r, i) => (
              <tr key={r.id ?? i} className="border-t border-white/10 odd:bg-white/[0.03] hover:bg-white/10">
                {indexColumn && <td className="px-2 py-2 sm:px-3">{indexStart + i}</td>}

                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-2 py-2 sm:px-3 ${c.wrap ? "whitespace-normal" : "whitespace-nowrap"}`}
                  >
                    {c.render ? c.render(r[c.key], r, i) : r[c.key]}
                  </td>
                ))}

                {showActions && (
                  <td className="px-2 py-2 sm:px-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {allowedActions.includes("download") && (
                        <IconButton title="Download" onClick={() => onAction?.("download", r)}>
                          <Download size={16} />
                        </IconButton>
                      )}
                      {allowedActions.includes("print") && (
                        <IconButton title="Print" onClick={() => onAction?.("print", r)}>
                          <Printer size={16} />
                        </IconButton>
                      )}
                      {allowedActions.includes("mail") && (
                        <IconButton title="Mail" onClick={() => onAction?.("mail", r)}>
                          <Mail size={16} />
                        </IconButton>
                      )}
                      {allowedActions.includes("edit") && (
                        <IconButton title="Edit" onClick={() => onAction?.("edit", r)}>
                          <Pencil size={16} />
                        </IconButton>
                      )}
                      {allowedActions.includes("receive") && (
                        <IconButton title="Receive" onClick={() => onAction?.("receive", r)}>
                          <Banknote size={16} />
                        </IconButton>
                      )}
                      {allowedActions.includes("delete") && (
                        <IconButton title="Delete" onClick={() => onAction?.("delete", r)}>
                          <Trash2 size={16} />
                        </IconButton>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
