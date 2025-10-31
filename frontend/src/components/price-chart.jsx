import React from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
  ReferenceLine,
} from 'recharts'
import { formatINR } from '../utils/format'

export default function PriceChart({ data = [], height = 280, yLabel = 'Price' }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="rounded-xl border border-white/10 bg-black/10 p-4 text-white/60">No data</div>
  }

  const hasNumbers = data.some(d => typeof d.value === 'number')
  const yFormatter = (v) => hasNumbers ? formatINR(v) : v

  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-2">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} minTickGap={24} />
          <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={yFormatter} width={80} />
          <Tooltip content={<SingleTooltip yLabel={yLabel} />} />
          <Area type="monotone" dataKey="value" stroke="#60a5fa" fill="url(#priceFill)" />
          <Line type="monotone" dataKey="value" stroke="#60a5fa" dot={{ r: 2 }} strokeWidth={2} />
          <ReferenceLine y={0} stroke="#6b7280" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function SingleTooltip({ active, label, payload, yLabel }) {
  if (!active || !payload || payload.length === 0) return null
  // Use the first series value only to avoid duplicates from Area + Line
  const v = payload[0].value
  return (
    <div style={{ background: '#0b1220', border: '1px solid #334155', borderRadius: 8, color: '#e5e7eb', padding: '8px 10px' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#93c5fd' }}>{yLabel} : {formatINR(v)}</div>
    </div>
  )
}
