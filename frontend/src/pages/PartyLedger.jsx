import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout";
import { useCtx } from "../state/context";
import { api } from "../api";
import { Card, glass } from "../components/primitives";
import ComboBox from "../components/combobox";
import DataTable from "../components/table";
import Pagination from "../components/pagination";
import { Search, Download, RefreshCw } from "lucide-react";
import { useToast } from "../components/toast";
import { formatINR } from "../utils/format";

function toYMD(v) {
  if (!v) return "";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDate(v) {
  const ymd = toYMD(v);
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

function extractFilename(disposition, fallback) {
  const text = String(disposition || "");
  const m = text.match(/filename\*?=(?:UTF-8'')?"?([^\";]+)"?/i);
  if (!m) return fallback;
  try {
    return decodeURIComponent(m[1]).replace(/[\/\\:*?"<>|]/g, "_");
  } catch {
    return m[1].replace(/[\/\\:*?"<>|]/g, "_");
  }
}

export default function PartyLedger() {
  const toast = useToast();
  const { firm, fy, setFirm, setFy } = useCtx();

  const [firms, setFirms] = useState([]);
  const [fys, setFys] = useState([]);
  const [parties, setParties] = useState([]);

  const [partyId, setPartyId] = useState(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [asOf, setAsOf] = useState(toYMD(new Date()));

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [payload, setPayload] = useState({
    meta: {},
    rows: [],
    transactions: [],
    totals: { bills: 0, bill_total: 0, received: 0, outstanding: 0 },
  });

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    (async () => {
      const [{ data: firmList }, { data: fyList }, { data: partyList }] = await Promise.all([
        api.get("/firms"),
        api.get("/firms/fiscal-years"),
        api.get("/parties"),
      ]);

      setFirms(firmList || []);
      setFys(fyList || []);
      setParties((partyList || []).map((p) => ({ value: p.id, label: p.name })));

      if (!firm && firmList?.[0]) setFirm(firmList[0]);
      if (!fy && fyList?.[0]) setFy(fyList[0]);
    })();
  }, []);

  useEffect(() => {
    if (!fy) return;
    setFrom(toYMD(fy.startDate));
    setTo(toYMD(fy.endDate));
  }, [fy?.id]);

  const filteredRows = useMemo(() => {
    const rows = payload?.rows || [];
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      String(r.bill_no || "").toLowerCase().includes(s)
      || String(r.bill_date || "").includes(s)
    );
  }, [payload?.rows, q]);

  const total = filteredRows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageRows = useMemo(() => filteredRows.slice(start, end), [filteredRows, start, end]);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);
  useEffect(() => { setPage(1); }, [q, partyId, from, to, pageSize]);

  async function loadLedger() {
    if (!partyId) return toast.error("Select a party");
    if (!from || !to) return toast.error("Select date range");
    if (!asOf) return toast.error("Select As Of date");
    if (from > to) return toast.error("From date must be before To date");

    try {
      setLoading(true);
      const { data } = await api.get("/billing/party-ledger", {
        params: { party_id: partyId, from, to, as_of: asOf },
      });
      setPayload(data || { rows: [], transactions: [], totals: {} });
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.error || "Failed to load ledger";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf() {
    if (!partyId) return toast.error("Select a party");
    if (!from || !to) return toast.error("Select date range");
    if (!asOf) return toast.error("Select As Of date");
    if (from > to) return toast.error("From date must be before To date");

    try {
      setDownloading(true);
      const res = await api.get("/billing/party-ledger/pdf", {
        params: { party_id: partyId, from, to, as_of: asOf },
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const fallback = `Ledger-${partyId}-${from}-to-${to}.pdf`;
      const filename = extractFilename(res.headers?.["content-disposition"], fallback);

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Ledger PDF downloaded");
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.error || "Failed to download PDF";
      toast.error(msg);
    } finally {
      setDownloading(false);
    }
  }

  const columns = [
    { key: "bill_no", label: "Bill No." },
    { key: "bill_date", label: "Bill Date", render: (v) => fmtDate(v) },
    {
      key: "period",
      label: "Period",
      sortValue: (r) => `${r.from_date || ""}_${r.to_date || ""}`,
      render: (_v, r) => `${fmtDate(r.from_date)} - ${fmtDate(r.to_date)}`,
    },
    {
      key: "bill_total",
      label: "Bill Amount",
      render: (v) => formatINR(v || 0),
      sortValue: (r) => Number(r.bill_total || 0),
    },
    {
      key: "received",
      label: "Received",
      render: (v) => <span className="text-emerald-300">{formatINR(v || 0)}</span>,
      sortValue: (r) => Number(r.received || 0),
    },
    {
      key: "outstanding",
      label: "Outstanding",
      render: (v) => (
        <span className={Number(v || 0) > 0 ? "text-red-300" : "text-emerald-300"}>
          {formatINR(v || 0)}
        </span>
      ),
      sortValue: (r) => Number(r.outstanding || 0),
    },
    {
      key: "last_receipt_date",
      label: "Last Payment",
      render: (v) => v ? fmtDate(v) : "-",
    },
  ];

  const periodLabel = `${fmtDate(from)} - ${fmtDate(to)}`;
  const asOfLabel = fmtDate(asOf);

  const txColumns = [
    { key: "date", label: "Date", render: (v) => fmtDate(v) },
    { key: "type", label: "Type" },
    { key: "bill_no", label: "Bill No." },
    {
      key: "debit",
      label: "Debit (Bill)",
      render: (v) => v ? formatINR(v) : "-",
      sortValue: (r) => Number(r.debit || 0),
    },
    {
      key: "credit",
      label: "Credit (Receipt)",
      render: (v) => v ? formatINR(v) : "-",
      sortValue: (r) => Number(r.credit || 0),
    },
    {
      key: "balance",
      label: "Running Balance",
      render: (v) => (
        <span className={Number(v || 0) > 0 ? "text-red-300" : "text-emerald-300"}>
          {formatINR(v || 0)}
        </span>
      ),
      sortValue: (r) => Number(r.balance || 0),
    },
    { key: "note", label: "Reference", wrap: true },
  ];

  return (
    <AppShell
      firm={firm}
      fy={fy}
      firms={firms}
      fys={fys}
      setFirm={setFirm}
      setFy={setFy}
      activeKey="party-ledger"
      setActiveKey={() => {}}
    >
      <div className="text-white">
        <div className="mb-3 grid grid-cols-1 gap-2 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-white/60">Party</div>
            <ComboBox
              value={partyId}
              onChange={setPartyId}
              options={parties}
              placeholder="Select party"
            />
          </div>
          <div className="lg:col-span-2">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-white/60">From (Bill Date)</div>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={`w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20 ${glass} bg-black/20`}
            />
          </div>
          <div className="lg:col-span-2">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-white/60">To (Bill Date)</div>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={`w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20 ${glass} bg-black/20`}
            />
          </div>
          <div className="lg:col-span-2">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-white/60">As Of (Payments Till)</div>
            <input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              className={`w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20 ${glass} bg-black/20`}
              title="As Of date (receipts up to this date are included)"
            />
          </div>
          <div className="lg:col-span-1">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-transparent select-none">Action</div>
            <button
              onClick={() => setAsOf(toYMD(new Date()))}
              className={`w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm border border-white/15 ${glass} bg-black/20 hover:bg-white/10`}
              title="Set As Of to today"
            >
              Today
            </button>
          </div>
          <div className="lg:col-span-2">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-transparent select-none">Action</div>
            <button
              onClick={loadLedger}
              disabled={loading}
              className={`w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm border border-white/15 ${glass} bg-black/20 hover:bg-white/10 disabled:opacity-60`}
            >
              <RefreshCw size={16} /> {loading ? "Loading..." : "Load Ledger"}
            </button>
          </div>
          <div className="lg:col-span-2">
            <button
              onClick={downloadPdf}
              disabled={downloading || !payload?.rows?.length}
              className={`w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm border border-emerald-400/30 bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-60`}
            >
              <Download size={16} /> {downloading ? "Downloading..." : "Download PDF"}
            </button>
          </div>
        </div>

        <div className={`mb-3 rounded-xl px-3 py-2 text-xs ${glass} bg-black/20 text-white/75`}>
          Showing bills for <strong className="text-white">{periodLabel}</strong> and receipts counted till <strong className="text-white">{asOfLabel}</strong>.
        </div>

        <div className={`mb-3 flex items-center gap-2 rounded-xl px-3 py-2 ${glass} bg-black/20`}>
          <Search size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by bill no/date..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-white/50"
          />
        </div>

        <div className="mb-3">
          <Card title="Ledger Totals">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4 text-sm">
              <div className="rounded-lg p-3 bg-black/20 border border-white/10">
                <div className="text-white/60 text-xs">Bills</div>
                <div className="text-lg font-semibold">{payload?.totals?.bills || 0}</div>
              </div>
              <div className="rounded-lg p-3 bg-black/20 border border-white/10">
                <div className="text-white/60 text-xs">Total Bill Amount</div>
                <div className="text-lg font-semibold">{formatINR(payload?.totals?.bill_total || 0)}</div>
              </div>
              <div className="rounded-lg p-3 bg-black/20 border border-white/10">
                <div className="text-white/60 text-xs">Received</div>
                <div className="text-lg font-semibold text-emerald-300">{formatINR(payload?.totals?.received || 0)}</div>
              </div>
              <div className="rounded-lg p-3 bg-black/20 border border-white/10">
                <div className="text-white/60 text-xs">Outstanding</div>
                <div className="text-lg font-semibold text-red-300">{formatINR(payload?.totals?.outstanding || 0)}</div>
              </div>
            </div>
          </Card>
        </div>

        <DataTable columns={columns} rows={pageRows} allowedActions={[]} />
        <Pagination total={total} page={page} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />

        <div className="mt-4">
          <Card title="Transaction Ledger">
            <DataTable
              columns={txColumns}
              rows={payload?.transactions || []}
              allowedActions={[]}
              indexColumn
              indexStart={1}
            />
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
