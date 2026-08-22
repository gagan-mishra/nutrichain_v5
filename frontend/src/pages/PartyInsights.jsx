import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  FileBarChart,
  Lightbulb,
  RefreshCw,
  Sparkles,
  WalletCards,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "../components/layout";
import ComboBox from "../components/combobox";
import { Card, glass } from "../components/primitives";
import DataTable from "../components/table";
import { useToast } from "../components/toast";
import { useCtx } from "../state/context";
import { api } from "../api";

function number(value, maximumFractionDigits = 2) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits });
}

function money(value) {
  return `\u20B9 ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function monthLabel(value, short = false) {
  if (!/^\d{4}-\d{2}$/.test(String(value || ""))) return value || "";
  const date = new Date(`${value}-01T00:00:00Z`);
  return date.toLocaleDateString("en-IN", {
    month: short ? "short" : "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function toYmd(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftMonths(dateText, months) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function previousDay(dateText) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function shortDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });
}

function buildPeriodOptions(fy, todayInput = new Date()) {
  const start = toYmd(fy?.startDate || fy?.start_date);
  const end = toYmd(fy?.endDate || fy?.end_date);
  const today = toYmd(todayInput);
  if (!start || !end) return [{ value: "consolidated", label: "Consolidated FY", ongoing: false }];

  const quarters = Array.from({ length: 4 }, (_unused, index) => {
    const quarterStart = shiftMonths(start, index * 3);
    const calculatedEnd = previousDay(shiftMonths(start, (index + 1) * 3));
    const quarterEnd = calculatedEnd > end ? end : calculatedEnd;
    const ongoing = quarterStart <= today && today <= quarterEnd;
    return {
      value: `q${index + 1}`,
      label: `Q${index + 1} | ${shortDate(quarterStart)} - ${shortDate(quarterEnd)}${ongoing ? " | Ongoing" : ""}`,
      ongoing,
    };
  });
  return [...quarters, { value: "consolidated", label: "Consolidated FY", ongoing: false }];
}

function extractFilename(disposition, fallback) {
  const match = String(disposition || "").match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  if (!match) return fallback;
  try {
    return decodeURIComponent(match[1]).replace(/[/\\:*?"<>|]/g, "_");
  } catch {
    return match[1].replace(/[/\\:*?"<>|]/g, "_");
  }
}

function Metric({ label, value, note, tone = "cyan" }) {
  const tones = {
    cyan: "from-cyan-400/15 border-cyan-300/15",
    amber: "from-amber-400/15 border-amber-300/15",
    emerald: "from-emerald-400/15 border-emerald-300/15",
    rose: "from-rose-400/15 border-rose-300/15",
  };
  return (
    <div className={`rounded-xl border bg-gradient-to-br ${tones[tone]} to-transparent p-3.5`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">{label}</div>
      <div className="mt-1 text-xl font-semibold tracking-tight text-white">{value}</div>
      <div className="mt-0.5 text-xs text-white/50">{note}</div>
    </div>
  );
}

function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  return (
    <div className="rounded-xl border border-white/15 bg-[#101722]/95 px-3 py-2 text-xs shadow-2xl backdrop-blur">
      <div className="font-semibold text-white">{monthLabel(label)}</div>
      <div className="mt-1 text-cyan-200">Volume: {number(row.qty)} {unit}</div>
      <div className="text-white/60">Trades: {number(row.trades, 0)}</div>
    </div>
  );
}

function Momentum({ momentum }) {
  if (!momentum?.current_period || !momentum?.previous_period) return null;
  const positive = momentum.direction === "up";
  const negative = momentum.direction === "down";
  const Icon = positive ? ArrowUpRight : negative ? ArrowDownRight : RefreshCw;
  const color = positive ? "text-emerald-300" : negative ? "text-rose-300" : "text-white/60";
  const change = Number(momentum.change || 0);
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-xs ${color}`}>
      <Icon size={14} />
      <span>
        {change === 0 ? "No change" : `${change > 0 ? "+" : ""}${number(change)} ${momentum.unit}`} vs {monthLabel(momentum.previous_period, true)}
      </span>
    </div>
  );
}

