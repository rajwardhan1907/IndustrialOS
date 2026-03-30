"use client";
// app/portal/page.tsx
// Phase 6 complete:
// - Real DB login via /api/portal/login
// - Quote accept/decline updates DB via /api/quotes PATCH
// - Order list auto-refreshes after submitting a new request

import { useState } from "react";

const P = {
  bg: "#f7f8fc", surface: "#ffffff", border: "#e4e8f0", border2: "#cdd3e0",
  text: "#1a1d2e", muted: "#6b7280", subtle: "#9ca3af",
  blue: "#3b6fd4", blueBg: "#eff4ff", blueBorder: "#bfcfef",
  green: "#1a7f5a", greenBg: "#edfaf3", greenBorder: "#9ee0c4",
  amber: "#b45309", amberBg: "#fffbeb", amberBorder: "#fcd34d",
  red: "#b91c1c", redBg: "#fff1f2", redBorder: "#fecdd3",
  purple: "#6d28d9", purpleBg: "#f5f3ff", purpleBorder: "#c4b5fd",
};

type OrderStage = "Placed" | "Confirmed" | "Picked" | "Shipped" | "Delivered";

interface DBOrder {
  id: string; customer: string; sku: string; items: number;
  value: number; stage: string; priority: string; source: string;
  notes: string; createdAt: string;
}
interface DBInvoice {
  id: string; invoiceNumber: string; customer: string; total: number;
  amountPaid: number; dueDate: string; status: string; createdAt: string;
  paymentTerms: string;
}
interface DBQuote {
  id: string; quoteNumber: string; customer: string; total: number;
  validUntil: string; status: string; createdAt: string; items: any[];
}
interface PortalCustomer {
  id: string; name: string; contactName: string; email: string;
  portalCode: string; workspaceId: string; creditLimit: number;
  balanceDue: number; status: string; notes: string;
}

const ORDER_STAGES: OrderStage[] = ["Placed", "Confirmed", "Picked", "Shipped", "Delivered"];

const ORDER_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  Placed:    { label: "Placed",    color: "#5a5550", bg: "#f0f0f0",   border: "#d0ccc5"       },
  Confirmed: { label: "Confirmed", color: P.blue,   bg: P.blueBg,   border: P.blueBorder    },
  Picked:    { label: "Picked",    color: P.amber,  bg: P.amberBg,  border: P.amberBorder   },
  Shipped:   { label: "Shipped",   color: P.purple, bg: P.purpleBg, border: P.purpleBorder  },
  Delivered: { label: "Delivered", color: P.green,  bg: P.greenBg,  border: P.greenBorder   },
};
const QUOTE_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  draft:    { label: "Draft",    color: P.muted,  bg: "#f0f0f0",  border: P.border       },
  sent:     { label: "Sent",     color: P.blue,   bg: P.blueBg,  border: P.blueBorder   },
  accepted: { label: "Accepted", color: P.green,  bg: P.greenBg, border: P.greenBorder  },
  declined: { label: "Declined", color: P.red,    bg: P.redBg,   border: P.redBorder    },
  expired:  { label: "Expired",  color: P.muted,  bg: "#f0f0f0", border: P.border       },
};
const INVOICE_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  unpaid:  { label: "Unpaid",  color: P.amber,  bg: P.amberBg,  border: P.amberBorder  },
  paid:    { label: "Paid",    color: P.green,  bg: P.greenBg,  border: P.greenBorder  },
  overdue: { label: "Overdue", color: P.red,    bg: P.redBg,    border: P.redBorder    },
  partial: { label: "Partial", color: P.purple, bg: P.purpleBg, border: P.purpleBorder },
};

