// src/pages/TopAnalytics.jsx
import { useEffect, useState } from "react";
import { AppShell } from "../components/layout";
import { useCtx } from "../state/context";
import { api } from "../api";
import { Card, Field, Input, glass } from "../components/primitives";
import DataTable from "../components/table";
import ComboBox from "../components/combobox";
import { formatINR } from "../utils/format";

export default function TopAnalytics(){
  const { firm, fy, setFirm, setFy } = useCtx();
  const [firms, setFirms] = useState([]);
  const [fys, setFys] = useState([]);
  const [type, setType] = useState('party');
  const [metric, setMetric] = useState('qty');
  const [limit, setLimit] = useState(10);
  const [rows, setRows] = useState([]);

  useEffect(()=>{ (async()=>{ const [{data: firmList},{data: fyList}] = await Promise.all([api.get('/firms'), api.get('/firms/fiscal-years')]); setFirms(firmList||[]); setFys(fyList||[]); if(!firm&&firmList?.[0]) setFirm(firmList[0]); if(!fy&&fyList?.[0]) setFy(fyList[0]); })(); },[]);

  async function load(){ const { data } = await api.get('/reports/top', { params:{ type, metric, limit } }); setRows(data||[]); }
  useEffect(()=>{ if (firm?.id) load(); },[firm?.id, fy?.id, type, metric, limit]);

  const columns = type==='party'
    ? [ {key:'party_name',label:'Party'}, {key:'total',label:'Bill Total',render:v=>formatINR(v)} ]
    : [ {key:'product_name',label:'Product'}, {key:'qty',label:'Qty'}, {key:'value',label:'Value',render:v=>formatINR(v)} ];

  return (
    <AppShell firm={firm} fy={fy} firms={firms} fys={fys} setFirm={setFirm} setFy={setFy} activeKey="top" setActiveKey={()=>{}}>
      <div className="text-white">
        <Card title="Top Parties/Products">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <Field label="Type">
              <select value={type} onChange={e=>setType(e.target.value)} className={`w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20 ${glass} bg-black/20`}>
                <option value="party">Party</option>
                <option value="product">Product</option>
              </select>
            </Field>
            {type==='product' && (
              <Field label="Metric">
                <select value={metric} onChange={e=>setMetric(e.target.value)} className={`w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20 ${glass} bg-black/20`}>
                  <option value="qty">Qty</option>
                  <option value="value">Value</option>
                </select>
              </Field>
            )}
            <Field label="Limit">
              <Input type="number" value={limit} onChange={v=>setLimit(Number(v)||10)} />
            </Field>
          </div>
          <DataTable columns={columns} rows={rows} allowedActions={[]} />
        </Card>
      </div>
    </AppShell>
  );
}
