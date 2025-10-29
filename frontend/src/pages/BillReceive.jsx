// src/pages/BillReceive.jsx
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout";
import { useCtx } from "../state/context";
import { api } from "../api";
import { Card, Field, Input, glass } from "../components/primitives";
import { formatINR } from "../utils/format";
import ComboBox from "../components/combobox";
import DataTable from "../components/table";
import Pagination from "../components/pagination";
import { Search, Trash2 } from "lucide-react";
import { useToast } from "../components/toast";
import EditOverlay from "../components/edit-overlay";

function toYMD(d) {
  if (!d) return "";
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const dt = new Date(d);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function BillReceive() {
  const toast = useToast();
  const { firm, fy, setFirm, setFy } = useCtx();
  const [firms, setFirms] = useState([]);
  const [fys, setFys] = useState([]);

  const [parties, setParties] = useState([]);
  const [partyFilter, setPartyFilter] = useState(null);

  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [summaries, setSummaries] = useState({}); // { [billId]: { total, received, outstanding } }
  const [showOutstandingOnly, setShowOutstandingOnly] = useState(true);

  // Receive overlay state
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveFor, setReceiveFor] = useState(null); // row
  const [receipts, setReceipts] = useState([]);
  const [summary, setSummary] = useState({ total: 0, received: 0, outstanding: 0 });
  const [rcvDate, setRcvDate] = useState(toYMD(new Date()));
  const [rcvAmount, setRcvAmount] = useState("");
  const [rcvMode, setRcvMode] = useState("CASH");
  const [rcvRef, setRcvRef] = useState("");
  const [rcvNotes, setRcvNotes] = useState("");

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
    (async () => {
      const { data } = await api.get("/parties");
      setParties((data || []).map((p) => ({ value: p.id, label: p.name })));
    })();
  }, []);

  async function refresh() {
    try {
      const { data } = await api.get('/billing/party-bills', {
        params: partyFilter ? { party_id: partyFilter } : undefined,
      });
      setRows((data || []).map((r) => ({
        id: r.id,
        partyId: r.party_id,
        partyName: r.party_name,
        from: toYMD(r.from_date),
        to: toYMD(r.to_date),
        billDate: toYMD(r.bill_date),
        brokerage: Number(r.brokerage || 0),
        billId: r.bill_no || '',
        mailedAt: r.mailed_at || null,
        createdAt: r.created_at,
      })));
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.error || e?.message || 'Failed to load bills';
      toast.error(msg);
    }
  }
  useEffect(() => { if (firm?.id) refresh(); }, [firm?.id, fy?.id, partyFilter]);

  async function loadReceipts(billId) {
    const { data } = await api.get(`/billing/party-bills/${billId}/receipts`);
    setReceipts(data || []);
  }
  async function loadSummary(billId) {
    const { data } = await api.get(`/billing/party-bills/${billId}/summary`);
    setSummary({ total: Number(data.total||0), received: Number(data.received||0), outstanding: Number(data.outstanding||0) });
  }
  function openReceive(row) {
    setReceiveFor(row);
    setReceiveOpen(true);
    setRcvDate(toYMD(new Date()));
    setRcvAmount("");
    setRcvMode("CASH");
    setRcvRef("");
    setRcvNotes("");
    Promise.all([loadReceipts(row.id), loadSummary(row.id)]).catch(console.error);
  }
  async function addReceipt() {
    if (!receiveFor?.id) return;
    const amt = Number(rcvAmount);
    if (!amt || amt <= 0) return toast.error('Enter amount > 0');
    try {
      await api.post(`/billing/party-bills/${receiveFor.id}/receipts`, {
        receive_date: rcvDate,
        amount: amt,
        mode: rcvMode,
        reference_no: rcvRef,
        notes: rcvNotes,
      });
      setRcvAmount("");
      await Promise.all([loadReceipts(receiveFor.id), loadSummary(receiveFor.id)]);
      try {
        const { data } = await api.get(`/billing/party-bills/${receiveFor.id}/summary`);
        setSummaries((m) => ({ ...m, [receiveFor.id]: data }));
      } catch (_) {}
      toast.success('Receipt added');
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.error || 'Failed to add receipt';
      toast.error(msg);
    }
  }
  async function deleteReceipt(rid) {
    if (!receiveFor?.id) return;
    try {
      await api.delete(`/billing/party-bills/${receiveFor.id}/receipts/${rid}`);
      await Promise.all([loadReceipts(receiveFor.id), loadSummary(receiveFor.id)]);
      try {
        const { data } = await api.get(`/billing/party-bills/${receiveFor.id}/summary`);
        setSummaries((m) => ({ ...m, [receiveFor.id]: data }));
      } catch (_) {}
      toast.success('Receipt removed');
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete');
    }
  }

  const columns = [
    { key: "billId", label: "Bill No." },
    { key: "partyName", label: "Party" },
    { key: "billDate", label: "Bill Date" },
    { key: "received", label: "Received", render: (_v, row) => {
      const s = summaries[row.id];
      return s ? formatINR(s.received || 0) : '…';
    } },
    { key: "outstanding", label: "Outstanding", render: (_v, row) => {
      const s = summaries[row.id];
      return s ? (
        <span className={Number(s.outstanding||0) > 0 ? "text-red-300" : "text-emerald-300"}>
          {formatINR(s.outstanding || 0)}
        </span>
      ) : '…';
    } },
    { key: "mailedAt", label: "Mail", render: (v) => (
      v
        ? <span className="rounded px-2 py-0.5 text-xs bg-emerald-500/15 border border-emerald-500/25 text-emerald-200">Mailed</span>
        : <span className="rounded px-2 py-0.5 text-xs bg-yellow-500/15 border border-yellow-500/25 text-yellow-200">Not sent</span>
    )},
  ];

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let arr = rows;
    if (partyFilter) arr = arr.filter(r => r.partyId === partyFilter);
    if (!s) return arr;
    return arr.filter((r) => [r.partyName, r.billId].join(" ").toLowerCase().includes(s));
  }, [q, rows, partyFilter]);

  const filtered2 = useMemo(() => {
    if (!showOutstandingOnly) return filtered;
    // Include rows until their summary loads; then filter to outstanding > 0
    return filtered.filter((r) => {
      const sm = summaries[r.id];
      if (!sm) return true; // show while loading summary
      return Number(sm.outstanding) > 0;
    });
  }, [showOutstandingOnly, filtered, summaries]);

  const sorted = useMemo(() => {
    const arr = filtered2.slice();
    arr.sort((a, b) => {
      const A = a.billId ?? a.id ?? '';
      const B = b.billId ?? b.id ?? '';
      const nA = Number(A);
      const nB = Number(B);
      const bothNumeric = !Number.isNaN(nA) && !Number.isNaN(nB);
      return bothNumeric ? nA - nB : String(A).localeCompare(String(B));
    });
    return arr;
  }, [filtered2]);

  const total = sorted.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageRows = useMemo(() => sorted.slice(start, end), [sorted, start, end]);
  useEffect(() => { setPage(1); }, [q, pageSize, partyFilter, showOutstandingOnly]);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  // Preload summaries for visible rows
  useEffect(() => {
    (async () => {
      for (const r of pageRows) {
        if (!summaries[r.id]) {
          try {
            const { data } = await api.get(`/billing/party-bills/${r.id}/summary`);
            setSummaries((m) => ({ ...m, [r.id]: data }));
          } catch (_) {}
        }
      }
    })();
  }, [pageRows, summaries]);

  // Always preload summaries for the entire filtered set so totals are accurate
  useEffect(() => {
    (async () => {
      for (const r of filtered2) {
        if (!summaries[r.id]) {
          try {
            const { data } = await api.get(`/billing/party-bills/${r.id}/summary`);
            setSummaries((m) => ({ ...m, [r.id]: data }));
          } catch (_) {}
        }
      }
    })();
  }, [filtered2, summaries]);

  // Compute totals for the current filtered set
  const totals = useMemo(() => {
    let totalAmt = 0, totalReceived = 0, totalOutstanding = 0;
    for (const r of filtered2) {
      const s = summaries[r.id];
      if (!s) continue;
      totalAmt += Number(s.total || 0);
      totalReceived += Number(s.received || 0);
      totalOutstanding += Number(s.outstanding || 0);
    }
    return {
      total: Number(totalAmt.toFixed(2)),
      received: Number(totalReceived.toFixed(2)),
      outstanding: Number(totalOutstanding.toFixed(2)),
      counted: filtered2.filter(r => !!summaries[r.id]).length,
      expected: filtered2.length,
    };
  }, [filtered2, summaries]);

  return (
    <AppShell
      firm={firm}
      fy={fy}
      firms={firms}
      fys={fys}
      setFirm={setFirm}
      setFy={setFy}
      activeKey="bill-receive"
      setActiveKey={() => {}}
    >
      <div className="text-white">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${glass} bg-black/20 flex-1 min-w-[160px]`}>
            <Search size={16} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search party/bill id…"
              className="bg-transparent text-sm outline-none placeholder:text-white/50"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <div className="w-full sm:w-auto sm:min-w-[240px]">
              <ComboBox
                value={partyFilter}
                onChange={setPartyFilter}
                options={parties}
                placeholder="Filter by party"
              />
            </div>
            <button
              onClick={() => setPartyFilter(null)}
              className={`rounded-lg px-3 py-2 text-xs text-white/80 hover:text-white hover:bg-white/10 border border-white/10 ${glass}`}
              title="Clear party filter"
            >
              Clear
            </button>
            <label className={`flex items-center gap-2 rounded-xl px-3 py-2 ${glass} bg-black/20 text-xs`}>
              <input type="checkbox" checked={showOutstandingOnly} onChange={(e) => setShowOutstandingOnly(e.target.checked)} />
              <span>Outstanding only</span>
            </label>
            <span className="text-xs text-white/60">{total} record(s)</span>
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={pageRows}
          allowedActions={["receive"]}
          onAction={(type, row) => {
            if (type === "receive") openReceive(row);
          }}
        />
        <Pagination total={total} page={page} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />

        <div className="mt-3">
          <Card title="Totals (Current Filter)">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4 text-sm">
              <div className="rounded-lg p-3 bg-black/20 border border-white/10">
                <div className="text-white/60 text-xs">Bills Counted</div>
                <div className="text-lg font-semibold">{totals.counted} / {totals.expected}</div>
              </div>
                <div className="rounded-lg p-3 bg-black/20 border border-white/10">
                  <div className="text-white/60 text-xs">Total Amount</div>
                  <div className="text-lg font-semibold">{formatINR(totals.total)}</div>
                </div>
                <div className="rounded-lg p-3 bg-black/20 border border-white/10">
                  <div className="text-white/60 text-xs">Total Received</div>
                  <div className="text-lg font-semibold text-emerald-300">{formatINR(totals.received)}</div>
                </div>
                <div className="rounded-lg p-3 bg-black/20 border border-white/10">
                  <div className="text-white/60 text-xs">Outstanding</div>
                  <div className="text-lg font-semibold text-red-300">{formatINR(totals.outstanding)}</div>
                </div>
            </div>
            {totals.counted < totals.expected && (
              <div className="mt-2 text-xs text-white/60">Calculating… totals will finish once all bill summaries load.</div>
            )}
          </Card>
        </div>

        {/* Receive overlay */}
        <EditOverlay
          open={receiveOpen}
          title={`Receive Payment • ${receiveFor?.billId || `#${receiveFor?.id || ''}`}`}
          onClose={() => { setReceiveOpen(false); setReceiveFor(null); }}
          footer={
            <>
              <button
                onClick={() => { setReceiveOpen(false); setReceiveFor(null); }}
                className="rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/10 border border-white/10"
              >
                Close
              </button>
              <button
                onClick={addReceipt}
                className="rounded-lg px-3 py-2 text-sm font-semibold bg-emerald-400/20 hover:bg-emerald-400/30 border border-emerald-400/40"
              >
                Add Receipt
              </button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Card title="Summary">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg p-3 bg-black/20 border border-white/10">
                  <div className="text-white/60 text-xs">Total</div>
                  <div className="text-lg font-semibold">{formatINR(summary.total ?? 0)}</div>
                </div>
                <div className="rounded-lg p-3 bg-black/20 border border-white/10">
                  <div className="text-white/60 text-xs">Received</div>
                  <div className="text-lg font-semibold">{formatINR(summary.received ?? 0)}</div>
                </div>
                <div className="rounded-lg p-3 bg-black/20 border border-white/10">
                  <div className="text-white/60 text-xs">Outstanding</div>
                  <div className="text-lg font-semibold">{formatINR(summary.outstanding ?? 0)}</div>
                </div>
              </div>
            </Card>

            <Card title="Add Receipt">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Date">
                  <Input type="date" value={rcvDate} onChange={setRcvDate} />
                </Field>
                <Field label="Amount">
                  <Input type="number" value={rcvAmount} onChange={setRcvAmount} placeholder="0.00" />
                </Field>
                <Field label="Mode">
                  <select
                    className={`w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20 ${glass} bg-black/20`}
                    value={rcvMode}
                    onChange={(e) => setRcvMode(e.target.value)}
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank</option>
                    <option value="UPI">UPI</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="OTHER">Other</option>
                  </select>
                </Field>
                <Field label="Reference No.">
                  <Input value={rcvRef} onChange={setRcvRef} placeholder="Txn/Chq No." />
                </Field>
                <Field label="Notes" full>
                  <Input value={rcvNotes} onChange={setRcvNotes} placeholder="Optional notes" />
                </Field>
              </div>
            </Card>

            <div className="md:col-span-2">
            <Card title="Receipts">
              <div className={`overflow-x-auto ${glass} rounded-xl`}>
                <table className="min-w-full text-left text-xs sm:text-sm text-white">
                  <thead className="border-b border-white/10 text-white/70">
                    <tr>
                      <th className="px-2 sm:px-3 py-2">Date</th>
                      <th className="px-2 sm:px-3 py-2">Amount</th>
                      <th className="px-2 sm:px-3 py-2">Mode</th>
                      <th className="px-2 sm:px-3 py-2">Ref</th>
                      <th className="px-2 sm:px-3 py-2">Notes</th>
                      <th className="px-2 sm:px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.length === 0 && (
                      <tr><td colSpan={6} className="px-3 py-6 text-center text-white/60">No receipts yet.</td></tr>
                    )}
                    {receipts.map((r) => (
                      <tr key={r.id} className="border-t border-white/10 hover:bg-white/5">
                        <td className="px-2 sm:px-3 py-2">{toYMD(r.receive_date)}</td>
                        <td className="px-2 sm:px-3 py-2">{formatINR(r.amount || 0)}</td>
                        <td className="px-2 sm:px-3 py-2">{r.mode || ''}</td>
                        <td className="px-2 sm:px-3 py-2">{r.reference_no || ''}</td>
                        <td className="px-2 sm:px-3 py-2">{r.notes || ''}</td>
                        <td className="px-2 sm:px-3 py-2">
                          <button
                            onClick={() => deleteReceipt(r.id)}
                            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-white/90 transition-colors hover:bg-white/10 ${glass} bg-black/20`}
                            title="Delete"
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            </div>
          </div>
        </EditOverlay>
      </div>
    </AppShell>
  );
}
