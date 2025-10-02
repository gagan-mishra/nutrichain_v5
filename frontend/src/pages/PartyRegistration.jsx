// // src/pages/PartyRegistration.jsx
// import React, { useEffect, useMemo, useState, useRef } from "react";
// import { AppShell } from "../components/layout";
// import { useCtx } from "../state/context";
// import { api } from "../api";
// import {
//   Tabs,
//   Card,
//   Field,
//   Input,
//   TextArea,
//   glass,
// } from "../components/primitives";
// import DataTable from "../components/table";
// import EditOverlay from "../components/edit-overlay";
// import { Plus, List as ListIcon, Save, X } from "lucide-react";

// import { useToast } from "../components/toast";
// import ConfirmationDialog from "../components/confirm-dialog";

// const MAX_EMAILS = 6;

// const EMPTY = {
//   name: "",
//   address: "",
//   contact: "",
//   emails: [""],
//   gst_no: "",
//   gst_type: "INTRA", // INTRA => CGST+SGST, INTER => IGST
//   cgst_rate: "",
//   sgst_rate: "",
//   igst_rate: "",
//   role: "BOTH", // SELLER | BUYER | BOTH
// };

// function PartyForm({ draft, setDraft, isEditing }) {
//   const ringWrap = isEditing ? "ring-1 ring-yellow-400/40 rounded-2xl" : "";

//   // helpers for emails
//   const updateEmail = (i, val) =>
//     setDraft((d) => {
//       const arr = [...(d.emails || [])];
//       arr[i] = val;
//       return { ...d, emails: arr };
//     });
//   const addEmail = () =>
//     setDraft((d) => {
//       const arr = [...(d.emails || [])];
//       if (arr.length < MAX_EMAILS) arr.push("");
//       return { ...d, emails: arr };
//     });
//   const removeEmail = (i) =>
//     setDraft((d) => {
//       const arr = [...(d.emails || [])];
//       arr.splice(i, 1);
//       if (arr.length === 0) arr.push("");
//       return { ...d, emails: arr };
//     });

//   return (
//     <div className="flex flex-col gap-6">
//       {/* Details */}
//       <div className={ringWrap}>
//         <Card title={`Party Details${isEditing ? " • Editing" : ""}`}>
//           <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
//             <Field label="Party Name">
//               <Input
//                 value={draft.name}
//                 onChange={(v) => setDraft({ ...draft, name: v })}
//                 placeholder="e.g., Mahadev Traders"
//               />
//             </Field>
//             <Field label="Contact">
//               <Input
//                 value={draft.contact}
//                 onChange={(v) => setDraft({ ...draft, contact: v })}
//                 placeholder="e.g., +91-98xxxxxxx"
//               />
//             </Field>
//             <Field label="Address" full>
//               <TextArea
//                 value={draft.address}
//                 onChange={(v) => setDraft({ ...draft, address: v })}
//                 rows={3}
//                 placeholder="Street, City, State, PIN"
//               />
//             </Field>
//             <Field label="Role">
//               <div className="flex gap-4 rounded-lg px-3 py-2 bg-white/5 border border-white/10">
//                 {["SELLER", "BUYER", "BOTH"].map((r) => (
//                   <label key={r} className="flex items-center gap-2 text-sm">
//                     <input
//                       type="radio"
//                       name="role"
//                       value={r}
//                       checked={draft.role === r}
//                       onChange={() => setDraft({ ...draft, role: r })}
//                     />
//                     <span>{r}</span>
//                   </label>
//                 ))}
//               </div>
//             </Field>
//           </div>
//         </Card>
//       </div>

