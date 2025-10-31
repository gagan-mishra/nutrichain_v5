// src/pages/Anomaly.jsx
import { useEffect, useState } from "react";
import { AppShell } from "../components/layout";
import { useCtx } from "../state/context";
import { api } from "../api";
import { Card, Field, Input, glass } from "../components/primitives";
import ComboBox from "../components/combobox";

export default function Anomaly(){
  const { firm, fy, setFirm, setFy } = useCtx();
  const [firms, setFirms] = useState([]);
  const [fys, setFys] = useState([]);
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState(null);
  const [windowDays, setWindowDays] = useState(30);
  const [z, setZ] = useState(2);
  const [rows, setRows] = useState([]);

  useEffect(()=>{ (async()=>{
    const [{data: firmList},{data: fyList},{data: productList}] = await Promise.all([
      api.get('/firms'), api.get('/firms/fiscal-years'), api.get('/products')
    ]);
    setFirms(firmList||[]); setFys(fyList||[]);
    setProducts((productList||[]).map(p=>({value:p.id,label:p.name})));
    if(!firm&&firmList?.[0]) setFirm(firmList[0]); if(!fy&&fyList?.[0]) setFy(fyList[0]);
  })(); },[]);

  async function load(){ const params = { window: windowDays, z }; if(productId) params.product_id = productId; const { data } = await api.get('/reports/anomaly', { params }); setRows(data||[]); }
  useEffect(()=>{ if (firm?.id) load(); },[firm?.id, fy?.id, productId, windowDays, z]);

  return (
    <AppShell firm={firm} fy={fy} firms={firms} fys={fys} setFirm={setFirm} setFy={setFy} activeKey="anomaly" setActiveKey={()=>{}}>
      <div className="text-white">
        <Card title="Anomaly Watch (Price Z-score)">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <Field label="Product (optional)"><ComboBox value={productId} onChange={setProductId} options={products} placeholder="All products" /></Field>
            <Field label="Window (days)"><Input type="number" value={windowDays} onChange={v=>setWindowDays(Number(v)||30)} /></Field>
            <Field label="Z-score ≥"><Input type="number" value={z} onChange={v=>setZ(Number(v)||2)} /></Field>
          </div>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-left text-xs sm:text-sm text-white">
              <thead className="border-b border-white/10 text-white/70">
                <tr>
                  <th className="px-2 sm:px-3 py-2">Date</th>
                  <th className="px-2 sm:px-3 py-2">Product</th>
                  <th className="px-2 sm:px-3 py-2">Price</th>
                  <th className="px-2 sm:px-3 py-2">Z</th>
                  <th className="px-2 sm:px-3 py-2">Seller</th>
                  <th className="px-2 sm:px-3 py-2">Buyer</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r)=> (
                  <tr key={r.id} className="border-t border-white/10">
                    <td className="px-2 sm:px-3 py-2">{r.date}</td>
                    <td className="px-2 sm:px-3 py-2">{r.product_name}</td>
                    <td className="px-2 sm:px-3 py-2">{r.price?.toLocaleString('en-IN')}</td>
                    <td className="px-2 sm:px-3 py-2">{r.z}</td>
                    <td className="px-2 sm:px-3 py-2">{r.seller_name}</td>
                    <td className="px-2 sm:px-3 py-2">{r.buyer_name}</td>
                  </tr>
                ))}
                {rows.length===0 && (<tr><td colSpan={6} className="px-3 py-4 text-white/60">No anomalies found</td></tr>)}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

