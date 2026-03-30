"use client";
// components/Customers.tsx
// Customer accounts module — profiles, contacts, order history, credit limits, balances.

import { getHealthScore, HealthGrade } from "@/lib/customerHealth";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { C } from "@/lib/utils";
import { Card, SectionTitle } from "./Dashboard";
import { Users, Plus, Search, Building2, Mail, Phone, TrendingUp, AlertCircle } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type CustStatus = "active" | "on_hold" | "inactive" | "pending";

interface CustomerContact {
  name:  string;
  role:  string;
  email: string;
  phone: string;
}

interface CustomerOrder {
  number: string; date: string; value: number; status: string;
}

interface Customer {
  id:              string;
  company:         string;
  industry:        string;
  status:          CustStatus;
  creditLimit:     number;
  balance:         number;       // outstanding balance
  totalSpend:      number;       // lifetime spend
  contact:         CustomerContact;
  address:         string;
  accessCode:      string;       // for the customer portal
  orders:          CustomerOrder[];
  since:           string;       // ISO date
  paymentTerms:    string;
  notes:           string;
  whatsappPaused:  boolean;      // Phase 11
}

// ── Seed data ─────────────────────────────────────────────────────────────────
const SEED: Customer[] = [
  {
    id: "c1", company: "Acme Corp", industry: "Manufacturing", status: "active",
    creditLimit: 100000, balance: 26244, totalSpend: 154300,
    contact: { name: "James Hartley", role: "Purchasing Manager", email: "buyer@acmecorp.com", phone: "+1 312-555-0192" },
    address: "400 W Superior St, Chicago, IL 60654",
    accessCode: "ACME2024",
    orders: [
      { number: "INV-2026-0312", date: "Mar 5, 2026",  value: 26244, status: "Overdue" },
      { number: "INV-2026-0201", date: "Feb 20, 2026", value: 16416, status: "Paid"    },
    ],
    since: "2023-06-01", whatsappPaused: false, paymentTerms: "Net 15", notes: "Key account. Prefers email comms. Always orders in bulk.",
  },
  {
    id: "c2", company: "TechWave Ltd", industry: "Technology", status: "active",
    creditLimit: 200000, balance: 24384, totalSpend: 287400,
    contact: { name: "Sarah Chen", role: "Head of Procurement", email: "purchasing@techwave.com", phone: "+1 415-555-0234" },
    address: "101 California St, San Francisco, CA 94111",
    accessCode: "TECH2024",
    orders: [
      { number: "INV-2026-0298", date: "Mar 1, 2026",  value: 48384, status: "Partial" },
    ],
    since: "2022-11-15", whatsappPaused: false, paymentTerms: "Net 30", notes: "Large quarterly orders. Net 30 — occasionally pays in 45 days.",
  },
  {
    id: "c3", company: "Midland Steel", industry: "Distribution", status: "active",
    creditLimit: 75000, balance: 24408, totalSpend: 98500,
    contact: { name: "Robert Marsh",  role: "Operations Director", email: "orders@midlandsteel.com", phone: "+1 312-555-0371" },
    address: "2200 S Halsted St, Chicago, IL 60608",
    accessCode: "MIDL2024",
    orders: [
      { number: "INV-2026-0188", date: "Mar 10, 2026", value: 24408, status: "Sent"  },
    ],
    since: "2024-01-10", whatsappPaused: false, paymentTerms: "Net 30", notes: "New customer. Good payment record so far.",
  },
  {
    id: "c4", company: "Apex Industrial",  industry: "Construction", status: "on_hold",
    creditLimit: 50000, balance: 18200, totalSpend: 62100,
    contact: { name: "Diana Perez",   role: "Buyer",                email: "diana@apexind.com",          phone: "+1 214-555-0089" },
    address: "300 Commerce St, Dallas, TX 75201",
    accessCode: "APEX2024",
    orders: [],
    since: "2023-09-20", whatsappPaused: false, paymentTerms: "Prepaid", notes: "Account on hold — overdue balance. Contact before taking new orders.",
  },
];

