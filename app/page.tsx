"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Zap, Bell, Plus, Settings as SettingsIcon, X } from "lucide-react";
import {
  LayoutDashboard, ShoppingCart, Package, FileText,
  Receipt, Truck, Users, Factory, BarChart2,
  GitMerge, Upload, Heart, Link as LinkIcon,
} from "lucide-react";

import Dashboard     from "@/components/Dashboard";
import Pipeline      from "@/components/Pipeline";
import OrderKanban   from "@/components/OrderKanban";
import InventorySync from "@/components/InventorySync";
import CRMPanel      from "@/components/CRMPanel";
import SystemHealth  from "@/components/SystemHealth";
import Quotes        from "@/components/Quotes";
import Invoicing     from "@/components/Invoicing";
import Customers     from "@/components/Customers";
import Analytics     from "@/components/Analytics";
import Settings      from "@/components/Settings";
import Suppliers     from "@/components/Suppliers";
import Shipping      from "@/components/Shipping";

import { C } from "@/lib/utils";
import { loadWorkspace, saveWorkspace, WorkspaceConfig, ModuleId, CustomTab } from "@/lib/workspace";

// ── Module tab definitions ────────────────────────────────────────────────────
const MODULE_TABS: Record<ModuleId, { label: string; icon: any }> = {
  dashboard: { label: "Dashboard",     icon: LayoutDashboard },
  orders:    { label: "Orders",        icon: ShoppingCart    },
  inventory: { label: "Inventory",     icon: Package         },
  quotes:    { label: "Quotes & RFQ",  icon: FileText        },
  invoicing: { label: "Invoicing",     icon: Receipt         },
  shipping:  { label: "Shipping",      icon: Truck           },
  customers: { label: "Customers",     icon: Users           },
  suppliers: { label: "Suppliers",     icon: Factory         },
  analytics: { label: "Analytics",     icon: BarChart2       },
  crm:       { label: "CRM",           icon: GitMerge        },
  pipeline:  { label: "SKU Pipeline",  icon: Upload          },
  health:    { label: "System Health", icon: Heart           },
};

// ── Coming soon placeholder ───────────────────────────────────────────────────
function ComingSoon({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 8 }}>{label} — Coming Soon</h2>
      <p style={{ color: C.muted, fontSize: 14, maxWidth: 360, lineHeight: 1.6 }}>
        This module is being built and will be available in the next update.
      </p>
    </div>
  );
}

// ── Custom tab content ────────────────────────────────────────────────────────
function CustomTabContent({ tab }: { tab: CustomTab }) {
  if (tab.type === "link" && tab.url) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, display: "flex", alignItems: "center", gap: 14 }}>
          <LinkIcon size={20} color={C.blue} />
          <div>
            <div style={{ fontWeight: 700, color: C.text }}>{tab.label}</div>
            <a href={tab.url} target="_blank" rel="noreferrer" style={{ color: C.blue, fontSize: 13 }}>{tab.url}</a>
          </div>
        </div>
      </div>
    );
  }
  return <ComingSoon label={tab.label} />;
}

