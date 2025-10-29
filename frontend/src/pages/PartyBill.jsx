// src/pages/PartyBill.jsx
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout";
import { useCtx } from "../state/context";
import { api } from "../api";
import { Tabs, Card, Field, Input, glass } from "../components/primitives";
import ComboBox from "../components/combobox";
import DataTable from "../components/table";
import Pagination from "../components/pagination";
import { Plus, List as ListIcon, Save, X, Search } from "lucide-react";
import { useToast } from "../components/toast";
import EditOverlay from "../components/edit-overlay";
import ConfirmationDialog from "../components/confirm-dialog";
import { usePrintHtml } from "../print/usePrintHtml";
import { buildPartyBillHtml, buildPartyBillExcelHtml } from "../print/party-bill-template";

function toYMD(d) {
  if (!d) return "";
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d; // already a plain date
  const dt = new Date(d);
  // use local getters to avoid UTC shifting
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startEndFromFy(fy) {
  // Prefer explicit dates from API (assumed YYYY-MM-DD strings)
  if (fy?.startDate && fy?.endDate) {
    return { from: toYMD(fy.startDate), to: toYMD(fy.endDate), bill: toYMD(fy.endDate) };
  }
  // Parse label like "2024-25" or fallback from today
  const label = String(fy?.label || "");
  const m = label.match(/(\d{4})/);
  let y0;
  if (m) y0 = Number(m[1]);
  else {
    const today = new Date();
    const m0 = today.getMonth(); // 0=Jan
    y0 = today.getFullYear() - (m0 < 3 ? 1 : 0); // FY starts Apr
  }
  // Build YYYY-MM-DD strings directly to avoid timezone pitfalls
  const from = `${y0}-04-01`;
  const to = `${y0 + 1}-03-31`;
  return { from, to, bill: to };
}

// ---------- helpers for naming downloaded files ----------
function firmInitials(name = "") {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 4).map(w => w[0]?.toUpperCase() || "");
  const ini = letters.join("");
  return ini || "FIRM";
}
function fyRangeStr(from, to) {
  // prefer like 2024-25 based on start/end year
  const y1 = (from || "").slice(0, 4);
  const y2full = (to || "").slice(0, 4);
  const y2 = y2full ? y2full.slice(-2) : "";
  return y1 && y2 ? `${y1}-${y2}` : (y1 || y2full || "");
}
function fileSafe(s = "") {
  return String(s)
    .replace(/[\\/:*?"<>|]+/g, "-") // remove illegal filename chars
    .replace(/\s+/g, " ")
    .trim();
}

export default function PartyBill() {
  const toast = useToast();
  const { open: openPrint } = usePrintHtml();
  const { firm, fy, setFirm, setFy } = useCtx();
  const [firms, setFirms] = useState([]);
  const [fys, setFys] = useState([]);

  // Form state
  const [tab, setTab] = useState("add");
  const [parties, setParties] = useState([]);
  const [partyId, setPartyId] = useState(null);
  const defaults = startEndFromFy(fy);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [billDate, setBillDate] = useState(defaults.bill);
  const [brokerage, setBrokerage] = useState("");
  const [billId, setBillId] = useState("");

  // Bills list (persisted via backend)
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // Receipts-related UI moved to Bill Receive page

  useEffect(() => {
    // load firms + fiscal years (for header context)
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
    // whenever FY changes, reset range and bill date to FY defaults
    const d = startEndFromFy(fy);
    setFrom(d.from);
    setTo(d.to);
    setBillDate(d.bill);
  }, [fy?.id]);

  useEffect(() => {
    // load party options (all parties)
    (async () => {
      const { data } = await api.get("/parties");
      setParties((data || []).map((p) => ({ value: p.id, label: p.name })));
    })();
  }, []);

  function reset() {
    const d = startEndFromFy(fy);
    setPartyId(null);
    setFrom(d.from);
    setTo(d.to);
    setBillDate(d.bill);
    setBrokerage("");
    setBillId("");
  }

  const [editingId, setEditingId] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const askDelete = (cb) => { setPendingAction(() => cb); setConfirmOpen(true); };

  // Receive overlay moved to Bill Receive page

  async function refresh() {
    try {
      const { data } = await api.get('/billing/party-bills');
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
  useEffect(() => { if (firm?.id) refresh(); }, [firm?.id, fy?.id]);

  // Receive handlers removed from this page

  async function save() {
    if (!partyId) return toast.error("Select a party");
    if (!from || !to) return toast.error("Select a date range");
    if (new Date(from) > new Date(to)) return toast.error("From date cannot be after To date");
    const body = {
      party_id: partyId,
      bill_no: billId?.trim() || null,
      from_date: from,
      to_date: to,
      bill_date: billDate,
      brokerage: Number(brokerage || 0),
      fiscal_year_id: fy?.id,
    };
    try {
      if (editingId) {
        await api.put(`/billing/party-bills/${editingId}`, body);
        toast.success('Bill updated');
        setEditOpen(false);
        setEditingId(null);
      } else {
        await api.post('/billing/party-bills', body);
        toast.success('Bill created');
        setTab('list');
      }
      await refresh();
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.error || e?.message || 'Failed to save bill';
      toast.error(msg);
    }
  }

  const columns = [
    { key: "billId", label: "Bill No." },
    { key: "partyName", label: "Party" },
    { key: "from", label: "From" },
    { key: "to", label: "To" },
    { key: "billDate", label: "Bill Date" },
    { key: "brokerage", label: "Brokerage" },
    { key: "mailedAt", label: "Mail", render: (v) => (
      v
        ? <span className="rounded px-2 py-0.5 text-xs bg-emerald-500/15 border border-emerald-500/25 text-emerald-200">Mailed</span>
        : <span className="rounded px-2 py-0.5 text-xs bg-yellow-500/15 border border-yellow-500/25 text-yellow-200">Not sent</span>
    )},
  ];

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => [r.partyName, r.billId].join(" ").toLowerCase().includes(s));
  }, [q, rows]);

  // natural sort by bill number (numeric if possible, else lexicographic)
  const sorted = useMemo(() => {
    const arr = filtered.slice();
    arr.sort((a, b) => {
      const A = a.billId ?? a.id ?? '';
      const B = b.billId ?? b.id ?? '';
      const nA = Number(A);
      const nB = Number(B);
      const bothNumeric = !Number.isNaN(nA) && !Number.isNaN(nB);
      return bothNumeric ? nA - nB : String(A).localeCompare(String(B));
    });
    return arr;
  }, [filtered]);

  const total = sorted.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageRows = useMemo(() => sorted.slice(start, end), [sorted, start, end]);
  useEffect(() => { setPage(1); }, [q, pageSize]);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  // Summaries are not shown on this page

  return (
    <AppShell
      firm={firm}
      fy={fy}
      firms={firms}
      fys={fys}
      setFirm={setFirm}
      setFy={setFy}
      activeKey="party-bill"
      setActiveKey={() => {}}
    >
      <div className="text-white">
        <Tabs
          tabs={[
            { key: "add", label: "Add", icon: <Plus size={16} /> },
            { key: "list", label: "List", icon: <ListIcon size={16} /> },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === "add" && (
          <>
            <Card title="Party Bill">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Party">
                  <ComboBox
                    value={partyId}
                    onChange={setPartyId}
                    options={parties}
                    placeholder="Select party"
                  />
                </Field>
                <Field label="Brokerage">
                  <Input type="number" value={brokerage} onChange={setBrokerage} placeholder="0" />
                </Field>
                <Field label="Bill ID">
                  <Input value={billId} onChange={setBillId} placeholder="e.g., FY24-25/001" />
                </Field>
                <Field label="Bill Date">
                  <Input type="date" value={billDate} onChange={setBillDate} />
                </Field>
                <Field label="From (default FY start)">
                  <Input type="date" value={from} onChange={setFrom} />
                </Field>
                <Field label="To (default FY end)">
                  <Input type="date" value={to} onChange={setTo} />
                </Field>
              </div>
            </Card>

            <div className="mt-4 mb-24 flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={reset}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/5 ${glass}`}
              >
                <X size={16} /> Reset
              </button>
              <button
                onClick={save}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 ${glass} bg-white/10`}
              >
                <Save size={16} /> Create
              </button>
            </div>
            <div className="h-10" aria-hidden="true" />
          </>
        )}

        {/* Edit overlay */}
        <EditOverlay
          open={editOpen}
          title={`Edit Bill • ${billId || `#${editingId}`}`}
          onClose={() => {
            setEditOpen(false);
            setEditingId(null);
          }}
          footer={
            <>
              <button
                onClick={() => {
                  setEditOpen(false);
                  setEditingId(null);
                }}
                className="rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/10 border border-white/10"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="rounded-lg px-3 py-2 text-sm font-semibold bg-yellow-400/20 hover:bg-yellow-400/30 border border-yellow-400/40"
              >
                Update
              </button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Party">
              <ComboBox value={partyId} onChange={setPartyId} options={parties} placeholder="Select party" />
            </Field>
            <Field label="Brokerage">
              <Input type="number" value={brokerage} onChange={setBrokerage} placeholder="0" />
            </Field>
            <Field label="Bill ID">
              <Input value={billId} onChange={setBillId} placeholder="e.g., FY24-25/001" />
            </Field>
            <Field label="Bill Date">
              <Input type="date" value={billDate} onChange={setBillDate} />
            </Field>
            <Field label="From">
              <Input type="date" value={from} onChange={setFrom} />
            </Field>
            <Field label="To">
              <Input type="date" value={to} onChange={setTo} />
            </Field>
          </div>
        </EditOverlay>

        {tab === "list" && (
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${glass} bg-black/20`}>
                <Search size={16} />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search party/bill id…"
                  className="bg-transparent text-sm outline-none placeholder:text-white/50"
                />
              </div>
              <span className="text-xs text-white/60">{total} record(s)</span>
            </div>

            <DataTable
              columns={columns}
              rows={pageRows}
              allowedActions={["download","print","mail","edit","delete"]}
              onAction={(type, row) => {
                if (type === "download") {
                  (async () => {
                    try {
                      const { data } = await api.get('/billing/party-bills/compute', { params: {
                        party_id: row.partyId,
                        from: row.from,
                        to: row.to,
                        bill_date: row.billDate,
                        bill_no: row.billId,
                        brokerage: row.brokerage,
                      }});
                      const html = buildPartyBillExcelHtml(data);
                      const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      const ini = firmInitials(firm?.name);
                      const party = fileSafe(row.partyName || "Party");
                      const yr = fyRangeStr(row.from, row.to);
                      const bill = fileSafe(row.billId || row.id || "bill");
                      a.download = `${bill}. ${ini}. ${party}. ${yr}.xls`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch (e) {
                      console.error(e);
                      toast.error('Failed to download Excel');
                    }
                  })();
                } else if (type === "print") {
                  (async () => {
                    try {
                      const { data } = await api.get('/billing/party-bills/compute', { params: {
                        party_id: row.partyId,
                        from: row.from,
                        to: row.to,
                        bill_date: row.billDate,
                        bill_no: row.billId,
                        brokerage: row.brokerage,
                      }});
                      const html = buildPartyBillHtml(data);
                      openPrint(html);
                    } catch (e) {
                      console.error(e);
                      toast.error('Failed to build bill');
                    }
                  })();
                } else if (type === "edit") {
                  setEditingId(row.id);
                  setPartyId(row.partyId);
                  setFrom(row.from);
                  setTo(row.to);
                  setBillDate(row.billDate);
                  setBrokerage(row.brokerage);
                  setBillId(row.billId);
                  setEditOpen(true);
                } else if (type === "delete") {
                  askDelete(async () => {
                    try { await api.delete(`/billing/party-bills/${row.id}`); await refresh(); }
                    catch (e) { console.error(e); toast.error('Failed to delete'); }
                  });
                } else if (type === "mail") {
                  (async () => {
                    toast.info('Preparing email…');
                    try {
                      const { data } = await api.post(`/billing/party-bills/${row.id}/mail`);
                      toast.success(`Mail sent to ${data.to} recipient(s)`);
                      setRows(xs => xs.map(r => r.id === row.id ? { ...r, mailedAt: data.mailed_at } : r));
                    } catch (e) {
                      console.error(e);
                      const msg = e?.response?.data?.error || 'Failed to send mail';
                      toast.error(msg);
                    }
                  })();
                }
              }}
            />
            <Pagination total={total} page={page} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />
          </div>
        )}
        <ConfirmationDialog
          open={confirmOpen}
          title="Delete bill?"
          message="This will permanently remove the bill."
          confirmLabel="Delete"
          onCancel={() => { setConfirmOpen(false); setPendingAction(null); }}
          onConfirm={async () => {
            setConfirmOpen(false);
            if (pendingAction) await pendingAction();
            setPendingAction(null);
          }}
        />

        {/* Receipts moved to Bill Receive page */}
      </div>
    </AppShell>
  );
}
