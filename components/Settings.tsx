"use client";
// components/Settings.tsx
// Workspace settings — company info, module toggles, custom tab creator, danger zone.

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
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
  const { data: session } = useSession();
  const isAdmin = !session?.user?.role || session.user.role === "admin"; // default to true so demo users still see it

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

      {/* Danger zone — admin only */}
      {isAdmin && (
      <>
      {/* ── Users & Roles — admin only ── */}
      <UsersSection workspaceId={typeof window !== "undefined" ? localStorage.getItem("workspaceDbId") || "" : ""} currentUserId={session?.user?.email || ""} />

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
      </>
      )}
    </div>
  );
}

// ── Users & Roles sub-component ───────────────────────────────────────────────
const ROLES = ["admin", "operator", "viewer"] as const;
type Role = typeof ROLES[number];

const ROLE_CFG: Record<Role, { label: string; color: string; bg: string; border: string; desc: string }> = {
  admin:    { label: "Admin",    color: "#5b8de8", bg: "rgba(91,141,232,0.1)",  border: "rgba(91,141,232,0.3)",  desc: "Full access including settings & danger zone" },
  operator: { label: "Operator", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)",  desc: "Can create/edit orders, inventory, shipments" },
  viewer:   { label: "Viewer",   color: "#6b7280", bg: "rgba(107,114,128,0.1)",border: "rgba(107,114,128,0.3)", desc: "Read-only access — no create or edit buttons" },
};

function UsersSection({ workspaceId, currentUserId }: { workspaceId: string; currentUserId: string }) {
  const [users,       setUsers]       = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showInvite,  setShowInvite]  = useState(false);
  const [invName,     setInvName]     = useState("");
  const [invEmail,    setInvEmail]    = useState("");
  const [invRole,     setInvRole]     = useState<Role>("operator");
  const [invError,    setInvError]    = useState("");
  const [invLoading,  setInvLoading]  = useState(false);
  const [invSuccess,  setInvSuccess]  = useState("");

  useEffect(() => {
    if (!workspaceId) { setLoading(false); return; }
    fetch(`/api/users?workspaceId=${workspaceId}`)
      .then(r => r.json())
      .then(data => { setUsers(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [workspaceId]);

  const changeRole = async (id: string, role: Role) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u));
    await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, role }),
    });
  };

  const removeUser = async (id: string) => {
    if (!confirm("Remove this user from the workspace?")) return;
    setUsers(prev => prev.filter(u => u.id !== id));
    await fetch(`/api/users?id=${id}`, { method: "DELETE" });
  };

  const inviteUser = async () => {
    setInvError(""); setInvSuccess("");
    if (!invName.trim()) { setInvError("Name is required."); return; }
    if (!invEmail.trim()) { setInvError("Email is required."); return; }
    if (!workspaceId) { setInvError("No workspace found."); return; }
    setInvLoading(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: invName.trim(), email: invEmail.trim(), role: invRole, workspaceId }),
    });
    const data = await res.json();
    setInvLoading(false);
    if (!res.ok) { setInvError(data.error || "Failed to invite user."); return; }
    setUsers(prev => [...prev, data]);
    setInvSuccess(`${data.name} added! Their default password is changeme123 — tell them to update it.`);
    setInvName(""); setInvEmail(""); setInvRole("operator");
  };

  const inp = (val: string, set: (v: string) => void, ph: string, type = "text") => (
    <input type={type} value={val} onChange={e => set(e.target.value)} placeholder={ph}
      style={{ width: "100%", padding: "9px 12px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" as const }} />
  );

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <SectionTitle>Users & Roles</SectionTitle>
          <p style={{ fontSize: 12, color: C.muted, marginTop: -8 }}>Manage who has access to this workspace.</p>
        </div>
        <button onClick={() => { setShowInvite(v => !v); setInvError(""); setInvSuccess(""); }}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: C.blue, border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          <Plus size={13}/> Invite User
        </button>
      </div>

      {/* Invite form */}
      {showInvite && (
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px", marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px", marginBottom: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Full Name *</label>
              {inp(invName, setInvName, "e.g. Sarah Chen")}
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Work Email *</label>
              {inp(invEmail, setInvEmail, "sarah@company.com", "email")}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Role</label>
            <div style={{ display: "flex", gap: 8 }}>
              {ROLES.map(r => {
                const cfg = ROLE_CFG[r];
                const active = invRole === r;
                return (
                  <button key={r} onClick={() => setInvRole(r)}
                    style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${active ? cfg.border : C.border}`, background: active ? cfg.bg : "none", color: active ? cfg.color : C.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    {cfg.label}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{ROLE_CFG[invRole].desc}</p>
          </div>
          {invError   && <div style={{ fontSize: 12, color: C.red,   marginBottom: 8 }}>⚠️ {invError}</div>}
          {invSuccess && <div style={{ fontSize: 12, color: C.green, marginBottom: 8 }}>✓ {invSuccess}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={inviteUser} disabled={invLoading}
              style={{ padding: "9px 20px", background: invLoading ? C.border : C.blue, border: "none", borderRadius: 8, color: invLoading ? C.muted : "#fff", fontSize: 13, fontWeight: 700, cursor: invLoading ? "not-allowed" : "pointer" }}>
              {invLoading ? "Adding…" : "Add to Workspace"}
            </button>
            <button onClick={() => { setShowInvite(false); setInvError(""); setInvSuccess(""); }}
              style={{ padding: "9px 16px", background: "none", border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, fontSize: 13, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* User list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "20px 0", color: C.muted, fontSize: 13 }}>Loading users…</div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: "center", padding: "20px 0", color: C.muted, fontSize: 13 }}>No users found. Invite someone above.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {users.map((u, i) => {
            const role = (u.role as Role) || "operator";
            const cfg  = ROLE_CFG[role] || ROLE_CFG.operator;
            const isYou = u.email === currentUserId;
            return (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: i % 2 === 0 ? C.bg : "transparent", borderRadius: 8 }}>
                {/* Avatar */}
                <div style={{ width: 34, height: 34, borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: cfg.color, flexShrink: 0 }}>
                  {u.name?.[0]?.toUpperCase() || "?"}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                    {u.name} {isYou && <span style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>(you)</span>}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
                </div>
                {/* Role selector */}
                <select value={role} onChange={e => changeRole(u.id, e.target.value as Role)} disabled={isYou}
                  style={{ padding: "5px 8px", background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 7, color: cfg.color, fontSize: 11, fontWeight: 700, cursor: isYou ? "not-allowed" : "pointer", outline: "none" }}>
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_CFG[r].label}</option>)}
                </select>
                {/* Remove */}
                {!isYou && (
                  <button onClick={() => removeUser(u.id)}
                    style={{ width: 28, height: 28, borderRadius: 7, background: C.redBg, border: `1px solid ${C.redBorder}`, color: C.red, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Trash2 size={12}/>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
