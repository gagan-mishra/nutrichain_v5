// src/pages/Brokerage.jsx
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout";
import { useCtx } from "../state/context";
import { api } from "../api";
import { Card, Field, Input, glass } from "../components/primitives";
import ComboBox from "../components/combobox";
import DataTable from "../components/table";
import { formatINR } from "../utils/format";

export default function Brokerage(){
  const { firm, fy, setFirm, setFy } = useCtx();
  const [firms, setFirms] = useState([]);
  const [fys, setFys] = useState([]);
  const [group, setGroup] = useState('month');
  const [rows, setRows] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(()=>{ (async()=>{ const [{data: firmList},{data: fyList}] = await Promise.all([api.get('/firms'), api.get('/firms/fiscal-years')]); setFirms(firmList||[]); setFys(fyList||[]); if(!firm&&firmList?.[0]) setFirm(firmList[0]); if(!fy&&fyList?.[0]) setFy(fyList[0]); })(); },[]);

  async function load(){ const { data } = await api.get('/reports/brokerage', { params:{ group, from, to } }); setRows(data||[]); }
  useEffect(()=>{ if (firm?.id) load(); },[firm?.id, fy?.id, group, from, to]);

  const columns = group==='party'
    ? [ {key:'party_name',label:'Party'}, {key:'total',label:'Total',render:v=>formatINR(v)} ]
    : [ {key:'period',label:'Month'}, {key:'total',label:'Total',render:v=>formatINR(v)} ];

  const total = useMemo(()=> rows.reduce((s,r)=>s+Number(r.total||0),0),[rows]);

  return (
    <AppShell firm={firm} fy={fy} firms={firms} fys={fys} setFirm={setFirm} setFy={setFy} activeKey="analytics-home" setActiveKey={()=>{}}>
      <div className="text-white">
        <Card title="Brokerage Earnings">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <Field label="Group by">
              <select value={group} onChange={e=>setGroup(e.target.value)} className={`w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20 ${glass} bg-black/20`}>
                <option value="month">Month</option>
                <option value="party">Party</option>
              </select>
            </Field>
            <Field label="From"><Input type="date" value={from} onChange={setFrom} /></Field>
            <Field label="To"><Input type="date" value={to} onChange={setTo} /></Field>
            <div className="flex items-end"><button onClick={()=>{setFrom('');setTo('');}} className={`rounded-lg px-3 py-2 text-sm ${glass} bg-white/10 hover:bg-white/20 border border-white/10`}>Clear</button></div>
          </div>

          <DataTable columns={columns} rows={rows} allowedActions={[]} />
          <div className="mt-3 rounded-lg p-3 bg-black/20 border border-white/10 text-sm">
            <span className="text-white/60 mr-2">Total:</span> <span className="font-semibold">{formatINR(total)}</span>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

