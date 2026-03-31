"use client";
// Phase 15: Multi-currency support — invoices now store and display currency.
// Phase 12: Pricing Rules Engine — auto-apply discount rules on save.
// Phase 17: CSV export.
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { PricingRule, applyPricingRules, getRulesSummary } from "@/lib/pricingRules";
import { downloadCSV } from "@/lib/exportCSV";
import {
  Plus, ChevronLeft, CheckCircle, Clock, AlertCircle,
  XCircle, Trash2, User, Calendar, Hash, DollarSign,
  FileText, Receipt, CreditCard, RefreshCw, Download,
} from "lucide-react";
import { C, fmt } from "@/lib/utils";
import { fmtCurrency, CURRENCIES, DEFAULT_CURRENCY } from "@/lib/currencies";
import { loadWorkspace } from "@/lib/workspace";

interface InvoiceItem {
  id:        string;
  desc:      string;
  qty:       number;
  unitPrice: number;
  total:     number;
}

type InvoiceStatus = "unpaid" | "paid" | "overdue" | "partial";
type PaymentTerms  = "Net 15" | "Net 30" | "Net 60" | "Prepaid" | "Cash on Delivery";

interface Invoice {
  id:            string;
  invoiceNumber: string;
  customer:      string;
  items:         InvoiceItem[];
  subtotal:      number;
  tax:           number;
  total:         number;
  amountPaid:    number;
  paymentTerms:  PaymentTerms;
  issueDate:     string;
  dueDate:       string;
  status:        InvoiceStatus;
  notes:         string;
  currency:      string;  // Phase 15
  createdAt:     string;
}

const STATUS_CONFIG: Record<InvoiceStatus, {
  label: string; color: string; bg: string; border: string; icon: any;
}> = {
  unpaid:  { label: "Unpaid",   color: C.amber,  bg: C.amberBg,  border: C.amberBorder,  icon: Clock       },
  paid:    { label: "Paid",     color: C.green,  bg: C.greenBg,  border: C.greenBorder,  icon: CheckCircle },
  overdue: { label: "Overdue",  color: C.red,    bg: C.redBg,    border: C.redBorder,    icon: AlertCircle },
  partial: { label: "Partial",  color: C.purple, bg: C.purpleBg, border: C.purpleBorder, icon: RefreshCw   },
};

const TERMS_DAYS: Record<PaymentTerms, number> = {
  "Net 15": 15, "Net 30": 30, "Net 60": 60,
  "Prepaid": 0, "Cash on Delivery": 0,
};

const makeId      = () => Math.random().toString(36).slice(2, 9);
const makeInvNum  = () => `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
const fmtDate     = (d: string) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
// Phase 15: currency-aware money formatter — uses invoice currency if provided, else workspace default
const fmtMoney = (n: number, currencyCode?: string) => fmtCurrency(n, currencyCode ?? DEFAULT_CURRENCY);

function calcDueDate(issueDate: string, terms: PaymentTerms): string {
  const d = new Date(issueDate);
  d.setDate(d.getDate() + TERMS_DAYS[terms]);
  return d.toISOString().split("T")[0];
}

function deriveStatus(inv: Invoice): InvoiceStatus {
  if (inv.amountPaid >= inv.total) return "paid";
  if (inv.amountPaid > 0)         return "partial";
  if (new Date(inv.dueDate) < new Date()) return "overdue";
  return "unpaid";
}

const STORAGE_KEY = "industrialos_invoices";

function loadInvoices(): Invoice[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

function saveInvoices(invs: Invoice[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(invs));
}

function getWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("workspaceDbId");
}

async function fetchInvoicesFromDb(): Promise<Invoice[]> {
  const wid = getWorkspaceId();
  if (!wid) return [];
  try {
    const res = await fetch(`/api/invoices?workspaceId=${wid}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((d: any) => ({
      id:            d.id,
      invoiceNumber: d.invoiceNumber,
      customer:      d.customer,
      items:         Array.isArray(d.items) ? d.items : JSON.parse(d.items || "[]"),
      subtotal:      d.subtotal,
      tax:           d.tax,
      total:         d.total,
      amountPaid:    d.amountPaid,
      paymentTerms:  d.paymentTerms as PaymentTerms,
      issueDate:     d.issueDate,
      dueDate:       d.dueDate,
      status:        deriveStatus(d) as InvoiceStatus,
      notes:         d.notes,
      currency:      d.currency ?? "USD",  // Phase 15
      createdAt:     typeof d.createdAt === "string" ? d.createdAt : new Date(d.createdAt).toISOString(),
    }));
  } catch { return []; }
}