//       {/* Emails */}
//       <div className={ringWrap}>
//         <Card title="Emails (up to 6)">
//           <div className="space-y-2">
//             {Array.from({
//               length: Math.min(draft.emails?.length || 1, MAX_EMAILS),
//             }).map((_, i) => (
//               <div key={i} className="flex items-center gap-2">
//                 <Input
//                   value={draft.emails[i] || ""}
//                   onChange={(v) => updateEmail(i, v)}
//                   placeholder={`email ${i + 1}`}
//                 />
//                 {i > 0 && (
//                   <button
//                     onClick={() => removeEmail(i)}
//                     className={`rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/5 ${glass}`}
//                   >
//                     <X size={16} />
//                   </button>
//                 )}
//               </div>
//             ))}
//             <div className="flex justify-end">
//               <button
//                 disabled={(draft.emails?.length || 0) >= MAX_EMAILS}
//                 onClick={addEmail}
//                 className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/90 hover:bg-white/10 ${glass}`}
//               >
//                 <Plus size={16} /> Add email
//               </button>
//             </div>
//           </div>
//         </Card>
//       </div>

//       {/* GST */}
//       <div className={ringWrap}>
//         <Card title="GST">
//           <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
//             <Field label="GST Number">
//               <Input
//                 value={draft.gst_no}
//                 onChange={(v) => setDraft({ ...draft, gst_no: v })}
//                 placeholder="e.g., 27AAAAA0000A1Z5"
//               />
//             </Field>
//             <Field label="GST Type">
//               <div className="flex gap-4 rounded-lg px-3 py-2 bg-white/5 border border-white/10">
//                 <label className="flex items-center gap-2 text-sm">
//                   <input
//                     type="radio"
//                     name="gst_type"
//                     value="INTRA"
//                     checked={draft.gst_type === "INTRA"}
//                     onChange={() => setDraft({ ...draft, gst_type: "INTRA" })}
//                   />
//                   <span>Intrastate (CGST+SGST)</span>
//                 </label>
//                 <label className="flex items-center gap-2 text-sm">
//                   <input
//                     type="radio"
//                     name="gst_type"
//                     value="INTER"
//                     checked={draft.gst_type === "INTER"}
//                     onChange={() => setDraft({ ...draft, gst_type: "INTER" })}
//                   />
//                   <span>Interstate (IGST)</span>
//                 </label>
//               </div>
//             </Field>

//             {draft.gst_type === "INTRA" ? (
//               <>
//                 <Field label="CGST (%)">
//                   <Input
//                     type="number"
//                     value={draft.cgst_rate}
//                     onChange={(v) => setDraft({ ...draft, cgst_rate: v })}
//                   />
//                 </Field>
//                 <Field label="SGST (%)">
//                   <Input
//                     type="number"
//                     value={draft.sgst_rate}
//                     onChange={(v) => setDraft({ ...draft, sgst_rate: v })}
//                   />
//                 </Field>
//               </>
//             ) : (
//               <Field label="IGST (%)">
//                 <Input
//                   type="number"
//                   value={draft.igst_rate}
//                   onChange={(v) => setDraft({ ...draft, igst_rate: v })}
//                 />
//               </Field>
//             )}
//           </div>
//         </Card>
//       </div>
//     </div>
//   );
// }

// export default function PartyRegistration() {
//   // Context for firm/fy pickers in header
//   const { firm, fy, setFirm, setFy } = useCtx();
//   const [firms, setFirms] = useState([]);
//   const [fys, setFys] = useState([]);

//   // Page state
//   const [tab, setTab] = useState("add");
//   const [rows, setRows] = useState([]);
//   const [draft, setDraft] = useState({ ...EMPTY });
//   const [editingId, setEditingId] = useState(null);
//   const [editOpen, setEditOpen] = useState(false);

//   // search
//   const [q, setQ] = useState("");

//   const toast = useToast();

//   const [confirmOpen, setConfirmOpen] = useState(false); // 👈 add
//   const pendingAction = useRef(null); // 👈 add
//   function onAskDelete(cb) {
//     // 👈 add
//     pendingAction.current = cb;
//     setConfirmOpen(true);
//   }

//   // Columns (include serial number)
//   const columns = useMemo(
//     () => [
//       { key: "_sn", label: "#" },
//       { key: "name", label: "Name" },
//       { key: "address", label: "Address" },
//       { key: "contact", label: "Contact" },
//       {
//         key: "emails",
//         label: "Emails",
//         render: (value) =>
//           Array.isArray(value) ? value.filter(Boolean).join(", ") : value || "",
//       },
//       { key: "gst_no", label: "GST No" },
//     ],
//     []
//   );

