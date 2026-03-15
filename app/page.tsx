"use client";
// app/page.tsx

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Zap, Bell, Plus, Settings } from "lucide-react";
import Dashboard     from "@/components/Dashboard";
import Pipeline      from "@/components/Pipeline";
import OrderKanban   from "@/components/OrderKanban";
import InventorySync from "@/components/InventorySync";
import CRMPanel      from "@/components/CRMPanel";
import SystemHealth  from "@/components/SystemHealth";
import Quotes        from "@/components/Quotes";
import Invoicing     from "@/components/Invoicing";
import Suppliers    from "@/components/Suppliers";
import Shipping     from "@/components/Shipping";
import { C } from "@/lib/utils";
import {
  loadWorkspace, saveWorkspace, WorkspaceConfig, ModuleId, CustomTab,
} from "@/lib/workspace";
import {
  LayoutDashboard, ShoppingCart, Package, FileText,
  Receipt, Truck, Users, Factory, BarChart2,
  GitMerge, Upload, Heart, Link as LinkIcon,
} from "lucide-react";

// ── Module tab definitions ────────────────────────────────────────────────────
const MODULE_TABS: Record<ModuleId, { label: string; icon: any }> = {
  dashboard: { label: "Dashboard",      icon: LayoutDashboard },
  orders:    { label: "Orders",         icon: ShoppingCart    },
  inventory: { label: "Inventory",      icon: Package         },
  quotes:    { label: "Quotes & RFQ",   icon: FileText        },
  invoicing: { label: "Invoicing",      icon: Receipt         },
  shipping:  { label: "Shipping",       icon: Truck           },
  customers: { label: "Customers",      icon: Users           },
  suppliers: { label: "Suppliers",      icon: Factory         },
  analytics: { label: "Analytics",      icon: BarChart2       },
  crm:       { label: "CRM",            icon: GitMerge        },
  pipeline:  { label: "SKU Pipeline",   icon: Upload          },
  health:    { label: "System Health",  icon: Heart           },
};

// ── Add every newly built module here — auto-migration handles the rest ───────
const BUILT_MODULES: ModuleId[] = [
  "dashboard", "orders", "inventory", "quotes",
  "invoicing", "suppliers", "shipping", "crm", "pipeline", "health",
];

// ── Coming soon placeholder ───────────────────────────────────────────────────
function ComingSoon({ label }: { label: string }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"80px 24px", textAlign:"center" }}>
      <div style={{ fontSize:48, marginBottom:16 }}>🚧</div>
      <h2 style={{ fontSize:20, fontWeight:800, color:C.text, marginBottom:8 }}>{label} — Coming Soon</h2>
      <p style={{ color:C.muted, fontSize:14, maxWidth:360, lineHeight:1.6 }}>
        This module is being built. It will be available in the next update.
        Everything you set up here will automatically appear when it launches.
      </p>
    </div>
  );
}

function CustomTabContent({ tab }: { tab: CustomTab }) {
  if (tab.type === "link" && tab.url) {
    return (
      <div style={{ padding:24 }}>
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:20, display:"flex", alignItems:"center", gap:14 }}>
          <LinkIcon size={20} color={C.blue} />
          <div>
            <div style={{ fontWeight:700, color:C.text }}>{tab.label}</div>
            <a href={tab.url} target="_blank" rel="noreferrer" style={{ color:C.blue, fontSize:13 }}>{tab.url}</a>
          </div>
        </div>
      </div>
    );
  }
  return <ComingSoon label={tab.label} />;
}

