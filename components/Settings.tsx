"use client";
// components/Settings.tsx
// Phase 16: Added PO Approval Threshold setting.
// Phase 9:  Added Customer Self-Signup Link section.

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { C } from "@/lib/utils";
import { SectionTitle } from "./Dashboard";
import { WorkspaceConfig, ModuleId, CustomTab, saveWorkspace, clearWorkspace } from "@/lib/workspace";
import { Plus, Trash2, Copy, CheckCircle } from "lucide-react";
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
  { id: "returns",   icon: "↩️", label: "Returns & RMA",       desc: "Manage customer returns and refunds"          },
];

const TAB_TYPES: { id: CustomTab["type"]; label: string; icon: string }[] = [
  { id: "list",   label: "List",   icon: "📝" },
  { id: "kanban", label: "Kanban", icon: "📌" },
  { id: "notes",  label: "Notes",  icon: "📓" },
  { id: "link",   label: "Link",   icon: "🔗" },
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
  const isAdmin = !session?.user?.role || session.user.role === "admin";

  // ── Company info ───────────────────────────────────────────────────────────
  const [companyName, setCompanyName] = useState(workspace.companyName);
  const [saved,       setSaved]       = useState(false);

  // ── Module toggles ─────────────────────────────────────────────────────────
  const [modules, setModules] = useState<ModuleId[]>(workspace.modules);
  const toggleModule = (id: ModuleId) => {
    if (id === "dashboard") return;
    setModules(ms => ms.includes(id) ? ms.filter(m => m !== id) : [...ms, id]);
  };

  // ── Custom tabs ────────────────────────────────────────────────────────────
  const [customTabs, setCustomTabs] = useState<CustomTab[]>(workspace.customTabs);
  const [newLabel,   setNewLabel]   = useState("");
  const [newEmoji,   setNewEmoji]   = useState("📌");
  const [newType,    setNewType]    = useState<CustomTab["type"]>("list");
  const [newUrl,     setNewUrl]     = useState("");

  // ── Phase 16 — PO Approval Threshold ──────────────────────────────────────
  const [approvalThreshold, setApprovalThreshold] = useState(
    String(workspace.poApprovalThreshold ?? 0)
  );

  // ── Phase 9 — Signup link copy state ──────────────────────────────────────
  const [copied, setCopied] = useState(false);
  const workspaceDbId = typeof window !== "undefined" ? localStorage.getItem("workspaceDbId") || "" : "";
  const signupUrl = workspaceDbId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/portal/signup?workspace=${workspaceDbId}`
    : "";

  const copySignupLink = () => {
    if (!signupUrl) return;
    navigator.clipboard.writeText(signupUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

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

  const saveAll = () => {
    const threshold = parseFloat(approvalThreshold);
    const updated: WorkspaceConfig = {
      ...workspace,
      companyName:         companyName.trim() || workspace.companyName,
      modules,
      customTabs,
      poApprovalThreshold: isNaN(threshold) || threshold < 0 ? 0 : threshold,
    };
    saveWorkspace(updated);
    onUpdate(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

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

      {/* ── Company info ── */}
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

      {/* ── Phase 9: Customer Self-Signup Link ── */}
      <Section title="Customer Self-Signup">
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
          Share this link with your customers so they can create their own portal account. They fill in their details and instantly get a portal access code — no manual setup needed.
        </p>
        {workspaceDbId ? (
          <>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
              <div style={{
                flex: 1, padding: "10px 14px",
                background: C.bg, border: `1px solid ${C.border}`,
                borderRadius: 9, fontSize: 12, color: C.blue,
                fontFamily: "monospace", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
              }}>
                {signupUrl}
              </div>
              <button
                onClick={copySignupLink}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "10px 16px", borderRadius: 9, cursor: "pointer",
                  background: copied ? C.greenBg : C.blueBg,
                  border: `1px solid ${copied ? C.greenBorder : C.blueBorder}`,
                  color: copied ? C.green : C.blue,
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                  transition: "all 0.2s",
                }}
              >
                {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
                {copied ? "Copied!" : "Copy Link"}
              </button>
            </div>
            <div style={{ padding: "10px 14px", background: C.blueBg, border: `1px solid ${C.blueBorder}`, borderRadius: 9, fontSize: 12, color: C.blue, lineHeight: 1.6 }}>
              💡 <strong>How it works:</strong> Customer visits the link → fills in their company name, contact, and email → gets a unique portal code instantly → they use it to log in at <strong>/portal</strong>.
            </div>
          </>
        ) : (
          <div style={{ padding: "12px 14px", background: C.amberBg, border: `1px solid ${C.amberBorder}`, borderRadius: 9, fontSize: 13, color: C.amber }}>
            ⚠️ Your workspace ID isn't loaded yet. Try refreshing the page, or make sure you're logged in with a real account (not the demo).
          </div>
        )}
      </Section>

      {/* ── Modules ── */}
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

      {/* ── Phase 16: PO Approval Threshold ── */}
      <Section title="Purchase Approval Workflows">
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
          Set a dollar threshold for purchase orders. Any PO above this amount will require admin approval before it can be sent to the supplier. Set to <strong>0</strong> to disable approvals entirely.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const }}>
          <div style={{ display: "flex", alignItems: "center", gap: 0, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9, overflow: "hidden" }}>
            <span style={{ padding: "10px 12px", fontSize: 13, color: C.muted, borderRight: `1px solid ${C.border}`, fontWeight: 600 }}>$</span>
            <input
              type="number"
              min="0"
              step="100"
              value={approvalThreshold}
              onChange={e => setApprovalThreshold(e.target.value)}
              placeholder="e.g. 5000"
              style={{ padding: "10px 12px", background: "transparent", border: "none", color: C.text, fontSize: 13, outline: "none", width: 140 }}
            />
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>
            {parseFloat(approvalThreshold) > 0
              ? `POs over $${parseFloat(approvalThreshold).toLocaleString()} will need admin approval.`
              : "Approval workflow is disabled — all POs go straight to draft."}
          </div>
        </div>
        {parseFloat(approvalThreshold) > 0 && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: C.amberBg, border: `1px solid ${C.amberBorder}`, borderRadius: 9, fontSize: 12, color: C.amber }}>
            💡 When a PO exceeds the threshold, it will show as <strong>Pending Approval</strong>. Admins will see Approve / Reject buttons. Rejected POs are cancelled with an optional note.
          </div>
        )}
      </Section>

      {/* ── Custom tabs ── */}
      <Section title="Custom Tabs">
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
          Add your own tabs to the navigation bar.
        </p>
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
        <div style={{ background: C.bg, border: `1px dashed ${C.border2}`, borderRadius: 10, padding: "16px 16px 12px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Add New Tab</div>
          <div style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: 10, marginBottom: 10 }}>
            <input value={newEmoji} onChange={e => setNewEmoji(e.target.value)} placeholder="📌" maxLength={2}
              style={{ padding: "9px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 18, textAlign: "center", outline: "none" }} />
            {inp(newLabel, setNewLabel, "Tab label, e.g. 'Returns Log'")}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" as const }}>
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

      {/* ── Save ── */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={saveAll} style={{
          padding: "11px 28px", background: saved ? C.green : C.blue, border: "none",
          borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "background 0.3s",
        }}>
          {saved ? "✓ Saved!" : "Save Changes"}
        </button>
      </div>

      {/* ── Admin only sections ── */}
      {isAdmin && (
        <>
          <UsersSection
            workspaceId={typeof window !== "undefined" ? localStorage.getItem("workspaceDbId") || "" : ""}
            currentUserId={session?.user?.email || ""}
          />
          <div style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 14, padding: "18px 22px" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.red, marginBottom: 6 }}>Danger Zone</div>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 14, lineHeight: 1.5 }}>
              This will clear all workspace settings and send you back to the onboarding wizard.
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
  const [users,      setUsers]      = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [invName,    setInvName]    = useState("");
  const [invEmail,   setInvEmail]   = useState("");
  const [invRole,    setInvRole]    = useState<Role>("operator");
  const [invError,   setInvError]   = useState("");
  const [invLoading, setInvLoading] = useState(false);
  const [invSuccess, setInvSuccess] = useState("");

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
    if (!invName.trim())  { setInvError("Name is required."); return; }
    if (!invEmail.trim()) { setInvError("Email is required."); return; }
    if (!workspaceId)     { setInvError("No workspace found."); return; }
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
    setInvSuccess(`${data.name} added! Default password is changeme123.`);
    setInvName(""); setInvEmail(""); setInvRole("operator");
  };

  const inpStyle = (val: string, set: (v: string) => void, ph: string, type = "text") => (
    <input type={type} value={val} onChange={e => set(e.target.value)} placeholder={ph}
      style={{ width: "100%", padding: "9px 12px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" as const }} />
  );

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px", marginBottom: 16 }}>
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

      {showInvite && (
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px", marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px", marginBottom: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Full Name *</label>
              {inpStyle(invName, setInvName, "e.g. Sarah Chen")}
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Work Email *</label>
              {inpStyle(invEmail, setInvEmail, "sarah@company.com", "email")}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Role</label>
            <div style={{ display: "flex", gap: 8 }}>
              {ROLES.map(r => {
                const cfg    = ROLE_CFG[r];
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

      {loading ? (
        <div style={{ textAlign: "center", padding: "20px 0", color: C.muted, fontSize: 13 }}>Loading users…</div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: "center", padding: "20px 0", color: C.muted, fontSize: 13 }}>No users found.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {users.map((u, i) => {
            const role = (u.role as Role) || "operator";
            const cfg  = ROLE_CFG[role] || ROLE_CFG.operator;
            const isYou = u.email === currentUserId;
            return (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: i % 2 === 0 ? C.bg : "transparent", borderRadius: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: cfg.color, flexShrink: 0 }}>
                  {u.name?.[0]?.toUpperCase() || "?"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                    {u.name} {isYou && <span style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>(you)</span>}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
                </div>
                <select value={role} onChange={e => changeRole(u.id, e.target.value as Role)} disabled={isYou}
                  style={{ padding: "5px 8px", background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 7, color: cfg.color, fontSize: 11, fontWeight: 700, cursor: isYou ? "not-allowed" : "pointer", outline: "none" }}>
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_CFG[r].label}</option>)}
                </select>
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