//   // Load firms/FYs once so header pickers work
//   useEffect(() => {
//     (async () => {
//       const [{ data: firmList }, { data: fyList }] = await Promise.all([
//         api.get("/firms"),
//         api.get("/firms/fiscal-years"),
//       ]);
//       setFirms(firmList || []);
//       setFys(fyList || []);
//       if (!firm && firmList?.[0]) setFirm(firmList[0]);
//       if (!fy && fyList?.[0]) setFy(fyList[0]);
//     })();
//   }, []);

//   // Fetch registry
//   async function refresh() {
//     const { data } = await api.get("/parties/registry");
//     setRows(
//       (data || []).map((p) => ({
//         id: p.id,
//         name: p.name,
//         address: p.address || "",
//         contact: p.contact || "",
//         emails: Array.isArray(p.emails) ? p.emails : [],
//         gst_no: p.gst_no || "",
//         gst_type: p.gst_type || "INTRA",
//         cgst_rate: p.cgst_rate || "",
//         sgst_rate: p.sgst_rate || "",
//         igst_rate: p.igst_rate || "",
//         role: p.role || "BOTH",
//       }))
//     );
//   }
//   useEffect(() => {
//     refresh();
//   }, []);

//   // Filter + serial numbers for table
//   const filtered = useMemo(() => {
//     const s = q.trim().toLowerCase();
//     if (!s) return rows;
//     return rows.filter((r) => {
//       const hay = [
//         r.name,
//         r.address,
//         r.contact,
//         r.gst_no,
//         r.role,
//         ...(Array.isArray(r.emails) ? r.emails : []),
//       ]
//         .join(" ")
//         .toLowerCase();
//       return hay.includes(s);
//     });
//   }, [q, rows]);

//   const rowsForTable = useMemo(
//     () => filtered.map((r, i) => ({ ...r, _sn: i + 1 })),
//     [filtered]
//   );

//   // CRUD
//   async function save() {
//     const body = {
//       name: (draft.name || "").trim(),
//       address: (draft.address || "").trim(),
//       contact: (draft.contact || "").trim(),
//       emails: (draft.emails || [])
//         .map((e) => e.trim())
//         .filter(Boolean)
//         .slice(0, MAX_EMAILS),
//       gst_no: (draft.gst_no || "").trim(),
//       gst_type: draft.gst_type,
//       cgst_rate: draft.gst_type === "INTRA" ? Number(draft.cgst_rate || 0) : 0,
//       sgst_rate: draft.gst_type === "INTRA" ? Number(draft.sgst_rate || 0) : 0,
//       igst_rate: draft.gst_type === "INTER" ? Number(draft.igst_rate || 0) : 0,
//       role: draft.role || "BOTH",
//     };

//     if (!body.name) return toast.error("Party name is required.");

//     try {
//       if (editingId) {
//         await api.put(`/parties/${editingId}`, body);
//         toast.success("Party updated");
//         setEditOpen(false);
//       } else {
//         await api.post("/parties", body);
//         toast.success("Party created");
//         setTab("list");
//       }

//       setEditingId(null);
//       setDraft({ ...EMPTY });
//       await refresh();
//     } catch (e) {
//       console.error(e);
//       toast.error("Failed to save party");
//     }
//   }

//   async function onDelete(rec) {
//     try {
//       await api.delete(`/parties/${rec.id}`);
//       await refresh();
//       toast.success("Party deleted");
//     } catch (e) {
//       console.error(e);
//       toast.error("Failed to delete party");
//     }
//   }

