"use client";
// components/Analytics.tsx
// Revenue analytics — monthly revenue, top customers, top SKUs, order volume trends.
// Uses recharts (already installed).

import { C } from "@/lib/utils";
import { SectionTitle } from "./Dashboard";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

// ── Demo data ─────────────────────────────────────────────────────────────────
const MONTHLY = [
  { month: "Sep",  revenue: 68400,  orders: 24, invoiced: 62100 },
  { month: "Oct",  revenue: 74200,  orders: 28, invoiced: 70800 },
  { month: "Nov",  revenue: 91500,  orders: 34, invoiced: 87300 },
  { month: "Dec",  revenue: 88100,  orders: 31, invoiced: 84600 },
  { month: "Jan",  revenue: 72400,  orders: 26, invoiced: 68900 },
  { month: "Feb",  revenue: 95800,  orders: 38, invoiced: 91200 },
  { month: "Mar",  revenue: 103600, orders: 41, invoiced: 98400 },
];

const TOP_CUSTOMERS = [
  { name: "TechWave Ltd",   revenue: 287400, orders: 12, share: 34 },
  { name: "Acme Corp",      revenue: 154300, orders: 9,  share: 18 },
  { name: "Midland Steel",  revenue: 98500,  orders: 7,  share: 12 },
  { name: "Apex Industrial",revenue: 62100,  orders: 5,  share: 7  },
  { name: "Others",         revenue: 239100, orders: 28, share: 29 },
];

const TOP_SKUS = [
  { sku: "SKU-2210", desc: "Precision bearings",   revenue: 184200, units: 3280 },
  { sku: "SKU-4821", desc: "Industrial bolts M10", revenue: 142600, units: 2940 },
  { sku: "SKU-7753", desc: "Hex bolts grade 8",    revenue: 118400, units: 3720 },
  { sku: "SKU-9034", desc: "Lock washers",         revenue:  76800, units: 18300 },
  { sku: "SKU-3318", desc: "Stainless clamps",     revenue:  61200, units: 1060 },
];

const ORDER_STATUS_DIST = [
  { name: "Delivered", value: 38, color: C.green  },
  { name: "Shipped",   value: 14, color: C.blue   },
  { name: "Confirmed", value:  9, color: C.purple },
  { name: "Placed",    value:  6, color: C.amber  },
];

const fmtMoney = (n: number) => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(1)}K` : `$${n}`;
const fmtFull  = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 0 })}`;

// ── KPI card ──────────────────────────────────────────────────────────────────
function KPI({ label, val, prev, unit = "" }: { label: string; val: number; prev: number; unit?: string }) {
  const pct  = prev ? ((val - prev) / prev) * 100 : 0;
  const up   = pct > 0;
  const flat = Math.abs(pct) < 0.5;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  const color = flat ? C.muted : up ? C.green : C.red;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 6 }}>{unit}{fmtMoney(val)}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color }}>
        <Icon size={12} />
        <span style={{ fontWeight: 700 }}>{flat ? "Flat" : `${up ? "+" : ""}${pct.toFixed(1)}%`}</span>
        <span style={{ color: C.muted }}>vs prev month</span>
      </div>
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
const MoneyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
      <div style={{ fontWeight: 700, color: C.text, marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{fmtFull(p.value)}</strong>
        </div>
      ))}
    </div>
  );
};

// ── Main export ───────────────────────────────────────────────────────────────
export default function Analytics() {
  const cur  = MONTHLY[MONTHLY.length - 1];
  const prev = MONTHLY[MONTHLY.length - 2];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        <KPI label="Revenue (Mar)"     val={cur.revenue}  prev={prev.revenue}  />
        <KPI label="Invoiced (Mar)"    val={cur.invoiced} prev={prev.invoiced} />
        <KPI label="Orders (Mar)"      val={cur.orders}   prev={prev.orders}   />
        <KPI label="Avg Order Value"   val={Math.round(cur.revenue / cur.orders)} prev={Math.round(prev.revenue / prev.orders)} />
      </div>

      {/* Revenue + orders area chart */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 20px 10px" }}>
        <SectionTitle>Monthly Revenue & Orders (last 7 months)</SectionTitle>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={MONTHLY} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={C.blue}   stopOpacity={0.18} />
                <stop offset="95%" stopColor={C.blue}   stopOpacity={0}    />
              </linearGradient>
              <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={C.purple} stopOpacity={0.18} />
                <stop offset="95%" stopColor={C.purple} stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => fmtMoney(v)} tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} width={60} />
            <Tooltip content={<MoneyTooltip />} />
            <Area type="monotone" dataKey="revenue"  name="Revenue"  stroke={C.blue}   strokeWidth={2} fill="url(#revGrad)" />
            <Area type="monotone" dataKey="invoiced" name="Invoiced" stroke={C.purple} strokeWidth={2} fill="url(#invGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom row: top customers + SKUs + order pie */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 280px", gap: 14 }}>

        {/* Top customers */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px" }}>
          <SectionTitle>Top Customers by Revenue</SectionTitle>
          {TOP_CUSTOMERS.map((c, i) => (
            <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 22, height: 22, background: C.blueBg, border: `1px solid ${C.blueBorder}`, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: C.blue, flexShrink: 0 }}>
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.text, flexShrink: 0, marginLeft: 8 }}>{fmtMoney(c.revenue)}</span>
                </div>
                <div style={{ height: 4, background: C.bg, borderRadius: 999, overflow: "hidden", border: `1px solid ${C.border}` }}>
                  <div style={{ height: "100%", width: `${c.share}%`, background: i === 0 ? C.blue : i === 1 ? C.purple : i === 2 ? C.green : C.amber, borderRadius: 999 }} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{c.share}%</div>
            </div>
          ))}
        </div>

        {/* Top SKUs */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px" }}>
          <SectionTitle>Top SKUs by Revenue</SectionTitle>
          {TOP_SKUS.map((s, i) => (
            <div key={s.sku} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: i < TOP_SKUS.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{s.sku}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{s.desc}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmtMoney(s.revenue)}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{s.units.toLocaleString()} units</div>
              </div>
            </div>
          ))}
        </div>

        {/* Order status pie */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px" }}>
          <SectionTitle>Order Status Mix</SectionTitle>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={ORDER_STATUS_DIST} cx="50%" cy="50%" innerRadius={44} outerRadius={68} paddingAngle={3} dataKey="value">
                {ORDER_STATUS_DIST.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip formatter={(v: any) => [`${v} orders`, ""]} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", marginTop: 8 }}>
            {ORDER_STATUS_DIST.map(d => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
                <span style={{ color: C.muted }}>{d.name}</span>
                <span style={{ fontWeight: 700, color: C.text }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
