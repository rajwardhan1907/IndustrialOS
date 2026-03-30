"use client";
// app/onboarding/page.tsx
// The onboarding wizard. Shows when a company signs up for the first time.
// 4 steps: Company Info → Team Size → Pick Modules → Done
// Saves everything to localStorage. Later we'll save to the database.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  WorkspaceConfig, Industry, TeamSize, ModuleId,
  DEFAULT_WORKSPACE, saveWorkspace, getPlan, getRecommendedModules, PLANS,
} from "@/lib/workspace";

// ── All available modules the user can pick ──────────────────────────────────
const ALL_MODULES: { id: ModuleId; label: string; icon: string; desc: string }[] = [
  { id: "orders",    icon: "🛒", label: "Order Management",     desc: "Track orders from placed to delivered" },
  { id: "inventory", icon: "📦", label: "Inventory",            desc: "Stock levels, alerts, warehouse tracking" },
  { id: "quotes",    icon: "📋", label: "Quotes & RFQ",         desc: "Send price quotes, manage negotiations" },
  { id: "invoicing", icon: "🧾", label: "Invoicing & Payments", desc: "Bills, payment terms, collections" },
  { id: "shipping",  icon: "🚚", label: "Shipping & Logistics", desc: "Labels, carriers, tracking numbers" },
  { id: "customers", icon: "🤝", label: "Customer Accounts",    desc: "Company profiles, contacts, credit limits" },
  { id: "suppliers", icon: "🏭", label: "Suppliers & Procurement", desc: "Purchase orders, supplier management" },
  { id: "analytics", icon: "📊", label: "Analytics & Reports",  desc: "Revenue, forecasting, performance" },
  { id: "crm",       icon: "🔌", label: "CRM Integrations",     desc: "Salesforce, HubSpot, Zoho sync" },
  { id: "pipeline",  icon: "⚡", label: "SKU Pipeline",         desc: "Bulk import up to 1M SKUs" },
  { id: "health",    icon: "🩺", label: "System Health",        desc: "Monitor all services and uptime" },
];

const INDUSTRIES: { id: Industry; icon: string; label: string }[] = [
  { id: "manufacturer",  icon: "🏭", label: "Manufacturer" },
  { id: "distributor",   icon: "🚛", label: "Distributor / Wholesaler" },
  { id: "services",      icon: "🔧", label: "Industrial Services" },
  { id: "import_export", icon: "🌍", label: "Import / Export" },
  { id: "construction",  icon: "🏗️", label: "Construction & Supplies" },
  { id: "pharma",        icon: "💊", label: "Pharmaceutical" },
  { id: "food_beverage", icon: "🍱", label: "Food & Beverage" },
  { id: "technology",    icon: "💻", label: "Technology" },
  { id: "other",         icon: "⚙️", label: "Other B2B" },
];

const TEAM_SIZES: { id: TeamSize; label: string; plan: string; price: string }[] = [
  { id: "1-5",  label: "1 – 5 people",   plan: "Starter",    price: "$49/mo" },
  { id: "6-15", label: "6 – 15 people",  plan: "Growth",     price: "$99/mo" },
  { id: "16-30",label: "16 – 30 people", plan: "Business",   price: "$179/mo" },
  { id: "31-75",label: "31 – 75 people", plan: "Scale",      price: "$299/mo" },
  { id: "75+",  label: "75+ people",     plan: "Enterprise", price: "Custom" },
];