//   function onEdit(rec) {
//     setEditingId(rec.id);
//     setDraft({
//       name: rec.name || "",
//       address: rec.address || "",
//       contact: rec.contact || "",
//       emails: rec.emails?.length ? rec.emails.slice(0, MAX_EMAILS) : [""],
//       gst_no: rec.gst_no || "",
//       gst_type: rec.gst_type || "INTRA",
//       cgst_rate: rec.cgst_rate || "",
//       sgst_rate: rec.sgst_rate || "",
//       igst_rate: rec.igst_rate || "",
//       role: rec.role || "BOTH",
//     });
//     setEditOpen(true); // open the popup editor
//   }

//   return (
//     <AppShell
//       firm={firm}
//       fy={fy}
//       firms={firms}
//       fys={fys}
//       setFirm={setFirm}
//       setFy={setFy}
//       activeKey="party-registration"
//       setActiveKey={() => {}}
//     >
//       <div className="text-white">
//         <Tabs
//           tabs={[
//             { key: "add", label: "Add", icon: <Plus size={16} /> },
//             { key: "list", label: "List", icon: <ListIcon size={16} /> },
//           ]}
//           value={tab}
//           onChange={setTab}
//         />

//         {/* ADD (Create) */}
//         {tab === "add" && (
//           <>
//             <PartyForm draft={draft} setDraft={setDraft} isEditing={false} />
//             <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
//               <button
//                 onClick={() => setDraft({ ...EMPTY })}
//                 className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/5 ${glass}`}
//               >
//                 <X size={16} /> Reset
//               </button>
//               <button
//                 onClick={save}
//                 className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 ${glass} bg-white/10`}
//               >
//                 <Save size={16} /> Create
//               </button>
//             </div>
//           </>
//         )}

//         {/* LIST */}
//         {tab === "list" && (
//           <div>
//             <div className="mb-3 flex items-center justify-between">
//               <div
//                 className={`flex items-center gap-2 rounded-xl px-3 py-2 ${glass} bg-black/20`}
//               >
//                 <svg
//                   width="16"
//                   height="16"
//                   viewBox="0 0 24 24"
//                   className="opacity-80"
//                 >
//                   <path
//                     fill="currentColor"
//                     d="M15.5 14h-.79l-.28-.27a6.471 6.471 0 0 0 1.57-4.23A6.5 6.5 0 1 0 9.5 16a6.471 6.471 0 0 0 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5ZM4 9.5C4 6.46 6.46 4 9.5 4S15 6.46 15 9.5 12.54 15 9.5 15 4 12.54 4 9.5Z"
//                   />
//                 </svg>
//                 <input
//                   value={q}
//                   onChange={(e) => setQ(e.target.value)}
//                   placeholder="Search name, email, GST, address…"
//                   className="bg-transparent text-sm outline-none placeholder:text-white/50"
//                 />
//               </div>
//               <span className="text-xs text-white/60">
//                 {rowsForTable.length} record(s)
//               </span>
//             </div>

//             <DataTable
//               columns={columns}
//               rows={rowsForTable}
//               allowedActions={["edit", "delete"]}
//               onAction={(type, row) => {
//                 if (type === "edit") onEdit(row);
//                 if (type === "delete") onAskDelete(() => onDelete(row)); // 👈 open popover
//               }}
//             />
//           </div>
//         )}
//       </div>

//       {/* EDIT OVERLAY */}
//       <EditOverlay
//         open={editOpen}
//         title={`Edit Party • ${draft.name || `#${editingId}`}`}
//         onClose={() => {
//           setEditOpen(false);
//           setEditingId(null);
//           setDraft({ ...EMPTY });
//           setTab("list"); // after cancel, stay on list
//           toast.info("Edit canceled"); // optional
//         }}
//         footer={
//           <>
//             <button
//               onClick={() => {
//                 setEditOpen(false);
//                 setEditingId(null);
//                 setDraft({ ...EMPTY });
//                 setTab("list");
//               }}
//               className="rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/10 border border-white/10"
//             >
//               Cancel
//             </button>
//             <button
//               onClick={save}
//               className="rounded-lg px-3 py-2 text-sm font-semibold bg-yellow-400/20 hover:bg-yellow-400/30 border border-yellow-400/40"
//             >
//               Update
//             </button>
//           </>
//         }
//       >
//         <PartyForm draft={draft} setDraft={setDraft} isEditing />
//       </EditOverlay>