const STORAGE_KEY = "industrialos_customers";
function loadCustomers(): Customer[] {
  if (typeof window === "undefined") return SEED;
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : SEED; }
  catch { return SEED; }
}
function saveCustomers(list: Customer[]) {
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// ── DB helpers (fire-and-forget — localStorage stays primary) ─────────────────
// Field mapping: component ↔ DB
//   company      ↔ name          contact.name ↔ contactName
//   balance      ↔ balanceDue    accessCode   ↔ portalCode
//   address      ↔ country       (repurposed field)

function getCustWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("workspaceDbId");
}

function dbToCustomer(d: any): Customer {
  return {
    id:          d.id,
    company:     d.name,
    industry:    d.industry     || "",
    status:      (["active","on_hold","inactive","pending"].includes(d.status) ? d.status : "active") as CustStatus,
    creditLimit: d.creditLimit  || 0,
    balance:     d.balanceDue   || 0,
    totalSpend:  0,                // not in DB schema — defaults to 0
    contact: {
      name:  d.contactName || "",
      role:  "Contact",           // not in DB schema
      email: d.email       || "",
      phone: d.phone       || "",
    },
    address:      d.country      || "", // reusing country field for address
    accessCode:   d.portalCode   || "",
    orders:       Array.isArray(d.orders) ? d.orders : (typeof d.orders === "string" ? JSON.parse(d.orders || "[]") : []),
    since:        typeof d.createdAt === "string" ? d.createdAt.split("T")[0] : new Date(d.createdAt).toISOString().split("T")[0],
    paymentTerms:   "Net 30",             // not in DB schema
    notes:          d.notes        || "",
    whatsappPaused: d.whatsappPaused ?? false,  // Phase 11
  };
}

