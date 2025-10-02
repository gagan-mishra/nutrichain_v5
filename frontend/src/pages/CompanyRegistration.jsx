// src/pages/FirmRegistration.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "../components/layout";
import { useCtx } from "../state/context";
import { api } from "../api";
import { Tabs, Card, Field, Input, TextArea, glass } from "../components/primitives";
import DataTable from "../components/table";
import EditOverlay from "../components/edit-overlay";
import ConfirmationDialog from "../components/confirm-dialog";
import { useToast } from "../components/toast";
import { Plus, List as ListIcon, Save, X, Search } from "lucide-react";

/* ---------- form ---------- */
function FirmForm({ draft, setDraft, isEditing }) {
  const wrap = isEditing ? "ring-1 ring-yellow-400/40 rounded-2xl" : "";
  return (
    <div className={wrap}>
      <Card title={`Firm ${isEditing ? "• Editing" : ""}`}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Firm Name">
            <Input
              value={draft.name}
              onChange={(v) => setDraft({ ...draft, name: v })}
              placeholder="e.g., Enterprises"
            />
          </Field>
          <Field label="GST Number (optional)">
            <Input
              value={draft.gst_no || ""}
              onChange={(v) => setDraft({ ...draft, gst_no: v })}
              placeholder="e.g., 27AAAAA0000A1Z5"
            />
          </Field>
          <Field label="Address" full>
            <TextArea
              rows={3}
              value={draft.address || ""}
              onChange={(v) => setDraft({ ...draft, address: v })}
              placeholder="Street, City, State, PIN"
            />
          </Field>
        </div>
      </Card>
    </div>
  );
}

/* ---------- page ---------- */
export default function FirmRegistration() {
  const toast = useToast();

  // Header context (used across app)
  const { firm, fy, setFirm, setFy } = useCtx();
  const [firms, setFirms] = useState([]);
  const [fys, setFys] = useState([]);

  const [tab, setTab] = useState("add");
  const [rows, setRows] = useState([]);

  const [draft, setDraft] = useState({ name: "", address: "", gst_no: "" });
  const [editingId, setEditingId] = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  // Delete confirm popover
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingAction = useRef(null);
  function onAskDelete(cb) {
    pendingAction.current = cb;
    setConfirmOpen(true);
  }

  // search
  const [q, setQ] = useState("");

  const columns = useMemo(
    () => [
      { key: "_sn", label: "#" },
      { key: "name", label: "Firm" },
      { key: "address", label: "Address" },
      { key: "gst_no", label: "GST No" },
    ],
    []
  );

  /* ---- load firms & FYs for header ---- */
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
    const { data } = await api.get("/firms");
    setRows((data || []).map((r) => ({ ...r })));
  }

  // search + SN
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.name, r.address, r.gst_no].join(" ").toLowerCase().includes(s)
    );
  }, [q, rows]);

  const rowsForTable = useMemo(
    () => filtered.map((r, i) => ({ ...r, _sn: i + 1 })),
    [filtered]
  );

  /* ---- CRUD ---- */
  async function save() {
    const body = {
      name: (draft.name || "").trim(),
      address: (draft.address || "").trim() || null,
      gst_no: (draft.gst_no || "").trim() || null,
    };
    if (!body.name) {
      toast.error("Firm name is required.");
      return;
    }
    try {
      if (editingId) {
        await api.put(`/firms/${editingId}`, body);
        toast.success("Firm updated");
        setEditOpen(false);
        setEditingId(null);
      } else {
        const { data: created } = await api.post("/firms", body);
        toast.success("Firm created");
        // if this is your first firm, you may auto-select it:
        if (!firm) setFirm({ id: created.id, ...body });
      }
      setDraft({ name: "", address: "", gst_no: "" });
      await refresh();
      setTab("list");
    } catch (e) {
      console.error(e);
      toast.error("Failed to save firm");
    }
  }

  async function onDelete(rec) {
    // Guard: prevent deleting the active firm chosen in header
    if (firm?.id === rec.id) {
      toast.error("You cannot delete the currently active firm.");
      return;
    }
    try {
      await api.delete(`/firms/${rec.id}`);
      toast.success("Firm deleted");
      await refresh();
    } catch (e) {
      console.error(e);
      if (e?.response?.status === 409) {
        toast.info("Firm is linked to records and cannot be deleted.");
      } else {
        toast.error("Failed to delete firm");
      }
    }
  }

  function onEdit(rec) {
    setEditingId(rec.id);
    setDraft({
      name: rec.name || "",
      address: rec.address || "",
      gst_no: rec.gst_no || "",
    });
    setEditOpen(true);
  }

  return (
    <AppShell
      firm={firm}
      fy={fy}
      firms={firms}
      fys={fys}
      setFirm={setFirm}
      setFy={setFy}
      activeKey="firm-registration"
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
            <FirmForm draft={draft} setDraft={setDraft} isEditing={false} />
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={() => setDraft({ name: "", address: "", gst_no: "" })}
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
          </>
        )}

        {/* LIST */}
        {tab === "list" && (
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${glass} bg-black/20`}>
                <Search size={16} />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by firm, address, GST…"
                  className="bg-transparent text-sm outline-none placeholder:text-white/50"
                />
              </div>
              <span className="text-xs text-white/60">{rowsForTable.length} record(s)</span>
            </div>

            <DataTable
              columns={columns}
              rows={rowsForTable}
              allowedActions={["edit", "delete"]}
              onAction={(type, row) => {
                if (type === "edit") onEdit(row);
                if (type === "delete") onAskDelete(() => onDelete(row));
              }}
            />
          </div>
        )}
      </div>

      {/* EDIT OVERLAY */}
      <EditOverlay
        open={editOpen}
        title={`Edit Firm • ${draft.name || `#${editingId}`}`}
        onClose={() => {
          setEditOpen(false);
          setEditingId(null);
          setDraft({ name: "", address: "", gst_no: "" });
          setTab("list");
        }}
        footer={
          <>
            <button
              onClick={() => {
                setEditOpen(false);
                setEditingId(null);
                setDraft({ name: "", address: "", gst_no: "" });
                setTab("list");
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
        <FirmForm draft={draft} setDraft={setDraft} isEditing />
      </EditOverlay>

      {/* DELETE CONFIRM */}
      <ConfirmationDialog
        open={confirmOpen}
        title="Delete firm?"
        message="This will remove the firm. Avoid deleting firms that have contracts or data linked."
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
    </AppShell>
  );
}