//       <ConfirmationDialog
//         open={confirmOpen}
//         title="Delete party?"
//         message="This will remove the party from your registry."
//         confirmLabel="Delete"
//         onCancel={() => {
//           setConfirmOpen(false);
//           pendingAction.current = null;
//         }}
//         onConfirm={() => {
//           setConfirmOpen(false);
//           pendingAction.current?.(); // runs onDelete(row)
//           pendingAction.current = null;
//         }}
//       />
//     </AppShell>
//   );
// }


// src/pages/PartyRegistration.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "../components/layout";
import { useCtx } from "../state/context";
import { api } from "../api";
import { Tabs, Card, Field, Input, TextArea, glass } from "../components/primitives";
import DataTable from "../components/table";
import EditOverlay from "../components/edit-overlay";
import ConfirmationDialog from "../components/confirm-dialog";
import { Plus, List as ListIcon, Save, X } from "lucide-react";
import { useToast } from "../components/toast";

const MAX_EMAILS = 6;

const EMPTY = {
  name: "",
  address: "",
  contact: "",
  emails: [""],
  gst_no: "",
  gst_type: "INTRA", // INTRA => CGST+SGST, INTER => IGST
  cgst_rate: "",
  sgst_rate: "",
  igst_rate: "",
  role: "BOTH", // SELLER | BUYER | BOTH
};

