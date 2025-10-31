// src/pages/Cohorts.jsx
import { useEffect, useState } from "react";
import { AppShell } from "../components/layout";
import { useCtx } from "../state/context";
import { api } from "../api";
import { Card, Field, Input, glass } from "../components/primitives";

export default function Cohorts(){
  const { firm, fy, setFirm, setFy } = useCtx();
  const [firms, setFirms] = useState([]);
  const [fys, setFys] = useState([]);
  const [data, setData] = useState(null);
  const [months, setMonths] = useState(6);

  useEffect(()=>{ (async()=>{ const [{data: firmList},{data: fyList}] = await Promise.all([api.get('/firms'), api.get('/firms/fiscal-years')]); setFirms(firmList||[]); setFys(fyList||[]); if(!firm&&firmList?.[0]) setFirm(firmList[0]); if(!fy&&fyList?.[0]) setFy(fyList[0]); })(); },[]);

  async function load(){ const { data } = await api.get('/reports/cohort', { params:{ months } }); setData(data); }
  useEffect(()=>{ if (firm?.id) load(); },[firm?.id, fy?.id, months]);

  return (
    <AppShell firm={firm} fy={fy} firms={firms} fys={fys} setFirm={setFirm} setFy={setFy} activeKey="cohorts" setActiveKey={()=>{}}>
      <div className="text-white">
        <Card title="Cohort Repeat-Purchase">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <Field label="Months"><Input type="number" value={months} onChange={v=>setMonths(Number(v)||6)} /></Field>
          </div>
          {data ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs sm:text-sm text-white">
                <thead className="border-b border-white/10 text-white/70">
                  <tr>
                    <th className="px-2 sm:px-3 py-2">Cohort</th>
                    {Array.from({length:data.months}).map((_,i)=>(<th key={i} className="px-2 sm:px-3 py-2">M{i}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {data.cohorts.map((r)=> (
                    <tr key={r.cohort} className="border-t border-white/10">
                      <td className="px-2 sm:px-3 py-2">{r.cohort} (n={r.size})</td>
                      {r.buckets.map((v,i)=>(<td key={i} className="px-2 sm:px-3 py-2">{v.toFixed(1)}%</td>))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (<div className="text-white/60 text-sm">Loading…</div>)}
        </Card>
      </div>
    </AppShell>
  );
}

