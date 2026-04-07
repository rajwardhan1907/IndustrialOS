"use client";
// app/portal/[workspaceId]/page.tsx
// Customer-facing portal — publicly accessible, no internal login required.
// URL: /portal/{workspaceId}
//
// Tabs: Home · Orders · Quotes · Invoices · Returns · New Request
// Customers can also pay invoices directly through this portal.

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────
type AuthView  = "signin" | "signup" | "access_code";
type PortalTab = "home" | "orders" | "quotes" | "invoices" | "returns" | "request";

interface Account { id: string; email: string; name: string; workspaceId: string }

interface Order   { id: string; sku: string; items: number; value: number; stage: string; source: string; createdAt: string }
interface Quote   { id: string; quoteNumber: string; subtotal: number; total: number; status: string; validUntil: string; createdAt: string }
interface Invoice { id: string; invoiceNumber: string; total: number; amountPaid: number; status: string; dueDate: string; issueDate: string; currency: string }
interface Return  { id: string; rmaNumber: string; sku: string; qty: number; reason: string; status: string; createdAt: string }

// ── Design tokens (standalone, no dependency on app theme) ────────────────────
const T = {
  bg:           "#f8fafc",
  surface:      "#ffffff",
  border:       "#e2e8f0",
  text:         "#0f172a",
  muted:        "#64748b",
  faint:        "#94a3b8",
  blue:         "#2563eb",
  blueBg:       "#eff6ff",
  blueBorder:   "#bfdbfe",
  green:        "#16a34a",
  greenBg:      "#f0fdf4",
  greenBorder:  "#bbf7d0",
  amber:        "#d97706",
  amberBg:      "#fffbeb",
  amberBorder:  "#fde68a",
  red:          "#dc2626",
  redBg:        "#fef2f2",
  redBorder:    "#fecaca",
  purple:       "#7c3aed",
  purpleBg:     "#f5f3ff",
  purpleBorder: "#ddd6fe",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt$    = (n: number, cur = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(n);
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const inp: React.CSSProperties = {
  width: "100%", padding: "11px 14px", fontSize: 14,
  border: `1px solid ${T.border}`, borderRadius: 8, outline: "none",
  background: T.surface, color: T.text, boxSizing: "border-box", fontFamily: "inherit",
};
const lbl: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 700, color: T.muted,
  marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em",
};
const card: React.CSSProperties = {
  background: T.surface, border: `1px solid ${T.border}`,
  borderRadius: 12, padding: "16px 20px",
};

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, color, background: bg, border: `1px solid ${border}` }}>
      {label}
    </span>
  );
}

function statusBadge(status: string) {
  const map: Record<string, [string,string,string]> = {
    placed:    [T.blue,   T.blueBg,   T.blueBorder],
    confirmed: [T.amber,  T.amberBg,  T.amberBorder],
    shipped:   [T.purple, T.purpleBg, T.purpleBorder],
    delivered: [T.green,  T.greenBg,  T.greenBorder],
    unpaid:    [T.red,    T.redBg,    T.redBorder],
    partial:   [T.amber,  T.amberBg,  T.amberBorder],
    paid:      [T.green,  T.greenBg,  T.greenBorder],
    draft:     [T.muted,  T.bg,       T.border],
    sent:      [T.blue,   T.blueBg,   T.blueBorder],
    accepted:  [T.green,  T.greenBg,  T.greenBorder],
    rejected:  [T.red,    T.redBg,    T.redBorder],
    requested: [T.blue,   T.blueBg,   T.blueBorder],
    approved:  [T.amber,  T.amberBg,  T.amberBorder],
    received:  [T.purple, T.purpleBg, T.purpleBorder],
    refunded:  [T.green,  T.greenBg,  T.greenBorder],
  };
  const [c,b,br] = map[status?.toLowerCase()] ?? [T.muted, T.bg, T.border];
  return <Badge label={status} color={c} bg={b} border={br} />;
}