// ── Add Tab modal ─────────────────────────────────────────────────────────────
function AddTabModal({ onAdd, onClose }: {
  onAdd: (label: string, emoji: string, type: CustomTab["type"], url?: string) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [emoji, setEmoji] = useState("📌");
  const [type,  setType]  = useState<CustomTab["type"]>("list");
  const [url,   setUrl]   = useState("");

  const TAB_TYPES: { id: CustomTab["type"]; label: string; icon: string }[] = [
    { id: "list",   label: "List",   icon: "📝" },
    { id: "kanban", label: "Kanban", icon: "📌" },
    { id: "notes",  label: "Notes",  icon: "📓" },
    { id: "link",   label: "Link",   icon: "🔗" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, width: "100%", maxWidth: 420, boxShadow: "0 24px 80px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: C.text }}>Add Custom Tab</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }}><X size={18} /></button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Icon + Tab Name</label>
          <div style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: 8 }}>
            <input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={2}
              style={{ padding: 9, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 18, textAlign: "center", outline: "none" }} />
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Returns Log"
              style={{ padding: "9px 11px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, outline: "none" }} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Tab Type</label>
          <div style={{ display: "flex", gap: 6 }}>
            {TAB_TYPES.map(t => (
              <button key={t.id} onClick={() => setType(t.id)} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, background: type === t.id ? C.blue : C.bg, color: type === t.id ? "#fff" : C.muted }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {type === "link" && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>URL</label>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://your-tool.com"
              style={{ width: "100%", padding: "9px 11px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: "9px 18px", background: "none", border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button
            onClick={() => { if (label.trim()) { onAdd(label.trim(), emoji, type, type === "link" ? url : undefined); onClose(); } }}
            disabled={!label.trim()}
            style={{ padding: "9px 20px", background: label.trim() ? C.blue : C.border, border: "none", borderRadius: 8, color: label.trim() ? "#fff" : C.muted, fontSize: 13, fontWeight: 700, cursor: label.trim() ? "pointer" : "not-allowed" }}>
            Add Tab
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main app ──────────────────────────────────────────────────────────────────
export default function App() {
  const router = useRouter();
  const [workspace,  setWorkspace]  = useState<WorkspaceConfig | null>(null);
  const [tab,        setTab]        = useState("dashboard");
  const [loading,    setLoading]    = useState(true);
  const [showAddTab, setShowAddTab] = useState(false);

  useEffect(() => {
    const ws = loadWorkspace();
    if (!ws || !ws.onboardingDone) { router.push("/onboarding"); return; }
    setWorkspace(ws);
    setLoading(false);
  }, []);

  // ── State only for components that still need it passed in ─────────────────
  const [met] = useState({
    opm: 0, skus: 0, sync: 0, activeOrders: 0,
    rev: 0, latency: 0, queue: 0, conflicts: 0,
  });
  const [chart] = useState<any[]>([]);
  const [pipe,  setPipe] = useState<any>(null);
  const [crm,   setCrm]  = useState({
    salesforce: "disconnected",
    hubspot:    "disconnected",
    zoho:       "disconnected",
  });
  const [health] = useState([
    { name: "PostgreSQL",     status: "unknown", lat: 0, up: 0 },
    { name: "Redis Cache",    status: "unknown", lat: 0, up: 0 },
    { name: "BullMQ Workers", status: "unknown", lat: 0, up: 0 },
    { name: "CRM Webhook",    status: "unknown", lat: 0, up: 0 },
    { name: "Search Index",   status: "unknown", lat: 0, up: 0 },
    { name: "File Storage",   status: "unknown", lat: 0, up: 0 },
  ]);
  const alerts: any[] = [];

  // ── Add custom tab ─────────────────────────────────────────────────────────
  const addCustomTab = (label: string, icon: string, type: CustomTab["type"], url?: string) => {
    if (!workspace) return;
    const newTab: CustomTab = {
      id:    Math.random().toString(36).slice(2, 9),
      label, icon, type, url,
    };
    const updated = { ...workspace, customTabs: [...workspace.customTabs, newTab] };
    saveWorkspace(updated);
    setWorkspace(updated);
    setTab(newTab.id);
  };

  if (loading || !workspace) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
          <div style={{ color: C.muted, fontSize: 14 }}>Loading your workspace…</div>
        </div>
      </div>
    );
  }

  // ── Build tab list ─────────────────────────────────────────────────────────
  const moduleTabs = workspace.modules.map(id => ({
    id,
    label:  MODULE_TABS[id]?.label || id,
    icon:   MODULE_TABS[id]?.icon  || null,
    emoji:  undefined as string | undefined,
    custom: false,
  }));

  const customTabList = workspace.customTabs.map(ct => ({
    id:     ct.id,
    label:  ct.label,
    icon:   null as any,
    emoji:  ct.icon,
    custom: true,
  }));

  const allTabs = [...moduleTabs, ...customTabList];

  // ── Render active tab content ──────────────────────────────────────────────
  const renderContent = () => {
    if (tab === "settings") {
      return <Settings workspace={workspace} onUpdate={ws => { saveWorkspace(ws); setWorkspace(ws); }} />;
    }
    switch (tab) {
      case "dashboard": return <Dashboard    met={met}   chart={chart} alerts={alerts} />;
      case "pipeline":  return <Pipeline     pipe={pipe} setPipe={setPipe} />;
      case "orders":    return <OrderKanban />;
      case "inventory": return <InventorySync />;
      case "crm":       return <CRMPanel     crm={crm}   setCrm={setCrm} />;
      case "health":    return <SystemHealth health={health} met={met} alerts={alerts} />;
      case "quotes":    return <Quotes />;
      case "invoicing": return <Invoicing />;
      case "customers": return <Customers />;
      case "analytics": return <Analytics />;
      case "suppliers": return <Suppliers />;
      case "shipping":  return <Shipping />;
    }
    const ct = workspace.customTabs.find(c => c.id === tab);
    if (ct) return <CustomTabContent tab={ct} />;
    return <ComingSoon label={tab} />;
  };

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif", minHeight: "100vh", background: C.bg, color: C.text }}>

      {/* ── HEADER ── */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50, boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, background: "linear-gradient(135deg,#5b8de8,#9c6fdd)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(91,141,232,0.3)" }}>
            <Zap size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.text, letterSpacing: "-0.4px" }}>{workspace.companyName}</div>
            <div style={{ fontSize: 11, color: C.subtle }}>IndustrialOS · {workspace.modules.length + workspace.customTabs.length} modules active</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => window.open("/portal", "_blank")}
            style={{ padding: "7px 14px", background: C.blueBg, border: `1px solid ${C.blueBorder}`, borderRadius: 8, color: C.blue, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Customer Portal ↗
          </button>
          <button style={{ width: 34, height: 34, background: "none", border: `1px solid ${C.border}`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Bell size={15} color={C.muted} />
          </button>
          <button
            onClick={() => setTab("settings")}
            style={{ width: 34, height: 34, background: tab === "settings" ? C.blueBg : "none", border: `1px solid ${tab === "settings" ? C.blueBorder : C.border}`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <SettingsIcon size={15} color={tab === "settings" ? C.blue : C.muted} />
          </button>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 24px", display: "flex", overflowX: "auto", scrollbarWidth: "none" }}>
        {allTabs.map(t => {
          const active = tab === t.id;
          const Icon   = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "12px 14px", fontSize: 13, fontWeight: active ? 700 : 500,
              border: "none", borderBottom: active ? `2px solid ${C.blue}` : "2px solid transparent",
              color: active ? C.blue : C.muted, background: "none", cursor: "pointer",
              whiteSpace: "nowrap", transition: "color .15s", marginBottom: -1, flexShrink: 0,
            }}>
              {t.emoji
                ? <span style={{ fontSize: 13 }}>{t.emoji}</span>
                : Icon ? <Icon size={13} /> : null}
              {t.label}
            </button>
          );
        })}

        <button onClick={() => setShowAddTab(true)} style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "12px 14px", fontSize: 12, fontWeight: 600,
          border: "none", borderBottom: "2px solid transparent",
          color: C.muted, background: "none", cursor: "pointer",
          whiteSpace: "nowrap", marginBottom: -1, flexShrink: 0, opacity: 0.7,
        }}>
          <Plus size={13} /> Add Tab
        </button>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ padding: "24px", maxWidth: 1200, margin: "0 auto" }}>
        {renderContent()}
      </div>

      {showAddTab && <AddTabModal onAdd={addCustomTab} onClose={() => setShowAddTab(false)} />}
    </div>
  );
}