export default function PartyInsights() {
  const toast = useToast();
  const { firm, fy, setFirm, setFy } = useCtx();
  const [firms, setFirms] = useState([]);
  const [fys, setFys] = useState([]);
  const [parties, setParties] = useState([]);
  const [partyId, setPartyId] = useState(null);
  const [periodKey, setPeriodKey] = useState("consolidated");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([api.get("/firms"), api.get("/firms/fiscal-years"), api.get("/parties")])
      .then(([firmResponse, fyResponse, partyResponse]) => {
        if (!active) return;
        const firmList = firmResponse.data || [];
        const fyList = fyResponse.data || [];
        setFirms(firmList);
        setFys(fyList);
        setParties((partyResponse.data || []).map((party) => ({ value: party.id, label: party.name })));
        if (!firm && firmList[0]) setFirm(firmList[0]);
        if (!fy && fyList[0]) setFy(fyList[0]);
      })
      .catch((requestError) => {
        if (active) setError(requestError?.response?.data?.error || "Failed to load report options");
    });
    return () => { active = false; };
    // Context setters are stable; this request should only initialize the page once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const periodOptions = useMemo(() => buildPeriodOptions(fy), [fy]);

  useEffect(() => {
    const ongoingQuarter = periodOptions.find((option) => option.ongoing);
    setPeriodKey(ongoingQuarter?.value || "consolidated");
  }, [fy?.id, periodOptions]);

  useEffect(() => {
    setPayload(null);
    setError("");
  }, [firm?.id, fy?.id, periodKey]);

  async function generate() {
    if (!partyId) return toast.error("Select a party first");
    if (!fy?.id) return toast.error("Select a fiscal year");
    try {
      setLoading(true);
      setError("");
      const { data } = await api.get("/reports/party-insights", {
        params: { party_id: partyId, period: periodKey },
      });
      setPayload(data);
    } catch (requestError) {
      const message = requestError?.response?.data?.error || "Failed to generate party insights";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf() {
    if (!partyId) return toast.error("Select a party first");
    try {
      setDownloading(true);
      const response = await api.get("/reports/party-insights/pdf", {
        params: { party_id: partyId, period: periodKey },
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const fallback = `Party-Insights-${partyId}-${fy?.label || "FY"}-${periodKey.toUpperCase()}.pdf`;
      const filename = extractFilename(response.headers?.["content-disposition"], fallback);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Party insights PDF downloaded");
    } catch (requestError) {
      toast.error(requestError?.response?.data?.error || "Failed to download the PDF");
    } finally {
      setDownloading(false);
    }
  }

  const productColumns = useMemo(() => [
    { key: "product_name", label: "Product", wrap: true },
    { key: "trades", label: "Trades" },
    { key: "qty", label: "Qty", render: (value, row) => `${number(value)} ${row.unit}` },
    { key: "share_pct", label: "Share", render: (value) => value == null ? "-" : `${number(value, 1)}%` },
    { key: "weighted_avg_price", label: "Weighted Avg Price", render: (value) => value == null ? "-" : money(value) },
    {
      key: "price_range",
      label: "Price Range",
      sortable: false,
      render: (_value, row) => row.min_price == null ? "-" : `${money(row.min_price)} - ${money(row.max_price)}`,
    },
  ], []);

  const counterpartyColumns = useMemo(() => [
    { key: "party_name", label: "Counterparty", wrap: true },
    { key: "relationship", label: "Role" },
    { key: "trades", label: "Trades" },
    { key: "qty", label: "Qty", render: (value, row) => `${number(value)} ${row.unit}` },
  ], []);

  const chartRows = useMemo(
    () => (payload?.monthly_activity || []).map((row) => ({ ...row, label: monthLabel(row.period, true) })),
    [payload]
  );

  return (
    <AppShell firm={firm} fy={fy} firms={firms} fys={fys} setFirm={setFirm} setFy={setFy} activeKey="party-insights" setActiveKey={() => {}}>
      <div className="space-y-3 text-white">
        <div className={`rounded-2xl border border-amber-300/15 bg-gradient-to-r from-amber-400/10 via-white/[0.035] to-cyan-400/10 p-4 ${glass}`}>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">
                <Sparkles size={15} /> Party Insights <span className="rounded border border-amber-300/25 bg-amber-300/10 px-1.5 py-0.5 text-[9px]">BETA</span>
              </div>
              <h2 className="mt-1.5 text-lg font-semibold">Turn a quarter or the complete FY into a useful relationship report.</h2>
              <p className="mt-1 text-sm text-white/55">Choose any FY quarter or consolidated view for volume, pricing, connections, momentum, and payment position.</p>
            </div>
            <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:min-w-[720px] lg:grid-cols-[minmax(240px,1fr)_minmax(250px,1fr)_auto] lg:items-end">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">Party</label>
                <ComboBox value={partyId} onChange={(value) => { setPartyId(value); setPayload(null); setError(""); }} options={parties} placeholder="Select party" />
              </div>
              <div>
                <label htmlFor="party-insights-period" className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">Report period</label>
                <select
                  id="party-insights-period"
                  value={periodKey}
                  onChange={(event) => setPeriodKey(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 text-sm text-white outline-none transition hover:bg-white/10 focus:ring-2 focus:ring-white/20"
                >
                  {periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <button
                type="button"
                onClick={generate}
                disabled={loading}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-wait disabled:opacity-60 sm:col-span-2 lg:col-span-1"
              >
                <FileBarChart size={17} /> {loading ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>
        </div>

        {error ? <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div> : null}

        {!payload && !loading ? (
          <div className="flex min-h-[310px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/10 px-5 text-center">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-cyan-200"><FileBarChart size={27} /></div>
            <h3 className="mt-3 font-semibold">Select a party to build the report</h3>
            <p className="mt-1 max-w-lg text-sm text-white/50">The calculations use only the current firm, selected FY, and selected quarter or consolidated period. Nothing is saved or changed.</p>
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[310px] items-center justify-center rounded-2xl border border-white/10 bg-black/10 text-sm text-white/60">
            <RefreshCw className="mr-2 animate-spin" size={17} /> Reading contracts, bills, and receipts...
          </div>
        ) : null}

        {payload && !loading ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2">
              <div>
                <div className="font-semibold">{payload.meta?.party?.name}</div>
                <div className="text-xs text-white/50">{payload.meta?.firm?.name} | FY {payload.meta?.fy?.label} | {payload.meta?.period?.label}</div>
              </div>
              <button
                type="button"
                onClick={downloadPdf}
                disabled={downloading}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-wait disabled:opacity-60"
              >
                <Download size={16} /> {downloading ? "Preparing PDF..." : "Download PDF"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Metric label="Trades" value={number(payload.summary?.trades, 0)} note={`${number(payload.summary?.active_months, 0)} active months`} />
              <Metric label="Primary volume" value={number(payload.summary?.primary_qty)} note={payload.summary?.primary_unit} tone="amber" />
              <Metric label="Average trade" value={number(payload.summary?.avg_trade_qty)} note={payload.summary?.primary_unit} tone="emerald" />
              <Metric label="Outstanding" value={money(payload.financial?.outstanding)} note={`${payload.financial?.collection_rate ?? "-"}% collected`} tone="rose" />
            </div>

            <div className="grid gap-3 xl:grid-cols-[1.35fr_.65fr]">
              <Card
                title="Monthly Trading Rhythm"
                actions={<Momentum momentum={payload.momentum} />}
              >
                {chartRows.length ? (
                  <div className="h-[285px] rounded-xl border border-white/10 bg-black/20 p-2 sm:p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartRows} margin={{ top: 8, right: 12, left: 2, bottom: 4 }}>
                        <CartesianGrid stroke="rgba(255,255,255,.09)" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="period" tickFormatter={(value) => monthLabel(value, true)} tick={{ fill: "rgba(255,255,255,.65)", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(value) => number(value)} tick={{ fill: "rgba(255,255,255,.55)", fontSize: 10 }} axisLine={false} tickLine={false} width={54} />
                        <Tooltip content={<ChartTooltip unit={payload.summary?.primary_unit} />} />
                        <Bar dataKey="qty" fill="#22d3ee" radius={[5, 5, 0, 0]} maxBarSize={34} isAnimationActive animationDuration={450} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <div className="py-12 text-center text-sm text-white/50">No monthly activity in this period.</div>}
              </Card>

              <Card title="Financial Position" actions={<WalletCards size={17} className="text-emerald-200" />}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2.5"><span className="text-sm text-white/55">Bills</span><strong>{number(payload.financial?.bills, 0)}</strong></div>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2.5"><span className="text-sm text-white/55">Billed</span><strong>{money(payload.financial?.bill_total)}</strong></div>
                  <div className="flex items-center justify-between rounded-xl border border-emerald-300/15 bg-emerald-400/5 px-3 py-2.5"><span className="text-sm text-white/55">Received</span><strong className="text-emerald-200">{money(payload.financial?.received)}</strong></div>
                  <div className="flex items-center justify-between rounded-xl border border-rose-300/15 bg-rose-400/5 px-3 py-2.5"><span className="text-sm text-white/55">Outstanding</span><strong className="text-rose-200">{money(payload.financial?.outstanding)}</strong></div>
                </div>
              </Card>
            </div>

            <Card title="What Stands Out" actions={<Sparkles size={17} className="text-amber-200" />}>
              <div className="grid gap-2 md:grid-cols-2">
                {(payload.highlights || []).map((item, index) => (
                  <div key={`${item}-${index}`} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm leading-relaxed text-white/75">
                    <span className="mr-2 text-cyan-300">{String(index + 1).padStart(2, "0")}</span>{item}
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Product Mix and Price Bands">
              <DataTable columns={productColumns} rows={payload.products || []} allowedActions={[]} />
            </Card>

            <Card title="Frequent Trading Connections">
              <DataTable columns={counterpartyColumns} rows={payload.counterparties || []} allowedActions={[]} />
            </Card>

            {(payload.opportunities || []).length ? (
              <Card title="Ideas for the Next Conversation" actions={<Lightbulb size={17} className="text-amber-200" />}>
                <div className="grid gap-2 md:grid-cols-3">
                  {payload.opportunities.map((item) => (
                    <div key={item.title} className="rounded-xl border border-amber-300/15 bg-gradient-to-br from-amber-400/10 to-transparent p-3">
                      <div className="font-semibold text-amber-100">{item.title}</div>
                      <p className="mt-1 text-sm leading-relaxed text-white/60">{item.text}</p>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}

            <p className="px-1 text-xs leading-relaxed text-white/40">Beta note: this is a historical business summary, not a market forecast. Price insights are quantity-weighted from contracts recorded in the selected firm, FY, and report period.</p>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
