"use client";
// components/Invoicing.tsx
// Full invoicing module — create invoices, track payments, overdue alerts.
// Data saved to localStorage. Swap for API calls when DB is ready.

import { useState, useEffect } from "react";
import { C } from "@/lib/utils";
import { Card, SectionTitle } from "./Dashboard";
import {
  Receipt, Plus, Search, Download, Send,
  CheckCircle, AlertTriangle, Clock, XCircle, ChevronDown, ChevronUp,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type InvStatus = "draft" | "sent" | "paid" | "overdue" | "partial";

interface InvLine {
  id: string; desc: string; qty: number; unit: number; total: number;
}
interface Invoice {
  id:        string;
  number:    string;
  customer:  string;
  email:     string;
  lines:     InvLine[];
  subtotal:  number;
  tax:       number;
  total:     number;
  status:    InvStatus;
  issued:    string;   // ISO date string
  due:       string;   // ISO date string
  paidAmt:   number;
  notes:     string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const uid   = () => Math.random().toString(36).slice(2, 9);
const invNo = () => `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
const today = () => new Date().toISOString().split("T")[0];
const addDays = (d: string, n: number) => {
  const dt = new Date(d); dt.setDate(dt.getDate() + n);
  return dt.toISOString().split("T")[0];
};
const fmtDate  = (s: string) => new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
const fmtMoney = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const STORAGE_KEY = "industrialos_invoices";

function loadInvoices(): Invoice[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : SEED;
  } catch { return SEED; }
}
function saveInvoices(list: Invoice[]) {
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// ── Seed data ─────────────────────────────────────────────────────────────────
const SEED: Invoice[] = [
  {
    id: "s1", number: "INV-2026-0312", customer: "Acme Corp",   email: "buyer@acmecorp.com",
    lines: [
      { id: "l1", desc: "SKU-4821 — Industrial bolts M10 (x500)", qty: 500, unit: 48.60, total: 24300 },
    ],
    subtotal: 24300, tax: 1944, total: 26244, status: "overdue",
    issued: "2026-03-05", due: "2026-03-20", paidAmt: 0, notes: "Net 15 — overdue",
  },
  {
    id: "s2", number: "INV-2026-0298", customer: "TechWave Ltd", email: "purchasing@techwave.com",
    lines: [
      { id: "l2", desc: "SKU-2210 — Precision bearings (x800)", qty: 800, unit: 56.00, total: 44800 },
    ],
    subtotal: 44800, tax: 3584, total: 48384, status: "partial",
    issued: "2026-03-01", due: "2026-03-31", paidAmt: 24000, notes: "Partial payment received Mar 15",
  },
  {
    id: "s3", number: "INV-2026-0201", customer: "Acme Corp",   email: "buyer@acmecorp.com",
    lines: [
      { id: "l3", desc: "SKU-3318 — Stainless clamps (x200)",    qty: 200, unit: 76.00, total: 15200 },
    ],
    subtotal: 15200, tax: 1216, total: 16416, status: "paid",
    issued: "2026-02-20", due: "2026-03-22", paidAmt: 16416, notes: "Paid in full",
  },
  {
    id: "s4", number: "INV-2026-0188", customer: "Midland Steel", email: "orders@midlandsteel.com",
    lines: [
      { id: "l4", desc: "SKU-7753 — Hex bolts grade 8 (x400)",   qty: 400, unit: 46.00, total: 18400 },
      { id: "l5", desc: "SKU-9034 — Lock washers (x1000)",        qty: 1000, unit: 4.20, total:  4200 },
    ],
    subtotal: 22600, tax: 1808, total: 24408, status: "sent",
    issued: "2026-03-10", due: "2026-04-09", paidAmt: 0, notes: "Net 30",
  },
];

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<InvStatus, { label: string; bg: string; color: string; border: string; icon: any }> = {
  draft:   { label: "Draft",   bg: C.surface,   color: C.subtle,  border: C.border,       icon: Clock       },
  sent:    { label: "Sent",    bg: C.blueBg,    color: C.blue,    border: C.blueBorder,   icon: Send        },
  paid:    { label: "Paid",    bg: C.greenBg,   color: C.green,   border: C.greenBorder,  icon: CheckCircle },
  overdue: { label: "Overdue", bg: C.redBg,     color: C.red,     border: C.redBorder,    icon: AlertTriangle },
  partial: { label: "Partial", bg: C.amberBg,   color: C.amber,   border: C.amberBorder,  icon: Clock       },
};

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ status }: { status: InvStatus }) {
  const s = STATUS_CFG[status];
  const Icon = s.icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      <Icon size={10} /> {s.label}
    </span>
  );
}

// ── New Invoice modal ─────────────────────────────────────────────────────────
function NewInvoiceModal({ onSave, onClose }: { onSave: (inv: Invoice) => void; onClose: () => void }) {
  const [customer, setCustomer] = useState("");
  const [email,    setEmail]    = useState("");
  const [dueIn,    setDueIn]    = useState("30");
  const [notes,    setNotes]    = useState("Net 30");
  const [lines, setLines] = useState<InvLine[]>([
    { id: uid(), desc: "", qty: 1, unit: 0, total: 0 },
  ]);

  const updateLine = (id: string, field: keyof InvLine, val: string) => {
    setLines(ls => ls.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: field === "desc" ? val : parseFloat(val) || 0 };
      updated.total = parseFloat((updated.qty * updated.unit).toFixed(2));
      return updated;
    }));
  };
  const addLine    = () => setLines(ls => [...ls, { id: uid(), desc: "", qty: 1, unit: 0, total: 0 }]);
  const removeLine = (id: string) => setLines(ls => ls.filter(l => l.id !== id));

  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const tax      = parseFloat((subtotal * 0.08).toFixed(2));
  const total    = parseFloat((subtotal + tax).toFixed(2));
  const issuedOn = today();
  const dueOn    = addDays(issuedOn, parseInt(dueIn) || 30);

  const save = () => {
    if (!customer.trim()) return;
    const inv: Invoice = {
      id: uid(), number: invNo(), customer: customer.trim(),
      email: email.trim(), lines, subtotal: parseFloat(subtotal.toFixed(2)),
      tax, total, status: "draft", issued: issuedOn, due: dueOn,
      paidAmt: 0, notes,
    };
    onSave(inv);
    onClose();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 100, padding: "16px",
    }}>
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: "28px 28px 24px",
        width: "100%", maxWidth: 620, maxHeight: "90vh",
        overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.18)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text }}>New Invoice</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 20 }}>✕</button>
        </div>

        {/* Customer + email */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          {[
            { label: "Customer Name *", val: customer, set: setCustomer, ph: "e.g. Acme Corp" },
            { label: "Customer Email",  val: email,    set: setEmail,    ph: "buyer@acmecorp.com" },
          ].map(({ label, val, set, ph }) => (
            <div key={label}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</label>
              <input value={val} onChange={e => set(e.target.value)} placeholder={ph}
                style={{ width: "100%", padding: "9px 11px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
          ))}
        </div>

        {/* Due + notes */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Due In (days)</label>
            <select value={dueIn} onChange={e => setDueIn(e.target.value)}
              style={{ width: "100%", padding: "9px 11px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, outline: "none" }}>
              {["7","15","30","45","60","90"].map(d => <option key={d} value={d}>Net {d}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Payment terms, notes…"
              style={{ width: "100%", padding: "9px 11px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
        </div>

        {/* Line items */}
        <SectionTitle>Line Items</SectionTitle>
        <div style={{ marginBottom: 10 }}>
          {lines.map((l, i) => (
            <div key={l.id} style={{ display: "grid", gridTemplateColumns: "3fr 80px 100px 100px 28px", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <input value={l.desc} onChange={e => updateLine(l.id, "desc", e.target.value)} placeholder={`Item ${i + 1} description`}
                style={{ padding: "8px 10px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, fontSize: 12, outline: "none" }} />
              <input type="number" value={l.qty} onChange={e => updateLine(l.id, "qty", e.target.value)} placeholder="Qty"
                style={{ padding: "8px 8px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, fontSize: 12, outline: "none", textAlign: "right" }} />
              <input type="number" value={l.unit} onChange={e => updateLine(l.id, "unit", e.target.value)} placeholder="Unit $"
                style={{ padding: "8px 8px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, fontSize: 12, outline: "none", textAlign: "right" }} />
              <div style={{ padding: "8px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, fontSize: 12, textAlign: "right", fontWeight: 600 }}>
                {fmtMoney(l.total)}
              </div>
              <button onClick={() => removeLine(l.id)} disabled={lines.length === 1}
                style={{ background: "none", border: "none", cursor: lines.length === 1 ? "not-allowed" : "pointer", color: C.red, fontSize: 16, opacity: lines.length === 1 ? 0.3 : 1 }}>✕</button>
            </div>
          ))}
        </div>
        <button onClick={addLine} style={{ fontSize: 12, fontWeight: 700, color: C.blue, background: "none", border: `1px dashed ${C.blueBorder}`, borderRadius: 7, padding: "7px 14px", cursor: "pointer", marginBottom: 20 }}>
          + Add line item
        </button>

        {/* Totals */}
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
          {[["Subtotal", fmtMoney(subtotal)], ["Tax (8%)", fmtMoney(tax)]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.muted, marginBottom: 6 }}>
              <span>{k}</span><span>{v}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, color: C.text, borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
            <span>Total</span><span>{fmtMoney(total)}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", background: "none", border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button onClick={save} disabled={!customer.trim()}
            style={{ padding: "10px 22px", background: customer.trim() ? C.blue : C.border, border: "none", borderRadius: 8, color: customer.trim() ? "#fff" : C.muted, fontSize: 13, fontWeight: 700, cursor: customer.trim() ? "pointer" : "not-allowed" }}>
            Save as Draft
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────
function InvoiceDetail({ inv, onClose, onStatusChange, onRecordPayment }: {
  inv: Invoice;
  onClose: () => void;
  onStatusChange: (id: string, s: InvStatus) => void;
  onRecordPayment: (id: string, amt: number) => void;
}) {
  const [payAmt, setPayAmt] = useState("");
  const outstanding = inv.total - inv.paidAmt;

  const recordPay = () => {
    const amt = parseFloat(payAmt);
    if (!amt || amt <= 0) return;
    onRecordPayment(inv.id, amt);
    setPayAmt("");
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 100, padding: "16px",
    }}>
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: "28px",
        width: "100%", maxWidth: 560, maxHeight: "90vh",
        overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.18)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Invoice</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{inv.number}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Badge status={inv.status} />
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 20 }}>✕</button>
          </div>
        </div>

        {/* Customer + dates */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
          {[
            ["Bill To",  inv.customer],
            ["Email",    inv.email || "—"],
            ["Issued",   fmtDate(inv.issued)],
            ["Due",      fmtDate(inv.due)],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{k}</div>
              <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Lines */}
        <div style={{ background: C.bg, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}`, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "3fr 60px 90px 90px", gap: 8, padding: "8px 12px", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${C.border}` }}>
            <span>Description</span><span style={{ textAlign: "right" }}>Qty</span><span style={{ textAlign: "right" }}>Unit</span><span style={{ textAlign: "right" }}>Total</span>
          </div>
          {inv.lines.map(l => (
            <div key={l.id} style={{ display: "grid", gridTemplateColumns: "3fr 60px 90px 90px", gap: 8, padding: "10px 12px", fontSize: 13, borderBottom: `1px solid ${C.border}`, color: C.text }}>
              <span>{l.desc}</span>
              <span style={{ textAlign: "right", color: C.muted }}>{l.qty}</span>
              <span style={{ textAlign: "right", color: C.muted }}>{fmtMoney(l.unit)}</span>
              <span style={{ textAlign: "right", fontWeight: 600 }}>{fmtMoney(l.total)}</span>
            </div>
          ))}
          <div style={{ padding: "10px 12px" }}>
            {[["Subtotal", fmtMoney(inv.subtotal)], ["Tax (8%)", fmtMoney(inv.tax)]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted, marginBottom: 4 }}>
                <span>{k}</span><span>{v}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, color: C.text, borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
              <span>Total</span><span>{fmtMoney(inv.total)}</span>
            </div>
            {inv.paidAmt > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.green, marginTop: 6, fontWeight: 700 }}>
                <span>Paid</span><span>{fmtMoney(inv.paidAmt)}</span>
              </div>
            )}
            {outstanding > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 800, color: C.red, marginTop: 4 }}>
                <span>Outstanding</span><span>{fmtMoney(outstanding)}</span>
              </div>
            )}
          </div>
        </div>

        {inv.notes && (
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, padding: "8px 12px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
            {inv.notes}
          </div>
        )}

        {/* Actions */}
        {inv.status !== "paid" && (
          <div style={{ background: C.greenBg, border: `1px solid ${C.greenBorder}`, borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 10 }}>Record Payment</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="number" value={payAmt} onChange={e => setPayAmt(e.target.value)}
                placeholder={`Up to ${fmtMoney(outstanding)}`}
                style={{ flex: 1, padding: "8px 10px", background: C.surface, border: `1px solid ${C.greenBorder}`, borderRadius: 7, color: C.text, fontSize: 13, outline: "none" }} />
              <button onClick={recordPay} style={{ padding: "8px 18px", background: C.green, border: "none", borderRadius: 7, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Record
              </button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {inv.status === "draft" && (
            <button onClick={() => onStatusChange(inv.id, "sent")} style={{ padding: "9px 18px", background: C.blue, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <Send size={13} /> Mark as Sent
            </button>
          )}
          <button onClick={() => onStatusChange(inv.id, "paid")} style={{ padding: "9px 18px", background: C.greenBg, border: `1px solid ${C.greenBorder}`, borderRadius: 8, color: C.green, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle size={13} /> Mark Paid in Full
          </button>
          <button onClick={onClose} style={{ padding: "9px 18px", background: "none", border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer", marginLeft: "auto" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function Invoicing() {
  const [invoices,  setInvoices]  = useState<Invoice[]>([]);
  const [search,    setSearch]    = useState("");
  const [filter,    setFilter]    = useState<InvStatus | "all">("all");
  const [showNew,   setShowNew]   = useState(false);
  const [selected,  setSelected]  = useState<Invoice | null>(null);

  useEffect(() => { setInvoices(loadInvoices()); }, []);

  const save = (list: Invoice[]) => { setInvoices(list); saveInvoices(list); };

  const addInvoice = (inv: Invoice) => save([inv, ...invoices]);

  const changeStatus = (id: string, status: InvStatus) => {
    save(invoices.map(i => i.id === id ? { ...i, status, paidAmt: status === "paid" ? i.total : i.paidAmt } : i));
    setSelected(prev => prev?.id === id ? { ...prev, status, paidAmt: status === "paid" ? prev.total : prev.paidAmt } : prev);
  };

  const recordPayment = (id: string, amt: number) => {
    save(invoices.map(inv => {
      if (inv.id !== id) return inv;
      const paidAmt = Math.min(inv.total, inv.paidAmt + amt);
      const status: InvStatus = paidAmt >= inv.total ? "paid" : "partial";
      return { ...inv, paidAmt, status };
    }));
    setSelected(prev => {
      if (!prev || prev.id !== id) return prev;
      const paidAmt = Math.min(prev.total, prev.paidAmt + amt);
      return { ...prev, paidAmt, status: paidAmt >= prev.total ? "paid" : "partial" };
    });
  };

  const visible = invoices.filter(i => {
    const matchFilter = filter === "all" || i.status === filter;
    const matchSearch = !search || i.customer.toLowerCase().includes(search.toLowerCase()) || i.number.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalOutstanding = invoices.filter(i => i.status !== "paid").reduce((s, i) => s + (i.total - i.paidAmt), 0);
  const totalOverdue     = invoices.filter(i => i.status === "overdue").reduce((s, i) => s + (i.total - i.paidAmt), 0);
  const totalPaidMTD     = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.paidAmt, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* ── Summary cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {[
          { label: "Outstanding",   val: fmtMoney(totalOutstanding), bg: C.blueBg,  color: C.blue,  border: C.blueBorder  },
          { label: "Overdue",       val: fmtMoney(totalOverdue),     bg: C.redBg,   color: C.red,   border: C.redBorder   },
          { label: "Paid (all time)", val: fmtMoney(totalPaidMTD),   bg: C.greenBg, color: C.green, border: C.greenBorder },
        ].map(({ label, val, bg, color, border }) => (
          <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by customer or invoice no…"
            style={{ width: "100%", padding: "8px 10px 8px 30px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          {(["all","draft","sent","partial","overdue","paid"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "7px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none",
              background: filter === f ? C.blue : C.surface,
              color:      filter === f ? "#fff" : C.muted,
              boxShadow:  filter === f ? `0 2px 8px ${C.blue}44` : "none",
            }}>
              {f === "all" ? "All" : STATUS_CFG[f].label}
            </button>
          ))}
        </div>

        <button onClick={() => setShowNew(true)} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 16px", background: C.blue, border: "none",
          borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
        }}>
          <Plus size={14} /> New Invoice
        </button>
      </div>

      {/* ── Invoice list ── */}
      <Card>
        {visible.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}>
            <Receipt size={32} style={{ marginBottom: 10, opacity: 0.4 }} />
            <div>No invoices found</div>
          </div>
        ) : visible.map((inv, idx) => {
          const outstanding = inv.total - inv.paidAmt;
          return (
            <div key={inv.id} onClick={() => setSelected(inv)} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 4px", cursor: "pointer",
              borderBottom: idx < visible.length - 1 ? `1px solid ${C.border}` : "none",
              transition: "background 0.1s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 38, height: 38, background: C.blueBg, border: `1px solid ${C.blueBorder}`, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Receipt size={16} color={C.blue} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{inv.number}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{inv.customer} · Due {fmtDate(inv.due)}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{fmtMoney(inv.total)}</div>
                  {outstanding > 0 && outstanding < inv.total && (
                    <div style={{ fontSize: 11, color: C.amber }}>{fmtMoney(outstanding)} outstanding</div>
                  )}
                </div>
                <Badge status={inv.status} />
              </div>
            </div>
          );
        })}
      </Card>

      {showNew   && <NewInvoiceModal onSave={addInvoice} onClose={() => setShowNew(false)} />}
      {selected  && <InvoiceDetail  inv={selected} onClose={() => setSelected(null)} onStatusChange={changeStatus} onRecordPayment={recordPayment} />}
    </div>
  );
}