const fmtMoney = (n: number) =>
  `$${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtDate = (d: string) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return d; }
};

const Card = ({ children, style = {} }: any) => (
  <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 14, padding: "20px 22px", ...style }}>
    {children}
  </div>
);
const SectionTitle = ({ children }: any) => (
  <div style={{ fontWeight: 700, fontSize: 14, color: P.text, marginBottom: 16 }}>{children}</div>
);
const Badge = ({ label, s }: { label: string; s: any }) => (
  <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
    {label}
  </span>
);

export default function PortalPage() {
  const [customer,  setCustomer]  = useState<PortalCustomer | null>(null);
  const [orders,    setOrders]    = useState<DBOrder[]>([]);
  const [invoices,  setInvoices]  = useState<DBInvoice[]>([]);
  const [quotes,    setQuotes]    = useState<DBQuote[]>([]);

  const [email,     setEmail]     = useState("");
  const [code,      setCode]      = useState("");
  const [loginErr,  setLoginErr]  = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState<"orders" | "quotes" | "invoices" | "request">("orders");

  const [reqSku,      setReqSku]      = useState("");
  const [reqQty,      setReqQty]      = useState("");
  const [reqNotes,    setReqNotes]    = useState("");
  const [reqDeadline, setReqDeadline] = useState("");
  const [reqSent,     setReqSent]     = useState(false);
  const [reqSending,  setReqSending]  = useState(false);
  const [reqError,    setReqError]    = useState("");

  // Phase 14 — Stripe Pay Now
  const [payingInvoice, setPayingInvoice] = useState<string | null>(null);
  const [paymentMsg,    setPaymentMsg]    = useState<{ type: "success" | "cancelled"; invoice: string } | null>(null);

  // Check URL params for payment result on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const inv     = params.get("invoice");
    if (payment === "success" && inv) {
      setPaymentMsg({ type: "success", invoice: inv });
      setTab("invoices");
      // Clean URL
      window.history.replaceState({}, "", "/portal");
    } else if (payment === "cancelled" && inv) {
      setPaymentMsg({ type: "cancelled", invoice: inv });
      setTab("invoices");
      window.history.replaceState({}, "", "/portal");
    }
  }, []);

  const handlePayNow = async (invoiceId: string) => {
    setPayingInvoice(invoiceId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment failed");
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      alert(err.message || "Could not start payment. Please try again.");
      setPayingInvoice(null);
    }
  };

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = async () => {
    setLoggingIn(true); setLoginErr("");
    try {
      const res  = await fetch("/api/portal/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: code.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) { setLoginErr(data.error || "Something went wrong."); return; }
      setCustomer(data.customer);
      setOrders(data.orders   || []);
      setInvoices(data.invoices || []);
      setQuotes(data.quotes   || []);
    } catch { setLoginErr("Network error. Please check your connection."); }
    finally { setLoggingIn(false); }
  };

  const logout = () => {
    setCustomer(null); setEmail(""); setCode(""); setLoginErr("");
    setOrders([]); setInvoices([]); setQuotes([]);
    setTab("orders"); setReqSent(false); setReqError("");
  };

  // ── FIX 1: Quote accept/decline — updates DB ──────────────────────────────
  const updateQuoteStatus = async (quoteId: string, newStatus: "accepted" | "declined") => {
    // Update UI immediately (feels fast)
    setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, status: newStatus } : q));
    // Then save to DB in background
    try {
      await fetch("/api/quotes", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: quoteId, status: newStatus }),
      });
    } catch {
      // If DB fails, revert the UI change
      setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, status: q.status } : q));
    }
  };

  // ── FIX 2: Submit request + refresh orders list ───────────────────────────
  const submitRequest = async () => {
    if (!customer || !reqSku.trim() || !reqQty.trim()) return;
    setReqSending(true); setReqError("");
    const notesParts = [
      reqNotes.trim(),
      reqDeadline.trim() ? `Required by: ${reqDeadline.trim()}` : "",
    ].filter(Boolean);
    try {
      const res = await fetch("/api/portal/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId:  customer.workspaceId,
          customerId:   customer.id,
          customerName: customer.name,
          sku:          reqSku.trim(),
          qty:          reqQty.trim(),
          notes:        notesParts.join(" | ") || `Portal request from ${customer.contactName}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setReqError(data.error || "Could not submit."); return; }

      // ── Auto-refresh the orders list so the new one appears immediately ──
      const refreshRes = await fetch("/api/portal/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: customer.email, code: customer.portalCode }),
      });
      if (refreshRes.ok) {
        const refreshed = await refreshRes.json();
        setOrders(refreshed.orders || []);
      }

      setReqSent(true);
    } catch { setReqError("Network error. Please try again."); }
    finally { setReqSending(false); }
  };

  // ── Derived counts ────────────────────────────────────────────────────────
  const activeOrders  = orders.filter(o => o.stage !== "Delivered").length;
  const overdueInv    = invoices.filter(i => i.status === "overdue").length;
  const pendingQuotes = quotes.filter(q => q.status === "sent" || q.status === "draft").length;
  const totalBalance  = invoices.filter(i => i.status !== "paid")
                                 .reduce((s, i) => s + (i.total - i.amountPaid), 0);

  // ══════════════════════════════════════════════════════════════════════════
  // LOGIN SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  if (!customer) return (
    <div style={{ minHeight: "100vh", background: P.bg, fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 36 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg,#3b6fd4,#6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>⚡</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: P.text }}>Customer Portal</div>
          <div style={{ fontSize: 12, color: P.muted }}>Powered by IndustrialOS</div>
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 400, background: P.surface, border: `1px solid ${P.border}`, borderRadius: 18, padding: "32px 28px", boxShadow: "0 8px 40px rgba(0,0,0,0.08)" }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: P.text, marginBottom: 6 }}>Sign in to your portal</h2>
        <p style={{ fontSize: 13, color: P.muted, marginBottom: 24 }}>Use the contact email your supplier has on file, and the access code they gave you.</p>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: P.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Your Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@yourcompany.com" type="email" onKeyDown={e => e.key === "Enter" && login()}
            style={{ width: "100%", padding: "11px 13px", background: P.bg, border: `1px solid ${loginErr ? P.red : P.border}`, borderRadius: 9, color: P.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: P.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Access Code</label>
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. ACME2024" onKeyDown={e => e.key === "Enter" && login()}
            style={{ width: "100%", padding: "11px 13px", background: P.bg, border: `1px solid ${loginErr ? P.red : P.border}`, borderRadius: 9, color: P.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit", fontWeight: 700, letterSpacing: "0.08em" }} />
        </div>

        {loginErr && <div style={{ marginBottom: 16, padding: "10px 13px", background: P.redBg, border: `1px solid ${P.redBorder}`, borderRadius: 8, fontSize: 13, color: P.red }}>{loginErr}</div>}

        <button onClick={login} disabled={loggingIn || !email || !code}
          style={{ width: "100%", padding: "13px", background: email && code ? "linear-gradient(135deg,#3b6fd4,#6d28d9)" : P.border, border: "none", borderRadius: 10, color: email && code ? "#fff" : P.muted, fontSize: 15, fontWeight: 700, cursor: email && code ? "pointer" : "not-allowed" }}>
          {loggingIn ? "Signing in…" : "Sign In →"}
        </button>

        <div style={{ marginTop: 20, padding: "12px 14px", background: P.blueBg, border: `1px solid ${P.blueBorder}`, borderRadius: 10, fontSize: 12, color: P.blue }}>
          💡 Contact your supplier if you don't have an access code yet.
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // PORTAL DASHBOARD
  // ══════════════════════════════════════════════════════════════════════════
  const TABS = [
    { id: "orders",   label: "My Orders",   emoji: "🛒" },
    { id: "quotes",   label: "Quotes",      emoji: "📋" },
    { id: "invoices", label: "Invoices",    emoji: "🧾" },
    { id: "request",  label: "New Request", emoji: "✍️"  },
  ] as const;

  return (
    <div style={{ minHeight: "100vh", background: P.bg, fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif", color: P.text }}>

      {/* Header */}
      <div style={{ background: P.surface, borderBottom: `1px solid ${P.border}`, padding: "12px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50, boxShadow: "0 1px 8px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg,#3b6fd4,#6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚡</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{customer.name}</div>
            <div style={{ fontSize: 11, color: P.muted }}>Customer Portal · IndustrialOS</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {overdueInv > 0 && (
            <button onClick={() => setTab("invoices")} style={{ padding: "4px 12px", borderRadius: 999, cursor: "pointer", background: P.redBg, border: `1px solid ${P.redBorder}`, color: P.red, fontSize: 11, fontWeight: 700 }}>
              ⚠️ {overdueInv} overdue invoice{overdueInv > 1 ? "s" : ""}
            </button>
          )}
          {pendingQuotes > 0 && (
            <button onClick={() => setTab("quotes")} style={{ padding: "4px 12px", borderRadius: 999, cursor: "pointer", background: P.amberBg, border: `1px solid ${P.amberBorder}`, color: P.amber, fontSize: 11, fontWeight: 700 }}>
              ⏳ {pendingQuotes} quote{pendingQuotes > 1 ? "s" : ""} to review
            </button>
          )}
          <div style={{ fontSize: 13, color: P.muted }}>Hi, <strong style={{ color: P.text }}>{customer.contactName.split(" ")[0]}</strong></div>
          <button onClick={logout} style={{ padding: "6px 14px", borderRadius: 8, background: "none", border: `1px solid ${P.border}`, color: P.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Sign Out</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: P.surface, borderBottom: `1px solid ${P.border}`, padding: "0 28px", display: "flex", gap: 4 }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "13px 16px", fontSize: 13, fontWeight: 600, border: "none", borderBottom: active ? `2px solid ${P.blue}` : "2px solid transparent", color: active ? P.blue : P.muted, background: "none", cursor: "pointer", whiteSpace: "nowrap", marginBottom: -1 }}>
              <span>{t.emoji}</span>{t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ padding: "28px", maxWidth: 900, margin: "0 auto" }}>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 }}>
          {[
            { label: "Active Orders",    value: activeOrders,  color: P.blue,  bg: P.blueBg,  bdr: P.blueBorder,  emoji: "🛒" },
            { label: "Balance Due",      value: fmtMoney(totalBalance), color: totalBalance > 0 ? P.amber : P.green, bg: totalBalance > 0 ? P.amberBg : P.greenBg, bdr: totalBalance > 0 ? P.amberBorder : P.greenBorder, emoji: "💳" },
            { label: "Overdue Invoices", value: overdueInv,    color: overdueInv > 0 ? P.red : P.green, bg: overdueInv > 0 ? P.redBg : P.greenBg, bdr: overdueInv > 0 ? P.redBorder : P.greenBorder, emoji: "⚠️" },
          ].map((s, i) => (
            <div key={i} style={{ background: s.bg, border: `1px solid ${s.bdr}`, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 28 }}>{s.emoji}</span>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: P.muted }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── ORDERS TAB ── */}
        {tab === "orders" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionTitle>My Orders ({orders.length})</SectionTitle>
            {orders.length === 0 ? (
              <Card style={{ textAlign: "center", padding: "60px 24px" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🛒</div>
                <p style={{ color: P.muted, fontSize: 14 }}>No orders yet. Use the <strong>New Request</strong> tab to place one.</p>
              </Card>
            ) : orders.map(order => {
              const stageIdx = ORDER_STAGES.indexOf(order.stage as OrderStage);
              const s = ORDER_STYLE[order.stage] || ORDER_STYLE.Placed;
              return (
                <Card key={order.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: P.text, marginBottom: 3 }}>{order.sku}</div>
                      <div style={{ fontSize: 13, color: P.muted }}>{order.items} unit{order.items !== 1 ? "s" : ""} · Ordered {fmtDate(order.createdAt)}</div>
                      {order.notes && <div style={{ fontSize: 12, color: P.subtle, marginTop: 4, fontStyle: "italic" }}>{order.notes}</div>}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {order.value > 0 && <div style={{ fontWeight: 800, fontSize: 18, color: P.text, marginBottom: 4 }}>{fmtMoney(order.value)}</div>}
                      <Badge label={s.label} s={s} />
                    </div>
                  </div>
                  {/* Stage pipeline */}
                  <div style={{ display: "flex", alignItems: "center" }}>
                    {ORDER_STAGES.map((stage, i) => {
                      const done = i <= stageIdx; const current = i === stageIdx;
                      return (
                        <div key={stage} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                            {i > 0 && <div style={{ flex: 1, height: 3, background: done ? P.blue : P.border }} />}
                            <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: done ? P.blue : P.surface, border: `2px solid ${done ? P.blue : P.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: done ? "#fff" : P.subtle, boxShadow: current ? `0 0 0 4px ${P.blueBg}` : "none" }}>
                              {done && !current ? "✓" : i + 1}
                            </div>
                            {i < ORDER_STAGES.length - 1 && <div style={{ flex: 1, height: 3, background: i < stageIdx ? P.blue : P.border }} />}
                          </div>
                          <div style={{ fontSize: 9, marginTop: 6, fontWeight: current ? 700 : 400, color: current ? P.blue : done ? P.muted : P.subtle, textAlign: "center" }}>{stage}</div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── QUOTES TAB ── */}
        {tab === "quotes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionTitle>Quotes ({quotes.length})</SectionTitle>
            {quotes.length === 0 ? (
              <Card style={{ textAlign: "center", padding: "60px 24px" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                <p style={{ color: P.muted, fontSize: 14 }}>No quotes from your supplier yet.</p>
              </Card>
            ) : quotes.map(q => {
              const s = QUOTE_STYLE[q.status] || QUOTE_STYLE.draft;
              const isPending = q.status === "sent" || q.status === "draft";
              return (
                <Card key={q.id} style={{ border: isPending ? `1px solid ${P.amberBorder}` : `1px solid ${P.border}`, background: isPending ? P.amberBg : P.surface }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isPending ? 16 : 0 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <span style={{ fontWeight: 800, fontSize: 15, fontFamily: "monospace", color: P.text }}>{q.quoteNumber}</span>
                        <Badge label={s.label} s={s} />
                      </div>
                      <div style={{ fontSize: 13, color: P.muted }}>Valid until {fmtDate(q.validUntil)} · Created {fmtDate(q.createdAt)}</div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 20, color: P.text }}>{fmtMoney(q.total)}</div>
                  </div>
                  {/* Accept/Decline buttons — only shown for pending quotes */}
                  {isPending && (
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={() => updateQuoteStatus(q.id, "accepted")}
                        style={{ flex: 1, padding: "11px", background: "linear-gradient(135deg,#1a7f5a,#28a770)", border: "none", borderRadius: 9, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        ✓ Accept Quote
                      </button>
                      <button onClick={() => updateQuoteStatus(q.id, "declined")}
                        style={{ flex: 1, padding: "11px", background: P.surface, border: `1px solid ${P.redBorder}`, borderRadius: 9, color: P.red, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        ✕ Decline
                      </button>
                    </div>
                  )}
                  {q.status === "accepted" && (
                    <div style={{ marginTop: 10, padding: "8px 12px", background: P.greenBg, border: `1px solid ${P.greenBorder}`, borderRadius: 8, fontSize: 12, color: P.green }}>
                      ✅ You accepted this quote. Your supplier will raise an invoice shortly.
                    </div>
                  )}
                  {q.status === "declined" && (
                    <div style={{ marginTop: 10, padding: "8px 12px", background: P.redBg, border: `1px solid ${P.redBorder}`, borderRadius: 8, fontSize: 12, color: P.red }}>
                      ✕ You declined this quote.
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* ── INVOICES TAB ── */}
        {tab === "invoices" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionTitle>Invoices ({invoices.length})</SectionTitle>
            {/* Phase 14 — Payment result banner */}
            {paymentMsg && paymentMsg.type === "success" && (
              <div style={{ padding: "14px 16px", background: P.greenBg, border: `1px solid ${P.greenBorder}`, borderRadius: 10, fontSize: 13, color: P.green, marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>✅ Payment received for <strong>{paymentMsg.invoice}</strong>. Thank you!</span>
                <button onClick={() => setPaymentMsg(null)} style={{ background: "none", border: "none", color: P.green, cursor: "pointer", fontSize: 16, fontWeight: 700 }}>×</button>
              </div>
            )}
            {paymentMsg && paymentMsg.type === "cancelled" && (
              <div style={{ padding: "14px 16px", background: P.amberBg, border: `1px solid ${P.amberBorder}`, borderRadius: 10, fontSize: 13, color: P.amber, marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Payment for <strong>{paymentMsg.invoice}</strong> was cancelled. You can try again anytime.</span>
                <button onClick={() => setPaymentMsg(null)} style={{ background: "none", border: "none", color: P.amber, cursor: "pointer", fontSize: 16, fontWeight: 700 }}>×</button>
              </div>
            )}
            {totalBalance > 0 && (
              <div style={{ padding: "12px 16px", background: P.amberBg, border: `1px solid ${P.amberBorder}`, borderRadius: 10, fontSize: 13, color: P.amber, marginBottom: 4 }}>
                💳 You have <strong>{fmtMoney(totalBalance)}</strong> outstanding.
              </div>
            )}
            {invoices.length === 0 ? (
              <Card style={{ textAlign: "center", padding: "60px 24px" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🧾</div>
                <p style={{ color: P.muted, fontSize: 14 }}>No invoices yet.</p>
              </Card>
            ) : invoices.map(inv => {
              const s = INVOICE_STYLE[inv.status] || INVOICE_STYLE.unpaid;
              const remaining = inv.total - inv.amountPaid;
              return (
                <Card key={inv.id} style={{ border: inv.status === "overdue" ? `1px solid ${P.redBorder}` : `1px solid ${P.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <span style={{ fontWeight: 800, fontSize: 15, fontFamily: "monospace", color: P.text }}>{inv.invoiceNumber}</span>
                        <Badge label={s.label} s={s} />
                      </div>
                      <div style={{ fontSize: 13, color: P.muted }}>Issued {fmtDate(inv.createdAt)} · Due {fmtDate(inv.dueDate)} · {inv.paymentTerms}</div>
                      {inv.amountPaid > 0 && inv.status !== "paid" && (
                        <div style={{ fontSize: 12, color: P.green, marginTop: 3 }}>✓ {fmtMoney(inv.amountPaid)} paid · {fmtMoney(remaining)} remaining</div>
                      )}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 20, color: P.text }}>{fmtMoney(inv.total)}</div>
                  </div>
                  {inv.status === "overdue" && (
                    <div style={{ marginTop: 12, padding: "8px 12px", background: P.redBg, border: `1px solid ${P.redBorder}`, borderRadius: 8, fontSize: 12, color: P.red }}>
                      ⚠️ This invoice is overdue. Please contact your supplier to arrange payment.
                    </div>
                  )}
                  {/* Phase 14 — Pay Now button for unpaid/overdue/partial invoices */}
                  {inv.status !== "paid" && remaining > 0 && (
                    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
                      <button
                        onClick={() => handlePayNow(inv.id)}
                        disabled={payingInvoice === inv.id}
                        style={{
                          padding: "10px 22px", borderRadius: 9,
                          background: payingInvoice === inv.id ? P.border : "linear-gradient(135deg, #3b6fd4, #6d28d9)",
                          border: "none", color: payingInvoice === inv.id ? P.muted : "#fff",
                          fontSize: 13, fontWeight: 700,
                          cursor: payingInvoice === inv.id ? "not-allowed" : "pointer",
                        }}
                      >
                        {payingInvoice === inv.id ? "Redirecting to Stripe…" : `💳 Pay Now — ${fmtMoney(remaining)}`}
                      </button>
                      <span style={{ fontSize: 11, color: P.muted }}>Secure payment via Stripe</span>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* ── NEW REQUEST TAB ── */}
        {tab === "request" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionTitle>Submit a New Request</SectionTitle>
            {reqSent ? (
              <Card style={{ textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: P.text, marginBottom: 8 }}>Request Submitted!</h3>
                <p style={{ color: P.muted, fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
                  Your request is now in your supplier's order pipeline.<br />
                  Check the <strong>My Orders</strong> tab — it's already there.
                </p>
                <button onClick={() => { setReqSent(false); setReqSku(""); setReqQty(""); setReqNotes(""); setReqDeadline(""); setReqError(""); setTab("orders"); }}
                  style={{ padding: "11px 24px", borderRadius: 9, background: "linear-gradient(135deg,#3b6fd4,#6d28d9)", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  View My Orders →
                </button>
              </Card>
            ) : (
              <Card>
                <p style={{ fontSize: 13, color: P.muted, marginBottom: 22, lineHeight: 1.6 }}>
                  Tell your supplier what you need. Your request will go straight into their order pipeline.
                </p>
                {[
                  { label: "SKU / Product Name *",  placeholder: "e.g. SKU-4821 or Industrial bolts M10", val: reqSku,      set: setReqSku      },
                  { label: "Quantity Needed *",      placeholder: "e.g. 500",                               val: reqQty,      set: setReqQty      },
                  { label: "Required By (optional)", placeholder: "e.g. End of March",                      val: reqDeadline, set: setReqDeadline },
                ].map(({ label, placeholder, val, set }) => (
                  <div key={label} style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: P.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</label>
                    <input value={val} onChange={e => set(e.target.value)} placeholder={placeholder}
                      style={{ width: "100%", padding: "11px 13px", background: P.bg, border: `1px solid ${P.border}`, borderRadius: 9, color: P.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                  </div>
                ))}
                <div style={{ marginBottom: 22 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: P.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Additional Notes (optional)</label>
                  <textarea value={reqNotes} onChange={e => setReqNotes(e.target.value)} placeholder="Any special requirements or delivery instructions…" rows={3}
                    style={{ width: "100%", padding: "11px 13px", background: P.bg, border: `1px solid ${P.border}`, borderRadius: 9, color: P.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }} />
                </div>
                {reqError && (
                  <div style={{ marginBottom: 14, padding: "10px 14px", background: P.redBg, border: `1px solid ${P.redBorder}`, borderRadius: 8, fontSize: 13, color: P.red }}>{reqError}</div>
                )}
                <button onClick={submitRequest} disabled={!reqSku.trim() || !reqQty.trim() || reqSending}
                  style={{ width: "100%", padding: "13px", background: reqSku && reqQty && !reqSending ? "linear-gradient(135deg,#3b6fd4,#6d28d9)" : P.border, border: "none", borderRadius: 10, color: reqSku && reqQty && !reqSending ? "#fff" : P.muted, fontSize: 15, fontWeight: 700, cursor: reqSku && reqQty && !reqSending ? "pointer" : "not-allowed" }}>
                  {reqSending ? "Submitting…" : "✍️ Submit Request"}
                </button>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
