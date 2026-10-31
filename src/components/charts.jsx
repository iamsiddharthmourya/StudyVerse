// Chart building blocks (Recharts). Colours come from utils/constants.js and CSS variables so
// charts follow light/dark mode. Every chart card can also be viewed as a plain table.
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Table2, BarChart3 } from 'lucide-react';
import { COLORS } from '../utils/constants.js';
import { ProgressBar } from './ui.jsx';

const tooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 10,
  color: 'var(--text)',
  fontSize: 12.5,
  boxShadow: 'var(--shadow)',
};

/** Card wrapper with a "table view" toggle (so charts never rely on colour or sight alone). */
export function ChartCard({ title, subtitle, table, children, className = '' }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={`card ${className}`}>
      <header className="card-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="muted small">{subtitle}</p>}
        </div>
        {table && (
          <button className="btn ghost sm" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
            {asTable ? <BarChart3 size={14} aria-hidden="true" /> : <Table2 size={14} aria-hidden="true" />}
            {asTable ? 'Chart' : 'Table'}
          </button>
        )}
      </header>
      {asTable && table ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {table.cols.map((c) => (
                  <th key={c.key} scope="col">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {table.cols.map((c) => (
                    <td key={c.key}>{r[c.key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

/** Completed vs due per day (Mon-Sun). */
export function ActivityChart({ data, height = 230 }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(124,92,255,0.08)' }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="completed" name="Completed" fill={COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="due" name="Due" fill={COLORS.slate} radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendLine({ data, xKey = 'label', yKey, name, color = COLORS.primary, height = 220, unit = '', domain }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} domain={domain} unit={unit} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}${unit}`, name]} />
          <Line type="monotone" dataKey={yKey} name={name} stroke={color} strokeWidth={2} dot={{ r: 3, strokeWidth: 2, fill: 'var(--surface)' }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut with an HTML legend (name, count, share). `data` = [{ name, value, color }]. */
export function Donut({ data, centerLabel, centerValue, height = 180 }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (!total) return <p className="muted center-text">No data yet.</p>;
  return (
    <div className="donut">
      <div className="donut-chart" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="var(--surface)" strokeWidth={2}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        {centerValue !== undefined && (
          <div className="donut-center" aria-hidden="true">
            <strong>{centerValue}</strong>
            <span>{centerLabel}</span>
          </div>
        )}
      </div>
      <ul className="legend">
        {data.map((d) => (
          <li key={d.name}>
            <span className="swatch" style={{ background: d.color }} aria-hidden="true" />
            <span className="legend-name">{d.name}</span>
            <span className="legend-val">
              {d.value} <span className="muted">({Math.round((d.value / total) * 100)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Rows of "name  done/total  [bar]  pct". `rows` come from groupStats(). */
export function CompletionRows({ rows, colorFor, emptyText = 'No tasks yet.' }) {
  if (!rows.length) return <p className="muted center-text">{emptyText}</p>;
  return (
    <ul className="comp-rows">
      {rows.map((r) => (
        <li key={r.name}>
          <div className="comp-top">
            <span className="comp-name">{r.name}</span>
            <span className="comp-num">
              {r.completed}/{r.total} · {r.pct}%
            </span>
          </div>
          <ProgressBar value={r.pct} color={colorFor ? colorFor(r.name) : COLORS.primary} label={`${r.name} completion`} />
        </li>
      ))}
    </ul>
  );
}