/* ---------------------------------- form --------------------------------- */
function PartyForm({ draft, setDraft, isEditing }) {
  const ringWrap = isEditing ? "ring-1 ring-yellow-400/40 rounded-2xl" : "";

  // emails helpers
  const updateEmail = (i, val) =>
    setDraft((d) => {
      const arr = [...(d.emails || [])];
      arr[i] = val;
      return { ...d, emails: arr };
    });
  const addEmail = () =>
    setDraft((d) => {
      const arr = [...(d.emails || [])];
      if (arr.length < MAX_EMAILS) arr.push("");
      return { ...d, emails: arr };
    });
  const removeEmail = (i) =>
    setDraft((d) => {
      const arr = [...(d.emails || [])];
      arr.splice(i, 1);
      if (arr.length === 0) arr.push("");
      return { ...d, emails: arr };
    });

  return (
    <div className="flex flex-col gap-6">
      {/* Details */}
      <div className={ringWrap}>
        <Card title={`Party Details${isEditing ? " • Editing" : ""}`}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Party Name">
              <Input
                value={draft.name}
                onChange={(v) => setDraft({ ...draft, name: v })}
                placeholder="e.g., Mahadev Traders"
              />
            </Field>
            <Field label="Contact">
              <Input
                value={draft.contact}
                onChange={(v) => setDraft({ ...draft, contact: v })}
                placeholder="e.g., +91-98xxxxxxx"
              />
            </Field>
            <Field label="Address" full>
              <TextArea
                value={draft.address}
                onChange={(v) => setDraft({ ...draft, address: v })}
                rows={3}
                placeholder="Street, City, State, PIN"
              />
            </Field>
            <Field label="Role">
              <div className="flex gap-4 rounded-lg px-3 py-2 bg-white/5 border border-white/10">
                {["SELLER", "BUYER", "BOTH"].map((r) => (
                  <label key={r} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="role"
                      value={r}
                      checked={draft.role === r}
                      onChange={() => setDraft({ ...draft, role: r })}
                    />
                    <span>{r}</span>
                  </label>
                ))}
              </div>
            </Field>
          </div>
        </Card>
      </div>

      {/* Emails */}
      <div className={ringWrap}>
        <Card title="Emails (up to 6)">
          <div className="space-y-2">
            {Array.from({ length: Math.min(draft.emails?.length || 1, MAX_EMAILS) }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={draft.emails[i] || ""}
                  onChange={(v) => updateEmail(i, v)}
                  placeholder={`email ${i + 1}`}
                />
                {i > 0 && (
                  <button
                    onClick={() => removeEmail(i)}
                    className={`rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/5 ${glass}`}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
            <div className="flex justify-end">
              <button
                disabled={(draft.emails?.length || 0) >= MAX_EMAILS}
                onClick={addEmail}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/90 hover:bg-white/10 ${glass}`}
              >
                <Plus size={16} /> Add email
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* GST */}
      <div className={ringWrap}>
        <Card title="GST">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="GST Number">
              <Input
                value={draft.gst_no}
                onChange={(v) => setDraft({ ...draft, gst_no: v })}
                placeholder="e.g., 27AAAAA0000A1Z5"
              />
            </Field>
            <Field label="GST Type">
              <div className="flex gap-4 rounded-lg px-3 py-2 bg-white/5 border border-white/10">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="gst_type"
                    value="INTRA"
                    checked={draft.gst_type === "INTRA"}
                    onChange={() => setDraft({ ...draft, gst_type: "INTRA" })}
                  />
                  <span>Intrastate (CGST+SGST)</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="gst_type"
                    value="INTER"
                    checked={draft.gst_type === "INTER"}
                    onChange={() => setDraft({ ...draft, gst_type: "INTER" })}
                  />
                  <span>Interstate (IGST)</span>
                </label>
              </div>
            </Field>

            {draft.gst_type === "INTRA" ? (
              <>
                <Field label="CGST (%)">
                  <Input
                    type="number"
                    value={draft.cgst_rate}
                    onChange={(v) => setDraft({ ...draft, cgst_rate: v })}
                  />
                </Field>
                <Field label="SGST (%)">
                  <Input
                    type="number"
                    value={draft.sgst_rate}
                    onChange={(v) => setDraft({ ...draft, sgst_rate: v })}
                  />
                </Field>
              </>
            ) : (
              <Field label="IGST (%)">
                <Input
                  type="number"
                  value={draft.igst_rate}
                  onChange={(v) => setDraft({ ...draft, igst_rate: v })}
                />
              </Field>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------ main page ------------------------------- */
export default function PartyRegistration() {
  // header context
  const { firm, fy, setFirm, setFy } = useCtx();
  const [firms, setFirms] = useState([]);
  const [fys, setFys] = useState([]);

  // page state
  const [tab, setTab] = useState("add");
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState({ ...EMPTY });
  const [editingId, setEditingId] = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  // search
  const [q, setQ] = useState("");

  // toasts
  const toast = useToast();

  // delete confirm popover
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingAction = useRef(null);
  function onAskDelete(cb) {
    pendingAction.current = cb;
    setConfirmOpen(true);
  }

  // columns
  const columns = useMemo(
    () => [
      { key: "_sn", label: "#" },
      { key: "name", label: "Name" },
      { key: "address", label: "Address" },
      { key: "contact", label: "Contact" },
      {
        key: "emails",
        label: "Emails",
        render: (value) => (Array.isArray(value) ? value.filter(Boolean).join(", ") : value || ""),
      },
      { key: "gst_no", label: "GST No" },
    ],
    []
  );

  // header lists
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

  // fetch registry
  async function refresh() {
    const { data } = await api.get("/parties/registry");
    setRows(
      (data || []).map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address || "",
        contact: p.contact || "",
        emails: Array.isArray(p.emails) ? p.emails : [],
        gst_no: p.gst_no || "",
        gst_type: p.gst_type || "INTRA",
        cgst_rate: p.cgst_rate || "",
        sgst_rate: p.sgst_rate || "",
        igst_rate: p.igst_rate || "",
        role: p.role || "BOTH",
      }))
    );
  }
  useEffect(() => {
    refresh();
  }, []);

  // filter + SN
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const hay = [r.name, r.address, r.contact, r.gst_no, r.role, ...(Array.isArray(r.emails) ? r.emails : [])]
        .join(" ")
        .toLowerCase();
      return hay.includes(s);
    });
  }, [q, rows]);

  const rowsForTable = useMemo(() => filtered.map((r, i) => ({ ...r, _sn: i + 1 })), [filtered]);

  /* ------------------------------- CRUD -------------------------------- */
  async function save() {
    const body = {
      name: (draft.name || "").trim(),
      address: (draft.address || "").trim(),
      contact: (draft.contact || "").trim(),
      emails: (draft.emails || []).map((e) => e.trim()).filter(Boolean).slice(0, MAX_EMAILS),
      gst_no: (draft.gst_no || "").trim(),
      gst_type: draft.gst_type,
      cgst_rate: draft.gst_type === "INTRA" ? Number(draft.cgst_rate || 0) : 0,
      sgst_rate: draft.gst_type === "INTRA" ? Number(draft.sgst_rate || 0) : 0,
      igst_rate: draft.gst_type === "INTER" ? Number(draft.igst_rate || 0) : 0,
      role: draft.role || "BOTH",
    };

    if (!body.name) return toast.error("Party name is required.");

    try {
      if (editingId) {
        await api.put(`/parties/${editingId}`, body);
        toast.success("Party updated");
        setEditOpen(false);
      } else {
        await api.post("/parties", body);
        toast.success("Party created");
        setTab("list");
      }
      setEditingId(null);
      setDraft({ ...EMPTY });
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save party");
    }
  }

  async function attemptDelete(id) {
    try {
      await api.delete(`/parties/${id}`);
      toast.success("Party deleted");
      await refresh();
    } catch (e) {
      // FK protected (backend should return 409)
      if (e?.response?.status === 409) {
        toast.info("Party is linked to contracts. Deactivating instead.");
        await api.patch(`/parties/${id}/deactivate`);
        await refresh();
      } else {
        console.error(e);
        toast.error("Failed to delete party");
      }
    }
  }

  function onEdit(rec) {
    setEditingId(rec.id);
    setDraft({
      name: rec.name || "",
      address: rec.address || "",
      contact: rec.contact || "",
      emails: rec.emails?.length ? rec.emails.slice(0, MAX_EMAILS) : [""],
      gst_no: rec.gst_no || "",
      gst_type: rec.gst_type || "INTRA",
      cgst_rate: rec.cgst_rate || "",
      sgst_rate: rec.sgst_rate || "",
      igst_rate: rec.igst_rate || "",
      role: rec.role || "BOTH",
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
      activeKey="party-registration"
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
            <PartyForm draft={draft} setDraft={setDraft} isEditing={false} />
            <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={() => setDraft({ ...EMPTY })}
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
            <div className="mb-3 flex items-center justify-between">
              <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${glass} bg-black/20`}>
                <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-80">
                  <path
                    fill="currentColor"
                    d="M15.5 14h-.79l-.28-.27a6.471 6.471 0 0 0 1.57-4.23A6.5 6.5 0 1 0 9.5 16a6.471 6.471 0 0 0 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5ZM4 9.5C4 6.46 6.46 4 9.5 4S15 6.46 15 9.5 12.54 15 9.5 15 4 12.54 4 9.5Z"
                  />
                </svg>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search name, email, GST, address…"
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
                if (type === "edit") return onEdit(row);
                if (type === "delete") {
                  onAskDelete(() => attemptDelete(row.id));
                }
              }}
            />
          </div>
        )}
      </div>

      {/* EDIT OVERLAY */}
      <EditOverlay
        open={editOpen}
        title={`Edit Party • ${draft.name || `#${editingId}`}`}
        onClose={() => {
          setEditOpen(false);
          setEditingId(null);
          setDraft({ ...EMPTY });
          setTab("list");
          toast.info?.("Edit canceled");
        }}
        footer={
          <>
            <button
              onClick={() => {
                setEditOpen(false);
                setEditingId(null);
                setDraft({ ...EMPTY });
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
        <PartyForm draft={draft} setDraft={setDraft} isEditing />
      </EditOverlay>

      {/* DELETE CONFIRM */}
      <ConfirmationDialog
        open={confirmOpen}
        title="Delete party?"
        message="If this party is linked to contracts, we'll deactivate it instead."
        confirmLabel="Delete"
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
    </AppShell>
  );
}
