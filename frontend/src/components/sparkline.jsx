import React, { useMemo, useState, useRef, useEffect } from 'react'

export default function Sparkline({ points=[], labels=[], height=260, stroke='#60a5fa', smooth=true }){
  const [hoverIdx, setHoverIdx] = useState(null)
  const wrapRef = useRef(null)
  const [width, setWidth] = useState(800)
  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width
      if (w) setWidth(w)
    })
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])
  if (!points.length) return <div ref={wrapRef} style={{height}} />
  const xs = points.map((_,i)=>i)
  const min = Math.min(...points), max = Math.max(...points)
  const padL = 40, padB = 20, padT=10, padR=10
  const W = width - padL - padR, H = height - padT - padB
  const normY = v => max===min ? (H/2) : (H - ( (v-min)/(max-min) )*H)
  const xAt = i => padL + (i/(xs.length-1||1))*W
  const yAt = v => padT + normY(v)
  // Build path (optionally smoothed Catmull-Rom)
  const path = useMemo(() => {
    const n = xs.length
    if (!smooth || n < 3) {
      return xs.map((i,idx)=> `${idx?'L':'M'}${xAt(i).toFixed(1)},${yAt(points[i]).toFixed(1)}`).join(' ')
    }
    const t = 0.5 // tension
    const pts = xs.map(i => ({ x: xAt(i), y: yAt(points[i]) }))
    let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
    for (let i=0;i<n-1;i++){
      const p0 = pts[i-1] || pts[i]
      const p1 = pts[i]
      const p2 = pts[i+1]
      const p3 = pts[i+2] || p2
      const c1x = p1.x + (p2.x - p0.x) * t / 6
      const c1y = p1.y + (p2.y - p0.y) * t / 6
      const c2x = p2.x - (p3.x - p1.x) * t / 6
      const c2y = p2.y - (p3.y - p1.y) * t / 6
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
    }
    return d
  }, [points, labels, width, height, smooth])

  // ticks: y 4 ticks
  const yTicks = 4
  const tickVals = Array.from({length:yTicks+1}, (_,i)=> min + (i*(max-min)/yTicks))
  const fmt = n => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })

  function onMove(e){
    const bbox = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - bbox.left
    const ratio = Math.max(0, Math.min(1, (x - padL)/W))
    const idx = Math.round(ratio * (xs.length-1))
    setHoverIdx(idx)
  }

  return (
    <div ref={wrapRef} className="w-full">
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" onMouseMove={onMove} onMouseLeave={()=>setHoverIdx(null)}>
      {/* axes */}
      <line x1={padL} y1={padT} x2={padL} y2={padT+H} stroke="#9ca3af" strokeWidth="1"/>
      <line x1={padL} y1={padT+H} x2={padL+W} y2={padT+H} stroke="#9ca3af" strokeWidth="1"/>
      {/* y ticks */}
      {tickVals.map((v,i)=> (
        <g key={i}>
          <line x1={padL-4} y1={yAt(v)} x2={padL} y2={yAt(v)} stroke="#9ca3af" />
          <text x={padL-6} y={yAt(v)+4} textAnchor="end" fontSize="10" fill="#9ca3af">{fmt(v)}</text>
        </g>
      ))}
      {/* x labels (sparse) + grid lines */}
      {labels.length>0 && labels.map((l,i)=> {
        const step = Math.max(1, Math.ceil(labels.length/6))
        if (i % step !== 0) return null
        return (
          <g key={i}>
            <line x1={xAt(i)} y1={padT} x2={xAt(i)} y2={padT+H} stroke="#374151" />
            <text x={xAt(i)} y={padT+H+14} textAnchor="middle" fontSize="10" fill="#9ca3af">{l}</text>
          </g>
        )
      })}
      {/* series */}
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" />
      {/* area fill */}
      <path d={`${path} L${padL+W},${padT+H} L${padL},${padT+H} Z`} fill="url(#g)" opacity="0.6" />

      {/* hover marker */}
      {hoverIdx!=null && (
        <g>
          <line x1={xAt(hoverIdx)} y1={padT} x2={xAt(hoverIdx)} y2={padT+H} stroke="#94a3b8" strokeDasharray="3 3" />
          <circle cx={xAt(hoverIdx)} cy={yAt(points[hoverIdx])} r="3.5" fill={stroke} />
          {/* tooltip */}
          <rect x={xAt(hoverIdx)+8} y={yAt(points[hoverIdx])-30} width="150" height="28" rx="6" fill="#0b1220" stroke="#334155" />
          <text x={xAt(hoverIdx)+14} y={yAt(points[hoverIdx]) - 12} fontSize="11" fill="#e5e7eb">
            {labels[hoverIdx] || ''}
          </text>
          <text x={xAt(hoverIdx)+14} y={yAt(points[hoverIdx]) - 2} fontSize="11" fill="#93c5fd">₹ {fmt(points[hoverIdx])}</text>
        </g>
      )}
      {/* points */}
      {xs.map(i => (
        <circle key={i} cx={xAt(i)} cy={yAt(points[i])} r="2" fill="#93c5fd" opacity="0.9" />
      ))}
    </svg>
    </div>
  )
}
