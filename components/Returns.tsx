"use client";
// components/Returns.tsx
// Phase 18 — Returns & RMA Module
// Status flow: requested → approved → received → refunded | rejected

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Plus, X, ChevronLeft, RotateCcw, CheckCircle, XCircle, Package, RefreshCw, Search } from "lucide-react";
import { SkuPopup } from "./SkuPopup";
import { C } from "@/lib/utils";
import { useFilterSort, SearchSortBar } from "./useFilterSort";
import { SkuLink } from "./SkuPopup";

// ── Types ─────────────────────────────────────────────────────────────────────
type ReturnStatus  = "requested" | "approved" | "received" | "refunded" | "rejected";
type ReturnReason  = "damaged" | "wrong_item" | "not_needed" | "defective" | "other";
type RefundMethod  = "original" | "credit" | "exchange";

interface ReturnRecord {
  id:            string;
  rmaNumber:     string;
  orderId:       string;
  customer:      string;
  customerEmail: string;
  sku:           string;
  qty:           number;
  reason:        ReturnReason;
  description:   string;
  status:        ReturnStatus;
  refundAmount:  number;
  refundMethod:  RefundMethod;
  notes:         string;
  workspaceId:   string;
  createdAt:     string;
  updatedAt:     string;
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<ReturnStatus, { label: string; color: string; bg: string; border: string; icon: any }> = {
  requested: { label: "Requested", color: C.blue,   bg: C.blueBg,   border: C.blueBorder,   icon: RotateCcw    },
  approved:  { label: "Approved",  color: C.amber,  bg: C.amberBg,  border: C.amberBorder,  icon: CheckCircle  },
  received:  { label: "Received",  color: C.purple, bg: C.purpleBg, border: C.purpleBorder, icon: Package      },
  refunded:  { label: "Refunded",  color: C.green,  bg: C.greenBg,  border: C.greenBorder,  icon: RefreshCw    },
  rejected:  { label: "Rejected",  color: C.red,    bg: C.redBg,    border: C.redBorder,    icon: XCircle      },
};

const REASON_LABELS: Record<ReturnReason, string> = {
  damaged:    "Item Damaged",
  wrong_item: "Wrong Item Sent",
  not_needed: "No Longer Needed",
  defective:  "Defective / Not Working",
  other:      "Other",
};

const REFUND_METHOD_LABELS: Record<RefundMethod, string> = {
  original: "Refund to Original Payment",
  credit:   "Store Credit",
  exchange: "Exchange for New Item",
};

// Status advance flow
const NEXT_STATUS: Partial<Record<ReturnStatus, ReturnStatus>> = {
  requested: "approved",
  approved:  "received",
  received:  "refunded",
};

const fmtDate   = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtMoney  = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function getWorkspaceId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("workspaceDbId") ?? "";
}

