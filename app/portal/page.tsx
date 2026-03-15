"use client";
// app/portal/page.tsx
// Customer Portal — customers log in with email + access code.
// "New Request" form now writes directly to the shared orders store (lib/orders.ts)
// so requests appear instantly in the main app's Orders tab.

import { useState, useEffect } from "react";
import { addOrder, makeOrderId } from "@/lib/orders";

// ── Colour palette ────────────────────────────────────────────────────────────
const P = {
  bg:          "#f7f8fc",
  surface:     "#ffffff",
  border:      "#e4e8f0",
  border2:     "#cdd3e0",
  text:        "#1a1d2e",
  muted:       "#6b7280",
  subtle:      "#9ca3af",
  blue:        "#3b6fd4",
  blueBg:      "#eff4ff",
  blueBorder:  "#bfcfef",
  green:       "#1a7f5a",
  greenBg:     "#edfaf3",
  greenBorder: "#9ee0c4",
  amber:       "#b45309",
  amberBg:     "#fffbeb",
  amberBorder: "#fcd34d",
  red:         "#b91c1c",
  redBg:       "#fff1f2",
  redBorder:   "#fecdd3",
  purple:      "#6d28d9",
  purpleBg:    "#f5f3ff",
  purpleBorder:"#c4b5fd",
};

// ── Types ─────────────────────────────────────────────────────────────────────
type OrderStatus   = "Placed" | "Confirmed" | "Picked" | "Shipped" | "Delivered";
type QuoteStatus   = "pending" | "accepted" | "declined" | "expired";
type InvoiceStatus = "unpaid" | "paid" | "overdue" | "partial";

interface PortalOrder   { id: string; sku: string; items: number; value: number; status: OrderStatus; date: string; eta: string; }
interface PortalQuote   { id: string; quoteNumber: string; items: number; value: number; status: QuoteStatus; validUntil: string; date: string; }
interface PortalInvoice { id: string; invoiceNumber: string; value: number; status: InvoiceStatus; due: string; date: string; }

// ── Demo customers ────────────────────────────────────────────────────────────
const DEMO_CUSTOMERS: Record<string, {
  name: string; company: string; code: string;
  orders: PortalOrder[]; quotes: PortalQuote[]; invoices: PortalInvoice[];
}> = {
  "buyer@acmecorp.com": {
    name: "James Hartley", company: "Acme Corp", code: "ACME2024",
    orders: [
      { id:"o1", sku:"SKU-4821", items:6, value:24300, status:"Shipped",   date:"Mar 5, 2026",  eta:"Mar 14, 2026" },
      { id:"o2", sku:"SKU-7753", items:2, value:8750,  status:"Confirmed", date:"Mar 10, 2026", eta:"Mar 20, 2026" },
      { id:"o3", sku:"SKU-3318", items:4, value:15200, status:"Delivered", date:"Feb 20, 2026", eta:"Delivered"    },
    ],
    quotes: [
      { id:"q1", quoteNumber:"QT-2026-1042", items:3, value:31500, status:"pending",  validUntil:"Mar 25, 2026", date:"Mar 8, 2026"  },
      { id:"q2", quoteNumber:"QT-2026-0891", items:1, value:9200,  status:"accepted", validUntil:"Mar 1, 2026",  date:"Feb 15, 2026" },
      { id:"q3", quoteNumber:"QT-2026-0744", items:2, value:18400, status:"expired",  validUntil:"Feb 10, 2026", date:"Jan 28, 2026" },
    ],
    invoices: [
      { id:"i1", invoiceNumber:"INV-2026-0312", value:24300, status:"unpaid",  due:"Apr 4, 2026",  date:"Mar 5, 2026"  },
      { id:"i2", invoiceNumber:"INV-2026-0201", value:15200, status:"paid",    due:"Mar 22, 2026", date:"Feb 20, 2026" },
      { id:"i3", invoiceNumber:"INV-2026-0188", value:18400, status:"overdue", due:"Mar 1, 2026",  date:"Jan 30, 2026" },
    ],
  },
  "purchasing@techwave.com": {
    name: "Sarah Chen", company: "TechWave Ltd", code: "TECH2024",
    orders: [
      { id:"o4", sku:"SKU-9034", items:3, value:12600, status:"Placed",    date:"Mar 11, 2026", eta:"Mar 22, 2026" },
      { id:"o5", sku:"SKU-2210", items:8, value:44800, status:"Delivered", date:"Mar 1, 2026",  eta:"Delivered"    },
    ],
    quotes: [
      { id:"q4", quoteNumber:"QT-2026-1055", items:5, value:67200, status:"pending", validUntil:"Mar 30, 2026", date:"Mar 10, 2026" },
    ],
    invoices: [
      { id:"i4", invoiceNumber:"INV-2026-0298", value:44800, status:"partial", due:"Mar 31, 2026", date:"Mar 1, 2026" },
    ],
  },
};