// ── Colour palette (matches rest of app) ────────────────────────────────────
const C = {
  bg: "#0f1117", surface: "#141722", border: "#2a2d3e",
  text: "#e8e6e1", muted: "#7a7d8a", subtle: "#4a4d5a",
  blue: "#5b8de8", blueBg: "#1e2a45", blueBorder: "#2d4a7a",
  green: "#68d391", greenBg: "#0d1f12", greenBorder: "#276749",
  amber: "#f6c90e", amberBg: "#1f1a00", amberBorder: "#4a3f00",
  purple: "#9c6fdd", purpleBg: "#1f1530", purpleBorder: "#4a2d7a",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1 | 2 | 3 | 4
  const TOTAL_STEPS = 4;

  // ── Form state ─────────────────────────────────────────────────────────────
  const [companyName, setCompanyName] = useState("");
  const [industry,    setIndustry]    = useState<Industry | "">("");
  const [teamSize,    setTeamSize]    = useState<TeamSize | "">("");
  const [modules,     setModules]     = useState<ModuleId[]>([]);
  const [nameError,   setNameError]   = useState("");
  const [saveError,   setSaveError]   = useState("");
  // ── Toggle a module on/off ─────────────────────────────────────────────────
  const toggleModule = (id: ModuleId) => {
    setModules(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  // ── When user picks industry → auto-select recommended modules ─────────────
  const pickIndustry = (id: Industry) => {
    setIndustry(id);
    setModules(getRecommendedModules(id));
  };

  // ── Step navigation ────────────────────────────────────────────────────────
  const next = () => {
    if (step === 1) {
      if (!companyName.trim()) { setNameError("Please enter your company name"); return; }
      if (!industry)           { setNameError("Please select your industry");    return; }
      setNameError("");
    }
    setStep(s => Math.min(s + 1, TOTAL_STEPS));
  };

  const back = () => setStep(s => Math.max(s - 1, 1));

  // ── Finish → save workspace and go to dashboard ───────────────────────────
  const finish = async () => {
    const size  = (teamSize || "1-5") as TeamSize;
    const plan  = getPlan(size);
    const allMods: ModuleId[] = ["dashboard", ...modules.filter(m => m !== "dashboard")];

    const config: WorkspaceConfig = {
      companyName:    companyName.trim(),
      industry:       (industry || "other") as Industry,
      teamSize:       size,
      modules:        allMods,
      customTabs:     [],
      onboardingDone: true,
      suggestedPlan:  plan,
      poApprovalThreshold: 0,
      currency:            "USD",  // Phase 15
    };

    // Save to localStorage (keeps app working as before)
    saveWorkspace(config);

    // ── If user came from /register they already have a workspace in DB.
    // Don't create a second one — just go to the dashboard.
    const existingWsId = typeof window !== "undefined"
      ? localStorage.getItem("workspaceDbId")
      : null;

    if (existingWsId) {
      router.push("/");
      return;
    }

    // Demo user / old flow — create workspace in DB now
    try {
      const wsRes = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:     companyName.trim(),
          industry: (industry || "other") as Industry,
        }),
      });
      if (!wsRes.ok) {
        const errData = await wsRes.json().catch(() => ({}));
        setSaveError("DB error: " + (errData.error ?? wsRes.statusText));
        return;
      }
      const wsData = await wsRes.json();
      if (wsData.id) {
        localStorage.setItem("workspaceDbId", wsData.id);
      } else {
        setSaveError("Workspace saved but no ID returned. Check your database.");
        return;
      }
    } catch (err: any) {
      setSaveError("Network error: " + (err.message ?? "Could not reach server"));
      return;
    }
    router.push("/");
  };

  // ── Suggested plan for current team size ──────────────────────────────────
  const currentPlan = teamSize ? PLANS[getPlan(teamSize as TeamSize)] : null;

  // ── Shared button style ───────────────────────────────────────────────────
  const btnPrimary: React.CSSProperties = {
    padding: "13px 32px", background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`,
    border: "none", borderRadius: 10, color: "#fff", fontSize: 15,
    fontWeight: 700, cursor: "pointer", transition: "opacity 0.15s",
  };
  const btnSecondary: React.CSSProperties = {
    padding: "13px 24px", background: "transparent",
    border: `1px solid ${C.border}`, borderRadius: 10, color: C.muted,
    fontSize: 14, fontWeight: 600, cursor: "pointer",
  };

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, color: C.text,
      fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "flex-start", padding: "40px 16px 60px",
    }}>

      {/* ── Logo ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 40 }}>
        <div style={{
          width: 40, height: 40,
          background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`,
          borderRadius: 10, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 20,
          boxShadow: `0 0 24px ${C.blue}66`,
        }}>⚡</div>
        <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: "-0.5px" }}>IndustrialOS</span>
      </div>

      {/* ── Progress bar ── */}
      <div style={{ width: "100%", maxWidth: 560, marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          {["Company Info", "Team Size", "Your Modules", "All Set!"].map((label, i) => {
            const done   = i + 1 < step;
            const active = i + 1 === step;
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: done ? C.green : active ? C.blue : C.surface,
                  border: `2px solid ${done ? C.green : active ? C.blue : C.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: done || active ? "#fff" : C.subtle,
                  transition: "all 0.3s",
                }}>{done ? "✓" : i + 1}</div>
                <span style={{ fontSize: 10, color: active ? C.blue : C.subtle, fontWeight: active ? 700 : 400 }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ height: 3, background: C.border, borderRadius: 999, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 999,
            background: `linear-gradient(90deg, ${C.blue}, ${C.purple})`,
            width: `${((step - 1) / (TOTAL_STEPS - 1)) * 100}%`,
            transition: "width 0.4s ease",
          }} />
        </div>
      </div>

      {/* ── Card ── */}
      <div style={{
        width: "100%", maxWidth: 560,
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 18, padding: "36px 32px",
        boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
      }}>

        {/* ════════════════════════════════════════
            STEP 1 — Company name + industry
        ════════════════════════════════════════ */}
        {step === 1 && (
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6, letterSpacing: "-0.5px" }}>
              Welcome! Let's set up your workspace
            </h1>
            <p style={{ color: C.muted, fontSize: 14, marginBottom: 28 }}>
              Takes about 2 minutes. You can change everything later in Settings.
            </p>

            {/* Company name */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Company Name
              </label>
              <input
                value={companyName}
                onChange={e => { setCompanyName(e.target.value); setNameError(""); }}
                placeholder="e.g. Acme Industrial Co."
                autoFocus
                style={{
                  width: "100%", padding: "12px 14px",
                  background: "#1a1d2e", border: `1px solid ${nameError ? "#e53e3e" : C.border}`,
                  borderRadius: 10, color: C.text, fontSize: 15, outline: "none",
                  boxSizing: "border-box", transition: "border-color 0.15s",
                }}
                onFocus={e => (e.target.style.borderColor = C.blue)}
                onBlur={e  => (e.target.style.borderColor = nameError ? "#e53e3e" : C.border)}
              />
              {nameError && <p style={{ color: "#e53e3e", fontSize: 12, marginTop: 6 }}>{nameError}</p>}
            </div>

            {/* Industry picker */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                What kind of business are you?
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {INDUSTRIES.map(ind => (
                  <button
                    key={ind.id}
                    onClick={() => { pickIndustry(ind.id); setNameError(""); }}
                    style={{
                      padding: "12px 8px", borderRadius: 10, cursor: "pointer",
                      border: `1px solid ${industry === ind.id ? C.blue : C.border}`,
                      background: industry === ind.id ? C.blueBg : "#1a1d2e",
                      color: industry === ind.id ? C.blue : C.muted,
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                      transition: "all 0.15s",
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{ind.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, textAlign: "center", lineHeight: 1.3 }}>{ind.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════
            STEP 2 — Team size
        ════════════════════════════════════════ */}
        {step === 2 && (
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6, letterSpacing: "-0.5px" }}>
              How big is your team?
            </h1>
            <p style={{ color: C.muted, fontSize: 14, marginBottom: 28 }}>
              We use this to suggest the right plan. You only pay for active users.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {TEAM_SIZES.map(t => {
                const selected = teamSize === t.id;
                const planInfo = PLANS[getPlan(t.id)];
                return (
                  <button
                    key={t.id}
                    onClick={() => setTeamSize(t.id)}
                    style={{
                      padding: "16px 18px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                      border: `1px solid ${selected ? C.blue : C.border}`,
                      background: selected ? C.blueBg : "#1a1d2e",
                      transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: selected ? C.blue : C.text }}>
                        {t.label}
                      </div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                        {t.plan} plan
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{
                        fontSize: 18, fontWeight: 800,
                        color: selected ? C.blue : C.text,
                      }}>{t.price}</div>
                      {t.id !== "75+" && (
                        <div style={{ fontSize: 11, color: C.muted }}>per month</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Plan callout */}
            {currentPlan && (
              <div style={{
                marginTop: 20, padding: "14px 16px",
                background: C.greenBg, border: `1px solid ${C.greenBorder}`,
                borderRadius: 10, display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ fontSize: 20 }}>✅</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: C.green }}>
                    {currentPlan.name} Plan — {currentPlan.users} active users
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                    14-day free trial included. No credit card required to start.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════
            STEP 3 — Module picker
        ════════════════════════════════════════ */}
        {step === 3 && (
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6, letterSpacing: "-0.5px" }}>
              Pick your modules
            </h1>
            <p style={{ color: C.muted, fontSize: 14, marginBottom: 6 }}>
              We've pre-selected the best ones for your industry. Add or remove anything.
            </p>
            <p style={{ fontSize: 12, color: C.subtle, marginBottom: 20 }}>
              You can turn modules on/off anytime in Settings → Modules.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 380, overflowY: "auto", paddingRight: 4 }}>
              {ALL_MODULES.map(mod => {
                const on = modules.includes(mod.id);
                return (
                  <button
                    key={mod.id}
                    onClick={() => toggleModule(mod.id)}
                    style={{
                      padding: "12px 14px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                      border: `1px solid ${on ? C.blue : C.border}`,
                      background: on ? C.blueBg : "#1a1d2e",
                      display: "flex", alignItems: "center", gap: 12,
                      transition: "all 0.15s", flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{mod.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: on ? C.blue : C.text }}>
                        {mod.label}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{mod.desc}</div>
                    </div>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      background: on ? C.blue : "transparent",
                      border: `2px solid ${on ? C.blue : C.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: 12, fontWeight: 900,
                      transition: "all 0.15s",
                    }}>{on ? "✓" : ""}</div>
                  </button>
                );
              })}
            </div>

            <div style={{
              marginTop: 14, padding: "10px 14px",
              background: "#1a1d2e", border: `1px solid ${C.border}`,
              borderRadius: 8, fontSize: 12, color: C.muted,
            }}>
              <strong style={{ color: C.text }}>{modules.length} modules selected.</strong> Dashboard is always included.
              You can also create custom tabs later from the dashboard.
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════
            STEP 4 — Done!
        ════════════════════════════════════════ */}
        {step === 4 && (
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 36, margin: "0 auto 24px",
              boxShadow: `0 0 40px ${C.blue}44`,
              animation: "pulse 2s infinite",
            }}>🚀</div>

            <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.5px" }}>
              {companyName} is ready to go!
            </h1>
            <p style={{ color: C.muted, fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
              Your workspace has been set up with {modules.length + 1} modules.<br />
              Your 14-day free trial starts now. No credit card needed.
            </p>

            {/* Summary card */}
            <div style={{
              background: "#1a1d2e", border: `1px solid ${C.border}`,
              borderRadius: 12, padding: "16px 20px", textAlign: "left", marginBottom: 28,
            }}>
              {[
                ["🏢 Company",  companyName],
                ["🏭 Industry", INDUSTRIES.find(i => i.id === industry)?.label || industry],
                ["👥 Team",     TEAM_SIZES.find(t => t.id === teamSize)?.label || teamSize],
                ["📦 Modules",  `${modules.length + 1} active (Dashboard always on)`],
                ["💳 Plan",     currentPlan ? `${currentPlan.name} — ${currentPlan.price > 0 ? `$${currentPlan.price}/mo` : "Custom"} (14 days free)` : "Starter"],
              ].map(([label, value]) => (
                <div key={label} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 0", borderBottom: `1px solid ${C.border}`,
                }}>
                  <span style={{ fontSize: 13, color: C.muted }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{value}</span>
                </div>
              ))}
            </div>

            {saveError && (
              <div style={{ background: "#2d1515", border: "1px solid #fc8181", borderRadius: 10, padding: "12px 18px", marginBottom: 16, color: "#fc8181", fontSize: 13 }}>
                ❌ {saveError}
              </div>
            )}
            <button onClick={() => void finish()} style={{ ...btnPrimary, width: "100%", fontSize: 16, padding: "15px" }}>
              Enter my workspace →
            </button>
            <p style={{ fontSize: 11, color: C.subtle, marginTop: 10 }}>
              You can change any of this in Settings at any time.
            </p>
          </div>
        )}

        {/* ── Navigation buttons ── */}
        {step < 4 && (
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginTop: 28, paddingTop: 24, borderTop: `1px solid ${C.border}`,
          }}>
            <button
              onClick={back}
              style={{ ...btnSecondary, visibility: step === 1 ? "hidden" : "visible" }}
            >← Back</button>

            <button onClick={next} style={btnPrimary}>
              {step === 3 ? "Review & Finish →" : "Continue →"}
            </button>
          </div>
        )}
      </div>

      {/* ── Footer note ── */}
      {step < 4 && (
        <p style={{ fontSize: 12, color: C.subtle, marginTop: 20 }}>
          Step {step} of {TOTAL_STEPS - 1} — Everything can be changed later in Settings
        </p>
      )}
    </div>
  );
}
