// src/pages/Analytics.jsx
import { AppShell } from "../components/layout";
import { useCtx } from "../state/context";
import { useEffect, useState } from "react";
import { api } from "../api";
import { Card, Field, glass } from "../components/primitives";
import ComboBox from "../components/combobox";
import PriceChart from "../components/price-chart";

export default function Analytics() {
  const { firm, fy, setFirm, setFy } = useCtx();
  const [firms, setFirms] = useState([]);
  const [fys, setFys] = useState([]);
  const [products, setProducts] = useState([]);
  const [parties, setParties] = useState([]);
  const [productId, setProductId] = useState(null);
  const [partyId, setPartyId] = useState(null);
  const [role, setRole] = useState('any');
  const [chartData, setChartData] = useState([]);
  const [group, setGroup] = useState('day');
  const [stat, setStat] = useState('last'); // last|avg|band
  const [showIntro, setShowIntro] = useState(() => localStorage.getItem('analyticsIntroHidden') !== '1');

  useEffect(() => {
    (async () => {
      const [{ data: firmList }, { data: fyList }, { data: productList }, { data: partyList }] = await Promise.all([
        api.get("/firms"), api.get("/firms/fiscal-years"), api.get('/products'), api.get('/parties')
      ]);
      setFirms(firmList||[]); setFys(fyList||[]);
      setProducts((productList||[]).map(p=>({value:p.id,label:p.name})));
      setParties((partyList||[]).map(p=>({value:p.id,label:p.name})));
      if (!firm && firmList?.[0]) setFirm(firmList[0]);
      if (!fy && fyList?.[0]) setFy(fyList[0]);
    })();
  }, []);

  useEffect(()=>{
    (async()=>{
      if (!firm?.id || !productId) { setChartData([]); return }
      const params = { product_id: productId, group, stat };
      if (partyId) { params.party_id = partyId; params.role = role; }
      const { data } = await api.get('/reports/price-series', { params })
      if (stat === 'band') {
        const rows = (data||[]).map(r => ({
          label: r.period,
          min: r.min == null ? null : Number(r.min),
          max: r.max == null ? null : Number(r.max),
          avg: r.avg == null ? null : Number(r.avg),
          count: Number(r.count || 0),
        }));
        // derive gap for stacked area band (max-min)
        const shaped = rows.map(r => ({ ...r, gap: (r.min!=null && r.max!=null) ? (r.max - r.min) : null }));
        setChartData(shaped);
      } else {
        setChartData((data||[]).map(r => ({ label: r.period, value: r.price==null? null : Number(r.price) })));
      }
    })()
  },[firm?.id, fy?.id, productId, partyId, role, group, stat])

  return (
    <AppShell firm={firm} fy={fy} firms={firms} fys={fys} setFirm={setFirm} setFy={setFy} activeKey="analytics-home" setActiveKey={()=>{}}>
      <div className="text-white">
        {showIntro && (
          <div className="mb-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-100 p-3 text-sm flex items-start justify-between">
            <div>
              <strong className="mr-2">Analytics is in beta.</strong>
              Explore Aging, Brokerage, Top lists, Cohorts and Anomaly Watch. We’ll keep refining visuals and performance.
            </div>
            <button
              onClick={() => { setShowIntro(false); localStorage.setItem('analyticsIntroHidden','1'); }}
              className="ml-3 rounded-lg px-2 py-1 border border-yellow-500/40 hover:bg-yellow-500/20"
            >Hide</button>
          </div>
        )}

        <div className="h-4" />
        <Card title="Price Trend">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-3">
            <Field label="Product">
              <ComboBox value={productId} onChange={setProductId} options={products} placeholder="Select product" />
            </Field>
            <Field label="Party (optional)">
              <ComboBox value={partyId} onChange={setPartyId} options={parties} placeholder="All parties" />
            </Field>
            <Field label="Role">
              <select value={role} onChange={e=>setRole(e.target.value)} disabled={!partyId} className={`w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20 ${glass} bg-black/20 ${!partyId?'opacity-50 cursor-not-allowed':''}`}>
                <option value="any">Any</option>
                <option value="seller">Seller</option>
                <option value="buyer">Buyer</option>
              </select>
            </Field>
            <Field label="Group by">
              <select value={group} onChange={e=>setGroup(e.target.value)} className={`w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20 ${glass} bg-black/20`}>
                <option value="day">Day</option>
                <option value="month">Month</option>
              </select>
            </Field>
            <Field label="Stat">
              <select value={stat} onChange={e=>setStat(e.target.value)} className={`w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20 ${glass} bg-black/20`}>
                <option value="last">Last</option>
                <option value="avg">Average</option>
                <option value="band">Range (min–max + avg)</option>
              </select>
            </Field>
            <div className="flex items-end">
              <button
                onClick={()=>{ setProductId(null); setPartyId(null); setRole('any'); setGroup('day'); setStat('last'); }}
                className={`rounded-lg px-3 py-2 text-sm ${glass} bg-white/10 hover:bg-white/20 border border-white/10`}
              >
                Reset
              </button>
            </div>
          </div>
          {chartData?.length ? (
            <PriceChart data={chartData} height={360} variant={stat==='band' ? 'band' : 'single'} />
          ) : (
            <div className="text-white/60 text-sm">Pick a product to see the price trend.</div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
