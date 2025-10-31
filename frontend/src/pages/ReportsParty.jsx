// src/pages/ReportsParty.jsx
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout";
import { useCtx } from "../state/context";
import { api } from "../api";
import DataTable from "../components/table";
import Pagination from "../components/pagination";
import { glass, Card } from "../components/primitives";
import { Search } from "lucide-react";

function fmtQty(n) {
  const v = Number(n || 0);
  return v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function ReportsParty() {
  const { firm, fy, setFirm, setFy } = useCtx();
  const [firms, setFirms] = useState([]);
  const [fys, setFys] = useState([]);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
    if (!firm?.id) return;
    (async () => {
      const { data } = await api.get('/reports/party-volume');
      setRows(data || []);
    })();
  }, [firm?.id, fy?.id]);

  const columns = [
    { key: 'party_name', label: 'Party' },
    { key: 'seller_qty', label: 'Seller Qty', render: (v) => fmtQty(v) },
    { key: 'buyer_qty', label: 'Buyer Qty', render: (v) => fmtQty(v) },
    { key: 'total_qty', label: 'Total Qty', render: (v) => fmtQty(v) },
  ];

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r => r.party_name.toLowerCase().includes(s));
  }, [q, rows]);

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageRows = useMemo(() => filtered.slice(start, end), [filtered, start, end]);
  useEffect(() => { setPage(1); }, [q, pageSize]);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  const totals = useMemo(() => {
    let s = 0, b = 0, t = 0;
    for (const r of filtered) { s += r.seller_qty || 0; b += r.buyer_qty || 0; t += r.total_qty || 0; }
    return { s, b, t };
  }, [filtered]);

  return (
    <AppShell
      firm={firm}
      fy={fy}
      firms={firms}
      fys={fys}
      setFirm={setFirm}
      setFy={setFy}
      activeKey="party-reports"
      setActiveKey={() => {}}
    >
      <div className="text-white">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${glass} bg-black/20 flex-1 min-w-[160px]`}>
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

        <Card title="Party Volume (FY)">
          <DataTable columns={columns} rows={pageRows} allowedActions={[]} />
          <Pagination total={total} page={page} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3 text-sm">
            <div className="rounded-lg p-3 bg-black/20 border border-white/10">
              <div className="text-white/60 text-xs">Total Seller Qty</div>
              <div className="text-lg font-semibold">{fmtQty(totals.s)}</div>
            </div>
            <div className="rounded-lg p-3 bg-black/20 border border-white/10">
              <div className="text-white/60 text-xs">Total Buyer Qty</div>
              <div className="text-lg font-semibold">{fmtQty(totals.b)}</div>
            </div>
            <div className="rounded-lg p-3 bg-black/20 border border-white/10">
              <div className="text-white/60 text-xs">Aggregate Qty</div>
              <div className="text-lg font-semibold">{fmtQty(totals.t)}</div>
            </div>
          </div>
        </Card>

      </div>
    </AppShell>
  );
}
