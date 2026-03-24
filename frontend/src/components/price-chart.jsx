import React, { useMemo } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
  Bar,
  ReferenceLine,
  Legend,
} from 'recharts'
import { formatINR } from '../utils/format'

const qtyFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })

function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function formatQty(v) {
  const n = toNum(v)
  return n == null ? '0' : qtyFmt.format(n)
}

function shortPeriodLabel(value) {
  const s = String(value || '')
  if (/^\d{4}-\d{2}$/.test(s)) {
    const [yy, mm] = s.split('-').map(Number)
    const d = new Date(Date.UTC(yy, mm - 1, 1))
    return d.toLocaleString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' })
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [yy, mm, dd] = s.split('-').map(Number)
    const d = new Date(Date.UTC(yy, mm - 1, dd))
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' })
  }
  return s
}

function longPeriodLabel(value) {
  const s = String(value || '')
  if (/^\d{4}-\d{2}$/.test(s)) {
    const [yy, mm] = s.split('-').map(Number)
    const d = new Date(Date.UTC(yy, mm - 1, 1))
    return d.toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [yy, mm, dd] = s.split('-').map(Number)
    const d = new Date(Date.UTC(yy, mm - 1, dd))
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
  }
  return s
}

function calcDomain(values) {
  const valid = values.filter((v) => Number.isFinite(v))
  if (!valid.length) return [0, 1]

  const min = Math.min(...valid)
  const max = Math.max(...valid)
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.06)
    return [Math.max(0, min - pad), max + pad]
  }

  const pad = (max - min) * 0.12
  return [Math.max(0, min - pad), max + pad]
}

function mean(values) {
  const valid = values.filter((v) => Number.isFinite(v))
  if (!valid.length) return null
  return valid.reduce((s, v) => s + v, 0) / valid.length
}

