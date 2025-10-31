// src/pages/ReportsSales.jsx
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout";
import { useCtx } from "../state/context";
import { api } from "../api";
import DataTable from "../components/table";
import { glass, Card, Field } from "../components/primitives";
import ComboBox from "../components/combobox";

function fmtQty(n){return Number(n||0).toLocaleString('en-IN');}
function fmtNum(n){return n==null ? '—' : Number(n).toLocaleString('en-IN', {maximumFractionDigits:2});}

export default function ReportsSales(){
  const { firm, fy, setFirm, setFy } = useCtx();
  const [firms, setFirms] = useState([]);
  const [fys, setFys] = useState([]);
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState(null);
  const [group, setGroup] = useState('month');

  useEffect(()=>{
    (async () => {
      const [{ data: firmList }, { data: fyList }, { data: productList }] = await Promise.all([
        api.get("/firms"), api.get("/firms/fiscal-years"), api.get('/products')
      ]);
      setFirms(firmList||[]); setFys(fyList||[]);
      setProducts((productList||[]).map(p=>({ value:p.id, label:p.name })));
      if (!firm && firmList?.[0]) setFirm(firmList[0]);
      if (!fy && fyList?.[0]) setFy(fyList[0]);
    })();
  },[]);

  async function load(){
    const params = { group };
    if (productId) params.product_id = productId;
    const { data } = await api.get('/reports/sales', { params });
    setRows(data||[]);
  }
  useEffect(()=>{ if (firm?.id) load(); }, [firm?.id, fy?.id, group, productId]);

  const columns = [
    { key:'period', label: group==='day' ? 'Date' : 'Month' },
    { key:'trades', label:'Trades' },
    { key:'total_qty', label:'Total Qty', render:(v)=>fmtQty(v) },
    { key:'avg_price', label:'Avg Price', render:(v)=> productId ? fmtNum(v) : '—' },
  ];

  const totals = useMemo(()=>{
    let t=0,q=0; for(const r of rows){ t+=r.trades||0; q+=r.total_qty||0; }
    return { trades:t, qty:q };
  },[rows]);

  return (
    <AppShell firm={firm} fy={fy} firms={firms} fys={fys} setFirm={setFirm} setFy={setFy} activeKey="sales-report" setActiveKey={()=>{}}>
      <div className="text-white">
        <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <Field label="Group by">
            <select value={group} onChange={e=>setGroup(e.target.value)} className={`w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20 ${glass} bg-black/20`}>
              <option value="day">Day</option>
              <option value="month">Month</option>
            </select>
          </Field>
          <Field label="Product (optional)">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-[200px]"><ComboBox value={productId} onChange={setProductId} options={products} placeholder="All products" /></div>
              <button onClick={()=>setProductId(null)} className={`rounded-lg px-3 py-2 text-xs text-white/80 hover:text-white hover:bg-white/10 border border-white/10 ${glass}`}>Clear</button>
            </div>
          </Field>
        </div>
        <Card title="Sales Summary">
          <DataTable columns={columns} rows={rows} allowedActions={[]} />
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 text-sm">
            <div className="rounded-lg p-3 bg-black/20 border border-white/10">
              <div className="text-white/60 text-xs">Total Trades</div>
              <div className="text-lg font-semibold">{totals.trades}</div>
            </div>
            <div className="rounded-lg p-3 bg-black/20 border border-white/10">
              <div className="text-white/60 text-xs">Total Qty</div>
              <div className="text-lg font-semibold">{fmtQty(totals.qty)}</div>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
