"use client";
import { useState, useRef } from "react";
import { Zap, Bell } from "lucide-react";
import Dashboard    from "@/components/Dashboard";
import Pipeline     from "@/components/Pipeline";
import OrderKanban  from "@/components/OrderKanban";
import InventorySync from "@/components/InventorySync";
import CRMPanel     from "@/components/CRMPanel";
import SystemHealth from "@/components/SystemHealth";
import { C, TABS, STAGES } from "@/lib/utils";

export default function App() {
  const [tab, setTab] = useState("dashboard");

  // ── METRICS ─────────────────────────────────────────────
  // All zeros — real numbers will come from your database later
  const [met, setMet] = useState({
    opm:          0,
    skus:         0,
    sync:         0,
    activeOrders: 0,
    rev:          0,
    latency:      0,
    queue:        0,
    conflicts:    0,
  });

  // ── CHART ───────────────────────────────────────────────
  // Empty — no data until real orders come in
  const [chart, setChart] = useState<any[]>([]);

  // ── ORDERS ──────────────────────────────────────────────
  // Empty — no orders until CRM is connected
  const [orders, setOrders] = useState<any[]>([]);

  // ── PIPELINE ────────────────────────────────────────────
  // null = not started yet
  const [pipe, setPipe] = useState<any>(null);

  // ── INVENTORY CONFLICTS ─────────────────────────────────
  // Empty — no conflicts until inventory is syncing
  const [conflicts, setConflicts] = useState<any[]>([]);

  // ── CRM STATUS ──────────────────────────────────────────
  // All disconnected — user needs to connect their own CRM
  const [crm, setCrm] = useState({
    salesforce: "disconnected",
    hubspot:    "disconnected",
    zoho:       "disconnected",
  });

  // ── SYSTEM HEALTH ───────────────────────────────────────
  // Unknown until the backend services are configured
  const [health, setHealth] = useState([
    { name: "PostgreSQL",     status: "unknown", lat: 0, up: 0 },
    { name: "Redis Cache",    status: "unknown", lat: 0, up: 0 },
    { name: "BullMQ Workers", status: "unknown", lat: 0, up: 0 },
    { name: "CRM Webhook",    status: "unknown", lat: 0, up: 0 },
    { name: "Search Index",   status: "unknown", lat: 0, up: 0 },
    { name: "File Storage",   status: "unknown", lat: 0, up: 0 },
  ]);

  // ── ALERTS ──────────────────────────────────────────────
  // Empty — no alerts until the system is running
  const alerts: any[] = [];

  // ── ORDER ACTIONS ────────────────────────────────────────
  const advanceOrder = (id: string) =>
    setOrders(os => os.map(o => {
      if (o.id !== id) return o;
      const i = STAGES.indexOf(o.stage);
      return i < 4 ? { ...o, stage: STAGES[i + 1] } : o;
    }));

  const resolveConflict = (id: number) =>
    setConflicts(cs => cs.map(c => c.id === id ? { ...c, status: "resolved" } : c));

  return (
    <div style={{ fontFamily: "'Inter',system-ui,sans-serif", minHeight: "100vh", background: C.bg, color: C.text }}>

      {/* ── HEADER ── */}
      <div style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: "10px 24px", display: "flex", alignItems: "center",
        justifyContent: "space-between", position: "sticky", top: 0,
        zIndex: 50, boxShadow: "0 1px 6px rgba(0,0,0,0.04)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36,
            background: "linear-gradient(135deg,#5b8de8,#9c6fdd)",
            borderRadius: 10, display: "flex", alignItems: "center",
            justifyContent: "center", boxShadow: "0 2px 8px rgba(91,141,232,0.3)"
          }}>
            <Zap size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.text, letterSpacing: "-0.4px" }}>
              IndustrialOS
            </div>
            <div style={{ fontSize: 11, color: C.subtle }}>
              Enterprise B2B Automation Platform
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Setup reminder badge — shown when nothing is connected yet */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: C.amberBg, border: `1px solid ${C.amberBorder}`,
            borderRadius: 999, padding: "4px 12px"
          }}>
            <span style={{ width: 7, height: 7, background: C.amber, borderRadius: "50%" }} />
            <span style={{ fontSize: 11, color: C.amber, fontWeight: 700 }}>SETUP REQUIRED</span>
          </div>

          {/* Bell — no alerts yet */}
          <div style={{ position: "relative", cursor: "pointer" }}>
            <Bell size={17} color={C.muted} />
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: "0 24px", display: "flex", gap: 2, overflowX: "auto"
      }}>
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "12px 14px", fontSize: 12, fontWeight: 600,
                border: "none",
                borderBottom: active ? `2px solid ${C.blue}` : "2px solid transparent",
                color: active ? C.blue : C.muted,
                background: "none", cursor: "pointer",
                whiteSpace: "nowrap", transition: "color .15s", marginBottom: -1
              }}
            >
              <Icon size={13} />{t.label}
            </button>
          );
        })}
      </div>

      {/* ── CONTENT ── */}
      <div style={{ padding: "24px", maxWidth: 1200, margin: "0 auto" }}>
        {tab === "dashboard" && <Dashboard    met={met} chart={chart} alerts={alerts} />}
        {tab === "pipeline"  && <Pipeline     pipe={pipe} setPipe={setPipe} />}
        {tab === "orders"    && <OrderKanban  orders={orders} advanceOrder={advanceOrder} />}
        {tab === "inventory" && <InventorySync conflicts={conflicts} resolveConflict={resolveConflict} />}
        {tab === "crm"       && <CRMPanel     crm={crm} setCrm={setCrm} />}
        {tab === "health"    && <SystemHealth health={health} met={met} alerts={alerts} />}
      </div>
    </div>
  );
}
