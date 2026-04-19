"use client";
// components/OrderKanban.tsx
// Phase 4:  Now loads from DB via fetchOrdersFromDb().
// Phase 11: Fires WhatsApp notification on stage advance.

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Plus, X, CheckCircle, ChevronRight, Receipt, Trash2, Search } from "lucide-react";
import { C } from "@/lib/utils";
import { Card, SectionTitle } from "./Dashboard";
import {
  Order, OrderStage, OrderPriority, OrderSource,
  loadOrders, saveOrders, addOrder, makeOrderId, timeAgo,
  fetchOrdersFromDb, updateOrderInDb,
} from "@/lib/orders";
import { loadInventory } from "@/lib/inventory";
import SkuPopup from "./SkuPopup";

// ── Stage config ──────────────────────────────────────────────────────────────
const STAGES: OrderStage[] = ["Placed", "Confirmed", "Picked", "Shipped", "Delivered"];

const STAGE_STYLE: Record<OrderStage, { bg: string; border: string; color: string }> = {
  Placed:    { bg: "#f0f0f0",   border: "#d0ccc5",        color: "#5a5550"  },
  Confirmed: { bg: C.blueBg,   border: C.blueBorder,     color: C.blue     },
  Picked:    { bg: C.amberBg,  border: C.amberBorder,    color: C.amber    },
  Shipped:   { bg: C.purpleBg, border: C.purpleBorder,   color: C.purple   },
  Delivered: { bg: C.greenBg,  border: C.greenBorder,    color: C.green    },
};

const PRIORITY_STYLE: Record<OrderPriority, { bg: string; color: string; border: string }> = {
  HIGH: { bg: C.redBg,   color: C.red,   border: C.redBorder   },
  MED:  { bg: C.amberBg, color: C.amber, border: C.amberBorder },
  LOW:  { bg: "#f0f0f0", color: C.muted, border: C.border      },
};

const SOURCE_LABEL: Record<OrderSource, { label: string; emoji: string }> = {
  portal: { label: "Portal", emoji: "🌐" },
  manual: { label: "Manual", emoji: "✏️"  },
  quote:  { label: "Quote",  emoji: "📋" },
};

