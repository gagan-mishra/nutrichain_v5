// src/pages/ReportsSales.jsx
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout";
import { useCtx } from "../state/context";
import { api } from "../api";
import DataTable from "../components/table";
import { glass, Card, Field } from "../components/primitives";
import ComboBox from "../components/combobox";
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

function fmtQty(n) { return Number(n || 0).toLocaleString("en-IN"); }
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

function SalesTooltip({ active, payload, productSelected }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-lg border border-white/15 bg-[#0b1220]/95 px-3 py-2 text-xs text-white shadow-xl">
      <div className="mb-1 font-semibold text-white">{row.fullLabel}</div>
      <div className="text-white/80">Qty: <span className="text-white font-medium">{fmtQty(row.qty)}</span></div>
      <div className="text-white/80">Trades: <span className="text-white font-medium">{row.trades}</span></div>
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

  async function load() {
    const params = { group };
    if (productId) params.product_id = productId;
    const { data } = await api.get("/reports/sales", { params });
    setRows(data || []);
  }

  useEffect(() => { if (firm?.id) load(); }, [firm?.id, fy?.id, group, productId]);

  const columns = [
    { key: "period", label: group === "day" ? "Date" : "Month", render: (v) => fmtPeriod(v, group) },
    { key: "trades", label: "Trades" },
    { key: "total_qty", label: "Total Qty", render: (v) => fmtQty(v) },
    { key: "avg_price", label: "Avg Price", render: (v) => productId ? fmtNum(v) : "-" },
  ];

  const chartRows = useMemo(
    () =>
      (rows || []).map((r) => ({
        shortLabel: fmtPeriodShort(r.period, group),
        fullLabel: fmtPeriod(r.period, group),
        qty: Number(r.total_qty || 0),
        trades: Number(r.trades || 0),
        avgPrice: r.avg_price == null ? null : Number(r.avg_price),
      })),
    [rows, group]
  );

  const totals = useMemo(() => {
    let t = 0;
    let q = 0;
    for (const r of rows) {
      t += r.trades || 0;
      q += r.total_qty || 0;
    }
    return { trades: t, qty: q };
  }, [rows]);

  return (
    <AppShell firm={firm} fy={fy} firms={firms} fys={fys} setFirm={setFirm} setFy={setFy} activeKey="sales-report" setActiveKey={() => {}}>
      <div className="text-white">
        <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-3">
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
        <Card title="Sales Summary">
          {chartRows.length > 0 ? (
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
          <DataTable columns={columns} rows={rows} allowedActions={[]} />
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 text-sm">
            <div className="rounded-lg p-3 bg-black/20 border border-white/10">
              <div className="text-white/60 text-xs">Total Trades</div>
              <div className="text-lg font-semibold">{totals.trades}</div>
            </div>
            <div className="rounded-lg p-3 bg-black/20 border border-white/10">
              <div className="text-white/60 text-xs">Total Qty</div>
              <div className="text-lg font-semibold">{fmtQty(totals.qty)}</div>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