// ── Order stage pipeline ──────────────────────────────────────────────────────
const ORDER_STAGES: OrderStatus[] = ["Placed","Confirmed","Picked","Shipped","Delivered"];

// ── Status styles ─────────────────────────────────────────────────────────────
const ORDER_STATUS_STYLE: Record<OrderStatus, { label:string; color:string; bg:string; border:string }> = {
  Placed:    { label:"Placed",    color:"#5a5550", bg:"#f0f0f0",  border:"#d0ccc5"     },
  Confirmed: { label:"Confirmed", color:P.blue,   bg:P.blueBg,  border:P.blueBorder  },
  Picked:    { label:"Picked",    color:P.amber,  bg:P.amberBg, border:P.amberBorder },
  Shipped:   { label:"Shipped",   color:P.purple, bg:P.purpleBg,border:P.purpleBorder},
  Delivered: { label:"Delivered", color:P.green,  bg:P.greenBg, border:P.greenBorder },
};
const QUOTE_STATUS_STYLE: Record<QuoteStatus, { label:string; color:string; bg:string; border:string }> = {
  pending:  { label:"Pending Review", color:P.amber,  bg:P.amberBg,  border:P.amberBorder  },
  accepted: { label:"Accepted",       color:P.green,  bg:P.greenBg,  border:P.greenBorder  },
  declined: { label:"Declined",       color:P.red,    bg:P.redBg,    border:P.redBorder    },
  expired:  { label:"Expired",        color:P.muted,  bg:"#f0f0f0",  border:P.border       },
};
const INVOICE_STATUS_STYLE: Record<InvoiceStatus, { label:string; color:string; bg:string; border:string }> = {
  unpaid:  { label:"Unpaid",   color:P.amber,  bg:P.amberBg,  border:P.amberBorder  },
  paid:    { label:"Paid",     color:P.green,  bg:P.greenBg,  border:P.greenBorder  },
  overdue: { label:"Overdue",  color:P.red,    bg:P.redBg,    border:P.redBorder    },
  partial: { label:"Partial",  color:P.purple, bg:P.purpleBg, border:P.purpleBorder },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtMoney = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// ── Sub-components ────────────────────────────────────────────────────────────
const Card = ({ children, style = {} }: any) => (
  <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 14, padding: "20px 22px", ...style }}>
    {children}
  </div>
);
const SectionTitle = ({ children }: any) => (
  <div style={{ fontWeight: 700, fontSize: 14, color: P.text, marginBottom: 16 }}>{children}</div>
);
const Badge = ({ label, style: s }: { label: string; style: any }) => (
  <span style={{ display:"inline-block", padding:"3px 10px", borderRadius:999, fontSize:11, fontWeight:700, color:s.color, background:s.bg, border:`1px solid ${s.border}` }}>
    {label}
  </span>
);

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PortalPage() {
  const [customer,    setCustomer]    = useState<typeof DEMO_CUSTOMERS[string] | null>(null);
  const [tab,         setTab]         = useState<"orders"|"quotes"|"invoices"|"request">("orders");
  const [email,       setEmail]       = useState("");
  const [code,        setCode]        = useState("");
  const [loginErr,    setLoginErr]    = useState("");
  const [loggingIn,   setLoggingIn]   = useState(false);
  const [quotes,      setQuotes]      = useState<PortalQuote[]>([]);
  const [reqSku,      setReqSku]      = useState("");
  const [reqQty,      setReqQty]      = useState("");
  const [reqNotes,    setReqNotes]    = useState("");
  const [reqDeadline, setReqDeadline] = useState("");
  const [reqSent,     setReqSent]     = useState(false);

  useEffect(() => { if (customer) setQuotes(customer.quotes); }, [customer]);

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = async () => {
    setLoggingIn(true); setLoginErr("");
    await new Promise(r => setTimeout(r, 900));
    const found = DEMO_CUSTOMERS[email.toLowerCase().trim()];
    if (found && found.code === code.trim().toUpperCase()) {
      setCustomer(found);
    } else {
      setLoginErr("Email or access code is incorrect. Try the demo credentials below.");
    }
    setLoggingIn(false);
  };

  const logout = () => {
    setCustomer(null); setEmail(""); setCode("");
    setLoginErr(""); setTab("orders"); setReqSent(false);
  };

  const acceptQuote  = (id: string) => setQuotes(qs => qs.map(q => q.id === id ? { ...q, status:"accepted" } : q));
  const declineQuote = (id: string) => setQuotes(qs => qs.map(q => q.id === id ? { ...q, status:"declined" } : q));

  // ── Submit request → writes to shared orders store ────────────────────────
  const submitRequest = () => {
    if (!reqSku.trim() || !reqQty.trim()) return;
    const qty   = parseInt(reqQty) || 1;
    const now   = new Date().toISOString();
    const notes = [
      reqNotes.trim(),
      reqDeadline.trim() ? `Required by: ${reqDeadline.trim()}` : "",
    ].filter(Boolean).join(" | ");

    addOrder({
      id:        makeOrderId(),
      customer:  customer!.company,
      sku:       reqSku.trim(),
      items:     qty,
      value:     0,        // value unknown until supplier reviews
      stage:     "Placed",
      priority:  "MED",
      source:    "portal",
      notes:     notes || `Request from ${customer!.name}`,
      createdAt: now,
      time:      "just now",
    });

    setReqSent(true);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // LOGIN SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  if (!customer) return (
    <div style={{
      minHeight:"100vh", background:P.bg,
      fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif",
      display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", padding:"24px 16px",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:36 }}>
        <div style={{ width:42, height:42, borderRadius:12, background:"linear-gradient(135deg,#3b6fd4,#6d28d9)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, boxShadow:"0 4px 18px #3b6fd433" }}>⚡</div>
        <div>
          <div style={{ fontWeight:800, fontSize:18, color:P.text }}>Customer Portal</div>
          <div style={{ fontSize:12, color:P.muted }}>Powered by IndustrialOS</div>
        </div>
      </div>

      <div style={{ width:"100%", maxWidth:400, background:P.surface, border:`1px solid ${P.border}`, borderRadius:18, padding:"32px 28px", boxShadow:"0 8px 40px rgba(0,0,0,0.08)" }}>
        <h2 style={{ fontSize:20, fontWeight:800, color:P.text, marginBottom:6 }}>Sign in to your portal</h2>
        <p style={{ fontSize:13, color:P.muted, marginBottom:24 }}>Your supplier shared an access code with you. Enter it below.</p>

        {/* Email */}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:700, color:P.muted, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>Your Email</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@yourcompany.com" type="email" onKeyDown={e=>e.key==="Enter"&&login()}
            style={{ width:"100%", padding:"11px 13px", background:P.bg, border:`1px solid ${loginErr?P.red:P.border}`, borderRadius:9, color:P.text, fontSize:14, outline:"none", boxSizing:"border-box", fontFamily:"inherit" }} />
        </div>

        {/* Code */}
        <div style={{ marginBottom:20 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:700, color:P.muted, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>Access Code</label>
          <input value={code} onChange={e=>setCode(e.target.value)} placeholder="e.g. ACME2024" onKeyDown={e=>e.key==="Enter"&&login()}
            style={{ width:"100%", padding:"11px 13px", background:P.bg, border:`1px solid ${loginErr?P.red:P.border}`, borderRadius:9, color:P.text, fontSize:14, outline:"none", boxSizing:"border-box", fontFamily:"inherit", fontWeight:700, letterSpacing:"0.08em" }} />
        </div>

        {loginErr && <div style={{ marginBottom:16, padding:"10px 13px", background:P.redBg, border:`1px solid ${P.redBorder}`, borderRadius:8, fontSize:13, color:P.red }}>{loginErr}</div>}

        <button onClick={login} disabled={loggingIn||!email||!code}
          style={{ width:"100%", padding:"13px", background:email&&code?"linear-gradient(135deg,#3b6fd4,#6d28d9)":P.border, border:"none", borderRadius:10, color:email&&code?"#fff":P.muted, fontSize:15, fontWeight:700, cursor:email&&code?"pointer":"not-allowed" }}>
          {loggingIn?"Signing in…":"Sign In →"}
        </button>

        {/* Demo credentials */}
        <div style={{ marginTop:24, padding:"14px 16px", background:P.blueBg, border:`1px solid ${P.blueBorder}`, borderRadius:10 }}>
          <div style={{ fontSize:11, fontWeight:700, color:P.blue, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.05em" }}>🎯 Demo Credentials</div>
          {[
            { email:"buyer@acmecorp.com",     code:"ACME2024", company:"Acme Corp"    },
            { email:"purchasing@techwave.com", code:"TECH2024", company:"TechWave Ltd" },
          ].map(d=>(
            <button key={d.email} onClick={()=>{setEmail(d.email);setCode(d.code);setLoginErr("");}}
              style={{ display:"block", width:"100%", textAlign:"left", padding:"8px 10px", marginBottom:6, borderRadius:7, background:P.surface, border:`1px solid ${P.blueBorder}`, cursor:"pointer", fontSize:12 }}>
              <strong style={{ color:P.text }}>{d.company}</strong>
              <span style={{ color:P.muted, marginLeft:6 }}>{d.email} · {d.code}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // PORTAL DASHBOARD
  // ══════════════════════════════════════════════════════════════════════════
  const TABS = [
    { id:"orders",   label:"My Orders",   emoji:"🛒" },
    { id:"quotes",   label:"Quotes",      emoji:"📋" },
    { id:"invoices", label:"Invoices",    emoji:"🧾" },
    { id:"request",  label:"New Request", emoji:"✍️"  },
  ] as const;

  const pendingQuotes = quotes.filter(q=>q.status==="pending").length;
  const overdueInv    = customer.invoices.filter(i=>i.status==="overdue").length;
  const activeOrders  = customer.orders.filter(o=>o.status!=="Delivered").length;

  return (
    <div style={{ minHeight:"100vh", background:P.bg, fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif", color:P.text }}>

      {/* ── Header ── */}
      <div style={{ background:P.surface, borderBottom:`1px solid ${P.border}`, padding:"12px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:50, boxShadow:"0 1px 8px rgba(0,0,0,0.05)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:9, background:"linear-gradient(135deg,#3b6fd4,#6d28d9)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>⚡</div>
          <div>
            <div style={{ fontWeight:800, fontSize:15 }}>{customer.company}</div>
            <div style={{ fontSize:11, color:P.muted }}>Customer Portal · IndustrialOS</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          {pendingQuotes>0&&<button onClick={()=>setTab("quotes")} style={{ display:"flex",alignItems:"center",gap:5,padding:"4px 12px",borderRadius:999,cursor:"pointer",background:P.amberBg,border:`1px solid ${P.amberBorder}`,color:P.amber,fontSize:11,fontWeight:700 }}>⏳ {pendingQuotes} quote{pendingQuotes>1?"s":""} awaiting review</button>}
          {overdueInv>0&&<button onClick={()=>setTab("invoices")} style={{ display:"flex",alignItems:"center",gap:5,padding:"4px 12px",borderRadius:999,cursor:"pointer",background:P.redBg,border:`1px solid ${P.redBorder}`,color:P.red,fontSize:11,fontWeight:700 }}>⚠️ {overdueInv} overdue invoice{overdueInv>1?"s":""}</button>}
          <div style={{ fontSize:13, color:P.muted }}>Hi, <strong style={{ color:P.text }}>{customer.name.split(" ")[0]}</strong></div>
          <button onClick={logout} style={{ padding:"6px 14px",borderRadius:8,background:"none",border:`1px solid ${P.border}`,color:P.muted,fontSize:12,fontWeight:600,cursor:"pointer" }}>Sign Out</button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ background:P.surface, borderBottom:`1px solid ${P.border}`, padding:"0 28px", display:"flex", gap:4 }}>
        {TABS.map(t=>{
          const active=tab===t.id;
          return (
            <button key={t.id} onClick={()=>setTab(t.id)} style={{ display:"flex",alignItems:"center",gap:6,padding:"13px 16px",fontSize:13,fontWeight:600,border:"none",borderBottom:active?`2px solid ${P.blue}`:"2px solid transparent",color:active?P.blue:P.muted,background:"none",cursor:"pointer",whiteSpace:"nowrap",marginBottom:-1 }}>
              <span>{t.emoji}</span>{t.label}
              {t.id==="quotes"&&pendingQuotes>0&&<span style={{ background:P.amber,color:"#fff",borderRadius:999,fontSize:10,fontWeight:800,padding:"1px 6px",marginLeft:2 }}>{pendingQuotes}</span>}
              {t.id==="invoices"&&overdueInv>0&&<span style={{ background:P.red,color:"#fff",borderRadius:999,fontSize:10,fontWeight:800,padding:"1px 6px",marginLeft:2 }}>{overdueInv}</span>}
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      <div style={{ padding:"28px", maxWidth:900, margin:"0 auto" }}>

        {/* Summary cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:24 }}>
          {[
            { label:"Active Orders",    value:activeOrders,  color:P.blue,  bg:P.blueBg,  bdr:P.blueBorder,  emoji:"🛒" },
            { label:"Quotes to Review", value:pendingQuotes, color:P.amber, bg:P.amberBg, bdr:P.amberBorder, emoji:"📋" },
            { label:"Overdue Invoices", value:overdueInv,    color:P.red,   bg:P.redBg,   bdr:P.redBorder,   emoji:"⚠️" },
          ].map((s,i)=>(
            <div key={i} style={{ background:s.bg, border:`1px solid ${s.bdr}`, borderRadius:12, padding:"14px 18px", display:"flex", alignItems:"center", gap:14 }}>
              <span style={{ fontSize:28 }}>{s.emoji}</span>
              <div>
                <div style={{ fontSize:26, fontWeight:800, color:s.color }}>{s.value}</div>
                <div style={{ fontSize:12, color:P.muted }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── ORDERS tab ── */}
        {tab==="orders"&&(
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <SectionTitle>My Orders</SectionTitle>
            {customer.orders.map(order=>{
              const stageIdx=ORDER_STAGES.indexOf(order.status);
              const s=ORDER_STATUS_STYLE[order.status];
              return (
                <Card key={order.id}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
                    <div>
                      <div style={{ fontWeight:800, fontSize:15, color:P.text, marginBottom:3 }}>{order.sku}</div>
                      <div style={{ fontSize:13, color:P.muted }}>{order.items} items · Ordered {order.date}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontWeight:800, fontSize:18, color:P.text }}>{fmtMoney(order.value)}</div>
                      <Badge label={s.label} style={s} />
                    </div>
                  </div>
                  {/* Stage pipeline */}
                  <div style={{ display:"flex", alignItems:"center", gap:0 }}>
                    {ORDER_STAGES.map((stage,i)=>{
                      const done=i<=stageIdx; const current=i===stageIdx;
                      return (
                        <div key={stage} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center" }}>
                          <div style={{ display:"flex", alignItems:"center", width:"100%" }}>
                            {i>0&&<div style={{ flex:1, height:3, background:done?P.blue:P.border, transition:"background 0.3s" }}/>}
                            <div style={{ width:28, height:28, borderRadius:"50%", flexShrink:0, background:done?P.blue:P.surface, border:`2px solid ${done?P.blue:P.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:done?"#fff":P.subtle, boxShadow:current?`0 0 0 4px ${P.blueBg}`:"none", transition:"all 0.3s" }}>
                              {done&&!current?"✓":i+1}
                            </div>
                            {i<ORDER_STAGES.length-1&&<div style={{ flex:1, height:3, background:i<stageIdx?P.blue:P.border, transition:"background 0.3s" }}/>}
                          </div>
                          <div style={{ fontSize:10, marginTop:6, fontWeight:current?700:400, color:current?P.blue:done?P.muted:P.subtle, textAlign:"center" }}>{stage}</div>
                        </div>
                      );
                    })}
                  </div>
                  {order.status!=="Delivered"&&(
                    <div style={{ marginTop:14, padding:"8px 12px", background:P.blueBg, border:`1px solid ${P.blueBorder}`, borderRadius:8, fontSize:12, color:P.blue }}>
                      📅 Estimated delivery: <strong>{order.eta}</strong>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* ── QUOTES tab ── */}
        {tab==="quotes"&&(
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <SectionTitle>Quotes</SectionTitle>
            {quotes.map(q=>{
              const s=QUOTE_STATUS_STYLE[q.status]; const pending=q.status==="pending";
              return (
                <Card key={q.id} style={{ border:pending?`1px solid ${P.amberBorder}`:`1px solid ${P.border}`, background:pending?P.amberBg:P.surface }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:pending?16:0 }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
                        <span style={{ fontWeight:800, fontSize:15, fontFamily:"monospace", color:P.text }}>{q.quoteNumber}</span>
                        <Badge label={s.label} style={s} />
                      </div>
                      <div style={{ fontSize:13, color:P.muted }}>{q.items} item{q.items!==1?"s":""} · Sent {q.date} · Valid until {q.validUntil}</div>
                    </div>
                    <div style={{ fontWeight:800, fontSize:20, color:P.text }}>{fmtMoney(q.value)}</div>
                  </div>
                  {pending&&(
                    <div style={{ display:"flex", gap:10 }}>
                      <button onClick={()=>acceptQuote(q.id)} style={{ flex:1, padding:"11px", background:"linear-gradient(135deg,#1a7f5a,#28a770)", border:"none", borderRadius:9, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 14px #1a7f5a33" }}>✓ Accept Quote</button>
                      <button onClick={()=>declineQuote(q.id)} style={{ flex:1, padding:"11px", background:P.surface, border:`1px solid ${P.redBorder}`, borderRadius:9, color:P.red, fontSize:13, fontWeight:700, cursor:"pointer" }}>✕ Decline</button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* ── INVOICES tab ── */}
        {tab==="invoices"&&(
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <SectionTitle>Invoices</SectionTitle>
            {(() => {
              const outstanding=customer.invoices.filter(i=>i.status!=="paid").reduce((s,i)=>s+i.value,0);
              return outstanding>0?(
                <div style={{ padding:"12px 16px", background:P.amberBg, border:`1px solid ${P.amberBorder}`, borderRadius:10, fontSize:13, color:P.amber, marginBottom:4 }}>
                  💳 You have <strong>{fmtMoney(outstanding)}</strong> outstanding across {customer.invoices.filter(i=>i.status!=="paid").length} invoice{customer.invoices.filter(i=>i.status!=="paid").length!==1?"s":""}.
                </div>
              ):null;
            })()}
            {customer.invoices.map(inv=>{
              const s=INVOICE_STATUS_STYLE[inv.status];
              return (
                <Card key={inv.id} style={{ border:inv.status==="overdue"?`1px solid ${P.redBorder}`:`1px solid ${P.border}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
                        <span style={{ fontWeight:800, fontSize:15, fontFamily:"monospace", color:P.text }}>{inv.invoiceNumber}</span>
                        <Badge label={s.label} style={s} />
                      </div>
                      <div style={{ fontSize:13, color:P.muted }}>Issued {inv.date} · Due {inv.due}</div>
                    </div>
                    <div style={{ fontWeight:800, fontSize:20, color:P.text }}>{fmtMoney(inv.value)}</div>
                  </div>
                  {inv.status==="overdue"&&(
                    <div style={{ marginTop:12, padding:"8px 12px", background:P.redBg, border:`1px solid ${P.redBorder}`, borderRadius:8, fontSize:12, color:P.red }}>
                      ⚠️ This invoice is overdue. Please contact your supplier to arrange payment.
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* ── NEW REQUEST tab ── */}
        {tab==="request"&&(
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <SectionTitle>Submit a New Request</SectionTitle>
            {reqSent?(
              <Card style={{ textAlign:"center", padding:"48px 24px" }}>
                <div style={{ fontSize:48, marginBottom:16 }}>🎉</div>
                <h3 style={{ fontSize:20, fontWeight:800, color:P.text, marginBottom:8 }}>Request Submitted!</h3>
                <p style={{ color:P.muted, fontSize:14, marginBottom:24, lineHeight:1.6 }}>
                  Your request has been received and added to the order pipeline.<br/>
                  Your supplier will confirm it shortly.
                </p>
                <button onClick={()=>{setReqSent(false);setReqSku("");setReqQty("");setReqNotes("");setReqDeadline("");}}
                  style={{ padding:"11px 24px", borderRadius:9, background:P.blueBg, border:`1px solid ${P.blueBorder}`, color:P.blue, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                  Submit Another Request
                </button>
              </Card>
            ):(
              <Card>
                <p style={{ fontSize:13, color:P.muted, marginBottom:22, lineHeight:1.6 }}>
                  Tell your supplier what you need. Your request will go straight into their order pipeline.
                </p>
                {[
                  { label:"SKU / Product Name *",  placeholder:"e.g. SKU-4821 or 'Industrial bolts M10'", val:reqSku,      set:setReqSku      },
                  { label:"Quantity Needed *",      placeholder:"e.g. 500",                                val:reqQty,      set:setReqQty      },
                  { label:"Required By (optional)", placeholder:"e.g. End of March",                       val:reqDeadline, set:setReqDeadline },
                ].map(({label,placeholder,val,set})=>(
                  <div key={label} style={{ marginBottom:16 }}>
                    <label style={{ display:"block", fontSize:12, fontWeight:700, color:P.muted, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>{label}</label>
                    <input value={val} onChange={e=>set(e.target.value)} placeholder={placeholder}
                      style={{ width:"100%", padding:"11px 13px", background:P.bg, border:`1px solid ${P.border}`, borderRadius:9, color:P.text, fontSize:14, outline:"none", boxSizing:"border-box", fontFamily:"inherit" }} />
                  </div>
                ))}
                <div style={{ marginBottom:22 }}>
                  <label style={{ display:"block", fontSize:12, fontWeight:700, color:P.muted, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>Additional Notes (optional)</label>
                  <textarea value={reqNotes} onChange={e=>setReqNotes(e.target.value)} placeholder="Any special requirements or delivery instructions…" rows={3}
                    style={{ width:"100%", padding:"11px 13px", background:P.bg, border:`1px solid ${P.border}`, borderRadius:9, color:P.text, fontSize:14, outline:"none", boxSizing:"border-box", fontFamily:"inherit", resize:"vertical" }} />
                </div>
                <button onClick={submitRequest} disabled={!reqSku.trim()||!reqQty.trim()}
                  style={{ width:"100%", padding:"13px", background:reqSku&&reqQty?"linear-gradient(135deg,#3b6fd4,#6d28d9)":P.border, border:"none", borderRadius:10, color:reqSku&&reqQty?"#fff":P.muted, fontSize:15, fontWeight:700, cursor:reqSku&&reqQty?"pointer":"not-allowed" }}>
                  ✍️ Submit Request
                </button>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
