"use client";
import { useState, useEffect } from "react";
import { C } from "@/lib/utils";
import { SectionTitle } from "./Dashboard";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const fmtMoney = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M`
  : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K`
  : `$${n}`;

const fmtFull = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 0 })}`;

function KPI({ label, val, prev }: { label: string; val: number; prev: number }) {
  const pct  = prev ? ((val - prev) / prev) * 100 : 0;
  const up   = pct > 0;
  const flat = Math.abs(pct) < 0.5;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  const color = flat ? C.muted : up ? C.green : C.red;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 6 }}>{fmtMoney(val)}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color }}>
        <Icon size={12} />
        <span style={{ fontWeight: 700 }}>{flat ? "Flat" : `${up ? "+" : ""}${pct.toFixed(1)}%`}</span>
        <span style={{ color: C.muted }}>vs prev month</span>
      </div>
    </div>
  );
}

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

export default function Analytics() {
  const [monthly,         setMonthly]         = useState<any[]>([]);
  const [topCustomers,    setTopCustomers]    = useState<any[]>([]);
  const [topSKUs,         setTopSKUs]         = useState<any[]>([]);
  const [orderStatusDist, setOrderStatusDist] = useState<any[]>([]);
  const [kpi,             setKpi]             = useState<any>(null);
  const [loading,         setLoading]         = useState(true);

  useEffect(() => {
    const wsId =
      typeof window !== "undefined" ? localStorage.getItem("workspaceDbId") : null;
    if (!wsId) { setLoading(false); return; }

    fetch(`/api/analytics?workspaceId=${wsId}`)
      .then(r => r.json())
      .then(data => {
        setMonthly(data.monthly        || []);
        setTopCustomers(data.topCustomers || []);
        setTopSKUs(data.topSKUs         || []);
        setOrderStatusDist(data.orderStatusDist || []);
        setKpi(data.kpi || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: C.muted, fontSize: 14 }}>
        Loading analytics…
      </div>
    );
  }

  const cur  = kpi?.cur  || { revenue: 0, invoiced: 0, orders: 0 };
  const prev = kpi?.prev || { revenue: 0, invoiced: 0, orders: 0 };
  const avgOrder      = cur.orders  > 0 ? Math.round(cur.revenue  / cur.orders)  : 0;
  const avgOrderPrev  = prev.orders > 0 ? Math.round(prev.revenue / prev.orders) : 0;

  const customerColors = [C.blue, C.purple, C.green, C.amber, C.muted];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        <KPI label="Revenue (this month)"  val={cur.revenue}  prev={prev.revenue}  />
        <KPI label="Invoiced (this month)" val={cur.invoiced} prev={prev.invoiced} />
        <KPI label="Orders (this month)"   val={cur.orders}   prev={prev.orders}   />
        <KPI label="Avg Order Value"       val={avgOrder}     prev={avgOrderPrev}  />
      </div>

      {/* Revenue chart */}
      {monthly.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 20px 10px" }}>
          <SectionTitle>Monthly Revenue (last 7 months)</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
      )}

      {/* Bottom row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 280px", gap: 14 }}>

        {/* Top customers */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px" }}>
          <SectionTitle>Top Customers by Revenue</SectionTitle>
          {topCustomers.length === 0 ? (
            <div style={{ color: C.muted, fontSize: 13 }}>No customer data yet.</div>
          ) : topCustomers.map((c, i) => (
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
                  <div style={{ height: "100%", width: `${c.share}%`, background: customerColors[i] || C.muted, borderRadius: 999 }} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{c.share}%</div>
            </div>
          ))}
        </div>

        {/* Top SKUs */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px" }}>
          <SectionTitle>Top SKUs by Revenue</SectionTitle>
          {topSKUs.length === 0 ? (
            <div style={{ color: C.muted, fontSize: 13 }}>No SKU data yet.</div>
          ) : topSKUs.map((s, i) => (
            <div key={s.sku} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: i < topSKUs.length - 1 ? `1px solid ${C.border}` : "none" }}>
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
          {orderStatusDist.length === 0 ? (
            <div style={{ color: C.muted, fontSize: 13 }}>No orders yet.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={orderStatusDist} cx="50%" cy="50%" innerRadius={44} outerRadius={68} paddingAngle={3} dataKey="value">
                    {orderStatusDist.map((e: any, i: number) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => [`${v} orders`, ""]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", marginTop: 8 }}>
                {orderStatusDist.map((d: any) => (
                  <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
                    <span style={{ color: C.muted }}>{d.name}</span>
                    <span style={{ fontWeight: 700, color: C.text }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
