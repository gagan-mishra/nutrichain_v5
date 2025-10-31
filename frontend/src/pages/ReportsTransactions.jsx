// src/pages/ReportsTransactions.jsx
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout";
import { useCtx } from "../state/context";
import { api } from "../api";
import DataTable from "../components/table";
import { glass, Card, Field, Input } from "../components/primitives";
import ComboBox from "../components/combobox";

function fmtQty(n){return Number(n||0).toLocaleString('en-IN');}
function fmtNum(n){return n==null ? '—' : Number(n).toLocaleString('en-IN', {maximumFractionDigits:2});}
function toYMD(d){ if(!d) return ''; const dt=new Date(d); const y=dt.getFullYear(), m=String(dt.getMonth()+1).padStart(2,'0'), dd=String(dt.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }

export default function ReportsTransactions(){
  const { firm, fy, setFirm, setFy } = useCtx();
  const [firms, setFirms] = useState([]);
  const [fys, setFys] = useState([]);
  const [rows, setRows] = useState([]);
  const [parties, setParties] = useState([]);
  const [products, setProducts] = useState([]);
  const [partyId, setPartyId] = useState(null);
  const [productId, setProductId] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(()=>{
    (async ()=>{
      const [{ data: firmList }, { data: fyList }, { data: partyList }, { data: productList }] = await Promise.all([
        api.get('/firms'), api.get('/firms/fiscal-years'), api.get('/parties'), api.get('/products')
      ]);
      setFirms(firmList||[]); setFys(fyList||[]);
      setParties((partyList||[]).map(p=>({value:p.id,label:p.name})));
      setProducts((productList||[]).map(p=>({value:p.id,label:p.name})));
      if (!firm && firmList?.[0]) setFirm(firmList[0]);
      if (!fy && fyList?.[0]) setFy(fyList[0]);
    })();
  },[]);

  async function load(){
    const params = {};
    if (partyId) params.party_id = partyId;
    if (productId) params.product_id = productId;
    if (from) params.from = from;
    if (to) params.to = to;
    const { data } = await api.get('/reports/transactions', { params });
    setRows(data||[]);
  }
  useEffect(()=>{ if (firm?.id) load(); }, [firm?.id, fy?.id, partyId, productId, from, to]);

  const columns = [
    { key:'order_date', label:'Date' },
    { key:'contract_no', label:'Contract' },
    { key:'seller_name', label:'Seller' },
    { key:'buyer_name', label:'Buyer' },
    { key:'product_name', label:'Product' },
    { key:'qty', label:'Qty', render:(v)=>fmtQty(v) },
    { key:'unit', label:'Unit' },
    { key:'price', label:'Price', render:(v)=>fmtNum(v) },
    { key:'seller_brokerage', label:'Seller Br.', render:(v)=>fmtNum(v) },
    { key:'buyer_brokerage', label:'Buyer Br.', render:(v)=>fmtNum(v) },
  ];

  return (
    <AppShell firm={firm} fy={fy} firms={firms} fys={fys} setFirm={setFirm} setFy={setFy} activeKey="transaction-report" setActiveKey={()=>{}}>
      <div className="text-white">
        <Card title="Filters">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <Field label="Party">
              <ComboBox value={partyId} onChange={setPartyId} options={parties} placeholder="All parties" />
            </Field>
            <Field label="Product">
              <ComboBox value={productId} onChange={setProductId} options={products} placeholder="All products" />
            </Field>
            <Field label="From"><Input type="date" value={from} onChange={setFrom} /></Field>
            <Field label="To"><Input type="date" value={to} onChange={setTo} /></Field>
            <div className="flex items-end">
              <button
                onClick={()=>{ setPartyId(null); setProductId(null); setFrom(''); setTo(''); }}
                className="rounded-lg px-3 py-2 text-sm bg-white/10 hover:bg-white/20 border border-white/10"
              >
                Clear
              </button>
            </div>
          </div>
        </Card>
        <div className="mt-3" />
        <Card title="Transactions">
          <DataTable columns={columns} rows={rows} allowedActions={[]} indexColumn indexStart={1} />
        </Card>
      </div>
    </AppShell>
  );
}