export default function App() {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [tab,       setTab]       = useState("dashboard");
  const [loading,   setLoading]   = useState(true);

  // ── Load workspace + auto-migrate new modules ─────────────────────────────
  useEffect(() => {
    const ws = loadWorkspace();
    if (!ws || !ws.onboardingDone) { router.push("/onboarding"); return; }
    const missing = BUILT_MODULES.filter(m => !ws.modules.includes(m));
    if (missing.length > 0) {
      const updated = { ...ws, modules: [...ws.modules, ...missing] };
      saveWorkspace(updated);
      setWorkspace(updated);
    } else {
      setWorkspace(ws);
    }
    setLoading(false);
  }, []);

  // ── Other component state ─────────────────────────────────────────────────
  const [met] = useState({ opm:0, skus:0, sync:0, activeOrders:0, rev:0, latency:0, queue:0, conflicts:0 });
  const [chart]     = useState<any[]>([]);
  const [pipe,      setPipe]      = useState<any>(null);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [crm,       setCrm]       = useState({ salesforce:"disconnected", hubspot:"disconnected", zoho:"disconnected" });
  const [health] = useState([
    { name:"PostgreSQL",     status:"unknown", lat:0, up:0 },
    { name:"Redis Cache",    status:"unknown", lat:0, up:0 },
    { name:"BullMQ Workers", status:"unknown", lat:0, up:0 },
    { name:"CRM Webhook",    status:"unknown", lat:0, up:0 },
    { name:"Search Index",   status:"unknown", lat:0, up:0 },
    { name:"File Storage",   status:"unknown", lat:0, up:0 },
  ]);
  const alerts: any[] = [];

  const resolveConflict = (id: number) =>
    setConflicts(cs => cs.map(c => c.id === id ? { ...c, status:"resolved" } : c));

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading || !workspace) {
    return (
      <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>⚡</div>
          <div style={{ color:C.muted, fontSize:14 }}>Loading your workspace…</div>
        </div>
      </div>
    );
  }

  // ── Build tabs ────────────────────────────────────────────────────────────
  const moduleTabs = workspace.modules.map(id => ({
    id, label: MODULE_TABS[id]?.label || id, icon: MODULE_TABS[id]?.icon || LayoutDashboard, custom: false,
  }));
  const customTabList = workspace.customTabs.map(ct => ({
    id: ct.id, label: ct.label, icon: null, emoji: ct.icon, custom: true, data: ct,
  }));
  const allTabs = [...moduleTabs, ...customTabList];

  // ── Render content ────────────────────────────────────────────────────────
  const renderContent = () => {
    switch (tab) {
      case "dashboard": return <Dashboard     met={met}       chart={chart}    alerts={alerts} />;
      case "pipeline":  return <Pipeline      pipe={pipe}     setPipe={setPipe} />;
      case "orders":    return <OrderKanban />;   // ← self-contained, no props needed
      case "inventory": return <InventorySync conflicts={conflicts} resolveConflict={resolveConflict} />;
      case "crm":       return <CRMPanel      crm={crm}       setCrm={setCrm} />;
      case "health":    return <SystemHealth  health={health} met={met} alerts={alerts} />;
      case "quotes":    return <Quotes />;
      case "invoicing": return <Invoicing />;
      case "suppliers": return <Suppliers />;
      case "shipping":  return <Shipping />;
      case "customers":
      case "analytics":
        return <ComingSoon label={MODULE_TABS[tab as ModuleId]?.label || tab} />;
    }
    const ct = workspace.customTabs.find(c => c.id === tab);
    if (ct) return <CustomTabContent tab={ct} />;
    return <ComingSoon label={tab} />;
  };

  return (
    <div style={{ fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif", minHeight:"100vh", background:C.bg, color:C.text }}>

      {/* ── Header ── */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"10px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:50, boxShadow:"0 1px 6px rgba(0,0,0,0.04)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:36, height:36, background:"linear-gradient(135deg,#5b8de8,#9c6fdd)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 8px rgba(91,141,232,0.3)" }}>
            <Zap size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight:800, fontSize:15, color:C.text, letterSpacing:"-0.4px" }}>{workspace.companyName}</div>
            <div style={{ fontSize:11, color:C.subtle }}>IndustrialOS · {workspace.modules.length + workspace.customTabs.length} modules active</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, background:"#edf6f1", border:"1px solid #b8dece", borderRadius:999, padding:"4px 12px" }}>
            <span style={{ width:7, height:7, background:"#2e7d5e", borderRadius:"50%" }}/>
            <span style={{ fontSize:11, color:"#2e7d5e", fontWeight:700 }}>{workspace.suggestedPlan.toUpperCase()} · 14 days free</span>
          </div>
          <button onClick={()=>router.push("/onboarding")} title="Settings" style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 8px", cursor:"pointer", color:C.muted, display:"flex", alignItems:"center" }}>
            <Settings size={15} />
          </button>
          <div style={{ position:"relative", cursor:"pointer" }}><Bell size={17} color={C.muted}/></div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 24px", display:"flex", gap:2, overflowX:"auto", scrollbarWidth:"none" }}>
        {allTabs.map((t: any) => {
          const active = tab === t.id;
          const Icon   = t.icon;
          return (
            <button key={t.id} onClick={()=>setTab(t.id)} style={{ display:"flex", alignItems:"center", gap:6, padding:"12px 14px", fontSize:12, fontWeight:600, border:"none", borderBottom:active?`2px solid ${C.blue}`:"2px solid transparent", color:active?C.blue:C.muted, background:"none", cursor:"pointer", whiteSpace:"nowrap", transition:"color .15s", marginBottom:-1, flexShrink:0 }}>
              {t.emoji ? <span style={{ fontSize:13 }}>{t.emoji}</span> : Icon ? <Icon size={13}/> : null}
              {t.label}
            </button>
          );
        })}
        <button onClick={()=>{/* Phase 2+ */}} style={{ display:"flex", alignItems:"center", gap:4, padding:"12px 14px", fontSize:12, fontWeight:600, border:"none", borderBottom:"2px solid transparent", color:C.muted, background:"none", cursor:"pointer", whiteSpace:"nowrap", marginBottom:-1, flexShrink:0, opacity:0.6 }}>
          <Plus size={13}/> Add Tab
        </button>
      </div>

      {/* ── Content ── */}
      <div style={{ padding:"24px", maxWidth:1200, margin:"0 auto" }}>
        {renderContent()}
      </div>
    </div>
  );
}
