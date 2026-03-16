"use client";
// components/Settings.tsx
// Workspace settings — company info, module toggles, custom tab creator, danger zone.

import { useState } from "react";
import { C } from "@/lib/utils";
import { SectionTitle } from "./Dashboard";
import { WorkspaceConfig, ModuleId, CustomTab, saveWorkspace, clearWorkspace } from "@/lib/workspace";
import { Settings as SettingsIcon, Plus, Trash2, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

const ALL_MODULES: { id: ModuleId; label: string; icon: string; desc: string }[] = [
  { id: "orders",    icon: "🛒", label: "Order Management",     desc: "Track orders from placed to delivered"       },
  { id: "inventory", icon: "📦", label: "Inventory",            desc: "Stock levels, alerts, warehouse tracking"     },
  { id: "quotes",    icon: "📋", label: "Quotes & RFQ",         desc: "Send price quotes, manage negotiations"       },
  { id: "invoicing", icon: "🧾", label: "Invoicing & Payments", desc: "Bills, payment terms, collections"            },
  { id: "shipping",  icon: "🚚", label: "Shipping & Logistics", desc: "Labels, carriers, tracking numbers"           },
  { id: "customers", icon: "🤝", label: "Customer Accounts",    desc: "Company profiles, contacts, credit limits"    },
  { id: "suppliers", icon: "🏭", label: "Suppliers",            desc: "Purchase orders, supplier management"         },
  { id: "analytics", icon: "📊", label: "Analytics & Reports",  desc: "Revenue, forecasting, performance"            },
  { id: "crm",       icon: "🔌", label: "CRM Integrations",     desc: "Salesforce, HubSpot, Zoho sync"               },
  { id: "pipeline",  icon: "⚡", label: "SKU Pipeline",         desc: "Bulk import up to 1M SKUs"                    },
  { id: "health",    icon: "🩺", label: "System Health",        desc: "Monitor all services and uptime"              },
];

const TAB_TYPES: { id: CustomTab["type"]; label: string; desc: string; icon: string }[] = [
  { id: "list",   label: "List",   icon: "📝", desc: "A simple list or checklist" },
  { id: "kanban", label: "Kanban", icon: "📌", desc: "Card-based board view"       },
  { id: "notes",  label: "Notes",  icon: "📓", desc: "Free-form notes page"        },
  { id: "link",   label: "Link",   icon: "🔗", desc: "Embed or link external URL"  },
];

const uid = () => Math.random().toString(36).slice(2, 9);

const inp = (val: string, set: (v: string) => void, ph: string) => (
  <input value={val} onChange={e => set(e.target.value)} placeholder={ph}
    style={{ width: "100%", padding: "9px 11px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
);

export default function Settings({ workspace, onUpdate }: {
  workspace: WorkspaceConfig;
  onUpdate: (ws: WorkspaceConfig) => void;
}) {
  const router = useRouter();

  // ── Company info state ─────────────────────────────────────────────────────
  const [companyName, setCompanyName] = useState(workspace.companyName);
  const [saved,       setSaved]       = useState(false);

  // ── Module toggles ─────────────────────────────────────────────────────────
  const [modules, setModules] = useState<ModuleId[]>(workspace.modules);
  const toggleModule = (id: ModuleId) => {
    if (id === "dashboard") return; // always on
    setModules(ms => ms.includes(id) ? ms.filter(m => m !== id) : [...ms, id]);
  };

  // ── Custom tabs ────────────────────────────────────────────────────────────
  const [customTabs, setCustomTabs] = useState<CustomTab[]>(workspace.customTabs);
  const [newLabel,   setNewLabel]   = useState("");
  const [newEmoji,   setNewEmoji]   = useState("📌");
  const [newType,    setNewType]    = useState<CustomTab["type"]>("list");
  const [newUrl,     setNewUrl]     = useState("");

  const addTab = () => {
    if (!newLabel.trim()) return;
    const tab: CustomTab = {
      id:    uid(),
      label: newLabel.trim(),
      icon:  newEmoji,
      type:  newType,
      url:   newType === "link" ? newUrl.trim() : undefined,
    };
    setCustomTabs(prev => [...prev, tab]);
    setNewLabel(""); setNewEmoji("📌"); setNewType("list"); setNewUrl("");
  };

  const removeTab = (id: string) => setCustomTabs(prev => prev.filter(t => t.id !== id));

  // ── Save ───────────────────────────────────────────────────────────────────
  const saveAll = () => {
    const updated: WorkspaceConfig = {
      ...workspace,
      companyName: companyName.trim() || workspace.companyName,
      modules,
      customTabs,
    };
    saveWorkspace(updated);
    onUpdate(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // ── Reset workspace ────────────────────────────────────────────────────────
  const resetWorkspace = () => {
    if (!confirm("This will clear all workspace settings and send you back to onboarding. Are you sure?")) return;
    clearWorkspace();
    router.push("/onboarding");
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px", marginBottom: 16 }}>
      <SectionTitle>{title}</SectionTitle>
      {children}
    </div>
  );

  return (
    <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Company info */}
      <Section title="Company Info">
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Company Name</label>
          {inp(companyName, setCompanyName, "Your company name")}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[
            ["Industry",      workspace.industry.replace(/_/g," ")],
            ["Team Size",     workspace.teamSize + " people"],
            ["Plan",          workspace.suggestedPlan.charAt(0).toUpperCase() + workspace.suggestedPlan.slice(1)],
            ["Modules Active",modules.length.toString()],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{k}</div>
              <div style={{ fontSize: 14, color: C.text, fontWeight: 600, textTransform: "capitalize" }}>{v}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Modules */}
      <Section title="Active Modules">
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 14, lineHeight: 1.5 }}>
          Toggle modules on or off. Dashboard is always visible.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {ALL_MODULES.map(m => {
            const on = modules.includes(m.id);
            return (
              <div key={m.id} onClick={() => toggleModule(m.id)} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "11px 14px", borderRadius: 10, cursor: m.id === "dashboard" ? "not-allowed" : "pointer",
                background: on ? C.blueBg : C.bg,
                border: `1px solid ${on ? C.blueBorder : C.border}`,
                opacity: m.id === "dashboard" ? 0.6 : 1,
                transition: "all 0.15s",
              }}>
                <span style={{ fontSize: 16 }}>{m.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: on ? C.blue : C.text }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.desc}</div>
                </div>
                <div style={{
                  width: 36, height: 20, borderRadius: 999, flexShrink: 0,
                  background: on ? C.blue : C.border, position: "relative", transition: "background 0.2s",
                }}>
                  <div style={{
                    position: "absolute", top: 3, left: on ? 18 : 3,
                    width: 14, height: 14, borderRadius: "50%", background: "#fff",
                    transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Custom tabs */}
      <Section title="Custom Tabs">
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
          Add your own tabs to the navigation bar. Useful for custom workflows, embedded tools, or quick links.
        </p>

        {/* Existing custom tabs */}
        {customTabs.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {customTabs.map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{t.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{t.type}{t.url ? ` · ${t.url}` : ""}</div>
                  </div>
                </div>
                <button onClick={() => removeTab(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.red, padding: 4 }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new tab form */}
        <div style={{ background: C.bg, border: `1px dashed ${C.border2}`, borderRadius: 10, padding: "16px 16px 12px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Add New Tab</div>
          <div style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: 10, marginBottom: 10 }}>
            <input value={newEmoji} onChange={e => setNewEmoji(e.target.value)} placeholder="📌" maxLength={2}
              style={{ padding: "9px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 18, textAlign: "center", outline: "none" }} />
            {inp(newLabel, setNewLabel, "Tab label, e.g. 'Returns Log'")}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {TAB_TYPES.map(t => (
              <button key={t.id} onClick={() => setNewType(t.id)} style={{
                padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none",
                background: newType === t.id ? C.blue : C.surface,
                color:      newType === t.id ? "#fff" : C.muted,
              }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          {newType === "link" && (
            <div style={{ marginBottom: 10 }}>
              {inp(newUrl, setNewUrl, "https://your-tool.com/embed")}
            </div>
          )}
          <button onClick={addTab} disabled={!newLabel.trim()} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", background: newLabel.trim() ? C.blue : C.border, border: "none",
            borderRadius: 8, color: newLabel.trim() ? "#fff" : C.muted, fontSize: 13, fontWeight: 700, cursor: newLabel.trim() ? "pointer" : "not-allowed",
          }}>
            <Plus size={13} /> Add Tab
          </button>
        </div>
      </Section>

      {/* Save */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={saveAll} style={{
          padding: "11px 28px", background: saved ? C.green : C.blue, border: "none",
          borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "background 0.3s",
        }}>
          {saved ? "✓ Saved!" : "Save Changes"}
        </button>
      </div>

      {/* Danger zone */}
      <div style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 14, padding: "18px 22px" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.red, marginBottom: 6 }}>Danger Zone</div>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 14, lineHeight: 1.5 }}>
          This will clear all workspace settings and send you back to the onboarding wizard. All local data will be lost.
        </p>
        <button onClick={resetWorkspace} style={{ padding: "9px 20px", background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 8, color: C.red, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Reset Workspace
        </button>
      </div>
    </div>
  );
}
