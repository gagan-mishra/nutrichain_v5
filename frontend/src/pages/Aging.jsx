// src/pages/Aging.jsx
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout";
import { useNavigate } from "react-router-dom";
import { useCtx } from "../state/context";
import { api } from "../api";
import DataTable from "../components/table";
import { Card, Field, Input, glass } from "../components/primitives";
import ComboBox from "../components/combobox";
import { formatINR } from "../utils/format";

function todayYMD(){ const d=new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }

export default function Aging(){
  const { firm, fy, setFirm, setFy } = useCtx();
  const navigate = useNavigate();
  const [firms, setFirms] = useState([]);
  const [fys, setFys] = useState([]);
  const [parties, setParties] = useState([]);
  const [partyId, setPartyId] = useState(null);
  const [asOf, setAsOf] = useState(todayYMD());
  const [rows, setRows] = useState([]);

  useEffect(()=>{ (async()=>{
    const [{data: firmList},{data: fyList},{data: partyList}] = await Promise.all([
      api.get('/firms'), api.get('/firms/fiscal-years'), api.get('/parties')
    ]);
    setFirms(firmList||[]); setFys(fyList||[]);
    setParties((partyList||[]).map(p=>({ value:p.id, label:p.name })));
    if (!firm && firmList?.[0]) setFirm(firmList[0]);
    if (!fy && fyList?.[0]) setFy(fyList[0]);
  })(); },[]);

  async function load(){
    const params = { as_of: asOf };
    if (partyId) params.party_id = partyId;
    const { data } = await api.get('/reports/aging', { params });
    setRows(data||[]);
  }
  useEffect(()=>{ if (firm?.id) load(); },[firm?.id, fy?.id, partyId, asOf]);

  const columns = [
    { key:'party_name', label:'Party' },
    { key:'b0_7', label:'0–7', render:(v)=>formatINR(v) },
    { key:'b8_30', label:'8–30', render:(v)=>formatINR(v) },
    { key:'b31_60', label:'31–60', render:(v)=>formatINR(v) },
    { key:'b61_90', label:'61–90', render:(v)=>formatINR(v) },
    { key:'b90p', label:'90+', render:(v)=>formatINR(v) },
    { key:'total', label:'Total', render:(v)=>formatINR(v) },
  ];

  const totals = useMemo(()=>{
    const t = { b0_7:0,b8_30:0,b31_60:0,b61_90:0,b90p:0,total:0 };
    for(const r of rows){ t.b0_7+=r.b0_7; t.b8_30+=r.b8_30; t.b31_60+=r.b31_60; t.b61_90+=r.b61_90; t.b90p+=r.b90p; t.total+=r.total; }
    return t;
  },[rows]);

  return (
    <AppShell firm={firm} fy={fy} firms={firms} fys={fys} setFirm={setFirm} setFy={setFy} activeKey="aging" setActiveKey={()=>{}}>
      <div className="text-white">
        <Card title="Receivables Aging">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <Field label="Party (optional)">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-[220px]"><ComboBox value={partyId} onChange={setPartyId} options={parties} placeholder="All parties" /></div>
                <button onClick={()=>setPartyId(null)} className={`rounded-lg px-3 py-2 text-xs text-white/80 hover:text-white hover:bg-white/10 border border-white/10 ${glass}`}>Clear</button>
              </div>
            </Field>
            <Field label="As of">
              <Input type="date" value={asOf} onChange={setAsOf} />
            </Field>
          </div>

          <DataTable columns={columns} rows={rows} allowedActions={["edit"]} onAction={(type,row)=>{
            if (type==='edit') {
              // Client-side navigate to Bill Receive with party filter (no reload)
              navigate(`/sales/bill-receive?party_id=${row.party_id}`);
            }
          }} />

          <div className="mt-3 grid grid-cols-1 md:grid-cols-6 gap-3 text-sm">
            <div className="rounded-lg p-3 bg-black/20 border border-white/10"><div className="text-white/60 text-xs">0–7</div><div className="text-lg font-semibold">{formatINR(totals.b0_7)}</div></div>
            <div className="rounded-lg p-3 bg-black/20 border border-white/10"><div className="text-white/60 text-xs">8–30</div><div className="text-lg font-semibold">{formatINR(totals.b8_30)}</div></div>
            <div className="rounded-lg p-3 bg-black/20 border border-white/10"><div className="text-white/60 text-xs">31–60</div><div className="text-lg font-semibold">{formatINR(totals.b31_60)}</div></div>
            <div className="rounded-lg p-3 bg-black/20 border border-white/10"><div className="text-white/60 text-xs">61–90</div><div className="text-lg font-semibold">{formatINR(totals.b61_90)}</div></div>
            <div className="rounded-lg p-3 bg-black/20 border border-white/10"><div className="text-white/60 text-xs">90+</div><div className="text-lg font-semibold">{formatINR(totals.b90p)}</div></div>
            <div className="rounded-lg p-3 bg-black/20 border border-white/10"><div className="text-white/60 text-xs">Total</div><div className="text-lg font-semibold">{formatINR(totals.total)}</div></div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