async function fetchCustomersFromDb(): Promise<Customer[]> {
  const wid = getCustWorkspaceId();
  if (!wid) return [];
  try {
    const res = await fetch(`/api/customers?workspaceId=${wid}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.map(dbToCustomer);
  } catch { return []; }
}

async function createCustomerInDb(c: Customer): Promise<void> {
  const wid = getCustWorkspaceId();
  if (!wid) return;
  try {
    await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:        c.company,
        contactName: c.contact.name,
        email:       c.contact.email,
        phone:       c.contact.phone,
        country:     c.address,      // repurposed
        industry:    c.industry,
        creditLimit: c.creditLimit,
        balanceDue:  c.balance,
        status:      c.status,
        portalCode:  c.accessCode,
        notes:       c.notes,
        orders:      c.orders,
        workspaceId: wid,
      }),
    });
  } catch {}
}

async function updateCustomerInDb(id: string, c: Partial<Customer>): Promise<void> {
  try {
    await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        ...(c.status      !== undefined && { status:      c.status }),
        ...(c.balance     !== undefined && { balanceDue:  c.balance }),
        ...(c.creditLimit !== undefined && { creditLimit: c.creditLimit }),
        ...(c.notes       !== undefined && { notes:       c.notes }),
        ...(c.orders      !== undefined && { orders:      c.orders }),
      }),
    });
  } catch {}
}

const uid = () => Math.random().toString(36).slice(2, 9);
const fmtMoney = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate  = (s: string) => new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

const STATUS_CFG: Record<CustStatus, { label: string; bg: string; color: string; border: string }> = {
  active:   { label: "Active",    bg: C.greenBg,  color: C.green,  border: C.greenBorder  },
  on_hold:  { label: "On Hold",   bg: C.amberBg,  color: C.amber,  border: C.amberBorder  },
  inactive: { label: "Inactive",  bg: C.surface,  color: C.subtle, border: C.border       },
  pending:  { label: "⏳ Pending", bg: C.purpleBg, color: C.purple, border: C.purpleBorder },
};

function Badge({ status }: { status: CustStatus }) {
  const s = STATUS_CFG[status] ?? { label: status, bg: C.surface, color: C.subtle, border: C.border };
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  );
}

// ── New Customer Modal ────────────────────────────────────────────────────────
function NewCustomerModal({ onSave, onClose }: { onSave: (c: Customer) => void; onClose: () => void }) {
  const [company,  setCompany]  = useState("");
  const [industry, setIndustry] = useState("Manufacturing");
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [phone,    setPhone]    = useState("");
  const [role,     setRole]     = useState("");
  const [address,  setAddress]  = useState("");
  const [limit,    setLimit]    = useState("50000");
  const [terms,    setTerms]    = useState("Net 30");
  const [notes,    setNotes]    = useState("");

  const save = () => {
    if (!company.trim() || !name.trim()) return;
    const code = company.trim().slice(0, 4).toUpperCase() + new Date().getFullYear();
    const cust: Customer = {
      id: uid(), company: company.trim(), industry, status: "active",
      creditLimit: parseFloat(limit) || 50000, balance: 0, totalSpend: 0,
      contact: { name: name.trim(), role: role.trim() || "Contact", email: email.trim(), phone: phone.trim() },
      address: address.trim(), accessCode: code, orders: [],
      since: new Date().toISOString().split("T")[0],
      paymentTerms: terms, notes: notes.trim(),
      whatsappPaused: false, // Phase 11
    };
    onSave(cust); onClose();
  };

  const row = (label: string, el: React.ReactNode) => (
    <div key={label} style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</label>
      {el}
    </div>
  );
  const inp = (val: string, set: (v: string) => void, ph: string, type = "text") => (
    <input type={type} value={val} onChange={e => set(e.target.value)} placeholder={ph}
      style={{ width: "100%", padding: "9px 11px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "28px", width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text }}>Add Customer</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 20 }}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
          <div style={{ gridColumn: "1 / -1" }}>{row("Company Name *", inp(company, setCompany, "e.g. Acme Corp"))}</div>
          {row("Industry", (
            <select value={industry} onChange={e => setIndustry(e.target.value)}
              style={{ width: "100%", padding: "9px 11px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, outline: "none" }}>
              {["Manufacturing","Distribution","Technology","Construction","Services","Import/Export","Pharma","Food & Beverage","Other"].map(i => <option key={i}>{i}</option>)}
            </select>
          ))}
          {row("Payment Terms", (
            <select value={terms} onChange={e => setTerms(e.target.value)}
              style={{ width: "100%", padding: "9px 11px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, outline: "none" }}>
              {["Net 7","Net 15","Net 30","Net 45","Net 60","Prepaid","COD"].map(t => <option key={t}>{t}</option>)}
            </select>
          ))}
          {row("Primary Contact Name *", inp(name, setName, "e.g. James Hartley"))}
          {row("Role / Title", inp(role, setRole, "e.g. Purchasing Manager"))}
          {row("Email", inp(email, setEmail, "buyer@company.com", "email"))}
          {row("Phone", inp(phone, setPhone, "+1 312-555-0000", "tel"))}
          <div style={{ gridColumn: "1 / -1" }}>{row("Address", inp(address, setAddress, "Street, City, State, ZIP"))}</div>
          {row("Credit Limit ($)", inp(limit, setLimit, "50000", "number"))}
          <div style={{ gridColumn: "1 / -1" }}>{row("Notes", (
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes about this customer…"
              rows={2} style={{ width: "100%", padding: "9px 11px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
          ))}</div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: "10px 20px", background: "none", border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button onClick={save} disabled={!company.trim() || !name.trim()}
            style={{ padding: "10px 22px", background: company.trim() && name.trim() ? C.blue : C.border, border: "none", borderRadius: 8, color: company.trim() && name.trim() ? "#fff" : C.muted, fontSize: 13, fontWeight: 700, cursor: company.trim() && name.trim() ? "pointer" : "not-allowed" }}>
            Add Customer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Customer detail panel ─────────────────────────────────────────────────────
function CustomerDetail({ cust, onClose, onStatusChange, onWhatsAppToggle, isViewer }: {
  cust: Customer; onClose: () => void;
  onStatusChange:   (id: string, s: CustStatus) => void;
  onWhatsAppToggle: (id: string, paused: boolean) => void;  // Phase 11
  isViewer?: boolean;
}) {
  const usedCredit = (cust.balance / cust.creditLimit) * 100;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, width: "100%", maxWidth: 580, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 48, height: 48, background: C.blueBg, border: `1px solid ${C.blueBorder}`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
              {cust.company.charAt(0)}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{cust.company}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{cust.industry} · Customer since {fmtDate(cust.since)}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Badge status={cust.status} />
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 20 }}>✕</button>
          </div>
        </div>

        {/* Stats */}
        {(() => {
          const h = getHealthScore({ status: cust.status, balance: cust.balance, creditLimit: cust.creditLimit, totalSpend: cust.totalSpend, orders: cust.orders });
          return (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 14 }}>
                {[
                  { label: "Total Spend",  val: fmtMoney(cust.totalSpend), color: "#2e7d5e", bg: "#edf6f1", border: "#b8dece" },
                  { label: "Balance Due",  val: fmtMoney(cust.balance),    color: cust.balance > 0 ? C.amber : "#2e7d5e", bg: cust.balance > 0 ? C.amberBg : "#edf6f1", border: cust.balance > 0 ? C.amberBorder : "#b8dece" },
                  { label: "Credit Limit", val: fmtMoney(cust.creditLimit),color: C.blue,    bg: C.blueBg,  border: C.blueBorder  },
                  { label: "Health Score", val: `${h.grade} — ${h.label}`, color: h.color,   bg: h.bg,      border: h.border       },
                ].map(({ label, val, color, bg, border }) => (
                  <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: label === "Health Score" ? 14 : 16, fontWeight: 800, color }}>{val}</div>
                    {label === "Health Score" && (
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{h.reasons[0]}</div>
                    )}
                  </div>
                ))}
              </div>
              {/* Health score bar */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted, marginBottom: 4 }}>
                  <span>Health score</span>
                  <span style={{ fontWeight: 700, color: h.color }}>{h.score} / 100</span>
                </div>
                <div style={{ height: 6, background: C.bg, borderRadius: 999, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${h.score}%`, borderRadius: 999, background: h.color, transition: "width 0.4s" }} />
                </div>
                {h.reasons.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4, marginTop: 6 }}>
                    {h.reasons.map((r, i) => (
                      <span key={i} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: h.bg, color: h.color, border: `1px solid ${h.border}`, fontWeight: 600 }}>
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          );
        })()}

        {/* Credit bar */}
        {cust.creditLimit > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted, marginBottom: 5 }}>
              <span>Credit utilisation</span>
              <span style={{ fontWeight: 700, color: usedCredit > 80 ? C.red : C.text }}>{usedCredit.toFixed(0)}%</span>
            </div>
            <div style={{ height: 8, background: C.bg, borderRadius: 999, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, usedCredit)}%`, borderRadius: 999, background: usedCredit > 80 ? C.red : usedCredit > 60 ? C.amber : C.green, transition: "width 0.4s" }} />
            </div>
          </div>
        )}

        {/* Contact */}
        <SectionTitle>Primary Contact</SectionTitle>
        <div style={{ background: C.bg, borderRadius: 10, padding: "14px 16px", marginBottom: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            [cust.contact.name,  cust.contact.role],
            [cust.contact.email, "Email"],
            [cust.contact.phone, "Phone"],
            [cust.paymentTerms,  "Payment Terms"],
          ].map(([v, label]) => (
            <div key={label}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Portal code */}
        <div style={{ background: C.purpleBg, border: `1px solid ${C.purpleBorder}`, borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.purple, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Portal Access Code</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.purple, letterSpacing: "0.1em" }}>{cust.accessCode}</div>
          </div>
          <div style={{ fontSize: 12, color: C.purple }}>Share with {cust.contact.name.split(" ")[0]} →</div>
        </div>

        {/* Order history */}
        {cust.orders.length > 0 && (
          <>
            <SectionTitle>Order History</SectionTitle>
            <div style={{ background: C.bg, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 20 }}>
              {cust.orders.map((o, i) => (
                <div key={o.number} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: i < cust.orders.length - 1 ? `1px solid ${C.border}` : "none", fontSize: 13 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: C.text }}>{o.number}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{o.date}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, color: C.text }}>{fmtMoney(o.value)}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{o.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {cust.notes && (
          <div style={{ fontSize: 12, color: C.muted, padding: "10px 14px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 18, lineHeight: 1.6 }}>
            📝 {cust.notes}
          </div>
        )}

        {/* Status actions */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!isViewer && cust.status !== "active"   && <button onClick={() => onStatusChange(cust.id, "active")}   style={{ padding: "8px 16px", background: C.greenBg, border: `1px solid ${C.greenBorder}`, borderRadius: 8, color: C.green, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Set Active</button>}
          {!isViewer && cust.status !== "on_hold"  && <button onClick={() => onStatusChange(cust.id, "on_hold")}  style={{ padding: "8px 16px", background: C.amberBg, border: `1px solid ${C.amberBorder}`, borderRadius: 8, color: C.amber, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Put on Hold</button>}
          {!isViewer && cust.status !== "inactive" && <button onClick={() => onStatusChange(cust.id, "inactive")} style={{ padding: "8px 16px", background: C.surface, border: `1px solid ${C.border}`,       borderRadius: 8, color: C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Deactivate</button>}
          {/* Phase 11 — WhatsApp pause toggle */}
          {!isViewer && (
            <button
              onClick={() => onWhatsAppToggle(cust.id, !cust.whatsappPaused)}
              style={{ padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                background: cust.whatsappPaused ? C.surface : C.greenBg,
                border:     cust.whatsappPaused ? `1px solid ${C.border}` : `1px solid ${C.greenBorder}`,
                color:      cust.whatsappPaused ? C.muted : C.green,
              }}
            >
              {cust.whatsappPaused ? "▶ Resume WhatsApp" : "⏸ Pause WhatsApp"}
            </button>
          )}
          <button onClick={onClose} style={{ padding: "8px 16px", background: "none", border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", marginLeft: "auto" }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function Customers() {
  const { data: session } = useSession();
  const isViewer = session?.user?.role === "viewer";
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search,    setSearch]    = useState("");
  const [filter,    setFilter]    = useState<CustStatus | "all">("all");
  const [showNew,   setShowNew]   = useState(false);
  const [selected,  setSelected]  = useState<Customer | null>(null);
  const [healthFilter, setHealthFilter] = useState<HealthGrade | "all">("all");

  // Load localStorage immediately, then refresh from DB in background
  useEffect(() => {
    setCustomers(loadCustomers());
    fetchCustomersFromDb().then(dbList => {
      if (dbList.length > 0) {
        setCustomers(dbList);
        saveCustomers(dbList);
      }
    });
  }, []);

  const save = (list: Customer[]) => { setCustomers(list); saveCustomers(list); };

  const addCustomer = (c: Customer) => {
    save([c, ...customers]);
    createCustomerInDb(c); // fire-and-forget
  };
  const changeStatus = (id: string, status: CustStatus) => {
    save(customers.map(c => c.id === id ? { ...c, status } : c));
    updateCustomerInDb(id, { status });
    setSelected(prev => prev?.id === id ? { ...prev, status } : prev);
  };

  // Phase 11 — toggle WhatsApp pause per customer
  const toggleWhatsApp = (id: string, paused: boolean) => {
    save(customers.map(c => c.id === id ? { ...c, whatsappPaused: paused } : c));
    updateCustomerInDb(id, { whatsappPaused: paused });
    setSelected(prev => prev?.id === id ? { ...prev, whatsappPaused: paused } : prev);
  };

  const visible = customers.filter(c => {
    const matchFilter = filter === "all" || c.status === filter;
    const matchSearch = !search || c.company.toLowerCase().includes(search.toLowerCase()) || c.contact.name.toLowerCase().includes(search.toLowerCase());
    const h = getHealthScore({ status: c.status, balance: c.balance, creditLimit: c.creditLimit, totalSpend: c.totalSpend, orders: c.orders });
    const matchHealth = healthFilter === "all" || h.grade === healthFilter;
    return matchFilter && matchSearch && matchHealth;
  });

  const totalSpend   = customers.reduce((s, c) => s + c.totalSpend, 0);
  const totalBalance = customers.reduce((s, c) => s + c.balance, 0);
  const onHold       = customers.filter(c => c.status === "on_hold").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {[
          { label: "Total Customers", val: customers.length.toString(),   bg: C.blueBg,  color: C.blue,  border: C.blueBorder  },
          { label: "Total Revenue",   val: fmtMoney(totalSpend),          bg: C.greenBg, color: C.green, border: C.greenBorder },
          { label: "Accounts on Hold",val: onHold.toString(),             bg: onHold > 0 ? C.amberBg : C.surface, color: onHold > 0 ? C.amber : C.subtle, border: onHold > 0 ? C.amberBorder : C.border },
        ].map(({ label, val, bg, color, border }) => (
          <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers…"
            style={{ width: "100%", padding: "8px 10px 8px 30px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["all","active","on_hold","inactive"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: "7px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", background: filter === f ? C.blue : C.surface, color: filter === f ? "#fff" : C.muted }}>
              {f === "all" ? "All" : STATUS_CFG[f].label}
            </button>
          ))}
        </div>
        {/* Health filter */}
        <div style={{ display: "flex", gap: 6 }}>
          {(["all", "A", "B", "C", "D"] as const).map(g => {
            const styles: Record<string, { color: string; bg: string }> = {
              all: { color: C.muted,  bg: C.surface },
              A:   { color: "#2e7d5e", bg: "#edf6f1" },
              B:   { color: C.blue,   bg: C.blueBg   },
              C:   { color: C.amber,  bg: C.amberBg  },
              D:   { color: C.red,    bg: C.redBg    },
            };
            const s = styles[g];
            const active = healthFilter === g;
            return (
              <button key={g} onClick={() => setHealthFilter(g)} style={{
                padding: "7px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                cursor: "pointer", border: "none",
                background: active ? s.bg : C.surface,
                color:      active ? s.color : C.muted,
                outline: active ? `1.5px solid ${s.color}` : "none",
              }}>
                {g === "all" ? "All Health" : `Grade ${g}`}
              </button>
            );
          })}
        </div>
        {!isViewer && (
        <button onClick={() => setShowNew(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: C.blue, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          <Plus size={14} /> Add Customer
        </button>
        )}
      </div>

      {/* List */}
      <Card>
        {visible.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}><Users size={32} style={{ marginBottom: 10, opacity: 0.4 }} /><div>No customers found</div></div>
        ) : visible.map((c, idx) => (
          <div key={c.id} onClick={() => setSelected(c)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 4px", cursor: "pointer", borderBottom: idx < visible.length - 1 ? `1px solid ${C.border}` : "none" }}
            onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 40, height: 40, background: C.blueBg, border: `1px solid ${C.blueBorder}`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: C.blue }}>
                {c.company.charAt(0)}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{c.company}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{c.contact.name} · {c.industry}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: C.text }}>{fmtMoney(c.totalSpend)}</div>
                <div style={{ fontSize: 11, color: c.balance > 0 ? C.amber : C.muted }}>{c.balance > 0 ? `${fmtMoney(c.balance)} due` : "No balance"}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {(() => {
                  const h = getHealthScore({ status: c.status, balance: c.balance, creditLimit: c.creditLimit, totalSpend: c.totalSpend, orders: c.orders });
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: h.bg, border: `1px solid ${h.border}` }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: h.color }}>{h.grade}</span>
                      <span style={{ fontSize: 10, color: h.color, fontWeight: 600 }}>{h.label}</span>
                    </div>
                  );
                })()}
                <Badge status={c.status} />
              </div>
            </div>
          </div>
        ))}
      </Card>

      {showNew  && <NewCustomerModal onSave={addCustomer} onClose={() => setShowNew(false)} />}
      {selected && <CustomerDetail cust={selected} onClose={() => setSelected(null)} onStatusChange={changeStatus} onWhatsAppToggle={toggleWhatsApp} isViewer={isViewer} />}
    </div>
  );
}
