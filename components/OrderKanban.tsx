"use client";
// components/OrderKanban.tsx
// Full order management — reads/writes from shared localStorage store (lib/orders.ts).
// Portal requests appear here automatically.
// Each order can be advanced through stages or turned into an invoice.

import { useState, useEffect } from "react";
import { Plus, X, CheckCircle, ChevronRight, Receipt } from "lucide-react";
import { C } from "@/lib/utils";
import { Card, SectionTitle } from "./Dashboard";
import {
  Order, OrderStage, OrderPriority, OrderSource,
  loadOrders, saveOrders, addOrder, makeOrderId, timeAgo,
} from "@/lib/orders";

// ── Stage config ──────────────────────────────────────────────────────────────
const STAGES: OrderStage[] = ["Placed", "Confirmed", "Picked", "Shipped", "Delivered"];

const STAGE_STYLE: Record<OrderStage, { bg: string; border: string; color: string }> = {
  Placed:    { bg: "#f0f0f0",  border: "#d0ccc5",       color: "#5a5550"  },
  Confirmed: { bg: C.blueBg,  border: C.blueBorder,    color: C.blue     },
  Picked:    { bg: C.amberBg, border: C.amberBorder,   color: C.amber    },
  Shipped:   { bg: C.purpleBg,border: C.purpleBorder,  color: C.purple   },
  Delivered: { bg: C.greenBg, border: C.greenBorder,   color: C.green    },
};

const PRIORITY_STYLE: Record<OrderPriority, { bg: string; color: string; border: string }> = {
  HIGH: { bg: C.redBg,    color: C.red,   border: C.redBorder   },
  MED:  { bg: C.amberBg,  color: C.amber, border: C.amberBorder },
  LOW:  { bg: "#f0f0f0",  color: C.muted, border: C.border      },
};

