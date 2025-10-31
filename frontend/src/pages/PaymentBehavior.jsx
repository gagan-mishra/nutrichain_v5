// src/pages/PaymentBehavior.jsx
import { useEffect, useState } from "react";
import { AppShell } from "../components/layout";
import { useCtx } from "../state/context";
import { api } from "../api";
import { Card, Field, Input, glass } from "../components/primitives";
import ComboBox from "../components/combobox";

function pct(v){ return v==null ? '—' : (v*100).toFixed(1) + '%'; }

export default function PaymentBehavior(){
  const { firm, fy, setFirm, setFy } = useCtx();
  const [firms, setFirms] = useState([]);
  const [fys, setFys] = useState([]);
  const [parties, setParties] = useState([]);
  const [partyId, setPartyId] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);

  useEffect(()=>{ (async()=>{
    const [{data: firmList},{data: fyList},{data: partyList}] = await Promise.all([
      api.get('/firms'), api.get('/firms/fiscal-years'), api.get('/parties')
    ]);
    setFirms(firmList||[]); setFys(fyList||[]);
    setParties((partyList||[]).map(p=>({value:p.id,label:p.name})));
    if (!firm && firmList?.[0]) setFirm(firmList[0]);
    if (!fy && fyList?.[0]) setFy(fyList[0]);
  })(); },[]);

  async function load(){ if(!partyId) return; const { data } = await api.get('/reports/payment-behavior', { params:{ party_id: partyId, from, to } }); setData(data); }
  useEffect(()=>{ if (firm?.id && partyId) load(); },[firm?.id, fy?.id, partyId, from, to]);

  return (
    <AppShell firm={firm} fy={fy} firms={firms} fys={fys} setFirm={setFirm} setFy={setFy} activeKey="analytics-home" setActiveKey={()=>{}}>
      <div className="text-white">
        <Card title="Payment Behavior">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <Field label="Party">
              <ComboBox value={partyId} onChange={setPartyId} options={parties} placeholder="Select party" />
            </Field>
            <Field label="From"><Input type="date" value={from} onChange={setFrom} /></Field>
            <Field label="To"><Input type="date" value={to} onChange={setTo} /></Field>
            <div className="flex items-end"><button onClick={()=>{setFrom('');setTo('');}} className={`rounded-lg px-3 py-2 text-sm ${glass} bg-white/10 hover:bg-white/20 border border-white/10`}>Clear</button></div>
          </div>

          {data ? (
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 text-sm">
              <Metric title="Bills" value={data.summary.bills} />
              <Metric title="Paid" value={data.summary.paid} />
              <Metric title="Open" value={data.summary.open} />
              <Metric title="Avg Days to Pay" value={data.summary.avg_days_to_pay==null?'—':data.summary.avg_days_to_pay.toFixed(1)} />
              <Metric title="% On-time" value={pct(data.summary.pct_on_time)} />
              <Metric title="Max Delay" value={data.summary.max_delay} />
            </div>
          ) : (
            <div className="text-white/60 text-sm">Pick a party to see metrics.</div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function Metric({ title, value }){
  return (
    <div className="rounded-lg p-3 bg-black/20 border border-white/10">
      <div className="text-white/60 text-xs">{title}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

