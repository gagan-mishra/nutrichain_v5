import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Printer,
  Mail,
  Pencil,
  Trash2,
  Download,
  Banknote,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { glass } from "./primitives";
import ComboBox from "./combobox";
import { IconButton } from "./primitives";

const phoneWidth = window.matchMedia("(max-width: 767px)");
function subscribeWidth(listener) {
  phoneWidth.addEventListener("change", listener);
  return () => phoneWidth.removeEventListener("change", listener);
}
const actions = [
  ["download", "Download", <Download size={16} />], ["print", "Print", <Printer size={16} />],
  ["mail", "Mail", <Mail size={16} />], ["edit", "Edit", <Pencil size={16} />],
  ["receive", "Receive", <Banknote size={16} />], ["delete", "Delete", <Trash2 size={16} />],
];

function RowActions({ allowed, onAction, row }) {
  return <div className="flex flex-wrap items-center gap-2">
    {actions.filter(([key]) => allowed.includes(key)).map(([key, label, icon]) => (
      <IconButton key={key} title={label} onClick={() => onAction?.(key, row)}>
        {icon}
      </IconButton>
    ))}
  </div>;
}

function renderCell(column, row, index) {
  return column.render ? column.render(row[column.key], row, index) : row[column.key];
}

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
  const isPhone = useSyncExternalStore(subscribeWidth, () => phoneWidth.matches);
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
  }, [columns, displayRows.length, showActions, indexColumn, isPhone]);

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

  if (isPhone) {
    const primary = columns.find((column) => column.key !== "_sn");
    const details = columns.filter((column) => column !== primary && column.key !== "_sn");
    const sortable = columns.filter(isSortable);
    return (
      <div className="mb-3 space-y-2 text-white">
        {displayRows.length > 1 && sortable.length > 0 && (
          <div className="toolbar-field grid w-full grid-cols-[minmax(0,1fr)_var(--field-height)] items-center gap-2 text-sm">
            <ComboBox label="Sort by" placeholder="Default order" value={activeSortCol?.key || ""}
              options={[{ value: "", label: "Default order" }, ...sortable.map(col => ({ value: col.key, label: col.label }))]}
              onChange={key => setSortBy({ key: key || null, dir: "asc" })} />
            <button type="button" disabled={!activeSortCol} className="grid size-(--field-height) place-items-center rounded-xl border border-white/10 bg-white/5 hover:enabled:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/25 disabled:opacity-40"
              title={activeSortCol ? `Sort ${sortBy.dir === "asc" ? "descending" : "ascending"}` : "Select a column to change sort direction"}
              aria-label={`Sort ${sortBy.dir === "asc" ? "descending" : "ascending"}`}
              onClick={() => setSortBy({ key: sortBy.key, dir: sortBy.dir === "asc" ? "desc" : "asc" })}>
              {sortBy.dir === "asc" ? <ArrowUp size={17} /> : <ArrowDown size={17} />}
            </button>
          </div>
        )}
        {!displayRows.length && <p className="py-6 text-center text-sm text-white/60">No records yet.</p>}
        <ul className="space-y-2">
          {displayRows.map((row, i) => (
            <li key={row.id ?? i} className="min-w-0 rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm [overflow-wrap:anywhere]">
              <div className="flex items-start justify-between gap-2">
                {primary && <div>
                  <div className="text-xs text-white/60">{primary.label}</div>
                  <strong>{renderCell(primary, row, i)}</strong>
                </div>}
                {(indexColumn || row._sn != null) && <span className="text-xs text-white/60">#{indexColumn ? indexStart + i : row._sn}</span>}
              </div>
              {details.length > 0 && <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-white/10 pt-2">
                {details.map((col) => <div key={col.key} className="min-w-0">
                  <dt className="text-xs text-white/60">{col.label}</dt>
                  <dd>{renderCell(col, row, i) ?? "-"}</dd>
                </div>)}
              </dl>}
              {showActions && <div className="mt-3 border-t border-white/10 pt-2">
                <RowActions allowed={allowedActions} onAction={onAction} row={row} />
              </div>}
            </li>
          ))}
        </ul>
      </div>
    );
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
                    {renderCell(c, r, i)}
                  </td>
                ))}

                {showActions && (
                  <td className="px-2 py-2 sm:px-3">
                    <RowActions allowed={allowedActions} onAction={onAction} row={r} />
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
