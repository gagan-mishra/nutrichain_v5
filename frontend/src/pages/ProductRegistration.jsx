// src/pages/ProductRegistration.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "../components/layout";
import { useCtx } from "../state/context";
import { api } from "../api";
import { Tabs, Card, Field, Input, glass } from "../components/primitives";
import DataTable from "../components/table";
import ConfirmationDialog from "../components/confirm-dialog";
import EditOverlay from "../components/edit-overlay";
import { Plus, List as ListIcon, Trash2, Save, X, Search } from "lucide-react";
import Pagination from "../components/pagination";
import { useToast } from "../components/toast";

function ProductForm({ draft, setDraft, isEditing }) {
  const wrap = isEditing ? "ring-1 ring-yellow-400/40 rounded-2xl" : "";
  return (
    <div className={wrap}>
      <Card title={`Product ${isEditing ? "• Editing" : ""}`}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Product Name">
            <Input
              value={draft.name}
              onChange={(v) => setDraft({ ...draft, name: v })}
              placeholder="e.g., Wheat"
            />
          </Field>
          <Field label="Unit (optional)">
            <Input
              value={draft.unit}
              onChange={(v) => setDraft({ ...draft, unit: v })}
              placeholder="e.g., mt / kg / pcs"
            />
          </Field>
          <Field label="HSN Code (optional)">
            <Input
              value={draft.hsn_code}
              onChange={(v) => setDraft({ ...draft, hsn_code: v })}
              placeholder="e.g., 1001"
            />
          </Field>

          {/* Keep product visible in registry; toggle status here */}
          <Field label="Status">
            <div className="flex items-center gap-2">
              <input
                id="is_active"
                type="checkbox"
                checked={!!draft.is_active}
                onChange={(e) =>
                  setDraft({ ...draft, is_active: e.target.checked ? 1 : 0 })
                }
              />
              <label
                htmlFor="is_active"
                className="text-sm text-white/80 select-none"
              >
                {draft.is_active ? "Active" : "Inactive"}
              </label>
            </div>
          </Field>
        </div>
      </Card>
    </div>
  );
}

