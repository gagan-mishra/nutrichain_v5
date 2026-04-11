import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "../components/layout";
import { useCtx } from "../state/context";
import { api } from "../api";
import DataTable from "../components/table";
import Pagination from "../components/pagination";
import { Card, glass } from "../components/primitives";

function fmtMoney(n) {
  const value = Number(n || 0);
  return `\u20B9 ${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function ReportsPartyBillsAllFirms() {
  const { firm, fy, setFirm, setFy } = useCtx();
  const [firms, setFirms] = useState([]);
  const [fys, setFys] = useState([]);

  const [reportRows, setReportRows] = useState([]);
  const [reportFirms, setReportFirms] = useState([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [billCount, setBillCount] = useState(0);
  const [partyCount, setPartyCount] = useState(0);

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: firmList }, { data: fyList }] = await Promise.all([
        api.get("/firms"),
        api.get("/firms/fiscal-years"),
      ]);
      setFirms(firmList || []);
      setFys(fyList || []);
      if (!firm && firmList?.[0]) setFirm(firmList[0]);
      if (!fy && fyList?.[0]) setFy(fyList[0]);
    })();
  }, []);

  useEffect(() => {
    if (!firm?.id || !fy?.id) return;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const { data } = await api.get("/reports/party-bills-all-firms", {
          params: { fy_id: fy.id },
        });
        const rows = (data?.rows || []).map((r) => ({ ...r, id: r.party_id }));
        setReportRows(rows);
        setReportFirms(data?.firms || []);
        setGrandTotal(Number(data?.grand_total || 0));
        setBillCount(Number(data?.bill_count || 0));
        setPartyCount(Number(data?.party_count || 0));
      } catch (e) {
        setError(e?.response?.data?.error || "Failed to load all-firms party bills report");
        setReportRows([]);
        setReportFirms([]);
        setGrandTotal(0);
        setBillCount(0);
        setPartyCount(0);
      } finally {
        setLoading(false);
      }
    })();
  }, [firm?.id, fy?.id]);

  const columns = useMemo(
    () => [
      { key: "party_name", label: "Party", wrap: true },
      ...reportFirms.map((f) => ({
        key: `firm_${f.id}`,
        label: f.name,
        render: (_v, row) => fmtMoney(row?.firm_totals?.[f.id] || 0),
        sortValue: (row) => Number(row?.firm_totals?.[f.id] || 0),
      })),
      {
        key: "total",
        label: "Total",
        render: (v) => fmtMoney(v),
        sortValue: (row) => Number(row?.total || 0),
      },
    ],
    [reportFirms],
  );

  const filteredRows = useMemo(() => {
    const search = q.trim().toLowerCase();
    if (!search) return reportRows;
    return reportRows.filter((r) => String(r.party_name || "").toLowerCase().includes(search));
  }, [q, reportRows]);

  const total = filteredRows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageRows = useMemo(() => filteredRows.slice(start, end), [filteredRows, start, end]);

  useEffect(() => {
    setPage(1);
  }, [q, pageSize]);
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  const filteredTotal = useMemo(
    () => filteredRows.reduce((sum, row) => sum + Number(row.total || 0), 0),
    [filteredRows],
  );

  return (
    <AppShell
      firm={firm}
      fy={fy}
      firms={firms}
      fys={fys}
      setFirm={setFirm}
      setFy={setFy}
      activeKey="party-bills-all-firms-report"
      setActiveKey={() => {}}
    >
      <div className="text-white">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className={`flex min-w-[180px] flex-1 items-center gap-2 rounded-xl bg-black/20 px-3 py-2 ${glass}`}>
            <Search size={16} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search party"
              className="bg-transparent text-sm outline-none placeholder:text-white/50"
            />
          </div>
          <span className="text-xs text-white/60">{total} record(s)</span>
        </div>

        <Card title="Party Bill Totals Across All Firms">
          {error ? (
            <div className="mb-3 rounded-lg border border-red-400/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          {loading ? (
            <div className="mb-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/70">
              Loading report...
            </div>
          ) : null}
          <DataTable columns={columns} rows={pageRows} allowedActions={[]} />
          <Pagination total={total} page={page} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />

          <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="text-xs text-white/60">Parties with Bills</div>
              <div className="text-lg font-semibold">{partyCount}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="text-xs text-white/60">Bills in FY</div>
              <div className="text-lg font-semibold">{billCount}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="text-xs text-white/60">Grand Total (All Firms)</div>
              <div className="text-lg font-semibold">{fmtMoney(grandTotal)}</div>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="mb-2 text-xs uppercase tracking-wider text-white/60">Firm Totals</div>
            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2 xl:grid-cols-3">
              {reportFirms.map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2">
                  <span className="truncate pr-3 text-white/90">{f.name}</span>
                  <strong>{fmtMoney(f.total)}</strong>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 text-sm font-semibold">
              <span>Grand Total</span>
              <span>{fmtMoney(grandTotal)}</span>
            </div>
            {!!q.trim() && (
              <div className="mt-1 text-xs text-white/60">Filtered total (search result): {fmtMoney(filteredTotal)}</div>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
