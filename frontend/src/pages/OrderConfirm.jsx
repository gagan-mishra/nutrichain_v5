// src/pages/OrderConfirm.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "../components/layout";
import { useCtx } from "../state/context";
import { api } from "../api";
import {
  Tabs,
  Card,
  Field,
  Input,
  TextArea,
  glass,
} from "../components/primitives";
import ComboBox from "../components/combobox";
import DataTable from "../components/table";
import ConfirmationDialog from "../components/confirm-dialog";
import EditOverlay from "../components/edit-overlay";
import { useToast } from "../components/toast";
import Pagination from "../components/pagination";
import {
  Plus,
  List as ListIcon,
  Trash2,
  Save,
  X,
  Search,
  ArrowUpDown,
} from "lucide-react";

// Print helpers
import { buildContractPrintHtml } from "../print/contract-template";
import { usePrintHtml } from "../print/usePrintHtml";

/* ---------------- utils ---------------- */
function fmtDMY(input) {
  if (!input) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split("-");
    return `${d}/${m}/${y}`;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(input)) {
    // treat as plain date; avoid timezone shifting
    const s = input.slice(0, 10);
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(input);
  if (Number.isNaN(dt.getTime())) return String(input);
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yy = dt.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

/* ---------------- forms ---------------- */
function OrderForm({
  draft,
  setDraft,
  sellerOptions,
  buyerOptions,
  productOptions,
  isEditing,
}) {
  const wrap = isEditing ? "ring-1 ring-yellow-400/40 rounded-2xl" : "";

  return (
    <div className="flex flex-col gap-6">
      {/* ===== Contract & Parties ===== */}
      <div className={wrap}>
        <Card
          title={`Contract & Parties${isEditing ? " • Editing" : ""}`}
          actions={<span className="text-xs text-white/60">Primary</span>}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Contract Number">
              <Input
                value={draft.contract_no}
                onChange={(v) => setDraft({ ...draft, contract_no: v })}
                placeholder="Auto or manual"
              />
            </Field>
            <Field label="Order Date">
              <Input
                type="date"
                value={draft.order_date}
                onChange={(v) => setDraft({ ...draft, order_date: v })}
              />
            </Field>
            <Field label="Seller">
              <ComboBox
                value={draft.seller}
                onChange={(v) => setDraft({ ...draft, seller: v })}
                options={sellerOptions}
                placeholder="Select seller"
              />
            </Field>
            <Field label="Seller Brokerage (%)">
              <Input
                type="number"
                value={draft.seller_brokerage}
                onChange={(v) => setDraft({ ...draft, seller_brokerage: v })}
              />
            </Field>
            <Field label="Buyer">
              <ComboBox
                value={draft.buyer}
                onChange={(v) => setDraft({ ...draft, buyer: v })}
                options={buyerOptions}
                placeholder="Select buyer"
              />
            </Field>
            <Field label="Buyer Brokerage (%)">
              <Input
                type="number"
                value={draft.buyer_brokerage}
                onChange={(v) => setDraft({ ...draft, buyer_brokerage: v })}
              />
            </Field>
          </div>
        </Card>
      </div>

      {/* ===== Logistics ===== */}
      <div className={wrap}>
        <Card title="Logistics">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Delivery Station">
              <Input
                value={draft.delivery_station}
                onChange={(v) => setDraft({ ...draft, delivery_station: v })}
                placeholder="Station/Location"
              />
            </Field>
            <Field label="Delivery Schedule">
              <Input
                value={draft.delivery_schedule}
                onChange={(v) => setDraft({ ...draft, delivery_schedule: v })}
                placeholder="e.g., within 7 days"
              />
            </Field>
            <Field label="Status">
              <Input
                value={draft.status}
                onChange={(v) => setDraft({ ...draft, status: v })}
                placeholder="Open/Confirmed/Pending"
              />
            </Field>
            <Field label="Payment Criteria">
              <Input
                value={draft.payment_criteria}
                onChange={(v) => setDraft({ ...draft, payment_criteria: v })}
                placeholder="e.g., 30% advance"
              />
            </Field>
            <Field label="Terms" full>
              <TextArea
                value={draft.terms}
                onChange={(v) => setDraft({ ...draft, terms: v })}
                rows={4}
                placeholder="Key contractual terms"
              />
            </Field>
          </div>
        </Card>
      </div>

      {/* ===== Quantity & Price (Product first) ===== */}
      <div className={wrap}>
        <Card title="Quantity & Price">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Product">
              <ComboBox
                value={draft.product}
                onChange={(v) => {
                  const picked = productOptions.find((o) => o.value === v);
                  setDraft({
                    ...draft,
                    product: v,
                    unit: picked?.unit || draft.unit,
                  });
                }}
                options={productOptions}
                placeholder="Select product"
              />
            </Field>
            <Field label="Min Qty">
              <Input
                type="number"
                value={draft.min_qty}
                onChange={(v) => setDraft({ ...draft, min_qty: v })}
              />
            </Field>
            <Field label="Max Qty">
              <Input
                type="number"
                value={draft.max_qty}
                onChange={(v) => setDraft({ ...draft, max_qty: v })}
              />
            </Field>
            <Field label="Unit of Qty">
              <Input
                value={draft.unit}
                onChange={(v) => setDraft({ ...draft, unit: v })}
                placeholder="kg/mt/pcs"
              />
            </Field>
            <Field label="Price (per unit)" full>
              <Input
                type="number"
                value={draft.price}
                onChange={(v) => setDraft({ ...draft, price: v })}
                placeholder="0.00"
              />
            </Field>
          </div>

          <div className="mt-3 rounded-xl bg-black/20 p-3 text-sm text-white/70">
            <span className="mr-2">Est. Range:</span>
            <span className="font-semibold text-white">
              {draft.min_qty || 0} — {draft.max_qty || 0} {draft.unit || "unit"}
            </span>
            {draft.price ? (
              <span className="ml-3">
                @ {draft.price} per {draft.unit || "unit"}
              </span>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- page ---------------- */
export default function OrderConfirm() {
  const toast = useToast();
  const { open: openPrint } = usePrintHtml();

  // Context for firm/fy pickers + header
  const { firm, fy, setFirm, setFy } = useCtx();
  const [firms, setFirms] = useState([]);
  const [fys, setFys] = useState([]);

  // Tabs
  const [tab, setTab] = useState("add");

  // Data
  const [rows, setRows] = useState([]);
  const [deleted, setDeleted] = useState([]);
  const [page, setPage] = useState(1);
  const [pageDel, setPageDel] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pageSizeDel, setPageSizeDel] = useState(10);

  // Lookups
  const [sellerOptions, setSellerOptions] = useState([]);
  const [buyerOptions, setBuyerOptions] = useState([]);
  const [productOptions, setProductOptions] = useState([]);

  // Draft + edit overlay
  const [draft, setDraft] = useState({ status: "Open" });
  const [editingId, setEditingId] = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  // Delete confirm (soft delete & purge)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingAction = useRef(null);
  function onAskDelete(cb) {
    pendingAction.current = cb;
    setConfirmOpen(true);
  }

  // Search + sort
  const [q, setQ] = useState("");
  const [sortAsc, setSortAsc] = useState(true);

  // Visible columns (no serial, no product)
  const columns = useMemo(
    () => [
      { key: "contract_no", label: "Contract No" },
      { key: "seller_label", label: "Seller" },
      { key: "buyer_label", label: "Buyer" },
      { key: "order_date", label: "Date", render: (v) => fmtDMY(v) },
      {
      key: "mailed_at",
      label: "Mail",
      render: (v) =>
        v
          ? <span className="rounded px-2 py-0.5 text-xs bg-emerald-500/15 border border-emerald-500/25 text-emerald-200">Mailed</span>
          : <span className="rounded px-2 py-0.5 text-xs bg-yellow-500/15 border border-yellow-500/25 text-yellow-200">Not sent</span>,
    },
    ],
    []
  );

  // columns for deleted list
  const delColumns = useMemo(
    () => [
      { key: "contract_no", label: "Contract No" },
      { key: "seller_label", label: "Seller" },
      { key: "buyer_label", label: "Buyer" },
      { key: "order_date", label: "Date", render: (v) => fmtDMY(v) },
    ],
    []
  );
  const totalDel = deleted.length;
  const pagesDel = Math.max(1, Math.ceil(totalDel / pageSizeDel));
  const startDel = (pageDel - 1) * pageSizeDel;
  const endDel = Math.min(startDel + pageSizeDel, totalDel);
  const pageRowsDel = useMemo(() => deleted.slice(startDel, endDel), [deleted, startDel, endDel]);
  useEffect(() => { if (pageDel > pagesDel) setPageDel(pagesDel); }, [pageDel, pagesDel, pageSizeDel]);

  /* ----------- initial firm/fy lists ----------- */
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

  /* ----------- load lookups + active/deleted contracts ----------- */
  useEffect(() => {
    if (!firm?.id || !fy?.id) return;
    (async () => {
      try {
        const [{ data: s }, { data: b }, { data: products }] =
          await Promise.all([
            api.get("/parties?for=seller"),
            api.get("/parties?for=buyer"),
            api.get("/products"),
          ]);

        setSellerOptions(
          (s || []).map((p) => ({ value: p.id, label: p.name }))
        );
        setBuyerOptions((b || []).map((p) => ({ value: p.id, label: p.name })));
        setProductOptions(
          (products || []).map((p) => ({
            value: p.id,
            label: p.name,
            unit: p.unit || "",
          }))
        );

        await Promise.all([refresh(), refreshDeleted()]);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load lookups");
      }
    })();
  }, [firm?.id, fy?.id]);

  /* ----------- refreshers ----------- */
  async function refresh() {
    const { data } = await api.get("/contracts");
    const mapped = (data || []).map((r) => ({
      id: r.id,
      contract_no: r.contract_no || "",
      order_date: (r.order_date || "").slice(0, 10),
      seller: r.seller_id,
      buyer: r.buyer_id,
      product: r.product_id ?? null,
      seller_label: r.seller_name,
      buyer_label: r.buyer_name,
      ...r,
    }));
    setRows(mapped);
  }

  async function refreshDeleted() {
    // backend should join seller/buyer names in this endpoint
    const { data } = await api.get("/contracts/deleted/all");
    const mapped = (data || []).map((r) => ({
      id: r.id,
      contract_no: r.contract_no || "",
      order_date: (r.order_date || "").slice(0, 10),
      seller_label: r.seller_name,
      buyer_label: r.buyer_name,
      ...r,
    }));
    setDeleted(mapped);
  }

  // auto-load deleted when the tab opens
  useEffect(() => {
    if (tab === "deleted") refreshDeleted();
  }, [tab]);

  /* ----------- filtering + sorting ----------- */
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = s
      ? rows.filter((r) =>
          [r.contract_no, r.seller_label, r.buyer_label, r.order_date, r.status]
            .join(" ")
            .toLowerCase()
            .includes(s)
        )
      : rows.slice();

    base.sort((a, b) => {
      const A = a.contract_no ?? "";
      const B = b.contract_no ?? "";
      const nA = Number(A);
      const nB = Number(B);
      const bothNumeric = !Number.isNaN(nA) && !Number.isNaN(nB);
      const cmp = bothNumeric ? nA - nB : String(A).localeCompare(String(B));
      return sortAsc ? cmp : -cmp;
    });
    return base;
  }, [q, rows, sortAsc]);
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageRows = useMemo(() => filtered.slice(start, end), [filtered, start, end]);
  useEffect(() => { setPage(1); }, [q, sortAsc, pageSize]);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  /* ----------- helpers ----------- */
  function resolveLabel(options, value) {
    return options.find((o) => o.value === value)?.label || "";
  }

  /* ----------- create/update ----------- */
  async function createOrUpdate(payload) {
    const required = [
      "order_date",
      "seller",
      "buyer",
      "price",
      "unit",
      "product",
    ];
    for (const k of required)
      if (!payload[k]) return toast.error(`Missing required field: ${k}`);
    if (payload.seller === payload.buyer)
      return toast.error("Seller and Buyer cannot be the same party.");

    const body = {
      contract_no: payload.contract_no || null,
      order_date: payload.order_date,
      fiscal_year_id: fy?.id,
      seller_id: payload.seller,
      buyer_id: payload.buyer,
      product_id: payload.product ?? null,
      seller_brokerage: payload.seller_brokerage || null,
      buyer_brokerage: payload.buyer_brokerage || null,
      delivery_station: payload.delivery_station || null,
      delivery_schedule: payload.delivery_schedule || null,
      status: payload.status || "Open",
      payment_criteria: payload.payment_criteria || null,
      terms: payload.terms || null,
      min_qty: payload.min_qty || null,
      max_qty: payload.max_qty || null,
      unit: payload.unit,
      price: payload.price,
    };

    try {
      if (editingId) {
        // ✅ Actually update the DB
        const { data } = await api.put(`/contracts/${editingId}`, body);
        if (data?.ok) {
          toast.success("Contract updated");
        } else {
          toast.info("Updated (no payload)");
        }
        setEditOpen(false);
        setEditingId(null);
        setDraft({ status: "Open" });
        await refresh(); // keep UI in sync with DB
        setTab("list");
      } else {
        const { data: created } = await api.post("/contracts", body);
        toast.success("Contract created");
        // You can either refresh or insert optimistically. Refresh keeps things simple:
        await refresh();
        setDraft({ status: "Open" });
        setTab("list");
      }
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.error || "Failed to save contract";
      toast.error(msg);
    }
  }

  async function softDelete(id) {
    try {
      await api.delete(`/contracts/${id}`);
      toast.success("Contract moved to Deleted");
      await Promise.all([refresh(), refreshDeleted()]);
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete contract");
    }
  }

  async function purge(id) {
    try {
      await api.delete(`/contracts/purge/${id}`);
      toast.success("Contract purged");
      await refreshDeleted();
    } catch (e) {
      console.error(e);
      toast.error("Failed to purge contract");
    }
  }

  function onAction(type, rec) {
    if (type === "delete") {
      onAskDelete(() => softDelete(rec.id));
    } else if (type === "edit") {
      setEditingId(rec.id);
      setDraft({
        ...rec,
        seller: rec.seller_id ?? rec.seller,
        buyer: rec.buyer_id ?? rec.buyer,
        product: rec.product_id ?? rec.product,
        order_date: (rec.order_date || "").slice(0, 10),
      });
      setEditOpen(true);
    } else if (type === "print") {
      (async () => {
        try {
          const { data } = await api.get(`/contracts/${rec.id}/print`);
          const html = buildContractPrintHtml(data);
          openPrint(html);
        } catch (e) {
          console.error(e);
          toast.error("Failed to load printable contract");
        }
      })();
    } else if (type === "mail") {
      toast.info("Mail sent (stub)");
    }
  }

  /* ----------- soft delete & purge ----------- */
  async function softDelete(id) {
    try {
      await api.delete(`/contracts/${id}`); // soft delete -> sets deleted_at
      toast.success("Contract moved to Deleted");
      await Promise.all([refresh(), refreshDeleted()]);
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete contract");
    }
  }

  async function purge(id) {
    try {
      await api.delete(`/contracts/purge/${id}`); // hard delete
      toast.success("Contract purged");
      await refreshDeleted();
    } catch (e) {
      console.error(e);
      toast.error("Failed to purge contract");
    }
  }

  /* ----------- list actions (edit/delete/print) ----------- */
  function onAction(type, rec) {
    if (type === "delete") {
      onAskDelete(() => softDelete(rec.id));
    } else if (type === "edit") {
      setEditingId(rec.id);
      setDraft({
        ...rec,
        seller: rec.seller_id ?? rec.seller,
        buyer: rec.buyer_id ?? rec.buyer,
        product: rec.product_id ?? rec.product,
        order_date: (rec.order_date || "").slice(0, 10),
      });
      setEditOpen(true);
    } else if (type === "print") {
      (async () => {
        try {
          const { data } = await api.get(`/contracts/${rec.id}/print`);
          const html = buildContractPrintHtml(data); // <-- now works with raw row
          openPrint(html);
        } catch (e) {
          console.error(e);
          toast.error("Failed to load printable contract");
        }
      })();
    } else if (type === "mail") {
  (async () => {
    try {
      toast.info("Preparing email…");
      const { data } = await api.post(`/contracts/${rec.id}/mail`);

      // Optimistic UI: set mailed_at on the row
      setRows((xs) =>
        xs.map((r) =>
          r.id === rec.id ? { ...r, mailed_at: data.mailed_at || new Date().toISOString() } : r
        )
      );

      const last = data.results?.[data.results.length - 1];
      toast.success(
        `Email sent (${data.sent} batch${data.sent > 1 ? "es" : ""})` +
        (last?.to ? ` to ${last.to}` : '') +
        (last?.bcc ? ` (bcc hidden)` : '')
      );
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.error || "Failed to send email";
      toast.error(msg);
    }
  })();
}

  }

  /* ----------------------------- render ----------------------------- */
  return (
    <AppShell
      firm={firm}
      fy={fy}
      firms={firms}
      fys={fys}
      setFirm={setFirm}
      setFy={setFy}
      activeKey="order-confirm"
      setActiveKey={() => {}}
    >
      <div className="text-white">
        <Tabs
          tabs={[
            { key: "add", label: "Add", icon: <Plus size={16} /> },
            { key: "list", label: "List", icon: <ListIcon size={16} /> },
            { key: "deleted", label: "Deleted", icon: <Trash2 size={16} /> },
          ]}
          value={tab}
          onChange={setTab}
        />

        {/* ADD */}
        {tab === "add" && (
          <>
            <OrderForm
              draft={draft}
              setDraft={setDraft}
              sellerOptions={sellerOptions}
              buyerOptions={buyerOptions}
              productOptions={productOptions}
              isEditing={false}
            />
            <div className="mt-4 mb-24 flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={() => setDraft({ status: "Open" })}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/5 ${glass}`}
              >
                <X size={16} /> Reset
              </button>
              <button
                onClick={() => createOrUpdate(draft)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 ${glass} bg-white/10`}
              >
                <Save size={16} /> Create
              </button>
            </div>
            <div className="h-10" aria-hidden="true" />
          </>
        )}

        {/* LIST */}
        {tab === "list" && (
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div
                className={`flex items-center gap-2 rounded-xl px-3 py-2 ${glass} bg-black/20`}
              >
                <Search size={16} />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by contract, party, date…"
                  className="bg-transparent text-sm outline-none placeholder:text-white/50"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSortAsc((s) => !s)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/90 hover:bg-white/10 ${glass}`}
                  title="Toggle sort by Contract No"
                >
                  <ArrowUpDown size={14} /> Sort: Contract No{" "}
                  {sortAsc ? "↑" : "↓"}
                </button>
                <span className="text-xs text-white/60">
                  {filtered.length} record(s)
                </span>
              </div>
            </div>

            <DataTable columns={columns} rows={pageRows} onAction={onAction} />
            <Pagination total={total} page={page} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />
          </div>
        )}

        {/* DELETED (soft-deleted list with PURGE) */}
        {tab === "deleted" && (
          <div>
            <div className="mb-2 text-xs text-white/70">
              These are soft-deleted contracts. Purging will remove them
              permanently (and then you’ll be able to hard-delete related
              parties if needed).
            </div>
            <DataTable
              columns={delColumns}
              rows={pageRowsDel}
              allowedActions={["delete"]} // only show the trash icon, used as "Purge"
              onAction={(type, rec) => {
                if (type === "delete") onAskDelete(() => purge(rec.id));
              }}
            />
            <Pagination total={totalDel} page={pageDel} pageSize={pageSizeDel} onPage={setPageDel} onPageSize={setPageSizeDel} />
            <div className="mt-2 text-xs text-white/60">
              {deleted.length} deleted record(s)
            </div>
          </div>
        )}
      </div>

      {/* Confirm dialog (used for both delete & purge) */}
      <ConfirmationDialog
        open={confirmOpen}
        title="Are you sure?"
        message="This action cannot be undone."
        confirmLabel="Continue"
        onCancel={() => {
          setConfirmOpen(false);
          pendingAction.current = null;
        }}
        onConfirm={async () => {
          setConfirmOpen(false);
          if (pendingAction.current) {
            await pendingAction.current();
            pendingAction.current = null;
          }
        }}
      />

      {/* EDIT OVERLAY */}
      <EditOverlay
        open={editOpen}
        title={`Edit Contract • ${draft.contract_no || `#${editingId}`}`}
        onClose={() => {
          setEditOpen(false);
          setEditingId(null);
          setDraft({ status: "Open" });
          setTab("list");
        }}
        footer={
          <>
            <button
              onClick={() => {
                setEditOpen(false);
                setEditingId(null);
                setDraft({ status: "Open" });
                setTab("list");
              }}
              className="rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/10 border border-white/10"
            >
              Cancel
            </button>
            <button
              onClick={() => createOrUpdate(draft)}
              className="rounded-lg px-3 py-2 text-sm font-semibold bg-yellow-400/20 hover:bg-yellow-400/30 border border-yellow-400/40"
            >
              Update
            </button>
          </>
        }
      >
        <OrderForm
          draft={draft}
          setDraft={setDraft}
          sellerOptions={sellerOptions}
          buyerOptions={buyerOptions}
          productOptions={productOptions}
          isEditing
        />
      </EditOverlay>
    </AppShell>
  );
}
