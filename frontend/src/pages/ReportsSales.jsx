// src/pages/ReportsSales.jsx
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout";
import { useCtx } from "../state/context";
import { api } from "../api";
import DataTable from "../components/table";
import { glass, Card, Field } from "../components/primitives";
import ComboBox from "../components/combobox";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  Line,
} from "recharts";

function fmtQty(n) {
  return Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
function fmtNum(n) { return n == null ? "-" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
function fmtINR(n) {
  return n == null
    ? "-"
    : `INR ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPeriod(period, group) {
  if (!period) return "";

  if (group === "month") {
    const m = String(period).match(/^(\d{4})-(\d{2})$/);
    if (!m) return String(period);
    const yy = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(yy) || !Number.isFinite(mm) || mm < 1 || mm > 12) return String(period);
    return new Date(Date.UTC(yy, mm - 1, 1)).toLocaleString("en-IN", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  const d = String(period).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!d) return String(period);
  const yy = Number(d[1]);
  const mm = Number(d[2]);
  const dd = Number(d[3]);
  return new Date(Date.UTC(yy, mm - 1, dd)).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function fmtPeriodShort(period, group) {
  if (!period) return "";
  if (group === "month") {
    const m = String(period).match(/^(\d{4})-(\d{2})$/);
    if (!m) return String(period);
    const yy = Number(m[1]);
    const mm = Number(m[2]);
    return new Date(Date.UTC(yy, mm - 1, 1)).toLocaleString("en-IN", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });
  }
  const d = String(period).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!d) return String(period);
  const yy = Number(d[1]);
  const mm = Number(d[2]);
  const dd = Number(d[3]);
  return new Date(Date.UTC(yy, mm - 1, dd)).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function parseUtcDate(value) {
  const match = String(value || "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function withMonthlyComparisons(sourceRows, group, fy) {
  const sorted = [...(sourceRows || [])].sort((a, b) => String(a.period).localeCompare(String(b.period)));
  if (group !== "month") return sorted;

  const byMonth = new Map(sorted.map((row) => [String(row.period), row]));
  const fyStart = parseUtcDate(fy?.startDate);
  const fyEnd = parseUtcDate(fy?.endDate);
  let completed = sorted;

  if (fyStart && fyEnd) {
    const start = new Date(Date.UTC(fyStart.getUTCFullYear(), fyStart.getUTCMonth(), 1));
    let end = new Date(Date.UTC(fyEnd.getUTCFullYear(), fyEnd.getUTCMonth(), 1));
    const now = new Date();
    const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    // Do not create zero rows for future months in the active FY, or for an FY
    // that has not started yet.
    if (currentMonth >= start && currentMonth < end) end = currentMonth;

    if (currentMonth >= start && end >= start) {
      completed = [];
      for (let cursor = new Date(start); cursor <= end; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
        const period = monthKey(cursor);
        completed.push(byMonth.get(period) || {
          period,
          trades: 0,
          firms: 0,
          total_qty: 0,
          avg_price: null,
        });
      }
    }
  }

  return completed.map((row, index) => {
    const qty = Number(row.total_qty || 0);
    const previousQty = index > 0 ? Number(completed[index - 1].total_qty || 0) : null;
    const qtyChange = previousQty == null ? null : qty - previousQty;
    const qtyChangePct = previousQty > 0 ? (qtyChange / previousQty) * 100 : null;
    return { ...row, qty_change: qtyChange, qty_change_pct: qtyChangePct };
  });
}

function QtyChange({ change, percent, compact = false }) {
  if (change == null) return <span className="text-white/45">No comparison</span>;
  const positive = change > 0;
  const negative = change < 0;
  const Icon = positive ? ArrowUpRight : negative ? ArrowDownRight : Minus;
  const tone = positive ? "text-emerald-300" : negative ? "text-rose-300" : "text-white/60";
  const sign = positive ? "+" : "";

  return (
    <span className={`inline-flex items-center gap-1 font-medium ${tone}`}>
      <Icon size={compact ? 14 : 16} />
      {sign}{fmtQty(change)}
      {percent != null ? <span className="text-[11px] opacity-80">({sign}{percent.toFixed(1)}%)</span> : null}
    </span>
  );
}

function SalesTooltip({ active, payload, productSelected }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-lg border border-white/15 bg-[#0b1220]/95 px-3 py-2 text-xs text-white shadow-xl">
      <div className="mb-1 font-semibold text-white">{row.fullLabel}</div>
      <div className="text-white/80">Qty: <span className="text-white font-medium">{fmtQty(row.qty)}</span></div>
      <div className="text-white/80">Trades: <span className="text-white font-medium">{row.trades}</span></div>
      {row.firms != null ? <div className="text-white/80">Firms: <span className="text-white font-medium">{row.firms}</span></div> : null}
      {row.qtyChange != null ? (
        <div className="mt-1 border-t border-white/10 pt-1">
          Vs previous month: <QtyChange change={row.qtyChange} percent={row.qtyChangePct} compact />
        </div>
      ) : null}
      {productSelected ? (
        <div className="text-white/80">Avg Price: <span className="text-white font-medium">{fmtINR(row.avgPrice)}</span></div>
      ) : null}
    </div>
  );
}

export default function ReportsSales() {
  const { firm, fy, setFirm, setFy } = useCtx();
  const [firms, setFirms] = useState([]);
  const [fys, setFys] = useState([]);
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState(null);
  const [group, setGroup] = useState("month");
  const [scope, setScope] = useState("current_firm");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: firmList }, { data: fyList }, { data: productList }] = await Promise.all([
        api.get("/firms"), api.get("/firms/fiscal-years"), api.get("/products"),
      ]);
      setFirms(firmList || []);
      setFys(fyList || []);
      setProducts((productList || []).map((p) => ({ value: p.id, label: p.name })));
      if (!firm && firmList?.[0]) setFirm(firmList[0]);
      if (!fy && fyList?.[0]) setFy(fyList[0]);
    })();
  }, []);

  useEffect(() => {
    if (!firm?.id) return undefined;
    let active = true;
    setLoading(true);
    setError("");

    const params = { group, scope };
    if (productId) params.product_id = productId;
    api.get("/reports/sales", { params })
      .then(({ data }) => { if (active) setRows(data || []); })
      .catch((requestError) => {
        if (!active) return;
        setRows([]);
        setError(requestError?.response?.data?.error || "Failed to load sales report");
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [firm?.id, fy?.id, group, productId, scope]);

  const displayRows = useMemo(() => withMonthlyComparisons(rows, group, fy), [rows, group, fy]);

  const columns = useMemo(() => [
    { key: "period", label: group === "day" ? "Date" : "Month", render: (v) => fmtPeriod(v, group) },
    ...(scope === "all_firms" ? [{ key: "firms", label: "Firms" }] : []),
    { key: "trades", label: "Trades" },
    { key: "total_qty", label: "Total Qty", render: (v) => fmtQty(v) },
    ...(group === "month" ? [{
      key: "qty_change",
      label: "Vs Previous Month",
      render: (value, row) => <QtyChange change={value} percent={row.qty_change_pct} compact />,
      sortValue: (row) => row.qty_change,
    }] : []),
    { key: "avg_price", label: "Avg Price", render: (v) => productId ? fmtNum(v) : "-" },
  ], [group, productId, scope]);

  const chartRows = useMemo(
    () =>
      displayRows.map((r) => ({
        shortLabel: fmtPeriodShort(r.period, group),
        fullLabel: fmtPeriod(r.period, group),
        qty: Number(r.total_qty || 0),
        trades: Number(r.trades || 0),
        firms: scope === "all_firms" ? Number(r.firms || 0) : null,
        avgPrice: r.avg_price == null ? null : Number(r.avg_price),
        qtyChange: r.qty_change,
        qtyChangePct: r.qty_change_pct,
      })),
    [displayRows, group, scope]
  );

  const totals = useMemo(() => {
    let t = 0;
    let q = 0;
    for (const r of displayRows) {
      t += r.trades || 0;
      q += r.total_qty || 0;
    }
    return { trades: t, qty: q };
  }, [displayRows]);

  const latestComparison = useMemo(() => {
    if (group !== "month" || displayRows.length < 2) return null;
    return displayRows[displayRows.length - 1];
  }, [displayRows, group]);

  return (
    <AppShell firm={firm} fy={fy} firms={firms} fys={fys} setFirm={setFirm} setFy={setFy} activeKey="sales-report" setActiveKey={() => {}}>
      <div className="text-white">
        <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <Field label="Firm scope">
            <select value={scope} onChange={(e) => setScope(e.target.value)} className={`w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20 ${glass} bg-black/20`}>
              <option value="current_firm">Current firm</option>
              <option value="all_firms">All firms</option>
            </select>
          </Field>
          <Field label="Group by">
            <select value={group} onChange={(e) => setGroup(e.target.value)} className={`w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20 ${glass} bg-black/20`}>
              <option value="day">Day</option>
              <option value="month">Month</option>
            </select>
          </Field>
          <Field label="Product (optional)">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-[200px]"><ComboBox value={productId} onChange={setProductId} options={products} placeholder="All products" /></div>
              <button onClick={() => setProductId(null)} className={`rounded-lg px-3 py-2 text-xs text-white/80 hover:text-white hover:bg-white/10 border border-white/10 ${glass}`}>Clear</button>
            </div>
          </Field>
        </div>
        <Card title={scope === "all_firms" ? "Sales Summary - All Firms" : "Sales Summary"}>
          {error ? (
            <div className="mb-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>
          ) : loading ? (
            <div className="mb-4 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/70">Loading sales data...</div>
          ) : chartRows.length > 0 ? (
            <div className="mb-4 h-[320px] rounded-xl border border-white/10 bg-black/20 p-2 sm:p-3">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartRows} margin={{ top: 10, right: 18, left: 8, bottom: 6 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.10)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="shortLabel"
                    stroke="rgba(255,255,255,0.65)"
                    tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 11 }}
                    minTickGap={16}
                  />
                  <YAxis
                    yAxisId="qty"
                    stroke="rgba(34,211,238,0.95)"
                    tick={{ fill: "rgba(34,211,238,0.95)", fontSize: 11 }}
                    tickFormatter={(v) => fmtQty(v)}
                  />
                  <YAxis
                    yAxisId="trades"
                    orientation="right"
                    stroke="rgba(245,158,11,0.95)"
                    tick={{ fill: "rgba(245,158,11,0.95)", fontSize: 11 }}
                    allowDecimals={false}
                  />
                  {productId ? <YAxis yAxisId="price" hide /> : null}
                  <Tooltip content={<SalesTooltip productSelected={!!productId} />} />
                  <Legend wrapperStyle={{ color: "rgba(255,255,255,0.85)", fontSize: 12 }} />
                  <Bar yAxisId="qty" dataKey="qty" name="Qty" fill="#22d3ee" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Line yAxisId="trades" dataKey="trades" name="Trades" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                  {productId ? (
                    <Line
                      yAxisId="price"
                      dataKey="avgPrice"
                      name="Avg Price"
                      stroke="#a78bfa"
                      strokeDasharray="4 3"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ) : null}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mb-4 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/70">
              No sales data for selected filters.
            </div>
          )}
          <DataTable columns={columns} rows={displayRows} allowedActions={[]} />
          <div className={`mt-3 grid grid-cols-1 gap-3 text-sm ${group === "month" ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
            <div className="rounded-lg p-3 bg-black/20 border border-white/10">
              <div className="text-white/60 text-xs">Total Trades</div>
              <div className="text-lg font-semibold">{totals.trades}</div>
            </div>
            <div className="rounded-lg p-3 bg-black/20 border border-white/10">
              <div className="text-white/60 text-xs">Total Qty {scope === "all_firms" ? "(All Firms)" : ""}</div>
              <div className="text-lg font-semibold">{fmtQty(totals.qty)}</div>
            </div>
            {group === "month" ? (
              <div className="rounded-lg p-3 bg-black/20 border border-white/10">
                <div className="text-white/60 text-xs">Latest Month vs Previous</div>
                <div className="mt-1 text-base"><QtyChange change={latestComparison?.qty_change} percent={latestComparison?.qty_change_pct} /></div>
                {latestComparison ? <div className="mt-1 text-[11px] text-white/45">{fmtPeriod(latestComparison.period, "month")}</div> : null}
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