const fmtMoney = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// ── New Order Form ────────────────────────────────────────────────────────────
function NewOrderModal({ onSave, onClose }: {
  onSave: (o: Order) => void;
  onClose: () => void;
}) {
  const [customer,   setCustomer]   = useState("");
  const [sku,        setSku]        = useState("");
  const [items,      setItems]      = useState("1");
  const [value,      setValue]      = useState("");
  const [priority,   setPriority]   = useState<OrderPriority>("MED");
  const [notes,      setNotes]      = useState("");
  const [error,      setError]      = useState("");
  const [unitHint,   setUnitHint]   = useState<{ unitCost: number; name: string } | null>(null);

  const handleSkuChange = (val: string) => {
    setSku(val);
    const inv = loadInventory();
    const found = inv.find(i => i.sku.toLowerCase() === val.trim().toLowerCase());
    if (found) {
      setUnitHint({ unitCost: found.unitCost, name: found.name });
      const qty = parseInt(items) || 1;
      setValue(parseFloat((found.unitCost * qty).toFixed(2)).toString());
    } else {
      setUnitHint(null);
    }
  };

  const handleItemsChange = (val: string) => {
    setItems(val);
    if (unitHint) {
      const qty = parseInt(val) || 1;
      setValue(parseFloat((unitHint.unitCost * qty).toFixed(2)).toString());
    }
  };

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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: C.text }}>New Order</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <div style={{ marginBottom: 14, gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Customer Name *</label>
            <input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="e.g. Acme Corp" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 14, gridColumn: "1 / -1" }}>
            <label style={labelStyle}>SKU / Product *</label>
            <input value={sku} onChange={e => handleSkuChange(e.target.value)} placeholder="e.g. SKU-4821 — Valve Assembly" style={inputStyle} />
            {unitHint && (
              <div style={{ fontSize: 11, color: C.green, marginTop: 4, fontWeight: 600 }}>
                ✓ {unitHint.name} · Unit cost: ${unitHint.unitCost.toFixed(2)}
              </div>
            )}
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Quantity</label>
            <input type="number" min="1" value={items} onChange={e => handleItemsChange(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Order Value ($) *{unitHint ? " — auto-calculated" : ""}</label>
            <input type="number" min="0" value={value} onChange={e => setValue(e.target.value)} placeholder="e.g. 12500" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 14, gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Priority</label>
            <select value={priority} onChange={e => setPriority(e.target.value as OrderPriority)} style={inputStyle}>
              <option value="HIGH">HIGH</option>
              <option value="MED">MED</option>
              <option value="LOW">LOW</option>
            </select>
          </div>
          <div style={{ marginBottom: 14, gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" style={inputStyle} />
          </div>
        </div>

        {error && (
          <div style={{ color: C.red, fontSize: 12, marginBottom: 12 }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "10px 0", borderRadius: 9, border: `1px solid ${C.border}`,
            background: "none", color: C.muted, fontSize: 13, cursor: "pointer",
          }}>Cancel</button>
          <button onClick={submit} style={{
            flex: 2, padding: "10px 0", borderRadius: 9, border: "none",
            background: C.blue, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>Create Order</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function OrderKanban({ onNavigate }: { onNavigate?: (tab: string, id?: string) => void }) {
  const { data: session } = useSession();
  const isViewer = session?.user?.role === "viewer";
  const [orders,     setOrders]     = useState<Order[]>([]);
  const [showNew,    setShowNew]    = useState(false);
  const [invoiceMsg, setInvoiceMsg] = useState<string | null>(null);
  const [skuPopup,   setSkuPopup]   = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Load from localStorage immediately (fast), then refresh from DB
  // Also poll every 30s so portal orders appear without manual reload
  useEffect(() => {
    setOrders(loadOrders()); // instant — from cache
    const refresh = () => fetchOrdersFromDb().then(dbOrders => {
      if (dbOrders.length > 0) setOrders(dbOrders);
    });
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, []);

  // ── Advance order to next stage ──────────────────────────────────────────
  const advanceOrder = (id: string) => {
    setOrders(prev => {
      const updated = prev.map(o => {
        if (o.id !== id) return o;
        const idx = STAGES.indexOf(o.stage);
        if (idx >= STAGES.length - 1) return o;
        const newStage = STAGES[idx + 1];
        updateOrderInDb(id, { stage: newStage });

        // Phase 11 — fire WhatsApp notification (fire-and-forget)
        const wid = typeof window !== "undefined" ? localStorage.getItem("workspaceDbId") : null;
        if (wid) {
          fetch("/api/whatsapp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId:      o.id,
              customerName: o.customer,
              stage:        newStage,
              sku:          o.sku,
              workspaceId:  wid,
            }),
          }).catch(() => {/* non-blocking */});
        }

        return { ...o, stage: newStage };
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
    addOrder(order); // writes to DB in background
    setShowNew(false);
  };

  // ── Delete order ─────────────────────────────────────────────────────────
  const deleteOrder = (id: string) => {
    if (!window.confirm("Delete this order? This cannot be undone.")) return;
    setOrders(prev => {
      const updated = prev.filter(o => o.id !== id);
      saveOrders(updated);
      return updated;
    });
    fetch(`/api/orders?id=${id}`, { method: "DELETE" }).catch(() => {});
  };

  // ── Create invoice from order ────────────────────────────────────────────
  const createInvoiceFromOrder = async (order: Order) => {
    const INVOICE_KEY = "industrialos_invoices";
    const wid       = typeof window !== "undefined" ? localStorage.getItem("workspaceDbId") : null;
    const today     = new Date().toISOString().split("T")[0];
    const dueDate   = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
    const unitPrice = order.value / Math.max(order.items, 1);
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
      currency:     "USD",
      createdAt:    new Date().toISOString(),
    };

    try {
      // Save to DB (source of truth) — this is what the Invoicing tab reads from
      if (wid) {
        await fetch("/api/invoices", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ ...newInvoice, workspaceId: wid }),
        });
      }
      // Also mirror to localStorage so the Invoicing tab shows it instantly on mount
      const existing = JSON.parse(localStorage.getItem(INVOICE_KEY) || "[]");
      localStorage.setItem(INVOICE_KEY, JSON.stringify([newInvoice, ...existing]));
      setInvoiceMsg(`Invoice created for ${order.customer} — go to the Invoicing tab to view it.`);
      setTimeout(() => setInvoiceMsg(null), 5000);
    } catch {
      setInvoiceMsg("Could not create invoice. Please try again.");
    }
  };

  const term = searchTerm.toLowerCase();
  const filteredOrders = term
    ? orders.filter(o =>
        o.customer?.toLowerCase().includes(term) ||
        o.id?.toLowerCase().includes(term) ||
        o.sku?.toLowerCase().includes(term)
      )
    : orders;

  const cols = STAGES.map(stage => ({
    stage,
    items: filteredOrders.filter(o => o.stage === stage),
  }));

  const activeCount = orders.filter(o => o.stage !== "Delivered").length;

  const log = [
    { e: "Inventory reserved",     o: "ORD-10234", ico: "📦", t: "just now" },
    { e: "CRM order pushed",       o: "ORD-10233", ico: "🔌", t: "12s ago"  },
    { e: "Packing slip generated", o: "ORD-10232", ico: "📄", t: "28s ago"  },
    { e: "Warehouse notified",     o: "ORD-10231", ico: "📧", t: "44s ago"  },
    { e: "Confirmation sent",      o: "ORD-10230", ico: "✉️",  t: "1m ago"   },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {showNew && (
        <NewOrderModal onSave={handleNewOrder} onClose={() => setShowNew(false)} />
      )}
      {skuPopup && <SkuPopup sku={skuPopup} onClose={() => setSkuPopup(null)} />}

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
            {activeCount} active order{activeCount !== 1 ? "s" : ""}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={14} style={{ position: "absolute", left: 10, color: C.muted, pointerEvents: "none" }} />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search orders…" style={{ padding: "9px 12px 9px 32px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, outline: "none", width: 180 }} />
          </div>
          {!isViewer && (
          <button
            onClick={() => setShowNew(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 18px", background: C.blue, border: "none",
              borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}
          >
            <Plus size={15} /> New Order
          </button>
          )}
        </div>
      </div>

      {/* ── Kanban board ── */}
      <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 8 }}>
        {cols.map(({ stage, items }) => {
          const ss = STAGE_STYLE[stage];
          return (
            <div key={stage} style={{
              minWidth: 220, flex: "0 0 220px",
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 14, padding: "14px 12px",
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12,
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, color: ss.color,
                  background: ss.bg, border: `1px solid ${ss.border}`,
                  padding: "3px 10px", borderRadius: 999,
                  textTransform: "uppercase", letterSpacing: "0.05em",
                }}>{stage}</span>
                <span style={{ fontSize: 11, color: C.muted }}>{items.length}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {items.map(o => {
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
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontFamily: "monospace", fontSize: 11, color: C.blue }}>{o.id}</span>
                        <span style={{
                          padding: "2px 7px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                          background: ps.bg, color: ps.color, border: `1px solid ${ps.border}`,
                        }}>{o.priority}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span style={{ color: C.blue, cursor: "pointer", textDecoration: "underline" }} onClick={() => onNavigate?.("customers", o.customer)}>{o.customer}</span>
                      </div>
                      <div style={{ fontSize: 11, color: C.subtle, marginBottom: 4 }}>
                        {o.items} unit{o.items !== 1 ? "s" : ""} · <span style={{ color: C.blue, cursor: "pointer", textDecoration: "underline" }} onClick={() => setSkuPopup(o.sku)}>{o.sku}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: C.green }}>
                          {fmtMoney(o.value)}
                        </span>
                        {!isViewer && (
                          <button
                            title="Set order value / price"
                            onClick={() => {
                              const raw = window.prompt("Set order value ($):", String(o.value));
                              if (raw === null) return;
                              const v = parseFloat(raw.replace(/[^0-9.]/g, ""));
                              if (isNaN(v)) return;
                              setOrders(prev => {
                                const updated = prev.map(x => x.id === o.id ? { ...x, value: v } : x);
                                saveOrders(updated);
                                return updated;
                              });
                              updateOrderInDb(o.id, { value: v } as any);
                            }}
                            style={{
                              padding: "2px 6px", fontSize: 10, fontWeight: 700, borderRadius: 5,
                              border: `1px solid ${C.border}`, background: C.bg,
                              color: C.muted, cursor: "pointer",
                            }}
                          >✏️</button>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: C.subtle, marginBottom: 8 }}>
                        {src.emoji} {src.label} · {o.time}
                      </div>
                      {o.notes && (
                        <div style={{
                          fontSize: 11, color: C.muted, marginBottom: 8,
                          padding: "5px 8px", background: C.bg,
                          borderRadius: 6, border: `1px solid ${C.border}`,
                        }}>
                          {o.notes}
                        </div>
                      )}
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
                        {!isViewer && (
                          <button
                            onClick={() => deleteOrder(o.id)}
                            title="Delete order"
                            style={{
                              padding: "5px 8px", borderRadius: 6, cursor: "pointer", fontSize: 11,
                              background: C.redBg, color: C.red,
                              border: `1px solid ${C.redBorder}`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
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