// ── New Return Modal ──────────────────────────────────────────────────────────
function NewReturnModal({ onSave, onClose }: {
  onSave:  (r: ReturnRecord) => void;
  onClose: () => void;
}) {
  const [customer,     setCustomer]     = useState("");
  const [sku,          setSku]          = useState("");
  const [qty,          setQty]          = useState("1");
  const [orderId,      setOrderId]      = useState("");
  const [reason,       setReason]       = useState<ReturnReason>("damaged");
  const [description,  setDescription]  = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("original");
  const [notes,        setNotes]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");

  const inp: React.CSSProperties = {
    width: "100%", padding: "9px 11px",
    background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: 8, color: C.text, fontSize: 13,
    outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 700,
    color: C.muted, marginBottom: 5,
    textTransform: "uppercase", letterSpacing: "0.05em",
  };

  const submit = async () => {
    if (!customer.trim()) { setError("Customer name is required."); return; }
    if (!sku.trim())       { setError("SKU is required."); return; }
    const workspaceId = getWorkspaceId();
    if (!workspaceId)      { setError("No workspace found. Try refreshing."); return; }

    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/returns", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          customer:     customer.trim(),
          sku:          sku.trim(),
          qty:          parseInt(qty) || 1,
          orderId:      orderId.trim(),
          reason,
          description:  description.trim(),
          refundAmount: parseFloat(refundAmount) || 0,
          refundMethod,
          notes:        notes.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to create return."); return; }
      onSave(data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", maxHeight: "90vh", overflowY: "auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: C.text }}>New Return Request</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }}><X size={18} /></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <div style={{ marginBottom: 14, gridColumn: "1/-1" }}>
            <label style={lbl}>Customer Name *</label>
            <input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="e.g. Acme Corp" style={inp} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>SKU *</label>
            <input value={sku} onChange={e => setSku(e.target.value)} placeholder="e.g. STL-3MM-HR" style={inp} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Qty</label>
            <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} style={inp} />
          </div>
          <div style={{ marginBottom: 14, gridColumn: "1/-1" }}>
            <label style={lbl}>Original Order ID (optional)</label>
            <input value={orderId} onChange={e => setOrderId(e.target.value)} placeholder="e.g. INV-2026-0312" style={inp} />
          </div>
          <div style={{ marginBottom: 14, gridColumn: "1/-1" }}>
            <label style={lbl}>Return Reason *</label>
            <select value={reason} onChange={e => setReason(e.target.value as ReturnReason)} style={inp}>
              {(Object.keys(REASON_LABELS) as ReturnReason[]).map(r => (
                <option key={r} value={r}>{REASON_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 14, gridColumn: "1/-1" }}>
            <label style={lbl}>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the issue in detail..."
              rows={3}
              style={{ ...inp, resize: "vertical" }}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Refund Amount ($)</label>
            <input type="number" min="0" step="0.01" value={refundAmount} onChange={e => setRefundAmount(e.target.value)} placeholder="0.00" style={inp} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Refund Method</label>
            <select value={refundMethod} onChange={e => setRefundMethod(e.target.value as RefundMethod)} style={inp}>
              {(Object.keys(REFUND_METHOD_LABELS) as RefundMethod[]).map(m => (
                <option key={m} value={m}>{REFUND_METHOD_LABELS[m]}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 14, gridColumn: "1/-1" }}>
            <label style={lbl}>Internal Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes for your team" style={inp} />
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 14, padding: "9px 13px", background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 8, fontSize: 13, color: C.red }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={submit} disabled={loading} style={{
            flex: 1, padding: "12px", borderRadius: 10,
            background: loading ? C.border : C.blue,
            border: "none", color: loading ? C.muted : "#fff",
            fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
          }}>
            {loading ? "Creating…" : "Create Return Request"}
          </button>
          <button onClick={onClose} style={{ padding: "12px 18px", borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`, color: C.muted, fontSize: 13, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Returns({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { data: session } = useSession();
  const isViewer = session?.user?.role === "viewer";

  const [returns,    setReturns]    = useState<ReturnRecord[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showNew,    setShowNew]    = useState(false);
  const [selected,   setSelected]   = useState<ReturnRecord | null>(null);
  const [filter,     setFilter]     = useState<ReturnStatus | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [skuPopup,   setSkuPopup]   = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const wid = getWorkspaceId();
    if (!wid) { setLoading(false); return; }
    fetch(`/api/returns?workspaceId=${wid}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setReturns(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Advance status ─────────────────────────────────────────────────────────
  const advanceStatus = async (ret: ReturnRecord) => {
    const next = NEXT_STATUS[ret.status];
    if (!next) return;
    const updated = { ...ret, status: next };
    setReturns(prev => prev.map(r => r.id === ret.id ? updated : r));
    if (selected?.id === ret.id) setSelected(updated);
    await fetch("/api/returns", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ret.id, status: next }),
    });
  };

  // ── Reject ─────────────────────────────────────────────────────────────────
  const rejectReturn = async (ret: ReturnRecord) => {
    if (!confirm(`Reject return ${ret.rmaNumber}?`)) return;
    const updated = { ...ret, status: "rejected" as ReturnStatus };
    setReturns(prev => prev.map(r => r.id === ret.id ? updated : r));
    if (selected?.id === ret.id) setSelected(updated);
    await fetch("/api/returns", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ret.id, status: "rejected" }),
    });
  };

  // ── Save new return ────────────────────────────────────────────────────────
  const handleNewReturn = (r: ReturnRecord) => {
    setReturns(prev => [r, ...prev]);
    setShowNew(false);
  };

  // ── Filtered list ──────────────────────────────────────────────────────────
  const visible = returns.filter(r => {
    if (filter !== "all" && r.status !== filter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (!(r.rmaNumber?.toLowerCase().includes(term) || r.orderId?.toLowerCase().includes(term) || r.customer?.toLowerCase().includes(term))) return false;
    }
    return true;
  });

  const workspaceId = typeof window !== "undefined" ? (localStorage.getItem("workspaceDbId") ?? "") : "";
  const returnSort = useFilterSort(visible, {
    searchFields: (r) => [r.customer, r.sku, r.rmaNumber, r.description, REASON_LABELS[r.reason]],
    sortOptions: [
      { value: "date",     label: "Date",     get: (r) => r.createdAt },
      { value: "customer", label: "Customer", get: (r) => r.customer },
      { value: "status",   label: "Status",   get: (r) => r.status },
    ],
    defaultSort: "date",
    defaultDir: "desc",
  });

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = {
    total:     returns.length,
    open:      returns.filter(r => ["requested", "approved", "received"].includes(r.status)).length,
    refunded:  returns.filter(r => r.status === "refunded").length,
    totalValue:returns.reduce((s, r) => s + r.refundAmount, 0),
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {skuPopup && <SkuPopup sku={skuPopup} workspaceId={workspaceId} onClose={() => setSkuPopup(null)} />}
      {showNew && <NewReturnModal onSave={handleNewReturn} onClose={() => setShowNew(false)} />}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>Returns & RMA</h1>
          <p style={{ color: C.muted, fontSize: 13 }}>Manage customer return requests and refunds.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={14} style={{ position: "absolute", left: 10, color: C.muted, pointerEvents: "none" }} />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search returns…" style={{ padding: "9px 12px 9px 32px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, outline: "none", width: 180 }} />
          </div>
          {!isViewer && (
            <button onClick={() => setShowNew(true)} style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "9px 18px", borderRadius: 10, background: C.blue,
              border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>
              <Plus size={14} /> New Return
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { label: "Total Returns",    value: stats.total,                  color: C.blue,  bg: C.blueBg,  border: C.blueBorder  },
          { label: "Open",             value: stats.open,                   color: C.amber, bg: C.amberBg, border: C.amberBorder },
          { label: "Refunded",         value: stats.refunded,               color: C.green, bg: C.greenBg, border: C.greenBorder },
          { label: "Total Refund Value", value: fmtMoney(stats.totalValue), color: C.purple,bg: C.purpleBg,border: C.purpleBorder },
        ].map((s, i) => (
          <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: "14px 18px" }}>
            <div style={{ fontSize: i === 3 ? 16 : 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(["all", "requested", "approved", "received", "refunded", "rejected"] as const).map(f => {
          const cfg = f === "all" ? null : STATUS_CFG[f];
          const active = filter === f;
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: "pointer", border: "none",
              background: active ? (cfg?.bg ?? C.blueBg) : C.surface,
              color:      active ? (cfg?.color ?? C.blue) : C.muted,
              outline:    active ? `1.5px solid ${cfg?.border ?? C.blueBorder}` : "none",
            }}>
              {f === "all" ? "All" : STATUS_CFG[f].label}
              {f !== "all" && (
                <span style={{ marginLeft: 5, fontSize: 11, opacity: 0.8 }}>
                  ({returns.filter(r => r.status === f).length})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <button onClick={() => setSelected(null)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer" }}>
              <ChevronLeft size={14} /> Back to list
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {!isViewer && NEXT_STATUS[selected.status] && (
                <button onClick={() => advanceStatus(selected)} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                  background: C.greenBg, border: `1px solid ${C.greenBorder}`, color: C.green,
                }}>
                  <CheckCircle size={12} />
                  Move to {STATUS_CFG[NEXT_STATUS[selected.status]!].label}
                </button>
              )}
              {!isViewer && ["requested", "approved"].includes(selected.status) && (
                <button onClick={() => rejectReturn(selected)} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                  background: C.redBg, border: `1px solid ${C.redBorder}`, color: C.red,
                }}>
                  <XCircle size={12} /> Reject
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>RMA Number</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: C.blue, fontFamily: "monospace" }}>{selected.rmaNumber}</span>
                {selected.customerEmail && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: C.purpleBg, color: C.purple, border: `1px solid ${C.purpleBorder}` }}>
                    Submitted via Customer Portal
                  </span>
                )}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Status</div>
              {(() => { const s = STATUS_CFG[selected.status]; const Icon = s.icon; return (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 999, background: s.bg, border: `1px solid ${s.border}`, color: s.color, fontSize: 13, fontWeight: 700 }}>
                  <Icon size={12} /> {s.label}
                </div>
              ); })()}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, margin: "16px 0" }}>
            {[
              { label: "Customer",      value: selected.customer, tab: "customers" as string | undefined, isSku: false },
              { label: "SKU",           value: selected.sku,      tab: undefined,                        isSku: true  },
              { label: "Qty",           value: String(selected.qty), tab: undefined,                     isSku: false },
              { label: "Reason",        value: REASON_LABELS[selected.reason], tab: undefined,            isSku: false },
              { label: "Refund Method", value: REFUND_METHOD_LABELS[selected.refundMethod], tab: undefined, isSku: false },
              { label: "Refund Amount", value: fmtMoney(selected.refundAmount), tab: undefined,           isSku: false },
              ...(selected.customerEmail ? [{ label: "Customer Email", value: selected.customerEmail, tab: undefined, isSku: false }] : []),
            ].map(({ label, value, tab, isSku }) => (
              <div key={label} style={{ background: C.bg, borderRadius: 10, border: `1px solid ${C.border}`, padding: "10px 14px" }}>
                <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: (tab || isSku) ? C.blue : C.text, cursor: (tab || isSku) ? "pointer" : "default", textDecoration: (tab || isSku) ? "underline" : "none" }}
                     onClick={() => { if (isSku) setSkuPopup(value); else if (tab) onNavigate?.(tab); }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {selected.description && (
            <div style={{ background: C.bg, borderRadius: 10, border: `1px solid ${C.border}`, padding: "12px 14px", marginBottom: 12, fontSize: 13, color: C.muted }}>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Description</div>
              {selected.description}
            </div>
          )}
          {selected.orderId && (
            <div style={{ fontSize: 12, color: C.muted }}>
              Original Order: <strong style={{ color: C.text }}>{selected.orderId}</strong>
            </div>
          )}
        </div>
      )}

      {/* List */}
      {!selected && (
        loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.muted, fontSize: 14 }}>Loading returns…</div>
        ) : visible.length === 0 ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "60px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 8 }}>
              {filter === "all" ? "No returns yet" : `No ${STATUS_CFG[filter].label.toLowerCase()} returns`}
            </h3>
            <p style={{ color: C.muted, fontSize: 14, marginBottom: 24 }}>
              {filter === "all" ? "When customers request returns, they'll appear here." : "Try a different filter."}
            </p>
            {filter === "all" && !isViewer && (
              <button onClick={() => setShowNew(true)} style={{ padding: "11px 24px", borderRadius: 10, background: C.blue, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Create First Return
              </button>
            )}
          </div>
        ) : (
          <>
          <SearchSortBar
            search={returnSort.search} setSearch={returnSort.setSearch}
            sortBy={returnSort.sortBy} setSortBy={returnSort.setSortBy}
            sortDir={returnSort.sortDir} setSortDir={returnSort.setSortDir}
            sortOptions={[
              { value: "date", label: "Date" },
              { value: "customer", label: "Customer" },
              { value: "status", label: "Status" },
            ]}
            placeholder="Search returns…"
          />
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                  {["RMA #", "Customer", "SKU", "Qty", "Reason", "Refund", "Status", "Date", "Actions"].map((h, i) => (
                    <th key={i} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {returnSort.filtered.map((ret, i) => {
                  const cfg  = STATUS_CFG[ret.status];
                  const Icon = cfg.icon;
                  return (
                    <tr key={ret.id} style={{ borderBottom: i < returnSort.filtered.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer" }}
                      onClick={() => setSelected(ret)}>
                      <td style={{ padding: "13px 16px", fontWeight: 700, color: C.blue, fontFamily: "monospace" }}>{ret.rmaNumber}</td>
                      <td style={{ padding: "13px 16px", fontWeight: 600, color: C.text }}>
                        <span style={{ color: C.blue, cursor: "pointer", textDecoration: "underline" }} onClick={() => onNavigate?.("customers", ret.customer)}>{ret.customer}</span>
                        {ret.customerEmail && (
                          <span style={{ marginLeft: 7, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: C.purpleBg, color: C.purple, border: `1px solid ${C.purpleBorder}` }}>
                            Via Portal
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "13px 16px", color: C.muted, fontFamily: "monospace" }} onClick={(e) => e.stopPropagation()}><SkuLink sku={ret.sku} workspaceId={workspaceId} /></td>
                      <td style={{ padding: "13px 16px", color: C.text }}>{ret.qty}</td>
                      <td style={{ padding: "13px 16px", color: C.muted }}>{REASON_LABELS[ret.reason]}</td>
                      <td style={{ padding: "13px 16px", fontWeight: 700, color: C.text }}>{fmtMoney(ret.refundAmount)}</td>
                      <td style={{ padding: "13px 16px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                          <Icon size={10} />{cfg.label}
                        </span>
                      </td>
                      <td style={{ padding: "13px 16px", color: C.muted }}>{fmtDate(ret.createdAt)}</td>
                      <td style={{ padding: "13px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                          {!isViewer && NEXT_STATUS[ret.status] && (
                            <button onClick={() => advanceStatus(ret)} style={{
                              padding: "5px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer",
                              background: C.greenBg, border: `1px solid ${C.greenBorder}`, color: C.green,
                            }}>
                              → {STATUS_CFG[NEXT_STATUS[ret.status]!].label}
                            </button>
                          )}
                          {!isViewer && ["requested", "approved"].includes(ret.status) && (
                            <button onClick={() => rejectReturn(ret)} style={{
                              padding: "5px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer",
                              background: C.redBg, border: `1px solid ${C.redBorder}`, color: C.red,
                            }}>
                              Reject
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )
      )}
    </div>
  );
}
