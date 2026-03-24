// src/pages/Analytics.jsx
import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/layout'
import { useCtx } from '../state/context'
import { api } from '../api'
import { Card, Field, glass } from '../components/primitives'
import ComboBox from '../components/combobox'
import PriceChart from '../components/price-chart'
import { formatINR } from '../utils/format'

const qtyFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })

function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function fmtQty(v) {
  const n = toNum(v)
  return n == null ? '0' : qtyFmt.format(n)
}

function shortPeriodLabel(value) {
  const s = String(value || '')
  if (/^\d{4}-\d{2}$/.test(s)) {
    const [yy, mm] = s.split('-').map(Number)
    return new Date(Date.UTC(yy, mm - 1, 1)).toLocaleString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' })
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [yy, mm, dd] = s.split('-').map(Number)
    return new Date(Date.UTC(yy, mm - 1, dd)).toLocaleString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' })
  }
  return s
}

function monthLabelsInRange(startIso, endIso) {
  if (!startIso || !endIso) return []
  const s = String(startIso).slice(0, 7)
  const e = String(endIso).slice(0, 7)
  const sm = /^(\d{4})-(\d{2})$/.exec(s)
  const em = /^(\d{4})-(\d{2})$/.exec(e)
  if (!sm || !em) return []

  let y = Number(sm[1])
  let m = Number(sm[2])
  const ey = Number(em[1])
  const emn = Number(em[2])

  const out = []
  while (y < ey || (y === ey && m <= emn)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

function fillMonthlyGaps(rows, fy, stat) {
  const safeRows = Array.isArray(rows) ? rows : []
  const labels = monthLabelsInRange(fy?.startDate, fy?.endDate)
  if (!labels.length) return safeRows

  const map = new Map(safeRows.map((r) => [r.label, r]))
  return labels.map((label) => {
    const hit = map.get(label)
    if (hit) return hit
    if (stat === 'band') {
      return { label, min: null, max: null, avg: null, count: 0, qty: 0 }
    }
    return { label, value: null, count: 0, qty: 0 }
  })
}

function statLabel(stat) {
  if (stat === 'avg') return 'Weighted Avg'
  if (stat === 'band') return 'Range + Weighted Avg'
  return 'Close Price'
}

function seriesValue(row, stat) {
  if (stat === 'band') return toNum(row.avg) ?? toNum(row.min) ?? toNum(row.max)
  return toNum(row.value)
}

function buildInsights(rows, stat) {
  if (!Array.isArray(rows) || rows.length === 0) return null

  const totalPeriods = rows.length
  const points = rows
    .map((r) => ({ label: r.label, value: seriesValue(r, stat) }))
    .filter((p) => p.value != null)

  if (!points.length) return null
  const observedPeriods = points.length
  const coveragePct = totalPeriods > 0 ? (observedPeriods / totalPeriods) * 100 : null

  const latest = points[points.length - 1]
  const previous = points.length > 1 ? points[points.length - 2] : null

  const change = previous ? latest.value - previous.value : null
  const changePct = previous && previous.value !== 0 ? (change / previous.value) * 100 : null

  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)
  const cvPct = mean !== 0 ? (stdDev / mean) * 100 : null
  const spanPct = min > 0 ? ((max - min) / min) * 100 : null

  const totalTrades = rows.reduce((s, r) => s + Number(r.count || 0), 0)
  const totalQty = rows.reduce((s, r) => s + Number(r.qty || 0), 0)

  let trend = 'Flat'
  if (change != null && Math.abs(change) > 0) trend = change > 0 ? 'Up' : 'Down'

  let confidence = 'High'
  if (observedPeriods < 3 || totalTrades < 5) confidence = 'Low'
  else if (observedPeriods < 6 || totalTrades < 15) confidence = 'Medium'

  return {
    latest,
    previous,
    change,
    changePct,
    min,
    max,
    mean,
    stdDev,
    cvPct,
    spanPct,
    totalTrades,
    totalQty,
    totalPeriods,
    observedPeriods,
    coveragePct,
    confidence,
    trend,
  }
}

function insightTone(change) {
  if (change == null || Math.abs(change) < 0.0001) return 'text-slate-200'
  return change > 0 ? 'text-emerald-300' : 'text-rose-300'
}

function InsightCard({ label, value, hint, toneClass = 'text-white' }) {
  return (
    <div className={`rounded-xl border border-white/10 bg-black/20 p-3 ${glass}`}>
      <div className="text-[11px] uppercase tracking-wider text-white/55">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-white/55">{hint}</div> : null}
    </div>
  )
}

export default function Analytics() {
  const { firm, fy, setFirm, setFy } = useCtx()

  const [firms, setFirms] = useState([])
  const [fys, setFys] = useState([])
  const [products, setProducts] = useState([])
  const [parties, setParties] = useState([])

  const [productId, setProductId] = useState(null)
  const [partyId, setPartyId] = useState(null)
  const [role, setRole] = useState('any')
  const [group, setGroup] = useState('day')
  const [stat, setStat] = useState('last')

  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [showIntro, setShowIntro] = useState(() => localStorage.getItem('analyticsIntroHidden') !== '1')

  useEffect(() => {
    (async () => {
      const [{ data: firmList }, { data: fyList }, { data: productList }, { data: partyList }] = await Promise.all([
        api.get('/firms'),
        api.get('/firms/fiscal-years'),
        api.get('/products'),
        api.get('/parties'),
      ])

      setFirms(firmList || [])
      setFys(fyList || [])
      setProducts((productList || []).map((p) => ({ value: p.id, label: p.name })))
      setParties((partyList || []).map((p) => ({ value: p.id, label: p.name })))

      if (!firm && firmList?.[0]) setFirm(firmList[0])
      if (!fy && fyList?.[0]) setFy(fyList[0])
    })()
  }, [])

  useEffect(() => {
    let active = true

    ;(async () => {
      if (!firm?.id || !productId) {
        if (active) {
          setChartData([])
          setError('')
          setLoading(false)
        }
        return
      }

      setLoading(true)
      setError('')

      try {
        const params = { product_id: productId, group, stat }
        if (fy?.id) params.fy_id = fy.id
        if (partyId) {
          params.party_id = partyId
          params.role = role
        }

        const { data } = await api.get('/reports/price-series', { params })
        if (!active) return

        if (stat === 'band') {
          const rows = (data || []).map((r) => ({
            label: r.period,
            min: r.min == null ? null : Number(r.min),
            max: r.max == null ? null : Number(r.max),
            avg: r.avg == null ? null : Number(r.avg),
            count: Number(r.count || 0),
            qty: Number(r.qty || 0),
          }))
          setChartData(group === 'month' ? fillMonthlyGaps(rows, fy, stat) : rows)
        } else {
          const rows = (data || []).map((r) => ({
            label: r.period,
            value: r.price == null ? null : Number(r.price),
            count: Number(r.count || 0),
            qty: Number(r.qty || 0),
          }))
          setChartData(group === 'month' ? fillMonthlyGaps(rows, fy, stat) : rows)
        }
      } catch (e) {
        if (!active) return
        setChartData([])
        setError(e?.response?.data?.error || 'Could not load price trend')
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [firm?.id, fy?.id, productId, partyId, role, group, stat])

  const insights = useMemo(() => buildInsights(chartData, stat), [chartData, stat])
  const hasPlottedPoints = useMemo(
    () => chartData.some((r) => seriesValue(r, stat) != null),
    [chartData, stat]
  )

  return (
    <AppShell firm={firm} fy={fy} firms={firms} fys={fys} setFirm={setFirm} setFy={setFy} activeKey="analytics-home" setActiveKey={() => {}}>
      <div className="text-white">
        {showIntro && (
          <div className="mb-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-100 flex items-start justify-between">
            <div>
              <strong className="mr-2">Analytics is in beta.</strong>
              The chart now uses cleaner pricing logic (period close and weighted averages) to improve signal quality.
            </div>
            <button
              onClick={() => {
                setShowIntro(false)
                localStorage.setItem('analyticsIntroHidden', '1')
              }}
              className="ml-3 rounded-lg px-2 py-1 border border-yellow-500/40 hover:bg-yellow-500/20"
            >
              Hide
            </button>
          </div>
        )}

        <div className="h-4" />

        <Card title="Price Intelligence">
          <div className="mb-3 grid grid-cols-1 md:grid-cols-7 gap-3">
            <Field label="FY">
              <select
                value={fy?.id ? String(fy.id) : ''}
                onChange={(e) => {
                  const next = (fys || []).find((x) => String(x.id) === String(e.target.value))
                  if (next) setFy(next)
                }}
                className={`w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20 ${glass} bg-black/20`}
              >
                {fys.map((x) => (
                  <option key={x.id} value={String(x.id)}>
                    {x.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Product">
              <ComboBox value={productId} onChange={setProductId} options={products} placeholder="Select product" />
            </Field>

            <Field label="Party (optional)">
              <ComboBox value={partyId} onChange={setPartyId} options={parties} placeholder="All parties" />
            </Field>

            <Field label="Role">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={!partyId}
                className={`w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20 ${glass} bg-black/20 ${!partyId ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <option value="any">Any</option>
                <option value="seller">Seller</option>
                <option value="buyer">Buyer</option>
              </select>
            </Field>

            <Field label="Group by">
              <select value={group} onChange={(e) => setGroup(e.target.value)} className={`w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20 ${glass} bg-black/20`}>
                <option value="day">Day</option>
                <option value="month">Month</option>
              </select>
            </Field>

            <Field label="Series">
              <select value={stat} onChange={(e) => setStat(e.target.value)} className={`w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20 ${glass} bg-black/20`}>
                <option value="last">Close Price</option>
                <option value="avg">Weighted Avg Price</option>
                <option value="band">Range + Weighted Avg</option>
              </select>
            </Field>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setProductId(null)
                  setPartyId(null)
                  setRole('any')
                  setGroup('day')
                  setStat('last')
                  setError('')
                }}
                className={`rounded-lg px-3 py-2 text-sm ${glass} bg-white/10 hover:bg-white/20 border border-white/10`}
              >
                Reset
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-white/60">Loading chart...</div>
          ) : error ? (
            <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>
          ) : chartData?.length ? (
            <>
              {hasPlottedPoints ? (
                <>
                  <PriceChart
                    data={chartData}
                    height={360}
                    variant={stat === 'band' ? 'band' : 'single'}
                    yLabel={statLabel(stat)}
                  />

                  {insights && (
                    <>
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
                        <InsightCard
                          label="Latest"
                          value={formatINR(insights.latest.value)}
                          hint={`Period: ${shortPeriodLabel(insights.latest.label)}`}
                        />
                        <InsightCard
                          label="Change vs Previous"
                          value={insights.change == null ? 'NA' : `${formatINR(insights.change)} (${insights.changePct == null ? 'NA' : `${insights.changePct.toFixed(2)}%`})`}
                          hint={insights.previous ? `Previous: ${formatINR(insights.previous.value)}` : 'Need at least 2 periods'}
                          toneClass={insightTone(insights.change)}
                        />
                        <InsightCard
                          label="Range"
                          value={`${formatINR(insights.min)} to ${formatINR(insights.max)}`}
                          hint={insights.spanPct == null ? 'NA' : `Span: ${insights.spanPct.toFixed(2)}%`}
                        />
                        <InsightCard
                          label="Volatility"
                          value={insights.cvPct == null ? 'NA' : `${insights.cvPct.toFixed(2)}%`}
                          hint={`Std Dev: ${formatINR(insights.stdDev)}`}
                        />
                        <InsightCard
                          label="Activity"
                          value={`${insights.totalTrades} trades`}
                          hint={`Total qty: ${fmtQty(insights.totalQty)}`}
                        />
                        <InsightCard
                          label="Data Quality"
                          value={`${insights.observedPeriods}/${insights.totalPeriods} periods`}
                          hint={`Coverage: ${insights.coveragePct == null ? 'NA' : `${insights.coveragePct.toFixed(1)}%`} | Confidence: ${insights.confidence}`}
                        />
                      </div>

                      <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80">
                        Signal: <span className={`font-semibold ${insightTone(insights.change)}`}>{insights.trend}</span> trend with mean price {formatINR(insights.mean)} for selected filters.
                        {insights.confidence !== 'High' ? (
                          <span className="ml-2 text-yellow-300/90">Data confidence is {insights.confidence.toLowerCase()} (few observations/trades).</span>
                        ) : null}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/75">
                  No trade prices found for this filter in the selected FY.
                  <div className="mt-2 text-white/55">Try removing party filter, changing role to Any, or switching FY/product.</div>
                </div>
              )}
            </>
          ) : (
            <div className="text-white/60 text-sm">
              {productId ? 'No trade prices found for this filter in the selected FY.' : 'Pick a product to see the price trend.'}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  )
}
