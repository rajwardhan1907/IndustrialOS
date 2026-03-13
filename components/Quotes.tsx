"use client";
// components/Quotes.tsx
// AI Quote Generator — demo version (no API key needed)
// The AI "thinking" is simulated but the UX is exactly how the real version will feel.
// When we upgrade to real AI, we just swap the parsePrompt() function for an API call.

import { useState, useRef, useEffect } from "react";
import { fmt, C } from "@/lib/utils";
import {
  Plus, Sparkles, ChevronLeft, FileText,
  Clock, CheckCircle, XCircle, Send, Trash2,
  Edit3, Package, User, Calendar, Hash,
  AlertCircle, Loader,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
interface LineItem {
  id:       string;
  sku:      string;
  desc:     string;
  qty:      number;
  unitPrice:number;
  discount: number; // percentage
  total:    number;
}

interface Quote {
  id:          string;
  quoteNumber: string;
  customer:    string;
  items:       LineItem[];
  subtotal:    number;
  discountAmt: number;
  tax:         number;
  total:       number;
  validUntil:  string;
  paymentTerms:string;
  notes:       string;
  status:      "draft" | "sent" | "accepted" | "declined" | "expired";
  createdAt:   string;
  prompt:      string; // the original plain-english prompt
}

// ── Status config ────────────────────────────────────────────────────────────
const STATUS: Record<Quote["status"], { label: string; color: string; bg: string; border: string; icon: any }> = {
  draft:    { label: "Draft",    color: C.muted,  bg: "#f0f0f0",  border: C.border,       icon: Edit3       },
  sent:     { label: "Sent",     color: C.blue,   bg: C.blueBg,   border: C.blueBorder,   icon: Send        },
  accepted: { label: "Accepted", color: C.green,  bg: C.greenBg,  border: C.greenBorder,  icon: CheckCircle },
  declined: { label: "Declined", color: C.red,    bg: C.redBg,    border: C.redBorder,    icon: XCircle     },
  expired:  { label: "Expired",  color: C.muted,  bg: "#f0f0f0",  border: C.border,       icon: AlertCircle },
};

// ── AI thinking steps (shown while "generating") ─────────────────────────────
const THINKING_STEPS = [
  "Reading your request…",
  "Identifying customer name…",
  "Extracting SKUs and quantities…",
  "Applying bulk discount rules…",
  "Setting payment terms…",
  "Calculating totals…",
  "Writing professional note…",
  "Quote ready ✓",
];

// ── Demo AI parser ────────────────────────────────────────────────────────────
// This reads the plain-english prompt and extracts data from it.
// It uses keyword matching for the demo. The real version calls Claude API.
function parsePrompt(prompt: string): Omit<Quote, "id" | "quoteNumber" | "status" | "createdAt"> {
  const lower = prompt.toLowerCase();

  // ── Extract customer name ─────────────────────────────────────────────────
  let customer = "New Customer";
  const forMatch = prompt.match(/for\s+([A-Z][A-Za-z\s&.,']+?)(?:\s*[,.]|\s+deliver|\s+by|\s*$)/);
  if (forMatch) customer = forMatch[1].trim();

  // ── Extract SKUs ──────────────────────────────────────────────────────────
  const skuMatches = Array.from(prompt.matchAll(/SKU[-–]?(\w+)/gi));
  const qtyMatches = Array.from(prompt.matchAll(/(\d{1,6})\s*(?:units?|pcs?|pieces?|x\s*SKU)/gi));
  const items: LineItem[] = [];

  if (skuMatches.length > 0) {
    skuMatches.forEach((m, i) => {
      const skuCode = `SKU-${m[1].toUpperCase()}`;
      const qty     = qtyMatches[i] ? parseInt(qtyMatches[i][1]) : 100;
      const base    = 80 + (skuCode.charCodeAt(4) % 200); // deterministic fake price
      const discount= qty >= 500 ? 10 : qty >= 200 ? 5 : qty >= 100 ? 3 : 0;
      const unit    = base * (1 - discount / 100);
      items.push({
        id:        `item-${i}`,
        sku:       skuCode,
        desc:      `Industrial component ${skuCode}`,
        qty,
        unitPrice: parseFloat(base.toFixed(2)),
        discount,
        total:     parseFloat((unit * qty).toFixed(2)),
      });
    });
  } else {
    // No SKUs found — create a placeholder item
    const qty = qtyMatches[0] ? parseInt(qtyMatches[0][1]) : 50;
    items.push({
      id:        "item-0",
      sku:       "SKU-TBD",
      desc:      "Product (please specify SKU)",
      qty,
      unitPrice: 150,
      discount:  qty >= 100 ? 5 : 0,
      total:     150 * qty * (qty >= 100 ? 0.95 : 1),
    });
  }

  // ── Extract delivery date ─────────────────────────────────────────────────
  let validUntil = "";
  const today = new Date();
  if (lower.includes("end of month")) {
    const eom = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    validUntil = eom.toISOString().split("T")[0];
  } else if (lower.includes("next week")) {
    const nw = new Date(today); nw.setDate(nw.getDate() + 7);
    validUntil = nw.toISOString().split("T")[0];
  } else {
    const dMatch = prompt.match(/by\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?)/i);
    if (dMatch) {
      const d = new Date(dMatch[1] + " " + today.getFullYear());
      validUntil = isNaN(d.getTime())
        ? new Date(today.getTime() + 30 * 86400000).toISOString().split("T")[0]
        : d.toISOString().split("T")[0];
    } else {
      validUntil = new Date(today.getTime() + 30 * 86400000).toISOString().split("T")[0];
    }
  }

  // ── Payment terms ─────────────────────────────────────────────────────────
  let paymentTerms = "Net 30";
  if (lower.includes("net 60"))  paymentTerms = "Net 60";
  if (lower.includes("net 15"))  paymentTerms = "Net 15";
  if (lower.includes("upfront") || lower.includes("prepaid")) paymentTerms = "Prepaid";
  if (lower.includes("cod"))     paymentTerms = "Cash on Delivery";

  // ── Totals ────────────────────────────────────────────────────────────────
  const subtotal    = items.reduce((s, it) => s + it.unitPrice * it.qty, 0);
  const discountAmt = items.reduce((s, it) => s + (it.unitPrice * it.qty * it.discount / 100), 0);
  const taxable     = subtotal - discountAmt;
  const tax         = parseFloat((taxable * 0.08).toFixed(2));
  const total       = parseFloat((taxable + tax).toFixed(2));

  // ── Professional note ─────────────────────────────────────────────────────
  const discountNote = discountAmt > 0
    ? ` A volume discount of ${items[0].discount}% has been applied.`
    : "";
  const notes = `Thank you for your inquiry, ${customer.split(" ")[0]}. Please find the attached quote for your review.${discountNote} This quote is valid until ${validUntil}. Payment terms are ${paymentTerms}. Please don't hesitate to reach out with any questions.`;

  return { customer, items, subtotal: parseFloat(subtotal.toFixed(2)), discountAmt: parseFloat(discountAmt.toFixed(2)), tax, total, validUntil, paymentTerms, notes, prompt };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const makeId    = () => Math.random().toString(36).slice(2, 9);
const makeQNum  = () => `QT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
const fmtDate   = (d: string) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
const fmtMoney  = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const STORAGE_KEY = "industrialos_quotes";

function loadQuotes(): Quote[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveQuotes(qs: Quote[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(qs));
}

// ── Sub-components ────────────────────────────────────────────────────────────
const Card = ({ children, style = {} }: any) => (
  <div style={{
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 14, padding: "20px 22px", ...style,
  }}>{children}</div>
);

const Badge = ({ status }: { status: Quote["status"] }) => {
  const s = STATUS[status];
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

// ── Main Component ────────────────────────────────────────────────────────────
export default function Quotes() {
  const [view,        setView]        = useState<"list" | "new" | "detail">("list");
  const [quotes,      setQuotes]      = useState<Quote[]>(() => loadQuotes());
  const [prompt,      setPrompt]      = useState("");
  const [thinking,    setThinking]    = useState(false);
  const [thinkStep,   setThinkStep]   = useState(0);
  const [draft,       setDraft]       = useState<Quote | null>(null);
  const [selected,    setSelected]    = useState<Quote | null>(null);
  const [editField,   setEditField]   = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when "new quote" opens
  useEffect(() => {
    if (view === "new" && textRef.current) textRef.current.focus();
  }, [view]);

  // ── Simulate AI generation ──────────────────────────────────────────────
  const generate = async () => {
    if (!prompt.trim()) return;
    setThinking(true);
    setThinkStep(0);

    // Walk through thinking steps with delays
    for (let i = 0; i < THINKING_STEPS.length; i++) {
      await new Promise(r => setTimeout(r, i === THINKING_STEPS.length - 1 ? 400 : 320));
      setThinkStep(i);
    }

    const parsed   = parsePrompt(prompt);
    const newQuote: Quote = {
      ...parsed,
      id:          makeId(),
      quoteNumber: makeQNum(),
      status:      "draft",
      createdAt:   new Date().toISOString(),
    };
    setDraft(newQuote);
    setThinking(false);
  };

  // ── Save quote ────────────────────────────────────────────────────────────
  const saveQuote = () => {
    if (!draft) return;
    const updated = [draft, ...quotes];
    setQuotes(updated);
    saveQuotes(updated);
    setSelected(draft);
    setDraft(null);
    setPrompt("");
    setView("detail");
  };

  // ── Delete quote ──────────────────────────────────────────────────────────
  const deleteQuote = (id: string) => {
    const updated = quotes.filter(q => q.id !== id);
    setQuotes(updated);
    saveQuotes(updated);
    setSelected(null);
    setView("list");
  };

  // ── Reset new quote form ──────────────────────────────────────────────────
  const resetNew = () => {
    setPrompt(""); setDraft(null); setThinking(false); setThinkStep(0);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // VIEW: LIST
  // ─────────────────────────────────────────────────────────────────────────
  if (view === "list") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>
            Quotes & RFQ
          </h1>
          <p style={{ color: C.muted, fontSize: 13 }}>
            Generate professional quotes in seconds using plain English.
          </p>
        </div>
        <button
          onClick={() => { resetNew(); setView("new"); }}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 20px", borderRadius: 10,
            background: `linear-gradient(135deg, ${C.blue}, #7c5cbf)`,
            border: "none", color: "#fff", fontSize: 13,
            fontWeight: 700, cursor: "pointer",
            boxShadow: `0 4px 16px ${C.blue}44`,
          }}
        >
          <Sparkles size={14} /> New AI Quote
        </button>
      </div>

      {/* Stats row */}
      {quotes.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { label: "Total Quotes",  value: quotes.length,                               color: C.blue,  bg: C.blueBg,  bdr: C.blueBorder  },
            { label: "Accepted",      value: quotes.filter(q => q.status === "accepted").length, color: C.green, bg: C.greenBg, bdr: C.greenBorder },
            { label: "Pending",       value: quotes.filter(q => q.status === "sent" || q.status === "draft").length, color: C.amber, bg: C.amberBg, bdr: C.amberBorder },
            { label: "Total Value",   value: fmtMoney(quotes.reduce((s, q) => s + q.total, 0)), color: C.purple, bg: C.purpleBg, bdr: C.purpleBorder },
          ].map((s, i) => (
            <div key={i} style={{
              background: s.bg, border: `1px solid ${s.bdr}`,
              borderRadius: 12, padding: "14px 16px",
            }}>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Quotes list */}
      {quotes.length === 0 ? (
        <Card>
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✨</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 8 }}>
              No quotes yet
            </h3>
            <p style={{ color: C.muted, fontSize: 14, marginBottom: 24, maxWidth: 360, margin: "0 auto 24px" }}>
              Click <strong>New AI Quote</strong> and type something like:<br />
              <em style={{ color: C.blue }}>"500 units of SKU-4821 for Acme Corp, deliver by end of month"</em>
            </p>
            <button
              onClick={() => { resetNew(); setView("new"); }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "12px 24px", borderRadius: 10,
                background: `linear-gradient(135deg, ${C.blue}, #7c5cbf)`,
                border: "none", color: "#fff", fontSize: 14,
                fontWeight: 700, cursor: "pointer",
              }}
            >
              <Sparkles size={15} /> Create Your First Quote
            </button>
          </div>
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                {["Quote #", "Customer", "Items", "Total", "Valid Until", "Status", ""].map((h, i) => (
                  <th key={i} style={{
                    padding: "10px 16px", textAlign: "left",
                    fontSize: 11, fontWeight: 700, color: C.muted,
                    textTransform: "uppercase", letterSpacing: "0.05em",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotes.map((q, i) => (
                <tr
                  key={q.id}
                  onClick={() => { setSelected(q); setView("detail"); }}
                  style={{
                    borderBottom: i < quotes.length - 1 ? `1px solid ${C.border}` : "none",
                    cursor: "pointer", transition: "background 0.1s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "12px 16px", fontWeight: 700, color: C.blue, fontFamily: "monospace" }}>{q.quoteNumber}</td>
                  <td style={{ padding: "12px 16px", color: C.text, fontWeight: 600 }}>{q.customer}</td>
                  <td style={{ padding: "12px 16px", color: C.muted }}>{q.items.length} item{q.items.length !== 1 ? "s" : ""}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 700, color: C.text }}>{fmtMoney(q.total)}</td>
                  <td style={{ padding: "12px 16px", color: C.muted }}>{fmtDate(q.validUntil)}</td>
                  <td style={{ padding: "12px 16px" }}><Badge status={q.status} /></td>
                  <td style={{ padding: "12px 16px", color: C.muted, fontSize: 11 }}>
                    {new Date(q.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // VIEW: NEW QUOTE
  // ─────────────────────────────────────────────────────────────────────────
  if (view === "new") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 780 }}>

      {/* Back button */}
      <button
        onClick={() => { resetNew(); setView("list"); }}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "none", border: "none", color: C.muted,
          fontSize: 13, cursor: "pointer", fontWeight: 600, padding: 0,
        }}
      >
        <ChevronLeft size={16} /> Back to Quotes
      </button>

      {/* Title */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>
          New AI Quote
        </h1>
        <p style={{ color: C.muted, fontSize: 13 }}>
          Just describe what you need in plain English. The AI handles the rest.
        </p>
      </div>

      {/* AI input card */}
      <Card style={{ position: "relative", overflow: "hidden" }}>
        {/* Gradient glow top */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, ${C.blue}, #7c5cbf, ${C.blue})`,
        }} />

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Sparkles size={16} color={C.blue} />
          <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Describe your quote</span>
        </div>

        <textarea
          ref={textRef}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate(); }}
          placeholder={
            `Try something like:\n` +
            `"500 units of SKU-4821 for Acme Corp, deliver by end of month"\n` +
            `"200 pieces of SKU-7753 and SKU-3318 for TechWave Ltd, Net 60"\n` +
            `"Quote for NovaBuild: 1000 units SKU-9034, urgent"`
          }
          disabled={thinking || !!draft}
          style={{
            width: "100%", minHeight: 100, padding: "12px 14px",
            background: "#f8f6f2", border: `1px solid ${C.border}`,
            borderRadius: 10, color: C.text, fontSize: 14,
            lineHeight: 1.6, resize: "vertical", outline: "none",
            fontFamily: "inherit", boxSizing: "border-box",
            opacity: thinking || draft ? 0.5 : 1,
          }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
          <span style={{ fontSize: 11, color: C.muted }}>
            Tip: Mention the customer name, SKU numbers, quantities, and delivery date.
            Press <kbd style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, padding: "1px 5px", fontSize: 10 }}>⌘ Enter</kbd> to generate.
          </span>
          <button
            onClick={generate}
            disabled={!prompt.trim() || thinking || !!draft}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 22px", borderRadius: 10,
              background: !prompt.trim() || thinking || draft
                ? C.border
                : `linear-gradient(135deg, ${C.blue}, #7c5cbf)`,
              border: "none", color: !prompt.trim() || thinking || draft ? C.muted : "#fff",
              fontSize: 13, fontWeight: 700, cursor: !prompt.trim() || thinking || draft ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}
          >
            {thinking ? <Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={14} />}
            {thinking ? "Generating…" : "Generate Quote"}
          </button>
        </div>
      </Card>

      {/* Thinking steps */}
      {thinking && (
        <Card style={{ background: C.blueBg, border: `1px solid ${C.blueBorder}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {THINKING_STEPS.map((step, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10,
                opacity: i <= thinkStep ? 1 : 0.25, transition: "opacity 0.3s",
              }}>
                {i < thinkStep
                  ? <CheckCircle size={13} color={C.green} />
                  : i === thinkStep
                    ? <Loader size={13} color={C.blue} style={{ animation: "spin 1s linear infinite" }} />
                    : <div style={{ width: 13, height: 13, borderRadius: "50%", border: `1px solid ${C.border}` }} />
                }
                <span style={{
                  fontSize: 13, fontWeight: i <= thinkStep ? 600 : 400,
                  color: i < thinkStep ? C.green : i === thinkStep ? C.blue : C.muted,
                }}>{step}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Generated quote preview */}
      {draft && !thinking && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CheckCircle size={18} color={C.green} />
            <span style={{ fontWeight: 700, fontSize: 15, color: C.green }}>
              Quote generated! Review and save.
            </span>
          </div>

          {/* Quote header info */}
          <Card>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { icon: Hash,      label: "Quote Number",   value: draft.quoteNumber },
                { icon: User,      label: "Customer",       value: draft.customer    },
                { icon: Calendar,  label: "Valid Until",    value: fmtDate(draft.validUntil) },
                { icon: Clock,     label: "Payment Terms",  value: draft.paymentTerms },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} style={{
                  padding: "12px 14px", background: C.bg,
                  borderRadius: 10, border: `1px solid ${C.border}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Icon size={12} color={C.muted} />
                    <span style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{value}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Line items */}
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px 12px", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>
                Line Items
              </span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.bg }}>
                  {["SKU", "Description", "Qty", "Unit Price", "Discount", "Total"].map(h => (
                    <th key={h} style={{
                      padding: "8px 16px", textAlign: "left",
                      fontSize: 11, fontWeight: 700, color: C.muted,
                      textTransform: "uppercase", letterSpacing: "0.05em",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {draft.items.map((item, i) => (
                  <tr key={item.id} style={{
                    borderTop: `1px solid ${C.border}`,
                  }}>
                    <td style={{ padding: "11px 16px", fontFamily: "monospace", fontWeight: 700, color: C.blue }}>{item.sku}</td>
                    <td style={{ padding: "11px 16px", color: C.text }}>{item.desc}</td>
                    <td style={{ padding: "11px 16px", color: C.text, fontWeight: 600 }}>{item.qty.toLocaleString()}</td>
                    <td style={{ padding: "11px 16px", color: C.text }}>{fmtMoney(item.unitPrice)}</td>
                    <td style={{ padding: "11px 16px" }}>
                      {item.discount > 0
                        ? <span style={{ color: C.green, fontWeight: 700 }}>−{item.discount}%</span>
                        : <span style={{ color: C.muted }}>—</span>
                      }
                    </td>
                    <td style={{ padding: "11px 16px", fontWeight: 700, color: C.text }}>{fmtMoney(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{
              padding: "14px 18px", borderTop: `1px solid ${C.border}`,
              display: "flex", justifyContent: "flex-end",
            }}>
              <div style={{ width: 260 }}>
                {[
                  ["Subtotal",  fmtMoney(draft.subtotal),    C.text  ],
                  ["Discounts", `−${fmtMoney(draft.discountAmt)}`, C.green ],
                  ["Tax (8%)",  fmtMoney(draft.tax),          C.muted ],
                ].map(([l, v, c]) => (
                  <div key={l as string} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
                    <span style={{ color: C.muted }}>{l}</span>
                    <span style={{ color: c as string, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "10px 0 0", marginTop: 6,
                  borderTop: `2px solid ${C.border}`, fontSize: 16,
                }}>
                  <span style={{ fontWeight: 800, color: C.text }}>Total</span>
                  <span style={{ fontWeight: 800, color: C.blue }}>{fmtMoney(draft.total)}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Notes */}
          <Card style={{ background: C.bg }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              Professional Note (auto-generated)
            </div>
            <p style={{ fontSize: 13, color: C.text, lineHeight: 1.7, margin: 0 }}>{draft.notes}</p>
          </Card>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              onClick={() => { setDraft(null); setPrompt(""); }}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "10px 18px", borderRadius: 10,
                background: "none", border: `1px solid ${C.border}`,
                color: C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              <Sparkles size={13} /> Regenerate
            </button>
            <button
              onClick={saveQuote}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 24px", borderRadius: 10,
                background: `linear-gradient(135deg, ${C.green}, #3aaa72)`,
                border: "none", color: "#fff",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                boxShadow: `0 4px 16px ${C.green}44`,
              }}
            >
              <CheckCircle size={14} /> Save Quote
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // VIEW: DETAIL
  // ─────────────────────────────────────────────────────────────────────────
  if (view === "detail" && selected) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 780 }}>

      {/* Back */}
      <button
        onClick={() => { setSelected(null); setView("list"); }}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "none", border: "none", color: C.muted,
          fontSize: 13, cursor: "pointer", fontWeight: 600, padding: 0,
        }}
      >
        <ChevronLeft size={16} /> Back to Quotes
      </button>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{selected.quoteNumber}</h1>
            <Badge status={selected.status} />
          </div>
          <p style={{ color: C.muted, fontSize: 13 }}>
            Created {fmtDate(selected.createdAt)} · Customer: <strong style={{ color: C.text }}>{selected.customer}</strong>
          </p>
        </div>
        <button
          onClick={() => deleteQuote(selected.id)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 8,
            background: C.redBg, border: `1px solid ${C.redBorder}`,
            color: C.red, fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}
        >
          <Trash2 size={13} /> Delete
        </button>
      </div>

      {/* Details grid */}
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[
            { icon: User,     label: "Customer",      value: selected.customer     },
            { icon: Hash,     label: "Quote Number",  value: selected.quoteNumber  },
            { icon: Calendar, label: "Valid Until",   value: fmtDate(selected.validUntil) },
            { icon: Clock,    label: "Payment Terms", value: selected.paymentTerms },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} style={{ padding: "10px 12px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                <Icon size={11} color={C.muted} />
                <span style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{value}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Line items */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "13px 18px 11px", borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>Line Items</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.bg }}>
              {["SKU", "Description", "Qty", "Unit Price", "Discount", "Total"].map(h => (
                <th key={h} style={{ padding: "8px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {selected.items.map(item => (
              <tr key={item.id} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={{ padding: "11px 16px", fontFamily: "monospace", fontWeight: 700, color: C.blue }}>{item.sku}</td>
                <td style={{ padding: "11px 16px", color: C.text }}>{item.desc}</td>
                <td style={{ padding: "11px 16px", fontWeight: 600 }}>{item.qty.toLocaleString()}</td>
                <td style={{ padding: "11px 16px" }}>{fmtMoney(item.unitPrice)}</td>
                <td style={{ padding: "11px 16px" }}>
                  {item.discount > 0
                    ? <span style={{ color: C.green, fontWeight: 700 }}>−{item.discount}%</span>
                    : <span style={{ color: C.muted }}>—</span>}
                </td>
                <td style={{ padding: "11px 16px", fontWeight: 700 }}>{fmtMoney(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: "14px 18px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: 260 }}>
            {[
              ["Subtotal",  fmtMoney(selected.subtotal),    C.text ],
              ["Discounts", `−${fmtMoney(selected.discountAmt)}`, C.green],
              ["Tax (8%)",  fmtMoney(selected.tax),          C.muted],
            ].map(([l, v, c]) => (
              <div key={l as string} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 13 }}>
                <span style={{ color: C.muted }}>{l}</span>
                <span style={{ color: c as string, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", marginTop: 6, borderTop: `2px solid ${C.border}`, fontSize: 16 }}>
              <span style={{ fontWeight: 800 }}>Total</span>
              <span style={{ fontWeight: 800, color: C.blue }}>{fmtMoney(selected.total)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Notes */}
      <Card style={{ background: C.bg }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Note</div>
        <p style={{ fontSize: 13, color: C.text, lineHeight: 1.7, margin: 0 }}>{selected.notes}</p>
      </Card>

      {/* Original prompt */}
      <Card style={{ background: C.blueBg, border: `1px solid ${C.blueBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <Sparkles size={12} color={C.blue} />
          <span style={{ fontSize: 11, fontWeight: 700, color: C.blue, textTransform: "uppercase", letterSpacing: "0.05em" }}>Original Prompt</span>
        </div>
        <p style={{ fontSize: 13, color: C.muted, margin: 0, fontStyle: "italic" }}>"{selected.prompt}"</p>
      </Card>
    </div>
  );

  return null;
}