const SOURCE_LABEL: Record<OrderSource, { label: string; emoji: string }> = {
  portal: { label: "Portal",  emoji: "🌐" },
  manual: { label: "Manual",  emoji: "✏️"  },
  quote:  { label: "Quote",   emoji: "📋" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtMoney = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// ── New Order Form ────────────────────────────────────────────────────────────
function NewOrderModal({ onSave, onClose }: {
  onSave: (o: Order) => void;
  onClose: () => void;
}) {
  const [customer, setCustomer] = useState("");
  const [sku,      setSku]      = useState("");
  const [items,    setItems]    = useState("1");
  const [value,    setValue]    = useState("");
  const [priority, setPriority] = useState<OrderPriority>("MED");
  const [notes,    setNotes]    = useState("");
  const [error,    setError]    = useState("");

  const submit = () => {
    if (!customer.trim()) { setError("Customer name is required."); return; }
    if (!sku.trim())      { setError("SKU / product is required."); return; }
    if (!value.trim() || isNaN(parseFloat(value))) { setError("Enter a valid order value."); return; }

    const now = new Date().toISOString();
    const order: Order = {
      id:        makeOrderId(),
      customer:  customer.trim(),
      sku:       sku.trim(),
      items:     parseInt(items) || 1,
      value:     parseFloat(value),
      stage:     "Placed",
      priority,
      source:    "manual",
      notes:     notes.trim(),
      createdAt: now,
      time:      "just now",
    };
    onSave(order);
  };

  const inputStyle = {
    width: "100%", padding: "10px 12px",
    background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: 9, color: C.text, fontSize: 13,
    outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit",
  };
  const labelStyle = {
    display: "block" as const, fontSize: 11, fontWeight: 700,
    color: C.muted, marginBottom: 5,
    textTransform: "uppercase" as const, letterSpacing: "0.05em",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200, padding: 24,
    }}>
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: "28px 28px 24px",
        width: "100%", maxWidth: 480,
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: C.text }}>New Order</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }}>
            <X size={18} />
          </button>
        </div>

        {/* Form fields */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <div style={{ marginBottom: 14, gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Customer Name *</label>
            <input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="e.g. Acme Corp" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 14, gridColumn: "1 / -1" }}>
            <label style={labelStyle}>SKU / Product *</label>
            <input value={sku} onChange={e => setSku(e.target.value)} placeholder="e.g. SKU-4821 or Industrial bolts" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Quantity</label>
            <input type="number" min="1" value={items} onChange={e => setItems(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Order Value ($) *</label>
            <input type="number" min="0" step="0.01" value={value} onChange={e => setValue(e.target.value)} placeholder="0.00" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 14, gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Priority</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["HIGH", "MED", "LOW"] as OrderPriority[]).map(p => {
                const s = PRIORITY_STYLE[p];
                const active = priority === p;
                return (
                  <button key={p} onClick={() => setPriority(p)} style={{
                    flex: 1, padding: "8px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 12,
                    background: active ? s.bg : C.bg,
                    border: `1px solid ${active ? s.border : C.border}`,
                    color: active ? s.color : C.muted,
                  }}>{p}</button>
                );
              })}
            </div>
          </div>
          <div style={{ marginBottom: 14, gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any special instructions…"
              style={{ ...inputStyle, resize: "vertical" }} />
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 14, padding: "9px 13px", background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 8, fontSize: 13, color: C.red }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={submit} style={{
            flex: 1, padding: "12px", borderRadius: 10,
            background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`,
            border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}>
            Create Order
          </button>
          <button onClick={onClose} style={{
            padding: "12px 18px", borderRadius: 10,
            background: C.bg, border: `1px solid ${C.border}`,
            color: C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function OrderKanban() {
  const [orders,      setOrders]      = useState<Order[]>([]);
  const [showNew,     setShowNew]     = useState(false);
  const [invoiceMsg,  setInvoiceMsg]  = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    setOrders(loadOrders());
  }, []);

  // ── Advance order to next stage ──────────────────────────────────────────
  const advanceOrder = (id: string) => {
    setOrders(prev => {
      const updated = prev.map(o => {
        if (o.id !== id) return o;
        const idx = STAGES.indexOf(o.stage);
        if (idx >= STAGES.length - 1) return o;
        return { ...o, stage: STAGES[idx + 1] };
      });
      saveOrders(updated);
      return updated;
    });
  };

  // ── Add new order ────────────────────────────────────────────────────────
  const handleNewOrder = (order: Order) => {
    setOrders(prev => {
      const updated = [order, ...prev];
      saveOrders(updated);
      return updated;
    });
    setShowNew(false);
  };

  // ── Create invoice from order ────────────────────────────────────────────
  const createInvoiceFromOrder = (order: Order) => {
    // Build an invoice object and save to invoicing localStorage store
    const INVOICE_KEY = "industrialos_invoices";
    const today    = new Date().toISOString().split("T")[0];
    const dueDate  = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
    const unitPrice = order.value / order.items;
    const subtotal  = order.value;
    const tax       = parseFloat((subtotal * 0.08).toFixed(2));
    const total     = parseFloat((subtotal + tax).toFixed(2));

    const newInvoice = {
      id:            `inv-${Math.random().toString(36).slice(2, 9)}`,
      invoiceNumber: `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      customer:      order.customer,
      items: [{
        id:        "item-0",
        desc:      `${order.sku} × ${order.items} units`,
        qty:       order.items,
        unitPrice: parseFloat(unitPrice.toFixed(2)),
        total:     subtotal,
      }],
      subtotal, tax, total,
      amountPaid:   0,
      paymentTerms: "Net 30",
      issueDate:    today,
      dueDate,
      status:       "unpaid",
      notes:        `Auto-generated from order ${order.id}`,
      createdAt:    new Date().toISOString(),
    };

    try {
      const existing = JSON.parse(localStorage.getItem(INVOICE_KEY) || "[]");
      localStorage.setItem(INVOICE_KEY, JSON.stringify([newInvoice, ...existing]));
      setInvoiceMsg(`Invoice created for ${order.customer} — go to the Invoicing tab to view it.`);
      setTimeout(() => setInvoiceMsg(null), 5000);
    } catch {
      setInvoiceMsg("Could not create invoice. Please try again.");
    }
  };

  // ── Columns ──────────────────────────────────────────────────────────────
  const cols = STAGES.map(stage => ({
    stage,
    items: orders.filter(o => o.stage === stage),
  }));

  const activeCount = orders.filter(o => o.stage !== "Delivered").length;

  // ── Automation log ────────────────────────────────────────────────────────
  const log = [
    { e: "Inventory reserved",     o: "ORD-10234", ico: "📦", t: "just now" },
    { e: "CRM order pushed",       o: "ORD-10233", ico: "🔌", t: "12s ago"  },
    { e: "Packing slip generated", o: "ORD-10232", ico: "📄", t: "28s ago"  },
    { e: "Warehouse notified",     o: "ORD-10231", ico: "📧", t: "44s ago"  },
    { e: "Confirmation sent",      o: "ORD-10230", ico: "✉️",  t: "1m ago"   },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* ── New Order Modal ── */}
      {showNew && (
        <NewOrderModal
          onSave={handleNewOrder}
          onClose={() => setShowNew(false)}
        />
      )}

      {/* ── Invoice success message ── */}
      {invoiceMsg && (
        <div style={{
          padding: "12px 16px", background: C.greenBg, border: `1px solid ${C.greenBorder}`,
          borderRadius: 10, fontSize: 13, color: C.green,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <CheckCircle size={15} /> {invoiceMsg}
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>Order Pipeline</div>
          <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>
            {activeCount} active order{activeCount !== 1 ? "s" : ""} · {orders.length} total
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.green,
            background: C.greenBg, border: `1px solid ${C.greenBorder}`,
            borderRadius: 999, padding: "5px 12px",
          }}>
            <span style={{ width: 7, height: 7, background: C.green, borderRadius: "50%", display: "inline-block" }} />
            Auto-advancing
          </div>
          <button
            onClick={() => setShowNew(true)}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "9px 18px", borderRadius: 10,
              background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`,
              border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            <Plus size={14} /> New Order
          </button>
        </div>
      </div>

      {/* ── Kanban board ── */}
      <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 12 }}>
        {cols.map(col => {
          const ss = STAGE_STYLE[col.stage];
          return (
            <div key={col.stage} style={{ minWidth: 210, width: 210, flexShrink: 0 }}>
              {/* Column header */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 10, padding: "6px 12px", borderRadius: 8,
                background: ss.bg, border: `1px solid ${ss.border}`,
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: ss.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {col.stage}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: ss.color }}>{col.items.length}</span>
              </div>

              {/* Cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {col.items.length === 0 && (
                  <div style={{
                    padding: "20px 12px", textAlign: "center",
                    border: `1px dashed ${C.border}`, borderRadius: 10,
                    color: C.subtle, fontSize: 12,
                  }}>
                    No orders
                  </div>
                )}
                {col.items.map(o => {
                  const ps  = PRIORITY_STYLE[o.priority];
                  const src = SOURCE_LABEL[o.source];
                  return (
                    <div key={o.id} style={{
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      borderLeft: `3px solid ${ss.color}`,
                      borderRadius: 10, padding: "10px 12px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}>
                      {/* Order ID + priority */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontFamily: "monospace", fontSize: 11, color: C.blue }}>{o.id}</span>
                        <span style={{
                          padding: "2px 7px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                          background: ps.bg, color: ps.color, border: `1px solid ${ps.border}`,
                        }}>{o.priority}</span>
                      </div>

                      {/* Customer */}
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {o.customer}
                      </div>

                      {/* SKU + items */}
                      <div style={{ fontSize: 11, color: C.subtle, marginBottom: 4 }}>
                        {o.items} unit{o.items !== 1 ? "s" : ""} · {o.sku}
                      </div>

                      {/* Value */}
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.green, marginBottom: 6 }}>
                        {fmtMoney(o.value)}
                      </div>

                      {/* Source badge */}
                      <div style={{ fontSize: 10, color: C.subtle, marginBottom: 8 }}>
                        {src.emoji} {src.label} · {o.time}
                      </div>

                      {/* Notes */}
                      {o.notes && (
                        <div style={{
                          fontSize: 11, color: C.muted, marginBottom: 8,
                          padding: "5px 8px", background: C.bg,
                          borderRadius: 6, border: `1px solid ${C.border}`,
                        }}>
                          {o.notes}
                        </div>
                      )}

                      {/* Actions */}
                      <div style={{ display: "flex", gap: 6 }}>
                        {o.stage !== "Delivered" ? (
                          <button
                            onClick={() => advanceOrder(o.id)}
                            style={{
                              flex: 1, fontSize: 11, fontWeight: 700,
                              background: C.bg, color: C.muted,
                              border: `1px solid ${C.border}`, borderRadius: 6,
                              padding: "5px 8px", cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                            }}
                          >
                            Next <ChevronRight size={11} />
                          </button>
                        ) : (
                          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.green }}>
                            <CheckCircle size={12} /> Done
                          </div>
                        )}
                        <button
                          onClick={() => createInvoiceFromOrder(o)}
                          title="Create invoice from this order"
                          style={{
                            padding: "5px 8px", borderRadius: 6, cursor: "pointer", fontSize: 11,
                            background: C.blueBg, color: C.blue,
                            border: `1px solid ${C.blueBorder}`,
                            display: "flex", alignItems: "center", gap: 4, fontWeight: 700,
                          }}
                        >
                          <Receipt size={11} /> Invoice
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Automation log ── */}
      <Card>
        <SectionTitle>Automation Events</SectionTitle>
        {log.map((e, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "9px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13,
          }}>
            <span style={{ fontSize: 16 }}>{e.ico}</span>
            <span style={{ color: C.muted }}>{e.e}</span>
            <span style={{ fontFamily: "monospace", color: C.blue, fontSize: 11 }}>{e.o}</span>
            <span style={{ marginLeft: "auto", color: C.subtle, fontSize: 11 }}>{e.t}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