export default function ProductRegistration() {
  const { firm, fy, setFirm, setFy } = useCtx(); // header context only
  const [firms, setFirms] = useState([]);
  const [fys, setFys] = useState([]);

  const [tab, setTab] = useState("add");
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [editingId, setEditingId] = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingAction = useRef(null);

  const [draft, setDraft] = useState({ is_active: 1 });

  const [q, setQ] = useState("");
  const [hideInactive, setHideInactive] = useState(false);

  const toast = useToast();

  const columns = [
    { key: "_sn", label: "#" },
    { key: "name", label: "Name" },
    { key: "unit", label: "Unit" },
    { key: "hsn_code", label: "HSN Code" },
    {
      key: "is_active",
      label: "Status",
      render: (v) => (
        <span
          className={`rounded px-2 py-0.5 text-xs ${
            v
              ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-200"
              : "bg-rose-500/20 border border-rose-500/30 text-rose-200"
          }`}
        >
          {v ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  function onAskDelete(cb) {
    pendingAction.current = cb;
    setConfirmOpen(true);
  }

  /* ------------ header context + initial load ------------ */
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

      await refresh();
    })();
  }, []);

  async function refresh() {
    // Ensure backend returns ALL products; if your API supports a flag, keep "?all=1"
    const { data } = await api.get("/products?all=1");
    setRows(
      (data || []).map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit || "",
        hsn_code: p.hsn_code || "",
        is_active: p.is_active ? 1 : 0,
      }))
    );
  }

  /* ------------ search / hide inactive / serials ------------ */
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let base = rows;
    if (hideInactive) base = base.filter((r) => r.is_active === 1);
    if (!s) return base;
    return base.filter((r) =>
      [r.name, r.unit, r.hsn_code].join(" ").toLowerCase().includes(s)
    );
  }, [q, rows, hideInactive]);
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const rowsForTable = useMemo(
    () => filtered.slice(start, end).map((r, i) => ({ ...r, _sn: start + i + 1 })),
    [filtered, start, end]
  );
  useEffect(() => { setPage(1); }, [q, hideInactive]);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  /* ---------------------- CRUD ---------------------- */
  async function createOrUpdate(payload) {
    if (!payload.name || !payload.name.trim()) {
      return toast.error("Product Name is required.");
    }
    const body = {
      name: payload.name.trim(),
      unit: payload.unit || null,
      hsn_code: payload.hsn_code || null,
      is_active: payload.is_active ? 1 : 0,
    };

    try {
      if (editingId) {
        await api.put(`/products/${editingId}`, body);
        toast.success("Product updated");
        setEditOpen(false);
        setEditingId(null);
        setDraft({ is_active: 1 });
      } else {
        await api.post("/products", body);
        toast.success("Product created");
        setDraft({ is_active: 1 });
      }
      await refresh();
      setTab("list");
    } catch (e) {
      console.error(e);
      toast.error("Failed to save product");
    }
  }

  // If FK prevents delete, gracefully deactivate
  async function handleDelete(id) {
    try {
      await api.delete(`/products/${id}`);
      toast.success("Product deleted");
      await refresh();
    } catch (e) {
      const code = e?.response?.status;
      if (code === 409) {
        toast.info("Product is used in contracts. Deactivating instead.");
        try {
          await api.patch(`/products/${id}/deactivate`);
          await refresh();
          toast.success("Product deactivated");
        } catch {
          toast.error("Failed to deactivate product");
        }
      } else {
        console.error(e);
        toast.error("Failed to delete product");
      }
    }
  }

  function onAction(type, rec) {
    if (type === "delete") {
      onAskDelete(() => handleDelete(rec.id));
    } else if (type === "edit") {
      setEditingId(rec.id);
      setDraft({
        name: rec.name,
        unit: rec.unit,
        hsn_code: rec.hsn_code,
        is_active: rec.is_active ? 1 : 0,
      });
      setEditOpen(true);
    }
  }

  /* ---------------------- UI ---------------------- */
  return (
    <AppShell
      firm={firm}
      fy={fy}
      firms={firms}
      fys={fys}
      setFirm={setFirm}
      setFy={setFy}
      activeKey="product-registration"
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

        {/* ADD */}
        {tab === "add" && (
          <>
            <ProductForm draft={draft} setDraft={setDraft} isEditing={false} />
            <div className="mt-4 mb-24 flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={() => setDraft({ is_active: 1 })}
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
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-white">
              <div
                className={`flex items-center gap-2 rounded-xl px-3 py-2 ${glass} bg-black/20`}
              >
                <Search size={16} />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by name, unit, HSN…"
                  className="bg-transparent text-sm outline-none placeholder:text-white/50"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-white/80">
                  <input
                    type="checkbox"
                    checked={hideInactive}
                    onChange={(e) => setHideInactive(e.target.checked)}
                  />
                  Hide inactive
                </label>
                <span className="text-xs text-white/60">
                  {rowsForTable.length} record(s)
                </span>
              </div>
            </div>

            <DataTable
              columns={columns}
              rows={rowsForTable}
              allowedActions={["edit", "delete"]}
              onAction={onAction}
            />
            <Pagination total={total} page={page} pageSize={pageSize} onPage={setPage} />
          </div>
        )}
      </div>

      {/* Delete confirm */}
      <ConfirmationDialog
        open={confirmOpen}
        title="Delete product?"
        message="This will remove the product. If it’s used in contracts, we’ll deactivate it instead."
        confirmLabel="Delete"
        onCancel={() => {
          setConfirmOpen(false);
          pendingAction.current = null;
        }}
        onConfirm={() => {
          setConfirmOpen(false);
          pendingAction.current?.();
          pendingAction.current = null;
        }}
      />

      {/* EDIT OVERLAY */}
      <EditOverlay
        open={editOpen}
        title={`Edit Product • ${draft.name || `#${editingId}`}`}
        onClose={() => {
          setEditOpen(false);
          setEditingId(null);
          setDraft({ is_active: 1 });
          setTab("list");
        }}
        footer={
          <>
            <button
              onClick={() => {
                setEditOpen(false);
                setEditingId(null);
                setDraft({ is_active: 1 });
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
        <ProductForm draft={draft} setDraft={setDraft} isEditing />
      </EditOverlay>
    </AppShell>
  );
}
