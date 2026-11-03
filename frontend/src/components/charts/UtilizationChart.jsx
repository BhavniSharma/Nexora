import { useState } from "react";

export default function UtilizationChart({ series }) {
  const [hoverT, setHoverT] = useState(null);

  const width = 1000;
  const height = 200;
  const pad = { top: 14, right: 30, bottom: 36, left: 48 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  const all = series.flatMap((s) => s.data);

  if (all.length === 0) {
    return <div className="trend-empty">Waiting for CloudWatch samples…</div>;
  }

  const tMin = Math.min(...all.map((p) => p.t));
  let tMax = Math.max(...all.map((p) => p.t));
  if (tMax === tMin) tMax = tMin + 1;
  const isTime = tMin > 1e11;

  const x = (t) => pad.left + ((t - tMin) / (tMax - tMin)) * cw;
  const y = (v) =>
    pad.top + ((100 - Math.max(0, Math.min(100, v))) / 100) * ch;

  const fmt = (t) =>
    isTime
      ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : `#${Math.round(t) + 1}`;

  const ticks = Array.from({ length: 6 }, (_, i) => tMin + ((tMax - tMin) * i) / 5);

  const nearest = (data, t) =>
    data.reduce(
      (best, p) => (best === null || Math.abs(p.t - t) < Math.abs(best.t - t) ? p : best),
      null
    );

  const onMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const vx = ((event.clientX - rect.left) / rect.width) * width;
    const clamped = Math.max(pad.left, Math.min(pad.left + cw, vx));
    setHoverT(tMin + ((clamped - pad.left) / cw) * (tMax - tMin));
  };

  const base = series.find((s) => s.data.length > 0);
  const anchor = hoverT !== null && base ? nearest(base.data, hoverT) : null;
  const hovered = anchor
    ? series
        .map((s) => ({ ...s, point: nearest(s.data, anchor.t) }))
        .filter((s) => s.point)
    : [];
  const leftPct = anchor ? (x(anchor.t) / width) * 100 : 0;

  return (
    <div className="big-chart-wrap">
      <svg
        className="big-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Resource utilization chart"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverT(null)}
      >
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left}
              y1={y(tick)}
              x2={width - pad.right}
              y2={y(tick)}
              className="trend-grid-line"
            />
            <text
              x={pad.left - 12}
              y={y(tick) + 4}
              textAnchor="end"
              className="trend-axis-label"
            >
              {tick}%
            </text>
          </g>
        ))}

        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={x(t)}
              y1={pad.top}
              x2={x(t)}
              y2={pad.top + ch}
              className="trend-grid-line vertical"
            />
            <text
              x={x(t)}
              y={height - 10}
              textAnchor="middle"
              className="trend-axis-label"
            >
              {fmt(t)}
            </text>
          </g>
        ))}

        {series.map((s) =>
          s.data.length > 0 ? (
            <path
              key={s.key}
              d={s.data
                .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.t)} ${y(p.v)}`)
                .join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth="2.4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null
        )}

        {anchor && (
          <g>
            <line
              x1={x(anchor.t)}
              y1={pad.top}
              x2={x(anchor.t)}
              y2={pad.top + ch}
              stroke="#ffffff"
              strokeOpacity="0.7"
              strokeDasharray="3 4"
            />
            {hovered.map((s) => (
              <g key={s.key}>
                <circle cx={x(s.point.t)} cy={y(s.point.v)} r="8" fill={s.color} fillOpacity="0.25" />
                <circle cx={x(s.point.t)} cy={y(s.point.v)} r="4" fill="#0b0b14" stroke={s.color} strokeWidth="2" />
              </g>
            ))}
          </g>
        )}
      </svg>

      {anchor && (
        <div
          className="chart-tooltip"
          style={
            leftPct > 60
              ? { left: `calc(${leftPct}% - 220px)` }
              : { left: `calc(${leftPct}% + 14px)` }
          }
        >
          <div className="chart-tooltip-time">{fmt(anchor.t)}</div>
          {hovered.map((s) => (
            <div className="chart-tooltip-row" key={s.key}>
              <i style={{ background: s.color }} />
              <span>{s.label}</span>
              <b>{Math.round(s.point.v)}%</b>
            </div>
          ))}
        </div>
      )}

      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