// ── Payment Modal ─────────────────────────────────────────────────────────────
function PaymentModal({ invoice, token, onClose, onPaid }: {
  invoice: Invoice; token: string;
  onClose: () => void; onPaid: (inv: Invoice) => void;
}) {
  const due    = invoice.total - invoice.amountPaid;
  const [card, setCard]   = useState("");
  const [exp,  setExp]    = useState("");
  const [cvc,  setCvc]    = useState("");
  const [name, setName]   = useState("");
  const [busy, setBusy]   = useState(false);
  const [err,  setErr]    = useState("");

  const fmtCard = (v: string) => v.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim();
  const fmtExp  = (v: string) => { const d = v.replace(/\D/g,'').slice(0,4); return d.length > 2 ? d.slice(0,2)+'/'+d.slice(2) : d; };

  const pay = async () => {
    if (!name.trim()) { setErr("Name on card is required."); return; }
    if (card.replace(/\s/g,'').length < 16) { setErr("Enter a valid 16-digit card number."); return; }
    if (exp.length < 5) { setErr("Enter a valid expiry (MM/YY)."); return; }
    if (cvc.length < 3) { setErr("Enter a valid CVC."); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/portal/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ invoiceId: invoice.id, amount: due }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Payment failed."); return; }
      onPaid(data.invoice);
    } catch { setErr("Network error. Please try again."); }
    finally  { setBusy(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
      <div style={{ background: T.surface, borderRadius: 16, padding: 28, width: "100%", maxWidth: 420, boxShadow: "0 24px 60px rgba(0,0,0,0.18)" }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 4 }}>Pay Invoice</h2>
        <p style={{ fontSize: 13, color: T.muted, marginBottom: 20 }}>{invoice.invoiceNumber}</p>

        <div style={{ ...card, background: T.blueBg, border: `1px solid ${T.blueBorder}`, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: T.blue, fontWeight: 600 }}>Amount due</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: T.blue }}>{fmt$(due, invoice.currency)}</span>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Name on Card</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" style={inp} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Card Number</label>
          <input value={card} onChange={e => setCard(fmtCard(e.target.value))} placeholder="1234 5678 9012 3456" style={inp} maxLength={19} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={lbl}>Expiry</label>
            <input value={exp} onChange={e => setExp(fmtExp(e.target.value))} placeholder="MM/YY" style={inp} maxLength={5} />
          </div>
          <div>
            <label style={lbl}>CVC</label>
            <input value={cvc} onChange={e => setCvc(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="123" style={inp} maxLength={4} />
          </div>
        </div>

        {err && (
          <div style={{ marginBottom: 14, padding: "9px 12px", background: T.redBg, border: `1px solid ${T.redBorder}`, borderRadius: 8, fontSize: 13, color: T.red }}>
            {err}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={pay} disabled={busy} style={{ flex: 1, padding: "12px", borderRadius: 10, background: busy ? T.border : T.blue, border: "none", color: busy ? T.muted : "#fff", fontSize: 14, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer" }}>
            {busy ? "Processing…" : `Pay ${fmt$(due, invoice.currency)}`}
          </button>
          <button onClick={onClose} style={{ padding: "12px 18px", borderRadius: 10, background: T.bg, border: `1px solid ${T.border}`, color: T.muted, fontSize: 13, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
        <p style={{ marginTop: 12, fontSize: 11, color: T.faint, textAlign: "center" }}>
          🔒 Payments are processed securely. Your card details are never stored.
        </p>
      </div>
    </div>
  );
}

// ── New Return Modal ──────────────────────────────────────────────────────────
function NewReturnModal({ workspaceId, account, token, onClose, onSaved }: {
  workspaceId: string; account: Account; token: string;
  onClose: () => void; onSaved: (r: Return) => void;
}) {
  const REASONS: Record<string, string> = {
    damaged: "Item Arrived Damaged", wrong_item: "Wrong Item Sent",
    not_needed: "No Longer Needed", defective: "Defective / Not Working", other: "Other",
  };
  const [sku, setSku]     = useState("");
  const [qty, setQty]     = useState("1");
  const [reason, setReason] = useState("damaged");
  const [desc, setDesc]   = useState("");
  const [orderId, setOrderId] = useState("");
  const [busy, setBusy]   = useState(false);
  const [err,  setErr]    = useState("");

  const submit = async () => {
    if (!sku.trim()) { setErr("SKU / product code is required."); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/portal/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId, customer: account.name, customerEmail: account.email,
          orderId: orderId.trim(), sku: sku.trim(), qty: parseInt(qty)||1,
          reason, description: desc.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Failed to submit."); return; }
      // Fake a return record for optimistic UI
      onSaved({ id: data.rmaNumber, rmaNumber: data.rmaNumber, sku: sku.trim(), qty: parseInt(qty)||1, reason, status: "requested", createdAt: new Date().toISOString() });
    } catch { setErr("Network error."); }
    finally  { setBusy(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
      <div style={{ background: T.surface, borderRadius: 16, padding: 28, width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
        <h2 style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 20 }}>New Return Request</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
          <div style={{ marginBottom: 14, gridColumn: "1/-1" }}>
            <label style={lbl}>Order Number (optional)</label>
            <input value={orderId} onChange={e => setOrderId(e.target.value)} placeholder="e.g. ORD-2026-0042" style={inp} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Product SKU *</label>
            <input value={sku} onChange={e => setSku(e.target.value)} placeholder="e.g. STL-3MM" style={inp} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Quantity</label>
            <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} style={inp} />
          </div>
          <div style={{ marginBottom: 14, gridColumn: "1/-1" }}>
            <label style={lbl}>Reason</label>
            <select value={reason} onChange={e => setReason(e.target.value)} style={inp}>
              {Object.entries(REASONS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 14, gridColumn: "1/-1" }}>
            <label style={lbl}>Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Describe the issue…" rows={3} style={{ ...inp, resize: "vertical" }} />
          </div>
        </div>
        {err && <div style={{ marginBottom: 14, padding: "9px 12px", background: T.redBg, border: `1px solid ${T.redBorder}`, borderRadius: 8, fontSize: 13, color: T.red }}>{err}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={submit} disabled={busy} style={{ flex: 1, padding: "12px", borderRadius: 10, background: busy ? T.border : T.blue, border: "none", color: busy ? T.muted : "#fff", fontSize: 14, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer" }}>
            {busy ? "Submitting…" : "Submit Return"}
          </button>
          <button onClick={onClose} style={{ padding: "12px 18px", borderRadius: 10, background: T.bg, border: `1px solid ${T.border}`, color: T.muted, fontSize: 13, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── New Request (Quote Request) Modal ─────────────────────────────────────────
function NewRequestModal({ workspaceId, account, onClose, onSaved }: {
  workspaceId: string; account: Account;
  onClose: () => void; onSaved: () => void;
}) {
  const [sku,   setSku]   = useState("");
  const [qty,   setQty]   = useState("1");
  const [notes, setNotes] = useState("");
  const [busy,  setBusy]  = useState(false);
  const [err,   setErr]   = useState("");
  const [done,  setDone]  = useState(false);

  const submit = async () => {
    if (!sku.trim()) { setErr("Please describe what you need."); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId, customer: account.name,
          items: [{ sku: sku.trim(), qty: parseInt(qty)||1, description: notes }],
          subtotal: 0, discountAmt: 0, tax: 0, total: 0,
          validUntil: "", paymentTerms: "Net 30",
          notes: `Customer portal request — ${notes}`.trim(),
          status: "draft",
          prompt: `Requested by customer ${account.name} (${account.email}) via portal`,
        }),
      });
      if (!res.ok) { const d = await res.json(); setErr(d.error || "Failed."); return; }
      setDone(true);
    } catch { setErr("Network error."); }
    finally  { setBusy(false); }
  };

  if (done) return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
      <div style={{ background: T.surface, borderRadius: 16, padding: 28, width: "100%", maxWidth: 400, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <h2 style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 8 }}>Request Submitted!</h2>
        <p style={{ color: T.muted, fontSize: 14, marginBottom: 20 }}>We'll prepare a quote and get back to you shortly.</p>
        <button onClick={() => { onSaved(); onClose(); }} style={{ padding: "10px 24px", borderRadius: 10, background: T.blue, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          Done
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
      <div style={{ background: T.surface, borderRadius: 16, padding: 28, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
        <h2 style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 6 }}>New Order / Quote Request</h2>
        <p style={{ fontSize: 13, color: T.muted, marginBottom: 20 }}>Tell us what you need and we'll prepare a quote for you.</p>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Product / SKU *</label>
          <input value={sku} onChange={e => setSku(e.target.value)} placeholder="e.g. STL-3MM-HR, or describe what you need" style={inp} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Quantity</label>
          <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} style={{ ...inp, width: 120 }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Notes / Specifications</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any specific requirements, delivery details, etc." rows={3} style={{ ...inp, resize: "vertical" }} />
        </div>
        {err && <div style={{ marginBottom: 14, padding: "9px 12px", background: T.redBg, border: `1px solid ${T.redBorder}`, borderRadius: 8, fontSize: 13, color: T.red }}>{err}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={submit} disabled={busy} style={{ flex: 1, padding: "12px", borderRadius: 10, background: busy ? T.border : T.blue, border: "none", color: busy ? T.muted : "#fff", fontSize: 14, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer" }}>
            {busy ? "Submitting…" : "Send Request"}
          </button>
          <button onClick={onClose} style={{ padding: "12px 18px", borderRadius: 10, background: T.bg, border: `1px solid ${T.border}`, color: T.muted, fontSize: 13, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Auth Page ─────────────────────────────────────────────────────────────────
function AuthPage({ workspaceId, companyName, onAuth }: {
  workspaceId: string; companyName: string;
  onAuth: (token: string, account: Account) => void;
}) {
  const [view,     setView]     = useState<AuthView>("signin");
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [code,     setCode]     = useState("");   // access code (existing customers)
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState("");

  const switchView = (v: AuthView) => { setView(v); setError(""); };

  const submit = async () => {
    setError("");
    if (!email.trim() || !email.includes("@")) { setError("Enter a valid email."); return; }
    if (view === "signup") {
      if (!name.trim())         { setError("Your name is required."); return; }
      if (!password)            { setError("Password is required."); return; }
      if (password !== confirm) { setError("Passwords do not match."); return; }
      if (password.length < 6)  { setError("Password must be at least 6 characters."); return; }
    }
    if (view === "signin"      && !password) { setError("Password is required."); return; }
    if (view === "access_code" && !code.trim()) { setError("Access code is required."); return; }

    setBusy(true);
    try {
      const res = await fetch("/api/portal/auth", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: view, workspaceId, name, email, password, code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong."); return; }
      onAuth(data.token, data.account);
    } catch { setError("Network error. Please try again."); }
    finally  { setBusy(false); }
  };

  const viewLabel: Record<AuthView, string> = {
    signin:      "Sign In",
    signup:      "Create Account",
    access_code: "Use Access Code",
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🏭</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text, marginBottom: 4 }}>
            {companyName || "Customer Portal"}
          </h1>
          <p style={{ color: T.muted, fontSize: 14 }}>
            {view === "signup" ? "Create an account to access your customer portal."
             : view === "access_code" ? "Sign in using the access code provided by your supplier."
             : "Sign in to view your orders, invoices, and more."}
          </p>
        </div>

        <div style={{ background: T.surface, borderRadius: 16, border: `1px solid ${T.border}`, padding: "28px 30px", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
          {/* Tab toggle — 3 options */}
          <div style={{ display: "flex", background: T.bg, borderRadius: 10, padding: 4, marginBottom: 22, gap: 2 }}>
            {(["signin", "signup", "access_code"] as const).map(v => (
              <button key={v} onClick={() => switchView(v)} style={{
                flex: 1, padding: "7px 4px", borderRadius: 8, border: "none", cursor: "pointer",
                fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" as const,
                background: view === v ? T.surface : "transparent",
                color:      view === v ? T.text    : T.muted,
                boxShadow:  view === v ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              }}>
                {viewLabel[v]}
              </button>
            ))}
          </div>

          {/* Fields */}
          {view === "signup" && (
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Full Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" style={inp} />
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Email Address *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@company.com" style={inp} />
          </div>

          {(view === "signin" || view === "signup") && (
            <div style={{ marginBottom: view === "signup" ? 14 : 20 }}>
              <label style={lbl}>Password *</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inp}
                onKeyDown={e => e.key === "Enter" && submit()} />
            </div>
          )}

          {view === "signup" && (
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Confirm Password *</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" style={inp} />
            </div>
          )}

          {view === "access_code" && (
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Access Code *</label>
              <input
                value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABC123" style={{ ...inp, fontFamily: "monospace", letterSpacing: "0.1em" }}
                onKeyDown={e => e.key === "Enter" && submit()}
              />
              <p style={{ fontSize: 11, color: T.faint, marginTop: 6 }}>
                Your access code was provided by your supplier in a welcome email.
              </p>
            </div>
          )}

          {error && (
            <div style={{ marginBottom: 16, padding: "9px 12px", background: T.redBg, border: `1px solid ${T.redBorder}`, borderRadius: 8, fontSize: 13, color: T.red }}>
              {error}
            </div>
          )}

          <button onClick={submit} disabled={busy} style={{
            width: "100%", padding: "13px", borderRadius: 10, fontSize: 15, fontWeight: 700,
            cursor: busy ? "not-allowed" : "pointer",
            background: busy ? T.border : T.blue, border: "none",
            color: busy ? T.muted : "#fff",
          }}>
            {busy ? "Please wait…" : viewLabel[view]}
          </button>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: T.faint, marginTop: 16 }}>
          Don't have an account? Ask your supplier for access.
        </p>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ workspaceId, account, token, companyName, onSignOut }: {
  workspaceId: string; account: Account; token: string; companyName: string;
  onSignOut: () => void;
}) {
  const [tab,      setTab]      = useState<PortalTab>("home");
  const [orders,   setOrders]   = useState<Order[]>([]);
  const [quotes,   setQuotes]   = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [returns,  setReturns]  = useState<Return[]>([]);
  const [loading,  setLoading]  = useState<Record<string, boolean>>({});
  const [payInv,   setPayInv]   = useState<Invoice | null>(null);
  const [showReturn, setShowReturn] = useState(false);
  const [showRequest, setShowRequest] = useState(false);

  const authHdr = { Authorization: `Bearer ${token}` };

  const load = useCallback(async (t: PortalTab) => {
    if (t === "home") {
      // Load all for summary
      setLoading(p => ({ ...p, home: true }));
      const [o, q, i, r] = await Promise.all([
        fetch("/api/portal/orders",   { headers: authHdr }).then(x => x.json()),
        fetch("/api/portal/quotes",   { headers: authHdr }).then(x => x.json()),
        fetch("/api/portal/invoices", { headers: authHdr }).then(x => x.json()),
        fetch("/api/portal/returns",  { headers: authHdr }).then(x => x.json()),
      ]);
      if (Array.isArray(o)) setOrders(o);
      if (Array.isArray(q)) setQuotes(q);
      if (Array.isArray(i)) setInvoices(i);
      if (Array.isArray(r)) setReturns(r);
      setLoading(p => ({ ...p, home: false }));
    } else if (t === "orders") {
      setLoading(p => ({ ...p, orders: true }));
      const d = await fetch("/api/portal/orders", { headers: authHdr }).then(x => x.json());
      if (Array.isArray(d)) setOrders(d);
      setLoading(p => ({ ...p, orders: false }));
    } else if (t === "quotes") {
      setLoading(p => ({ ...p, quotes: true }));
      const d = await fetch("/api/portal/quotes", { headers: authHdr }).then(x => x.json());
      if (Array.isArray(d)) setQuotes(d);
      setLoading(p => ({ ...p, quotes: false }));
    } else if (t === "invoices") {
      setLoading(p => ({ ...p, invoices: true }));
      const d = await fetch("/api/portal/invoices", { headers: authHdr }).then(x => x.json());
      if (Array.isArray(d)) setInvoices(d);
      setLoading(p => ({ ...p, invoices: false }));
    } else if (t === "returns") {
      setLoading(p => ({ ...p, returns: true }));
      const d = await fetch("/api/portal/returns", { headers: authHdr }).then(x => x.json());
      if (Array.isArray(d)) setReturns(d);
      setLoading(p => ({ ...p, returns: false }));
    }
  }, [token]);

  useEffect(() => { load("home"); }, []);
  useEffect(() => { load(tab); }, [tab]);

  const acceptQuote = async (id: string) => {
    await fetch("/api/portal/quotes", {
      method: "PATCH",
      headers: { ...authHdr, "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "accepted" }),
    });
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, status: "accepted" } : q));
  };

  const rejectQuote = async (id: string) => {
    if (!confirm("Decline this quote?")) return;
    await fetch("/api/portal/quotes", {
      method: "PATCH",
      headers: { ...authHdr, "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "rejected" }),
    });
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, status: "rejected" } : q));
  };

  const TABS: { id: PortalTab; label: string; emoji: string }[] = [
    { id: "home",     label: "Home",        emoji: "🏠" },
    { id: "orders",   label: "Orders",      emoji: "📦" },
    { id: "quotes",   label: "Quotes",      emoji: "📋" },
    { id: "invoices", label: "Invoices",    emoji: "💳" },
    { id: "returns",  label: "Returns",     emoji: "↩️" },
    { id: "request",  label: "New Request", emoji: "✏️" },
  ];

  const unpaidTotal = invoices.filter(i => i.status !== "paid").reduce((s, i) => s + (i.total - i.amountPaid), 0);
  const openOrders  = orders.filter(o => !["delivered","cancelled"].includes(o.stage?.toLowerCase())).length;
  const pendingQuotes = quotes.filter(q => ["draft","sent"].includes(q.status?.toLowerCase())).length;

  return (
    <div style={{ minHeight: "100vh", background: T.bg }}>
      {payInv && (
        <PaymentModal invoice={payInv} token={token}
          onClose={() => setPayInv(null)}
          onPaid={updated => {
            setInvoices(prev => prev.map(i => i.id === updated.id ? updated : i));
            setPayInv(null);
          }} />
      )}
      {showReturn && (
        <NewReturnModal workspaceId={workspaceId} account={account} token={token}
          onClose={() => setShowReturn(false)}
          onSaved={r => { setReturns(prev => [r, ...prev]); setShowReturn(false); }} />
      )}
      {showRequest && (
        <NewRequestModal workspaceId={workspaceId} account={account}
          onClose={() => setShowRequest(false)}
          onSaved={() => load("quotes")} />
      )}

      {/* Top bar */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>🏭</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{companyName || "Customer Portal"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 13, color: T.muted }}>
            <strong style={{ color: T.text }}>{account.name}</strong>
          </span>
          <button onClick={onSignOut} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "0 24px", display: "flex", gap: 2, overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); if (t.id === "request") setShowRequest(true); }} style={{
            padding: "14px 16px", border: "none", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 600,
            color:        tab === t.id ? T.blue   : T.muted,
            borderBottom: tab === t.id ? `2px solid ${T.blue}` : "2px solid transparent",
            display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
          }}>
            <span>{t.emoji}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "28px 24px", maxWidth: 900, margin: "0 auto" }}>

        {/* ── HOME ────────────────────────────────────────────────────────── */}
        {tab === "home" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 4 }}>
              Welcome back, {account.name.split(" ")[0]} 👋
            </h2>
            <p style={{ color: T.muted, fontSize: 14, marginBottom: 24 }}>Here's a summary of your account.</p>

            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 28 }}>
              {[
                { label: "Open Orders",      value: openOrders,        emoji: "📦", color: T.blue,   bg: T.blueBg,   border: T.blueBorder   },
                { label: "Pending Quotes",   value: pendingQuotes,     emoji: "📋", color: T.amber,  bg: T.amberBg,  border: T.amberBorder  },
                { label: "Outstanding",      value: fmt$(unpaidTotal), emoji: "💳", color: T.red,    bg: T.redBg,    border: T.redBorder    },
              ].map((s, i) => (
                <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: "16px 18px" }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{s.emoji}</div>
                  <div style={{ fontSize: i === 2 ? 18 : 26, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <button onClick={() => setShowRequest(true)} style={{ ...card, textAlign: "left", cursor: "pointer", border: `1px solid ${T.blueBorder}`, background: T.blueBg }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>✏️</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.blue }}>Request a Quote</div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>Tell us what you need and we'll get back to you.</div>
              </button>
              <button onClick={() => setShowReturn(true)} style={{ ...card, textAlign: "left", cursor: "pointer" }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>↩️</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Submit a Return</div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>Request an RMA for a product return.</div>
              </button>
              <button onClick={() => setTab("invoices")} style={{ ...card, textAlign: "left", cursor: "pointer" }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>💳</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Pay an Invoice</div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>View and pay outstanding invoices.</div>
              </button>
              <button onClick={() => setTab("orders")} style={{ ...card, textAlign: "left", cursor: "pointer" }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>📦</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Track Orders</div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>View the status of your orders.</div>
              </button>
            </div>
          </div>
        )}

        {/* ── ORDERS ──────────────────────────────────────────────────────── */}
        {tab === "orders" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 20 }}>Your Orders</h2>
            {loading.orders ? <p style={{ color: T.muted }}>Loading…</p> : orders.length === 0 ? (
              <div style={{ ...card, textAlign: "center", padding: "40px 24px" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
                <p style={{ color: T.muted }}>No orders found.</p>
              </div>
            ) : (
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: T.bg, borderBottom: `1px solid ${T.border}` }}>
                      {["SKU", "Qty", "Value", "Status", "Date"].map(h => (
                        <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o, i) => (
                      <tr key={o.id} style={{ borderBottom: i < orders.length-1 ? `1px solid ${T.border}` : "none" }}>
                        <td style={{ padding: "12px 16px", fontFamily: "monospace", color: T.text, fontWeight: 600 }}>{o.sku}</td>
                        <td style={{ padding: "12px 16px", color: T.muted }}>{o.items}</td>
                        <td style={{ padding: "12px 16px", fontWeight: 700, color: T.text }}>{fmt$(o.value)}</td>
                        <td style={{ padding: "12px 16px" }}>{statusBadge(o.stage)}</td>
                        <td style={{ padding: "12px 16px", color: T.muted }}>{fmtDate(o.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── QUOTES ──────────────────────────────────────────────────────── */}
        {tab === "quotes" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Your Quotes</h2>
              <button onClick={() => setShowRequest(true)} style={{ padding: "8px 16px", borderRadius: 9, background: T.blue, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                + Request Quote
              </button>
            </div>
            {loading.quotes ? <p style={{ color: T.muted }}>Loading…</p> : quotes.length === 0 ? (
              <div style={{ ...card, textAlign: "center", padding: "40px 24px" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                <p style={{ color: T.muted, marginBottom: 16 }}>No quotes yet.</p>
                <button onClick={() => setShowRequest(true)} style={{ padding: "10px 22px", borderRadius: 9, background: T.blue, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Request Your First Quote
                </button>
              </div>
            ) : (
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: T.bg, borderBottom: `1px solid ${T.border}` }}>
                      {["Quote #", "Total", "Valid Until", "Status", "Actions"].map(h => (
                        <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map((q, i) => (
                      <tr key={q.id} style={{ borderBottom: i < quotes.length-1 ? `1px solid ${T.border}` : "none" }}>
                        <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 700, color: T.blue }}>{q.quoteNumber}</td>
                        <td style={{ padding: "12px 16px", fontWeight: 700, color: T.text }}>{fmt$(q.total)}</td>
                        <td style={{ padding: "12px 16px", color: T.muted }}>{q.validUntil || "—"}</td>
                        <td style={{ padding: "12px 16px" }}>{statusBadge(q.status)}</td>
                        <td style={{ padding: "12px 16px" }}>
                          {["draft","sent"].includes(q.status?.toLowerCase()) && (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => acceptQuote(q.id)} style={{ padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", background: T.greenBg, border: `1px solid ${T.greenBorder}`, color: T.green }}>
                                Accept
                              </button>
                              <button onClick={() => rejectQuote(q.id)} style={{ padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.red }}>
                                Decline
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── INVOICES ────────────────────────────────────────────────────── */}
        {tab === "invoices" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 20 }}>Your Invoices</h2>
            {loading.invoices ? <p style={{ color: T.muted }}>Loading…</p> : invoices.length === 0 ? (
              <div style={{ ...card, textAlign: "center", padding: "40px 24px" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
                <p style={{ color: T.muted }}>No invoices found.</p>
              </div>
            ) : (
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: T.bg, borderBottom: `1px solid ${T.border}` }}>
                      {["Invoice #", "Total", "Paid", "Balance", "Due Date", "Status", ""].map(h => (
                        <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv, i) => {
                      const balance = inv.total - inv.amountPaid;
                      return (
                        <tr key={inv.id} style={{ borderBottom: i < invoices.length-1 ? `1px solid ${T.border}` : "none" }}>
                          <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 700, color: T.blue }}>{inv.invoiceNumber}</td>
                          <td style={{ padding: "12px 16px", fontWeight: 700, color: T.text }}>{fmt$(inv.total, inv.currency)}</td>
                          <td style={{ padding: "12px 16px", color: T.green }}>{fmt$(inv.amountPaid, inv.currency)}</td>
                          <td style={{ padding: "12px 16px", fontWeight: 700, color: balance > 0 ? T.red : T.green }}>{fmt$(balance, inv.currency)}</td>
                          <td style={{ padding: "12px 16px", color: T.muted }}>{inv.dueDate || "—"}</td>
                          <td style={{ padding: "12px 16px" }}>{statusBadge(inv.status)}</td>
                          <td style={{ padding: "12px 16px" }}>
                            {inv.status !== "paid" && (
                              <button onClick={() => setPayInv(inv)} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", background: T.blue, border: "none", color: "#fff" }}>
                                Pay Now
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── RETURNS ─────────────────────────────────────────────────────── */}
        {tab === "returns" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Your Returns</h2>
              <button onClick={() => setShowReturn(true)} style={{ padding: "8px 16px", borderRadius: 9, background: T.blue, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                + New Return
              </button>
            </div>
            {loading.returns ? <p style={{ color: T.muted }}>Loading…</p> : returns.length === 0 ? (
              <div style={{ ...card, textAlign: "center", padding: "40px 24px" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>↩️</div>
                <p style={{ color: T.muted, marginBottom: 16 }}>No returns submitted yet.</p>
                <button onClick={() => setShowReturn(true)} style={{ padding: "10px 22px", borderRadius: 9, background: T.blue, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Submit a Return
                </button>
              </div>
            ) : (
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: T.bg, borderBottom: `1px solid ${T.border}` }}>
                      {["RMA #", "SKU", "Qty", "Reason", "Status", "Date"].map(h => (
                        <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {returns.map((r, i) => (
                      <tr key={r.id} style={{ borderBottom: i < returns.length-1 ? `1px solid ${T.border}` : "none" }}>
                        <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 700, color: T.blue }}>{r.rmaNumber}</td>
                        <td style={{ padding: "12px 16px", fontFamily: "monospace", color: T.muted }}>{r.sku}</td>
                        <td style={{ padding: "12px 16px", color: T.muted }}>{r.qty}</td>
                        <td style={{ padding: "12px 16px", color: T.muted, textTransform: "capitalize" }}>{r.reason?.replace(/_/g, " ")}</td>
                        <td style={{ padding: "12px 16px" }}>{statusBadge(r.status)}</td>
                        <td style={{ padding: "12px 16px", color: T.muted }}>{fmtDate(r.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ── Page shell ─────────────────────────────────────────────────────────────────
export default function CustomerPortal() {
  const params      = useParams();
  const workspaceId = (params?.workspaceId as string) ?? "";

  const [state,    setState]    = useState<"loading" | "auth" | "dashboard">("loading");
  const [account,  setAccount]  = useState<Account | null>(null);
  const [token,    setToken]    = useState("");
  const [companyName, setCompany] = useState("");

  const storageKey = `portal_token_${workspaceId}`;

  // Load workspace name
  useEffect(() => {
    if (!workspaceId) return;
    fetch(`/api/portal/returns?wid=${workspaceId}`)
      .then(r => r.json())
      .then(d => { if (d.name) setCompany(d.name); })
      .catch(() => {});
  }, [workspaceId]);

  // Check for saved session
  useEffect(() => {
    if (!workspaceId) { setState("auth"); return; }
    const saved = localStorage.getItem(storageKey);
    if (!saved) { setState("auth"); return; }
    fetch("/api/portal/me", { headers: { Authorization: `Bearer ${saved}` } })
      .then(r => r.json())
      .then(d => {
        if (d.id) { setToken(saved); setAccount(d); setState("dashboard"); }
        else { localStorage.removeItem(storageKey); setState("auth"); }
      })
      .catch(() => setState("auth"));
  }, [workspaceId]);

  const handleAuth = (t: string, acct: Account) => {
    localStorage.setItem(storageKey, t);
    setToken(t); setAccount(acct); setState("dashboard");
  };

  const handleSignOut = () => {
    fetch("/api/portal/auth", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    localStorage.removeItem(storageKey);
    setToken(""); setAccount(null); setState("auth");
  };

  if (state === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: T.muted, fontSize: 14 }}>Loading portal…</p>
      </div>
    );
  }

  if (state === "auth") {
    return <AuthPage workspaceId={workspaceId} companyName={companyName} onAuth={handleAuth} />;
  }

  return (
    <Dashboard
      workspaceId={workspaceId}
      account={account!}
      token={token}
      companyName={companyName}
      onSignOut={handleSignOut}
    />
  );
}