export default function PriceChart({ data = [], height = 320, yLabel = 'Price', variant = 'auto' }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-white/60">No data</div>
  }

  const hasBand = data.some((d) => typeof d.min === 'number' || typeof d.max === 'number' || typeof d.avg === 'number')
  const mode = variant === 'auto' ? (hasBand ? 'band' : 'single') : variant

  const chartRows = useMemo(() => {
    if (mode !== 'band') return data
    return data.map((r) => {
      const min = toNum(r.min)
      const max = toNum(r.max)
      const gap = min != null && max != null ? Math.max(0, max - min) : null
      return { ...r, min, max, gap }
    })
  }, [data, mode])

  const priceValues = mode === 'band'
    ? chartRows.flatMap((r) => [toNum(r.min), toNum(r.max), toNum(r.avg)]).filter((v) => v != null)
    : chartRows.map((r) => toNum(r.value)).filter((v) => v != null)

  const [yMin, yMax] = calcDomain(priceValues)
  const avgRef = mean(mode === 'band' ? chartRows.map((r) => toNum(r.avg)).filter((v) => v != null) : priceValues)

  const latestSeriesValue = (() => {
    for (let i = chartRows.length - 1; i >= 0; i -= 1) {
      const v = mode === 'band' ? toNum(chartRows[i]?.avg) : toNum(chartRows[i]?.value)
      if (v != null) return v
    }
    return null
  })()

  const hasTrades = chartRows.some((r) => Number(r?.count || 0) > 0)

  return (
    <div className="rounded-2xl border border-slate-400/20 bg-slate-950/55 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartRows} margin={{ top: 8, right: 18, bottom: 6, left: 8 }}>
          <defs>
            <linearGradient id="priceLineFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="bandRangeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.34} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0.04} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="rgba(148,163,184,0.16)" strokeDasharray="4 4" vertical={false} />

          <XAxis
            dataKey="label"
            stroke="rgba(203,213,225,0.8)"
            axisLine={{ stroke: 'rgba(148,163,184,0.35)' }}
            tickLine={false}
            minTickGap={28}
            tick={{ fill: 'rgba(226,232,240,0.82)', fontSize: 11 }}
            tickFormatter={shortPeriodLabel}
          />

          <YAxis
            yAxisId="price"
            type="number"
            domain={[yMin, yMax]}
            width={94}
            stroke="rgba(203,213,225,0.8)"
            axisLine={{ stroke: 'rgba(148,163,184,0.35)' }}
            tickLine={false}
            tick={{ fill: 'rgba(226,232,240,0.82)', fontSize: 11 }}
            tickFormatter={(v) => formatINR(v)}
          />

          {hasTrades && (
            <YAxis
              yAxisId="trades"
              orientation="right"
              allowDecimals={false}
              width={46}
              stroke="rgba(148,163,184,0.68)"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'rgba(148,163,184,0.9)', fontSize: 10 }}
            />
          )}

          <Tooltip
            cursor={{ stroke: 'rgba(148,163,184,0.45)', strokeDasharray: '4 4' }}
            content={<TrendTooltip mode={mode} yLabel={yLabel} />}
          />

          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ color: 'rgba(226,232,240,0.8)', fontSize: 11 }}
          />

          {hasTrades && (
            <Bar
              yAxisId="trades"
              dataKey="count"
              name="Trades"
              barSize={12}
              fill="rgba(148,163,184,0.22)"
              stroke="rgba(148,163,184,0.28)"
              radius={[3, 3, 0, 0]}
            />
          )}

          {mode === 'single' ? (
            <>
              <Area
                yAxisId="price"
                type="monotone"
                dataKey="value"
                name={yLabel}
                stroke="#38bdf8"
                strokeWidth={1.8}
                fill="url(#priceLineFill)"
                connectNulls
              />
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="value"
                stroke="#7dd3fc"
                strokeWidth={2.2}
                dot={false}
                activeDot={{ r: 4, fill: '#e0f2fe', stroke: '#0c4a6e', strokeWidth: 1 }}
                connectNulls
                legendType="none"
              />
            </>
          ) : (
            <>
              <Area yAxisId="price" type="monotone" dataKey="min" stackId="band" stroke="transparent" fill="transparent" legendType="none" connectNulls />
              <Area yAxisId="price" type="monotone" dataKey="gap" stackId="band" name="Range" stroke="none" fill="url(#bandRangeFill)" connectNulls />
              <Line yAxisId="price" type="monotone" dataKey="min" name="Low" stroke="#86efac" strokeWidth={1.6} dot={false} connectNulls />
              <Line yAxisId="price" type="monotone" dataKey="max" name="High" stroke="#22d3ee" strokeWidth={1.6} dot={false} connectNulls />
              <Line yAxisId="price" type="monotone" dataKey="avg" name="Weighted Avg" stroke="#facc15" strokeWidth={2.2} dot={false} activeDot={{ r: 4 }} connectNulls />
            </>
          )}

          {avgRef != null && (
            <ReferenceLine
              yAxisId="price"
              y={avgRef}
              stroke="rgba(250,204,21,0.45)"
              strokeDasharray="4 4"
              label={{ value: 'Avg', fill: 'rgba(250,204,21,0.9)', fontSize: 10, position: 'insideTopLeft' }}
            />
          )}

          {latestSeriesValue != null && (
            <ReferenceLine
              yAxisId="price"
              y={latestSeriesValue}
              stroke="rgba(125,211,252,0.42)"
              strokeDasharray="2 4"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function TrendTooltip({ active, label, payload, mode, yLabel }) {
  if (!active || !payload || payload.length === 0) return null

  const values = payload.reduce((acc, p) => {
    if (p && p.dataKey != null) acc[p.dataKey] = p.value
    return acc
  }, {})

  const count = Number(values.count || 0)
  const qty = toNum(values.qty)

  return (
    <div style={{ background: '#020617', border: '1px solid rgba(148,163,184,0.45)', borderRadius: 10, color: '#e2e8f0', padding: '9px 11px', minWidth: 190 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{longPeriodLabel(label)}</div>

      {mode === 'band' ? (
        <>
          {toNum(values.min) != null && toNum(values.max) != null && (
            <div style={{ color: '#86efac' }}>Range: {formatINR(values.min)} to {formatINR(values.max)}</div>
          )}
          {toNum(values.avg) != null && (
            <div style={{ color: '#fde047' }}>Weighted Avg: {formatINR(values.avg)}</div>
          )}
        </>
      ) : (
        <>
          {toNum(values.value) != null && (
            <div style={{ color: '#7dd3fc' }}>{yLabel}: {formatINR(values.value)}</div>
          )}
        </>
      )}

      {count > 0 && (
        <div style={{ marginTop: 5, color: '#cbd5e1' }}>Trades: {count}</div>
      )}
      {qty != null && qty > 0 && (
        <div style={{ color: '#cbd5e1' }}>Qty: {formatQty(qty)}</div>
      )}
    </div>
  )
}
