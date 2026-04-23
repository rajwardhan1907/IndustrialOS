"use client";
// components/Contracts.tsx
// Phase 12 (roadmap) — Contract & SLA Tracker
// Track contracts with customers: min order qty, agreed pricing, delivery SLA, expiry.
// Auto-alerts when contracts are expiring within 30 days or already expired.

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { C } from "@/lib/utils";
import { Card, SectionTitle } from "./Dashboard";
import { downloadCSV } from "@/lib/exportCSV";
import {
  Plus, FileText, Calendar, AlertTriangle, CheckCircle,
  Clock, Trash2, ChevronLeft, Building2, Package,
  Truck, DollarSign, Edit3, Download, X, Search,
} from "lucide-react";
import { useFilterSort, SearchSortBar } from "./useFilterSort";

// ── Types ─────────────────────────────────────────────────────────────────────
export type ContractStatus = "active" | "expiring" | "expired" | "draft";

export interface Contract {
  id:             string;
  contractNumber: string;
  title:          string;
  customer:       string;
  minOrderQty:    number;
  agreedPricing:  string;
  deliverySLA:    number;   // max days
  value:          number;
  startDate:      string;
  expiryDate:     string;
  status:         ContractStatus;
  daysLeft?:      number;   // injected by API
  notes:          string;
  createdAt:      string;
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<ContractStatus, { label: string; color: string; bg: string; border: string; icon: any }> = {
  active:   { label: "Active",    color: C.green,  bg: C.greenBg,  border: C.greenBorder,  icon: CheckCircle  },
  expiring: { label: "Expiring",  color: C.amber,  bg: C.amberBg,  border: C.amberBorder,  icon: AlertTriangle },
  expired:  { label: "Expired",   color: C.red,    bg: C.redBg,    border: C.redBorder,    icon: X            },
  draft:    { label: "Draft",     color: C.muted,  bg: "#f0f0f0",  border: C.border,        icon: Edit3        },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const STORAGE_KEY = "industrialos_contracts";
const fmtDate     = (d: string) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
const fmtMoney    = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const makeId      = () => Math.random().toString(36).slice(2, 9);
const makeCNum    = () => `CT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

function deriveStatus(c: Contract): ContractStatus {
  if (c.status === "draft") return "draft";
  const daysLeft = Math.ceil((new Date(c.expiryDate).getTime() - Date.now()) / 86400000);
  if (daysLeft < 0)        return "expired";
  if (daysLeft <= 30)      return "expiring";
  return "active";
}

function loadContracts(): Contract[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveContracts(cs: Contract[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cs));
}
function getWid(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("workspaceDbId");
}

async function fetchContractsFromDb(): Promise<Contract[]> {
  const wid = getWid();
  if (!wid) return [];
  try {
    const res = await fetch(`/api/contracts?workspaceId=${wid}`);
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}
async function createContractInDb(c: Contract): Promise<void> {
  const wid = getWid();
  if (!wid) return;
  try {
    await fetch("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...c, workspaceId: wid }),
    });
  } catch {}
}
async function deleteContractFromDb(id: string): Promise<void> {
  try { await fetch(`/api/contracts?id=${id}`, { method: "DELETE" }); } catch {}
}

// ── Badge ─────────────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: ContractStatus }) => {
  const s    = STATUS_CFG[status];
  const Icon = s.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
      <Icon size={10} />{s.label}
    </span>
  );
};


// ── New Contract Form ─────────────────────────────────────────────────────────
function NewContractModal({ onSave, onClose }: {
  onSave: (c: Contract) => void;
  onClose: () => void;
}) {
  const [title,         setTitle]         = useState("");
  const [customer,      setCustomer]      = useState("");
  const [minOrderQty,   setMinOrderQty]   = useState("0");
  const [agreedPricing, setAgreedPricing] = useState("");
  const [deliverySLA,   setDeliverySLA]   = useState("7");
  const [value,         setValue]         = useState("0");
  const [startDate,     setStartDate]     = useState(new Date().toISOString().split("T")[0]);
  const [expiryDate,    setExpiryDate]    = useState(
    new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const inp = {
    width: "100%", padding: "10px 12px",
    background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: 9, color: C.text, fontSize: 13,
    outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit",
  };
  const lbl = { display: "block" as const, fontSize: 11, fontWeight: 700 as const, color: C.muted, marginBottom: 5, textTransform: "uppercase" as const, letterSpacing: "0.05em" };

  const submit = () => {
    if (!title.trim())    { setError("Contract title is required."); return; }
    if (!customer.trim()) { setError("Customer name is required."); return; }
    if (!expiryDate)      { setError("Expiry date is required."); return; }
    const c: Contract = {
      id:             makeId(),
      contractNumber: makeCNum(),
      title:          title.trim(),
      customer:       customer.trim(),
      minOrderQty:    parseInt(minOrderQty) || 0,
      agreedPricing:  agreedPricing.trim(),
      deliverySLA:    parseInt(deliverySLA) || 7,
      value:          parseFloat(value) || 0,
      startDate,
      expiryDate,
      status:         "active",
      notes:          notes.trim(),
      createdAt:      new Date().toISOString(),
    };
    c.status = deriveStatus(c);
    onSave(c);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: C.text }}>New Contract</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Contract Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Steel Supply Agreement — Acme Corp" style={inp} />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Customer Name *</label>
            <input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="e.g. Acme Corp" style={inp} />
          </div>
          <div>
            <label style={lbl}>Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Expiry Date *</label>
            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Contract Value ($)</label>
            <input type="number" min="0" value={value} onChange={e => setValue(e.target.value)} placeholder="0" style={inp} />
          </div>
          <div>
            <label style={lbl}>Min Order Qty / Period</label>
            <input type="number" min="0" value={minOrderQty} onChange={e => setMinOrderQty(e.target.value)} placeholder="0" style={inp} />
          </div>
          <div>
            <label style={lbl}>Delivery SLA (days)</label>
            <input type="number" min="1" value={deliverySLA} onChange={e => setDeliverySLA(e.target.value)} placeholder="7" style={inp} />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Agreed Pricing Terms</label>
            <input value={agreedPricing} onChange={e => setAgreedPricing(e.target.value)} placeholder="e.g. Fixed $4,050/unit for SKU-4821, 5% rebate above 2,000 units/quarter" style={inp} />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal notes about this contract…" rows={3} style={{ ...inp, resize: "vertical" }} />
          </div>
        </div>

        {error && <div style={{ marginTop: 12, fontSize: 13, color: C.red, fontWeight: 600 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px", borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, color: C.muted, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button onClick={submit} style={{ flex: 2, padding: "11px", borderRadius: 10, background: C.blue, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Save Contract</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Contracts({ onNavigate }: { onNavigate?: (tab: string, id?: string) => void }) {
  const { data: session } = useSession();
  const isViewer = session?.user?.role === "viewer";

  const [contracts,  setContracts]  = useState<Contract[]>(() => loadContracts());
  const [view,       setView]       = useState<"list" | "detail">("list");
  const [selected,   setSelected]   = useState<Contract | null>(null);
  const [showNew,    setShowNew]    = useState(false);
  const [filter,     setFilter]     = useState<ContractStatus | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Load from DB in background
  useEffect(() => {
    fetchContractsFromDb().then(dbContracts => {
      if (dbContracts.length > 0) {
        setContracts(dbContracts);
        saveContracts(dbContracts);
      }
    });
  }, []);

  const save = (cs: Contract[]) => { setContracts(cs); saveContracts(cs); };

  const addContract = (c: Contract) => {
    const updated = [c, ...contracts];
    save(updated);
    createContractInDb(c);
    setSelected(c);
    setView("detail");
    setShowNew(false);
  };

  const deleteContract = (id: string) => {
    if (!confirm("Delete this contract? This action cannot be undone.")) return;
    save(contracts.filter(c => c.id !== id));
    deleteContractFromDb(id);
    setSelected(null);
    setView("list");
  };

  // Summary stats
  const active   = contracts.filter(c => c.status === "active").length;
  const expiring = contracts.filter(c => c.status === "expiring").length;
  const expired  = contracts.filter(c => c.status === "expired").length;
  const totalVal = contracts.filter(c => c.status !== "expired").reduce((s, c) => s + c.value, 0);

  const visible = contracts.filter(c => {
    if (filter !== "all" && c.status !== filter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (!(c.customer?.toLowerCase().includes(term) || c.title?.toLowerCase().includes(term) || c.contractNumber?.toLowerCase().includes(term))) return false;
    }
    return true;
  });

  const contractSort = useFilterSort(visible, {
    searchFields: (c) => [c.customer, c.contractNumber, c.title, c.notes],
    sortOptions: [
      { value: "start",  label: "Start Date", get: (c) => c.startDate },
      { value: "expiry", label: "End Date",   get: (c) => c.expiryDate },
      { value: "value",  label: "Value",      get: (c) => Number(c.value ?? 0) },
      { value: "status", label: "Status",     get: (c) => c.status },
    ],
    defaultSort: "expiry",
    defaultDir: "asc",
  });

  // ── DETAIL VIEW ─────────────────────────────────────────────────────────────
  if (view === "detail" && selected) {
    const s    = STATUS_CFG[selected.status];
    const days = selected.daysLeft ?? Math.ceil((new Date(selected.expiryDate).getTime() - Date.now()) / 86400000);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 760 }}>
        <button onClick={() => { setSelected(null); setView("list"); }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", fontWeight: 600, padding: 0 }}>
          &#8592; Back to Contracts
        </button>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{selected.title}</h1>
              <StatusBadge status={selected.status} />
            </div>
            <p style={{ color: C.muted, fontSize: 13 }}>
              {selected.contractNumber} · Customer: <strong style={{ color: C.text }}><span style={{ color: C.blue, cursor: "pointer", textDecoration: "underline" }} onClick={() => onNavigate?.("customers", selected.customer)}>{selected.customer}</span></strong>
            </p>
          </div>
          {!isViewer && (
            <button onClick={() => deleteContract(selected.id)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, background: C.redBg, border: `1px solid ${C.redBorder}`, color: C.red, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>

        {/* Expiry alert */}
        {(selected.status === "expiring" || selected.status === "expired") && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: selected.status === "expired" ? C.redBg : C.amberBg, border: `1px solid ${selected.status === "expired" ? C.redBorder : C.amberBorder}`, borderRadius: 10 }}>
            <AlertTriangle size={16} color={selected.status === "expired" ? C.red : C.amber} />
            <span style={{ fontSize: 13, fontWeight: 700, color: selected.status === "expired" ? C.red : C.amber }}>
              {selected.status === "expired"
                ? `This contract expired ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} ago. Contact the customer to renew.`
                : `This contract expires in ${days} day${days !== 1 ? "s" : ""} on ${fmtDate(selected.expiryDate)}. Start renewal now.`}
            </span>
          </div>
        )}

        {/* Key metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { icon: DollarSign, label: "Contract Value",    value: fmtMoney(selected.value),         color: C.blue,   bg: C.blueBg,   border: C.blueBorder   },
            { icon: Package,    label: "Min Order / Period",value: `${selected.minOrderQty.toLocaleString()} units`, color: C.purple, bg: C.purpleBg, border: C.purpleBorder },
            { icon: Truck,      label: "Delivery SLA",      value: `${selected.deliverySLA} days`,  color: C.green,  bg: C.greenBg,  border: C.greenBorder  },
            { icon: Calendar,   label: "Expires",           value: fmtDate(selected.expiryDate),    color: s.color,  bg: s.bg,       border: s.border       },
          ].map(({ icon: Icon, label, value: val, color, bg, border }) => (
            <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Icon size={13} color={color} />
                <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Dates */}
        <Card>
          <SectionTitle icon={Calendar}>Contract Period</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { label: "Start Date",   value: fmtDate(selected.startDate)  },
              { label: "Expiry Date",  value: fmtDate(selected.expiryDate) },
            ].map(({ label, value: val }) => (
              <div key={label} style={{ padding: "12px 14px", background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{val}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Pricing terms */}
        {selected.agreedPricing && (
          <Card>
            <SectionTitle icon={DollarSign}>Agreed Pricing Terms</SectionTitle>
            <p style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>{selected.agreedPricing}</p>
          </Card>
        )}

        {/* Notes */}
        {selected.notes && (
          <Card>
            <SectionTitle icon={FileText}>Notes</SectionTitle>
            <p style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>{selected.notes}</p>
          </Card>
        )}
      </div>
    );
  }

  // ── LIST VIEW ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {showNew && <NewContractModal onSave={addContract} onClose={() => setShowNew(false)} />}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>Contracts & SLAs</h1>
          <p style={{ color: C.muted, fontSize: 13 }}>Track customer agreements, delivery SLAs, and contract expiry dates.</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={14} style={{ position: "absolute", left: 10, color: C.muted, pointerEvents: "none" }} />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search contracts…" style={{ padding: "9px 12px 9px 32px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, outline: "none", width: 190 }} />
          </div>
          <button
            onClick={() => downloadCSV(`contracts_${new Date().toISOString().split("T")[0]}`, contracts.map(c => ({
              "Contract #":    c.contractNumber,
              Title:           c.title,
              Customer:        c.customer,
              Status:          c.status,
              Value:           c.value,
              "Min Order Qty": c.minOrderQty,
              "Delivery SLA":  c.deliverySLA + " days",
              "Pricing Terms": c.agreedPricing,
              "Start Date":    c.startDate,
              "Expiry Date":   c.expiryDate,
              Notes:           c.notes,
            })))}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 14px", borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, color: C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            <Download size={13} /> Export CSV
          </button>
          {!isViewer && (
            <button onClick={() => setShowNew(true)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              <Plus size={14} /> New Contract
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { label: "Active",      value: active,         color: C.green,  bg: C.greenBg,  border: C.greenBorder,  icon: CheckCircle  },
          { label: "Expiring Soon", value: expiring,     color: C.amber,  bg: C.amberBg,  border: C.amberBorder,  icon: AlertTriangle },
          { label: "Expired",     value: expired,        color: C.red,    bg: C.redBg,    border: C.redBorder,    icon: X            },
          { label: "Active Value",value: fmtMoney(totalVal), color: C.blue, bg: C.blueBg, border: C.blueBorder,  icon: DollarSign   },
        ].map(({ label, value: val, color, bg, border, icon: Icon }) => (
          <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.surface, border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={16} color={color} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color }}>{val}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Expiry alert banner */}
      {expiring > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: C.amberBg, border: `1px solid ${C.amberBorder}`, borderRadius: 10 }}>
          <AlertTriangle size={15} color={C.amber} />
          <span style={{ fontSize: 13, color: C.amber, fontWeight: 700 }}>
            {expiring} contract{expiring !== 1 ? "s" : ""} expiring within 30 days — review and begin renewal now.
          </span>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(["all", "active", "expiring", "expired", "draft"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: "6px 13px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none",
              background: filter === f ? C.blue : C.surface,
              color:      filter === f ? "#fff" : C.muted }}>
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== "all" && ` (${contracts.filter(c => c.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Contract list */}
      {visible.length === 0 ? (
        <Card>
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 8 }}>No contracts yet</h3>
            <p style={{ color: C.muted, fontSize: 14, maxWidth: 360, margin: "0 auto 24px", lineHeight: 1.6 }}>
              Add your first customer contract to track SLAs, minimum orders, and expiry dates.
            </p>
            {!isViewer && (
              <button onClick={() => setShowNew(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 10, background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                <Plus size={15} /> Add First Contract
              </button>
            )}
          </div>
        </Card>
      ) : (
        <>
        <SearchSortBar
          search={contractSort.search} setSearch={contractSort.setSearch}
          sortBy={contractSort.sortBy} setSortBy={contractSort.setSortBy}
          sortDir={contractSort.sortDir} setSortDir={contractSort.setSortDir}
          sortOptions={[
            { value: "start", label: "Start Date" },
            { value: "expiry", label: "End Date" },
            { value: "value", label: "Value" },
            { value: "status", label: "Status" },
          ]}
          placeholder="Search contracts…"
        />
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                {["Contract #", "Title", "Customer", "Value", "Min Qty", "SLA", "Expires", "Status"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contractSort.filtered.map((c, i) => {
                const days = Math.ceil((new Date(c.expiryDate).getTime() - Date.now()) / 86400000);
                return (
                  <tr key={c.id}
                    onClick={() => { setSelected(c); setView("detail"); }}
                    style={{ borderBottom: i < contractSort.filtered.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "12px 16px", fontWeight: 700, color: C.blue, fontFamily: "monospace" }}>{c.contractNumber}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: C.text, maxWidth: 200 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
                    </td>
                    <td style={{ padding: "12px 16px", color: C.text }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: C.blueBg, border: `1px solid ${C.blueBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: C.blue, flexShrink: 0 }}>
                          {c.customer.charAt(0)}
                        </div>
                        <span style={{ color: C.blue, cursor: "pointer", textDecoration: "underline" }} onClick={() => onNavigate?.("customers", c.customer)}>{c.customer}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 700, color: C.text }}>{fmtMoney(c.value)}</td>
                    <td style={{ padding: "12px 16px", color: C.muted }}>{c.minOrderQty.toLocaleString()}</td>
                    <td style={{ padding: "12px 16px", color: C.muted }}>{c.deliverySLA}d</td>
                    <td style={{ padding: "12px 16px", color: c.status === "expired" ? C.red : c.status === "expiring" ? C.amber : C.muted, fontWeight: c.status !== "active" && c.status !== "draft" ? 700 : 400 }}>
                      {fmtDate(c.expiryDate)}
                      {c.status === "expiring" && <div style={{ fontSize: 10, color: C.amber }}>{days}d left</div>}
                      {c.status === "expired"  && <div style={{ fontSize: 10, color: C.red }}>expired {Math.abs(days)}d ago</div>}
                    </td>
                    <td style={{ padding: "12px 16px" }}><StatusBadge status={c.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        </>
      )}
    </div>
  );
}
