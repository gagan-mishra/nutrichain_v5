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

function toYMD(d) {
  if (!d) return "";
  const dt = new Date(d);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startEndFromFy(fy) {
  // Prefer explicit dates from API
  if (fy?.startDate && fy?.endDate) {
    return { from: toYMD(fy.startDate), to: toYMD(fy.endDate), bill: toYMD(fy.endDate) };
  }
  // Parse label like "2024-25" or "2024"
  const label = String(fy?.label || "");
  const m = label.match(/(\d{4})/);
  let y0;
  if (m) y0 = Number(m[1]);
  else {
    const today = new Date();
    const m0 = today.getMonth(); // 0=Jan
    y0 = today.getFullYear() - (m0 < 3 ? 1 : 0); // FY starts Apr (month 3)
  }
  const from = new Date(Date.UTC(y0, 3, 1)); // 1 Apr y0
  const to = new Date(Date.UTC(y0 + 1, 2, 31)); // 31 Mar y0+1
  return { from: toYMD(from), to: toYMD(to), bill: toYMD(to) };
}

export default function PartyBill() {
  const toast = useToast();
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

  // Local list (placeholder until backend is defined)
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  function save() {
    if (!partyId) return toast.error("Select a party");
    if (!from || !to) return toast.error("Select a date range");
    if (new Date(from) > new Date(to)) return toast.error("From date cannot be after To date");
    const rec = {
      id: editingId ?? Date.now(),
      partyId,
      partyName: parties.find((p) => p.value === partyId)?.label || "",
      from,
      to,
      billDate,
      brokerage: Number(brokerage || 0),
      billId: billId?.trim() || "",
      createdAt: new Date().toISOString(),
    };
    if (editingId) {
      setRows((xs) => xs.map((r) => (r.id === editingId ? rec : r)));
      toast.success("Bill updated");
      setEditingId(null);
      setEditOpen(false);
    } else {
      setRows((xs) => [rec, ...xs]);
      toast.success("Bill created (local)");
      setTab("list");
    }
  }

  const columns = [
    { key: "_sn", label: "#" },
    { key: "partyName", label: "Party" },
    { key: "from", label: "From" },
    { key: "to", label: "To" },
    { key: "billDate", label: "Bill Date" },
    { key: "brokerage", label: "Brokerage" },
    { key: "billId", label: "Bill ID" },
  ];

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => [r.partyName, r.billId].join(" ").toLowerCase().includes(s));
  }, [q, rows]);

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageRows = useMemo(() => filtered.slice(start, end).map((r, i) => ({ ...r, _sn: start + i + 1 })), [filtered, start, end]);
  useEffect(() => { setPage(1); }, [q, pageSize]);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

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
              allowedActions={["download","print","edit","delete","mail"]}
              onAction={(type, row) => {
                if (type === "download") {
                  const headers = ["Party","From","To","Bill Date","Brokerage","Bill ID"];
                  const values = [row.partyName, row.from, row.to, row.billDate, row.brokerage, row.billId];
                  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
                  const csv = [headers.join(","), values.map(esc).join(",")].join("\n");
                  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `party-bill-${row.billId || row.id}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                } else if (type === "print") {
                  toast.info("Print coming soon");
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
                  setRows((xs) => xs.filter((r) => r.id !== row.id));
                } else if (type === "mail") {
                  toast.info("Mail coming soon");
                }
              }}
            />
            <Pagination total={total} page={page} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