async function createInvoiceInDb(inv: Invoice): Promise<void> {
  const wid = getWorkspaceId();
  if (!wid) return;
  try {
    await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...inv, workspaceId: wid }),
    });
  } catch {}
}

async function updateInvoiceInDb(id: string, patch: Partial<Invoice>): Promise<void> {
  try {
    await fetch("/api/invoices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
  } catch {}
}

async function deleteInvoiceFromDb(id: string): Promise<void> {
  try { await fetch(`/api/invoices?id=${id}`, { method: "DELETE" }); } catch {}
}


const Card = ({ children, style = {} }: any) => (
  <div style={{
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 14, padding: "20px 22px", ...style,
  }}>{children}</div>
);

const SectionTitle = ({ children }: any) => (
  <div style={{ fontWeight: 700, fontSize: 13, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
    {children}
  </div>
);

const Badge = ({ status }: { status: InvoiceStatus }) => {
  const s = STATUS_CONFIG[status];
  const Icon = s.icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 999, fontSize: 11,
      fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`,
    }}>
      <Icon size={10} />{s.label}
    </span>
  );
};

const Input = ({ label, value, onChange, type = "text", placeholder = "" }: any) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%", padding: "10px 12px",
        background: C.bg, border: `1px solid ${C.border}`,
        borderRadius: 9, color: C.text, fontSize: 13,
        outline: "none", boxSizing: "border-box", fontFamily: "inherit",
      }}
    />
  </div>
);

export default function Invoicing() {
  const { data: session } = useSession();
  const isViewer = session?.user?.role === "viewer";
  const [view,     setView]     = useState<"list" | "create" | "detail">("list");
  const [invoices, setInvoices] = useState<Invoice[]>(() => loadInvoices());
  const [selected,  setSelected]  = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payError,  setPayError]  = useState("");

  useEffect(() => {
    const refreshed = invoices.map(inv => ({ ...inv, status: deriveStatus(inv) }));
    const changed   = refreshed.some((r, i) => r.status !== invoices[i].status);
    if (changed) {
      setInvoices(refreshed);
      saveInvoices(refreshed);
    }
  }, []);

  useEffect(() => {
    fetchInvoicesFromDb().then(dbInvs => {
      if (dbInvs.length > 0) {
        setInvoices(dbInvs);
        saveInvoices(dbInvs);
      }
    });
    // Phase 12: load pricing rules
    const wid = getWorkspaceId();
    if (wid) {
      fetch(`/api/pricing-rules?workspaceId=${wid}`)
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setPriceRules(data); })
        .catch(() => {});
    }
  }, []);

  const [formCustomer, setFormCustomer] = useState("");
  const [formTerms,    setFormTerms]    = useState<PaymentTerms>("Net 30");
  const [formNotes,    setFormNotes]    = useState("");
  // Phase 15 — currency defaults to workspace setting
  const [formCurrency, setFormCurrency] = useState<string>(() => loadWorkspace()?.currency ?? DEFAULT_CURRENCY);
  const [formItems,    setFormItems]    = useState<InvoiceItem[]>([
    { id: makeId(), desc: "", qty: 1, unitPrice: 0, total: 0 },
  ]);
  const [formError,    setFormError]    = useState("");
  // Phase 12: Pricing rules
  const [priceRules,   setPriceRules]   = useState<PricingRule[]>([]);
  const [rulesBanner,  setRulesBanner]  = useState("");

  const updateItem = (id: string, field: "desc" | "qty" | "unitPrice", val: string) => {
    setFormItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const updated = {
        ...it,
        [field]: field === "desc" ? val : parseFloat(val) || 0,
      };
      updated.total = updated.qty * updated.unitPrice;
      return updated;
    }));
  };

  const addItem = () =>
    setFormItems(prev => [...prev, { id: makeId(), desc: "", qty: 1, unitPrice: 0, total: 0 }]);

  const removeItem = (id: string) =>
    setFormItems(prev => prev.length > 1 ? prev.filter(it => it.id !== id) : prev);

  const formSubtotal = formItems.reduce((s, it) => s + it.total, 0);
  const formTax      = parseFloat((formSubtotal * 0.08).toFixed(2));
  const formTotal    = parseFloat((formSubtotal + formTax).toFixed(2));

  const resetForm = () => {
    setFormCustomer(""); setFormTerms("Net 30"); setFormNotes(""); setFormError("");
    setFormItems([{ id: makeId(), desc: "", qty: 1, unitPrice: 0, total: 0 }]);
    setRulesBanner("");
  };

  const downloadPDF = async (inv: Invoice) => {
    const { generateInvoicePDF } = await import('@/lib/generatePDF')
    generateInvoicePDF(inv)
  };

  const [emailTo,      setEmailTo]      = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailMsg,     setEmailMsg]     = useState("");
  const [showEmail,    setShowEmail]    = useState(false);

  const sendEmail = async (inv: Invoice) => {
    if (!emailTo.trim()) { setEmailMsg("Enter an email address."); return; }
    setEmailSending(true); setEmailMsg("");
    try {
      const res  = await fetch("/api/email", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type: "invoice", to: emailTo.trim(), data: inv }),
      });
      const data = await res.json();
      if (!res.ok) { setEmailMsg(data.error || "Failed to send."); }
      else         { setEmailMsg("Email sent successfully!"); setEmailTo(""); setShowEmail(false); }
    } catch { setEmailMsg("Network error. Please try again."); }
    finally { setEmailSending(false); }
  };

  const saveInvoice = () => {
    if (!formCustomer.trim())                    { setFormError("Customer name is required."); return; }
    if (formItems.some(it => !it.desc.trim()))   { setFormError("All line items need a description."); return; }
    if (formItems.some(it => it.unitPrice <= 0)) { setFormError("All items need a price greater than $0."); return; }

    const today   = new Date().toISOString().split("T")[0];
    const dueDate = calcDueDate(today, formTerms);

    // Phase 12: auto-apply pricing rules
    let finalItems = formItems;
    let finalSubtotal = formSubtotal;
    let finalTax      = formTax;
    let finalTotal    = formTotal;
    if (priceRules.length > 0) {
      const ruleItems = formItems.map(it => ({
        id: it.id, sku: "", desc: it.desc,
        qty: it.qty, unitPrice: it.unitPrice,
        discount: 0, total: it.total,
      }));
      const applied = applyPricingRules(priceRules, formCustomer.trim(), ruleItems);
      const banner  = getRulesSummary(priceRules, formCustomer.trim(), applied);
      setRulesBanner(banner);
      finalItems    = applied.map(it => ({ id: it.id, desc: it.desc, qty: it.qty, unitPrice: it.unitPrice, total: it.total }));
      finalSubtotal = parseFloat(finalItems.reduce((s, it) => s + it.total, 0).toFixed(2));
      finalTax      = parseFloat((finalSubtotal * 0.08).toFixed(2));
      finalTotal    = parseFloat((finalSubtotal + finalTax).toFixed(2));
    }

    const newInv: Invoice = {
      id:            makeId(),
      invoiceNumber: makeInvNum(),
      customer:      formCustomer.trim(),
      items:         finalItems,
      subtotal:      finalSubtotal,
      tax:           finalTax,
      total:         finalTotal,
      amountPaid:    0,
      paymentTerms:  formTerms,
      issueDate:     today,
      dueDate,
      status:        "unpaid",
      notes:         formNotes.trim(),
      currency:      formCurrency,  // Phase 15
      createdAt:     new Date().toISOString(),
    };

    const updated = [newInv, ...invoices];
    setInvoices(updated);
    saveInvoices(updated);
    createInvoiceInDb(newInv);
    setSelected(newInv);
    resetForm();
    setView("detail");
  };

  const deleteInvoice = (id: string) => {
    const updated = invoices.filter(inv => inv.id !== id);
    setInvoices(updated);
    saveInvoices(updated);
    deleteInvoiceFromDb(id);
    setSelected(null);
    setView("list");
  };

  const recordPayment = () => {
    if (!selected) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) { setPayError("Enter a valid amount."); return; }
    const remaining = selected.total - selected.amountPaid;
    if (amount > remaining) { setPayError(`Max payment is ${fmtMoney(remaining, selected?.currency)}.`); return; }

    const newPaid = selected.amountPaid + amount;
    const updated = invoices.map(inv => {
      if (inv.id !== selected.id) return inv;
      const upd = { ...inv, amountPaid: newPaid };
      upd.status = deriveStatus(upd);
      return upd;
    });
    setInvoices(updated);
    saveInvoices(updated);
    const refreshed = updated.find(i => i.id === selected.id)!;
    updateInvoiceInDb(selected.id, { amountPaid: refreshed.amountPaid, status: refreshed.status });
    setSelected(refreshed);
    setPayAmount("");
    setPayError("");
  };

  const markFullyPaid = () => {
    if (!selected) return;
    const updated = invoices.map(inv => {
      if (inv.id !== selected.id) return inv;
      return { ...inv, amountPaid: inv.total, status: "paid" as InvoiceStatus };
    });
    setInvoices(updated);
    saveInvoices(updated);
    updateInvoiceInDb(selected.id, { amountPaid: selected.total, status: "paid" });
    setSelected(updated.find(i => i.id === selected.id)!);
    setPayAmount("");
    setPayError("");
  };

  const totalOutstanding = invoices
    .filter(i => i.status !== "paid")
    .reduce((s, i) => s + (i.total - i.amountPaid), 0);
  const overdueCount = invoices.filter(i => i.status === "overdue").length;
  const paidThisMonth = invoices
    .filter(i => i.status === "paid" && new Date(i.createdAt).getMonth() === new Date().getMonth())
    .reduce((s, i) => s + i.total, 0);

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  if (view === "list") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>Invoicing &amp; Payments</h1>
          <p style={{ color: C.muted, fontSize: 13 }}>Track payments, manage overdue invoices, record receipts.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {/* Phase 17: CSV Export */}
          <button
            onClick={() => downloadCSV(`invoices_${new Date().toISOString().split("T")[0]}`, invoices.map(inv => ({
              "Invoice #":    inv.invoiceNumber,
              Customer:       inv.customer,
              Status:         inv.status,
              Subtotal:       inv.subtotal,
              Tax:            inv.tax,
              Total:          inv.total,
              "Amount Paid":  inv.amountPaid,
              Currency:       inv.currency,
              "Payment Terms":inv.paymentTerms,
              "Issue Date":   inv.issueDate,
              "Due Date":     inv.dueDate,
              Notes:          inv.notes,
            })))}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, color: C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            <Download size={14} /> Export CSV
          </button>
          {!isViewer && (
            <button
              onClick={() => { resetForm(); setView("create"); }}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              <Plus size={15} /> New Invoice
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {[
          { label: "Outstanding",     value: fmtMoney(totalOutstanding), color: C.amber,  bg: C.amberBg,  border: C.amberBorder,  icon: DollarSign  },
          { label: "Overdue",         value: `${overdueCount} invoice${overdueCount !== 1 ? "s" : ""}`, color: C.red, bg: C.redBg, border: C.redBorder, icon: AlertCircle },
          { label: "Paid This Month", value: fmtMoney(paidThisMonth),    color: C.green,  bg: C.greenBg,  border: C.greenBorder,  icon: CheckCircle },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: C.surface, border: `1px solid ${s.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={17} color={s.color} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {overdueCount > 0 && (
        <div style={{ padding: "12px 16px", background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 10, fontSize: 13, color: C.red, display: "flex", alignItems: "center", gap: 10 }}>
          <AlertCircle size={15} />
          <strong>{overdueCount} overdue invoice{overdueCount !== 1 ? "s" : ""}</strong> — follow up with customers to collect payment.
        </div>
      )}

      {invoices.length === 0 ? (
        <Card style={{ textAlign: "center", padding: "60px 24px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🧾</div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 8 }}>No invoices yet</h3>
          <p style={{ color: C.muted, fontSize: 14, marginBottom: 24 }}>Create your first invoice to start tracking payments.</p>
          {!isViewer && (
            <button onClick={() => { resetForm(); setView("create"); }} style={{ padding: "11px 24px", borderRadius: 10, background: `linear-gradient(135deg,${C.blue},${C.purple})`, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Create First Invoice
            </button>
          )}
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                {["Invoice #", "Customer", "Amount", "Paid", "Due Date", "Status", ""].map((h, i) => (
                  <th key={i} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, i) => (
                <tr
                  key={inv.id}
                  onClick={() => { setSelected(inv); setPayAmount(""); setPayError(""); setView("detail"); }}
                  style={{ borderBottom: i < invoices.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "13px 16px", fontWeight: 700, color: C.blue, fontFamily: "monospace" }}>{inv.invoiceNumber}</td>
                  <td style={{ padding: "13px 16px", fontWeight: 600, color: C.text }}>{inv.customer}</td>
                  <td style={{ padding: "13px 16px", fontWeight: 700, color: C.text }}>{fmtMoney(inv.total, inv.currency)}</td>
                  <td style={{ padding: "13px 16px", color: inv.amountPaid > 0 ? C.green : C.subtle }}>
                    {inv.amountPaid > 0 ? fmtMoney(inv.amountPaid, inv.currency) : "—"}
                  </td>
                  <td style={{ padding: "13px 16px", color: inv.status === "overdue" ? C.red : C.muted }}>{fmtDate(inv.dueDate)}</td>
                  <td style={{ padding: "13px 16px" }}><Badge status={inv.status} /></td>
                  <td style={{ padding: "13px 16px", color: C.subtle, fontSize: 11 }}>{fmtDate(inv.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );

  // ── CREATE VIEW ────────────────────────────────────────────────────────────
  if (view === "create") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 820 }}>
      <button onClick={() => { resetForm(); setView("list"); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", fontWeight: 600, padding: 0 }}>
        &#8592; Back to Invoices
      </button>

      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>New Invoice</h1>
        <p style={{ color: C.muted, fontSize: 13 }}>Fill in the details below. Tax (8%) is calculated automatically.</p>
      </div>

      <Card>
        <SectionTitle>Invoice Details</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Input label="Customer Name *" value={formCustomer} onChange={setFormCustomer} placeholder="e.g. Acme Corp" />
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Payment Terms</label>
            <select value={formTerms} onChange={e => setFormTerms(e.target.value as PaymentTerms)} style={{ width: "100%", padding: "10px 12px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9, color: C.text, fontSize: 13, outline: "none", fontFamily: "inherit" }}>
              {(["Net 15", "Net 30", "Net 60", "Prepaid", "Cash on Delivery"] as PaymentTerms[]).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        {/* Phase 15 — Currency selector */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Currency</label>
          <select value={formCurrency} onChange={e => setFormCurrency(e.target.value)} style={{ width: "100%", padding: "10px 12px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9, color: C.text, fontSize: 13, outline: "none", fontFamily: "inherit" }}>
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>{c.symbol}  {c.name} ({c.code})</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Notes (optional)</label>
          <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="e.g. Payment instructions, PO number, special terms…" rows={2}
            style={{ width: "100%", padding: "10px 12px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9, color: C.text, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>
      </Card>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>Line Items</span>
          <button onClick={addItem} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7, background: C.blueBg, border: `1px solid ${C.blueBorder}`, color: C.blue, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            <Plus size={12} /> Add Item
          </button>
        </div>
        <div style={{ padding: "14px 18px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1.2fr 1fr 28px", gap: 10, marginBottom: 8 }}>
            {["Description", "Qty", "Unit Price", "Total", ""].map((h, i) => (
              <div key={i} style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</div>
            ))}
          </div>
          {formItems.map(item => (
            <div key={item.id} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1.2fr 1fr 28px", gap: 10, marginBottom: 10 }}>
              <input value={item.desc} onChange={e => updateItem(item.id, "desc", e.target.value)} placeholder="e.g. SKU-4821 Industrial bolts"
                style={{ padding: "9px 11px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
              <input type="number" min="1" value={item.qty} onChange={e => updateItem(item.id, "qty", e.target.value)}
                style={{ padding: "9px 11px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, outline: "none", textAlign: "center" }} />
              <input type="number" min="0" step="0.01" value={item.unitPrice || ""} onChange={e => updateItem(item.id, "unitPrice", e.target.value)} placeholder="0.00"
                style={{ padding: "9px 11px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, outline: "none" }} />
              <div style={{ padding: "9px 11px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontWeight: 700, color: C.text }}>{fmtMoney(item.total, selected?.currency)}</div>
              <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <XCircle size={16} />
              </button>
            </div>
          ))}
          <div style={{ marginTop: 14, padding: "14px 0 0", borderTop: `1px solid ${C.border}` }}>
            {[
              ["Subtotal", fmtMoney(formSubtotal), false],
              ["Tax (8%)", fmtMoney(formTax),      false],
              ["Total",    fmtMoney(formTotal),     true ],
            ].map(([label, val, bold]) => (
              <div key={label as string} style={{ display: "flex", justifyContent: "flex-end", gap: 40, marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: C.muted }}>{label}</span>
                <span style={{ fontSize: bold ? 16 : 13, fontWeight: bold ? 800 : 600, color: bold ? C.text : C.muted, minWidth: 90, textAlign: "right" }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {formError && (
        <div style={{ padding: "10px 14px", background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 9, fontSize: 13, color: C.red }}>{formError}</div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={saveInvoice} style={{ flex: 1, padding: "13px", borderRadius: 10, background: `linear-gradient(135deg,${C.blue},${C.purple})`, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          Create Invoice &#8594;
        </button>
        <button onClick={() => { resetForm(); setView("list"); }} style={{ padding: "13px 20px", borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`, color: C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );

  // ── DETAIL VIEW ────────────────────────────────────────────────────────────
  if (view === "detail" && selected) {
    const remaining = selected.total - selected.amountPaid;
    const paidPct   = Math.round((selected.amountPaid / selected.total) * 100);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 820 }}>
        <button onClick={() => { setSelected(null); setView("list"); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", fontWeight: 600, padding: 0 }}>
          &#8592; Back to Invoices
        </button>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{selected.invoiceNumber}</h1>
              <Badge status={selected.status} />
            </div>
            <p style={{ color: C.muted, fontSize: 13 }}>
              Issued {fmtDate(selected.issueDate)} · Customer: <strong style={{ color: C.text }}>{selected.customer}</strong>
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => downloadPDF(selected)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, background: C.blueBg, border: `1px solid ${C.blueBorder}`, color: C.blue, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              &#8595; PDF
            </button>
            <button onClick={() => setShowEmail(v => !v)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, background: C.purpleBg, border: `1px solid ${C.purpleBorder}`, color: C.purple, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              &#9993; Email
            </button>
            {!isViewer && (
              <button onClick={() => deleteInvoice(selected.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, background: C.redBg, border: `1px solid ${C.redBorder}`, color: C.red, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <Trash2 size={13} /> Delete
              </button>
            )}
          </div>
        </div>

        {showEmail && (
          <div style={{ padding: "14px 16px", background: C.purpleBg, border: `1px solid ${C.purpleBorder}`, borderRadius: 10, display: "flex", gap: 10, alignItems: "center" }}>
            <input
              value={emailTo}
              onChange={e => { setEmailTo(e.target.value); setEmailMsg(""); }}
              placeholder="customer@email.com"
              type="email"
              style={{ flex: 1, padding: "8px 12px", background: C.surface, border: `1px solid ${C.purpleBorder}`, borderRadius: 8, fontSize: 13, color: C.text, outline: "none" }}
            />
            <button onClick={() => sendEmail(selected)} disabled={emailSending} style={{ padding: "8px 18px", borderRadius: 8, background: C.purple, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: emailSending ? "not-allowed" : "pointer", opacity: emailSending ? 0.7 : 1 }}>
              {emailSending ? "Sending..." : "Send"}
            </button>
            {emailMsg && <span style={{ fontSize: 12, color: emailMsg.includes("success") ? C.green : C.red, fontWeight: 600 }}>{emailMsg}</span>}
          </div>
        )}

        {/* Phase 12: Pricing rules banner */}
        {rulesBanner && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", background: C.greenBg, border: `1px solid ${C.greenBorder}`, borderRadius: 10 }}>
            <span style={{ fontSize: 15, flexShrink: 0 }}>🏷️</span>
            <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>{rulesBanner}</span>
          </div>
        )}

        {selected.status === "overdue" && (
          <div style={{ padding: "12px 16px", background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 10, fontSize: 13, color: C.red, display: "flex", alignItems: "center", gap: 10 }}>
            <AlertCircle size={15} />
            This invoice was due on <strong>{fmtDate(selected.dueDate)}</strong> and has not been fully paid.
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { icon: User,     label: "Customer",    value: selected.customer           },
            { icon: Hash,     label: "Invoice #",   value: selected.invoiceNumber      },
            { icon: Calendar, label: "Due Date",    value: fmtDate(selected.dueDate)   },
            { icon: FileText, label: "Terms",       value: selected.paymentTerms       },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} style={{ padding: "12px 14px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                <Icon size={11} color={C.muted} />
                <span style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{value}</div>
            </div>
          ))}
        </div>

        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "13px 18px 11px", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Line Items</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {["Description", "Qty", "Unit Price", "Total"].map(h => (
                  <th key={h} style={{ padding: "8px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selected.items.map(item => (
                <tr key={item.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: "11px 16px", color: C.text }}>{item.desc}</td>
                  <td style={{ padding: "11px 16px", color: C.muted }}>{item.qty.toLocaleString()}</td>
                  <td style={{ padding: "11px 16px", color: C.muted }}>{fmtMoney(item.unitPrice, selected?.currency)}</td>
                  <td style={{ padding: "11px 16px", fontWeight: 700, color: C.text }}>{fmtMoney(item.total, selected?.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: "14px 18px", borderTop: `1px solid ${C.border}`, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            {[
              ["Subtotal", fmtMoney(selected.subtotal, selected.currency), false],
              ["Tax (8%)", fmtMoney(selected.tax, selected.currency),      false],
              ["Total",    fmtMoney(selected.total, selected.currency),    true ],
            ].map(([label, val, bold]) => (
              <div key={label as string} style={{ display: "flex", gap: 40 }}>
                <span style={{ fontSize: 13, color: C.muted, minWidth: 80 }}>{label}</span>
                <span style={{ fontSize: bold ? 16 : 13, fontWeight: bold ? 800 : 600, color: bold ? C.text : C.muted, minWidth: 90, textAlign: "right" }}>{val}</span>
              </div>
            ))}
          </div>
        </Card>

        {selected.status !== "paid" && !isViewer && (
          <Card>
            <SectionTitle>Payment Progress</SectionTitle>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: C.muted }}>Paid: <strong style={{ color: C.green }}>{fmtMoney(selected.amountPaid, selected.currency)}</strong></span>
              <span style={{ color: C.muted }}>Remaining: <strong style={{ color: C.red }}>{fmtMoney(remaining, selected?.currency)}</strong></span>
              <span style={{ color: C.muted }}>{paidPct}% paid</span>
            </div>
            <div style={{ height: 10, background: C.bg, borderRadius: 999, overflow: "hidden", border: `1px solid ${C.border}`, marginBottom: 18 }}>
              <div style={{ height: "100%", width: `${paidPct}%`, background: `linear-gradient(90deg,${C.green},#52c89a)`, borderRadius: 999, transition: "width 0.4s" }} />
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Record Payment ($)</label>
                <input type="number" min="0" step="0.01" value={payAmount} onChange={e => { setPayAmount(e.target.value); setPayError(""); }} placeholder={`Up to ${fmtMoney(remaining, selected?.currency)}`}
                  style={{ width: "100%", padding: "10px 12px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9, color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              <button onClick={recordPayment} style={{ padding: "10px 18px", borderRadius: 9, background: C.blueBg, border: `1px solid ${C.blueBorder}`, color: C.blue, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                <CreditCard size={13} style={{ marginRight: 6, verticalAlign: "middle" }} />
                Record
              </button>
              <button onClick={markFullyPaid} style={{ padding: "10px 18px", borderRadius: 9, background: C.greenBg, border: `1px solid ${C.greenBorder}`, color: C.green, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                <CheckCircle size={13} style={{ marginRight: 6, verticalAlign: "middle" }} />
                Mark Fully Paid
              </button>
            </div>
            {payError && <div style={{ marginTop: 8, fontSize: 12, color: C.red }}>{payError}</div>}
          </Card>
        )}

        {selected.status === "paid" && (
          <div style={{ padding: "14px 18px", background: C.greenBg, border: `1px solid ${C.greenBorder}`, borderRadius: 12, fontSize: 14, color: C.green, display: "flex", alignItems: "center", gap: 10 }}>
            <CheckCircle size={18} />
            <div><strong>Fully paid</strong> — {fmtMoney(selected.total, selected.currency)} received.</div>
          </div>
        )}

        {selected.notes && (
          <Card>
            <SectionTitle>Notes</SectionTitle>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{selected.notes}</p>
          </Card>
        )}
      </div>
    );
  }

  return null;
}
