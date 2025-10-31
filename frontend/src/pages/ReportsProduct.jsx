// src/pages/ReportsProduct.jsx
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout";
import { useCtx } from "../state/context";
import { api } from "../api";
import DataTable from "../components/table";
import { Card } from "../components/primitives";

function fmtQty(n){return Number(n||0).toLocaleString('en-IN');}
function fmtNum(n){return n==null ? '—' : Number(n).toLocaleString('en-IN', {maximumFractionDigits:2});}

export default function ReportsProduct(){
  const { firm, fy, setFirm, setFy } = useCtx();
  const [firms, setFirms] = useState([]);
  const [fys, setFys] = useState([]);
  const [rows, setRows] = useState([]);

  useEffect(()=>{
    (async ()=>{
      const [{ data: firmList }, { data: fyList }] = await Promise.all([
        api.get('/firms'), api.get('/firms/fiscal-years')
      ]);
      setFirms(firmList||[]); setFys(fyList||[]);
      if (!firm && firmList?.[0]) setFirm(firmList[0]);
      if (!fy && fyList?.[0]) setFy(fyList[0]);
    })();
  },[]);

  useEffect(()=>{ (async()=>{ if(!firm?.id) return; const { data } = await api.get('/reports/products'); setRows(data||[]); })(); },[firm?.id, fy?.id]);

  const columns = [
    { key:'product_name', label:'Product' },
    { key:'trades', label:'Trades' },
    { key:'total_qty', label:'Total Qty', render:(v)=>fmtQty(v) },
    { key:'avg_price', label:'Avg Price', render:(v)=>fmtNum(v) },
  ];

  const totals = useMemo(()=>{
    let t=0,q=0; for(const r of rows){ t+=r.trades||0; q+=r.total_qty||0; } return {trades:t, qty:q};
  },[rows]);

  return (
    <AppShell firm={firm} fy={fy} firms={firms} fys={fys} setFirm={setFirm} setFy={setFy} activeKey="product-report" setActiveKey={()=>{}}>
      <div className="text-white">
        <Card title="Product Summary">
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

