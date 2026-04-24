"use client";
// components/InventorySync.tsx
// Phase 22: Demand Forecasting panel added.
// Phase 19: Barcode Scanner button added.
// Phase 13: Smart Reorder Prediction panel added.
// Phase 4: Loads from DB on mount, writes to DB in background.
// localStorage used as fast cache — falls back silently if DB unavailable.

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { AlertTriangle, CheckCircle, XCircle, Zap, Package, MapPin, RefreshCw, Plus, X, ScanLine, Brain, TrendingUp, Search } from "lucide-react";
import { C } from "@/lib/utils";
import { loadWorkspace } from "@/lib/workspace";
import dynamic from "next/dynamic";
import { useFilterSort, SearchSortBar } from "./useFilterSort";

const BarcodeScanner = dynamic(() => import("./BarcodeScanner"), { ssr: false });
import {
  InventoryItem, ConflictLog, WarehouseZone,
  loadInventory, saveInventory,
  loadConflicts, saveConflicts,
  getStockStatus, STATUS_LABEL, STATUS_COLOR,
  fetchInventoryFromDb, createInventoryItemInDb, updateInventoryItemInDb,
} from "@/lib/inventory";

// ── Add SKU Modal ─────────────────────────────────────────────────────────────
function AddSKUModal({ onSave, onClose }: {
  onSave: (item: InventoryItem) => void;
  onClose: () => void;
}) {
  const [sku,          setSku]          = useState("");
  const [name,         setName]         = useState("");
  const [category,     setCategory]     = useState("Fasteners");
  const [stockLevel,   setStockLevel]   = useState("0");
  const [reorderPoint, setReorderPoint] = useState("50");
  const [reorderQty,   setReorderQty]   = useState("100");
  const [unitCost,     setUnitCost]     = useState("");
  const [warehouse,    setWarehouse]    = useState("Warehouse A");
  const [zone,         setZone]         = useState<WarehouseZone>("A");
  const [binLocation,  setBinLocation]  = useState("");
  const [supplier,     setSupplier]     = useState("");
  const [error,        setError]        = useState("");

  const cats = ["Fasteners","Bearings","Hydraulics","Pneumatics","Tools","Safety Gear","Structural","Electronics","Mechanical","Other"];

  const inp: any = {
    width:"100%", padding:"10px 12px", background:C.bg,
    border:`1px solid ${C.border}`, borderRadius:9, color:C.text,
    fontSize:13, outline:"none", boxSizing:"border-box", fontFamily:"inherit",
  };
  const lbl: any = {
    display:"block", fontSize:11, fontWeight:700, color:C.muted,
    marginBottom:5, textTransform:"uppercase", letterSpacing:"0.05em",
  };

  const submit = () => {
    if (!sku.trim())     { setError("SKU code is required."); return; }
    if (!name.trim())    { setError("Product name is required."); return; }
    if (!unitCost.trim() || isNaN(parseFloat(unitCost))) { setError("Enter a valid unit cost."); return; }

    const newItem: InventoryItem = {
      id:           Math.random().toString(36).slice(2, 9),
      sku:          sku.trim().toUpperCase(),
      name:         name.trim(),
      category,
      stockLevel:   parseInt(stockLevel)   || 0,
      reorderPoint: parseInt(reorderPoint) || 50,
      reorderQty:   parseInt(reorderQty)   || 100,
      unitCost:     parseFloat(unitCost),
      warehouse,
      zone,
      binLocation:  binLocation.trim() || `${zone}-01-1`,
      lastSynced:   new Date().toISOString(),
      supplier:     supplier.trim() || "—",
    };
    onSave(newItem);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:24 }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"28px", width:"100%", maxWidth:560, boxShadow:"0 20px 60px rgba(0,0,0,0.15)", maxHeight:"90vh", overflowY:"auto" }}>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
          <h2 style={{ fontSize:17, fontWeight:800, color:C.text }}>Add New SKU</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted }}><X size={18}/></button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
          <div style={{ marginBottom:14 }}>
            <label style={lbl}>SKU Code *</label>
            <input value={sku} onChange={e=>setSku(e.target.value)} placeholder="e.g. SKU-1234" style={inp}/>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={lbl}>Category</label>
            <select value={category} onChange={e=>setCategory(e.target.value)} style={inp}>
              {cats.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:14, gridColumn:"1/-1" }}>
            <label style={lbl}>Product Name *</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Industrial Bolts M10 (Box/100)" style={inp}/>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={lbl}>Stock Level</label>
            <input type="number" min="0" value={stockLevel} onChange={e=>setStockLevel(e.target.value)} style={inp}/>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={lbl}>Unit Cost ($) *</label>
            <input type="number" min="0" value={unitCost} onChange={e=>setUnitCost(e.target.value)} placeholder="e.g. 4.50" style={inp}/>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={lbl}>Reorder Point</label>
            <input type="number" min="0" value={reorderPoint} onChange={e=>setReorderPoint(e.target.value)} style={inp}/>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={lbl}>Reorder Qty</label>
            <input type="number" min="0" value={reorderQty} onChange={e=>setReorderQty(e.target.value)} style={inp}/>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={lbl}>Warehouse</label>
            <select value={warehouse} onChange={e=>setWarehouse(e.target.value)} style={inp}>
              {["Warehouse A","Warehouse B","Warehouse C","Warehouse D"].map(w=><option key={w}>{w}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={lbl}>Zone</label>
            <select value={zone} onChange={e=>setZone(e.target.value as WarehouseZone)} style={inp}>
              {["A","B","C","D"].map(z=><option key={z}>{z}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={lbl}>Bin Location</label>
            <input value={binLocation} onChange={e=>setBinLocation(e.target.value)} placeholder="e.g. A-02-1" style={inp}/>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={lbl}>Supplier</label>
            <input value={supplier} onChange={e=>setSupplier(e.target.value)} placeholder="e.g. SteelCo Industries" style={inp}/>
          </div>
        </div>

        {error && (
          <div style={{ marginBottom:14, padding:"9px 13px", background:C.redBg, border:`1px solid ${C.redBorder}`, borderRadius:8, fontSize:13, color:C.red }}>
            {error}
          </div>
        )}

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={submit} style={{ flex:1, padding:"12px", borderRadius:10, background:C.blue, border:"none", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>
            Add to Inventory
          </button>
          <button onClick={onClose} style={{ padding:"12px 18px", borderRadius:10, background:C.bg, border:`1px solid ${C.border}`, color:C.muted, fontSize:13, fontWeight:600, cursor:"pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtMoney = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
const fmtNum   = (n: number) => n.toLocaleString("en-US");

const Card = ({ children, style = {} }: any) => (
  <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"20px 22px", ...style }}>
    {children}
  </div>
);
const SectionTitle = ({ children, icon: Icon }: any) => (
  <div style={{ display:"flex", alignItems:"center", gap:8, fontWeight:700, fontSize:13, color:C.muted, textTransform:"uppercase" as const, letterSpacing:"0.06em", marginBottom:14 }}>
    {Icon && <Icon size={13}/>}{children}
  </div>
);
const StatusBadge = ({ item }: { item: InventoryItem }) => {
  const status = getStockStatus(item);
  const s      = STATUS_COLOR[status];
  return (
    <span style={{ display:"inline-block", padding:"3px 10px", borderRadius:999, fontSize:11, fontWeight:700, color:s.color, background:s.bg, border:`1px solid ${s.border}` }}>
      {STATUS_LABEL[status]}
    </span>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function InventorySync({ onNavigate }: { onNavigate?: (tab: string, id?: string) => void }) {
  const { data: session } = useSession();
  const isViewer = session?.user?.role === "viewer";
  const [items,      setItems]      = useState<InventoryItem[]>([]);
  const [conflicts,  setConflicts]  = useState<ConflictLog[]>([]);
  const [view,       setView]       = useState<"stock"|"alerts"|"conflicts"|"pricing">("stock");
  const [searchTerm, setSearchTerm] = useState("");
  const [adjustId,  setAdjustId]  = useState<string|null>(null);
  const [adjustVal, setAdjustVal] = useState("");
  const [adjustErr, setAdjustErr] = useState("");
  const [rule,      setRule]      = useState({ cat:"Fasteners", change:"+10", type:"price" });
  const [applied,   setApplied]   = useState(false);
  const [showAdd,   setShowAdd]   = useState(false);

  // Reorder approval state
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [reorderQueue,     setReorderQueue]     = useState<InventoryItem[]>([]);
  const [reorderBusy,      setReorderBusy]      = useState(false);
  const [reorderDone,      setReorderDone]      = useState("");

  // Phase 13/19/22 — AI + Barcode feature flags
  const [aiReorderOn,     setAiReorderOn]     = useState(false);
  const [showBarcode,     setShowBarcode]      = useState(false);
  const [scannedSku,      setScannedSku]       = useState("");

  // Phase 13 — Smart Reorder
  const [reorderLoading,  setReorderLoading]   = useState(false);
  const [reorderResults,  setReorderResults]   = useState<{ sku:string; name:string; suggestedQty:number; urgency:string; reasoning:string }[]>([]);
  const [reorderMsg,      setReorderMsg]       = useState("");
  const [reorderErr,      setReorderErr]       = useState("");

  const { search, setSearch, sortBy, setSortBy, sortDir, setSortDir, filtered } = useFilterSort(items, {
    searchFields: (i) => [i.sku, i.name, i.category, i.supplier],
    sortOptions: [
      { value: "sku",      label: "SKU",         get: (i) => i.sku },
      { value: "name",     label: "Name",        get: (i) => i.name },
      { value: "stock",    label: "Stock level", get: (i) => i.stockLevel },
      { value: "unitCost", label: "Unit cost",   get: (i) => i.unitCost },
      { value: "category", label: "Category",    get: (i) => i.category },
    ],
    defaultSort: "sku",
    defaultDir: "asc",
  });

  // Phase 22 — Demand Forecast
  const [forecastLoading, setForecastLoading]  = useState(false);
  const [forecastResults, setForecastResults]  = useState<{ sku:string; name:string; forecast30d:number; trend:string; stockoutRisk:string; insight:string }[]>([]);
  const [forecastMsg,     setForecastMsg]      = useState("");
  const [forecastErr,     setForecastErr]      = useState("");

  // Load from localStorage immediately, then refresh from DB
  useEffect(() => {
    setItems(loadInventory());
    setConflicts(loadConflicts());
    fetchInventoryFromDb().then(dbItems => {
      if (dbItems.length > 0) setItems(dbItems);
    });
    // Phase 13: check AI toggle
    const ws = loadWorkspace();
    if (ws) setAiReorderOn(ws.aiReorder ?? false);
  }, []);

  // Phase 13 — Smart Reorder
  const runReorder = async () => {
    const wid = typeof window !== "undefined" ? localStorage.getItem("workspaceDbId") : null;
    if (!wid) return;
    setReorderLoading(true); setReorderErr(""); setReorderResults([]); setReorderMsg("");
    try {
      const res  = await fetch("/api/ai/reorder", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ workspaceId:wid }) });
      const data = await res.json();
      if (!res.ok) setReorderErr(data.error ?? "AI error");
      else { setReorderResults(data.suggestions ?? []); setReorderMsg(data.message ?? ""); }
    } catch (e:unknown) { setReorderErr(e instanceof Error ? e.message : "Request failed"); }
    finally { setReorderLoading(false); }
  };

  // Phase 22 — Demand Forecast
  const runForecast = async () => {
    const wid = typeof window !== "undefined" ? localStorage.getItem("workspaceDbId") : null;
    if (!wid) return;
    setForecastLoading(true); setForecastErr(""); setForecastResults([]); setForecastMsg("");
    try {
      const res  = await fetch("/api/ai/forecast", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ workspaceId:wid }) });
      const data = await res.json();
      if (!res.ok) setForecastErr(data.error ?? "AI error");
      else { setForecastResults(data.forecasts ?? []); setForecastMsg(data.message ?? ""); }
    } catch (e:unknown) { setForecastErr(e instanceof Error ? e.message : "Request failed"); }
    finally { setForecastLoading(false); }
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const alertItems    = items.filter(i => ["low","critical","out_of_stock"].includes(getStockStatus(i)));
  const totalValue    = items.reduce((s,i) => s + i.stockLevel * i.unitCost, 0);
  const totalSKUs     = items.length;
  const openConflicts = conflicts.filter(c => c.status === "alert").length;

  // ── Adjust stock ──────────────────────────────────────────────────────────
  const submitAdjust = (id: string) => {
    const delta = parseInt(adjustVal);
    if (isNaN(delta)) { setAdjustErr("Enter a number (e.g. -10 or +50)"); return; }
    const updated = items.map(i => {
      if (i.id !== id) return i;
      const newLevel = Math.max(0, i.stockLevel + delta);
      updateInventoryItemInDb(id, { stockLevel: newLevel, lastSynced: new Date().toISOString() }); // DB update in background
      return { ...i, stockLevel: newLevel, lastSynced: new Date().toISOString() };
    });
    setItems(updated);
    saveInventory(updated);
    setAdjustId(null);
    setAdjustVal("");
    setAdjustErr("");
  };

  // ── Per-item Reorder ─────────────────────────────────────────────────────
  const [reorderItemMsg, setReorderItemMsg] = useState<Record<string, string>>({});
  const reorderItem = async (item: InventoryItem) => {
    if (!item.supplierId) {
      setReorderItemMsg(prev => ({ ...prev, [item.id]: "Link a supplier to this item first." }));
      setTimeout(() => setReorderItemMsg(prev => { const n = { ...prev }; delete n[item.id]; return n; }), 4000);
      return;
    }
    const wid = typeof window !== "undefined" ? localStorage.getItem("workspaceDbId") : null;
    if (!wid) return;
    setReorderItemMsg(prev => ({ ...prev, [item.id]: "Creating…" }));
    try {
      const res = await fetch("/api/purchase-orders/auto-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: wid, inventoryItemId: item.id }),
      });
      if (res.ok) {
        setReorderItemMsg(prev => ({ ...prev, [item.id]: "✓ PO created" }));
      } else {
        const d = await res.json();
        setReorderItemMsg(prev => ({ ...prev, [item.id]: d.error ?? "Failed" }));
      }
    } catch {
      setReorderItemMsg(prev => ({ ...prev, [item.id]: "Network error" }));
    }
    setTimeout(() => setReorderItemMsg(prev => { const n = { ...prev }; delete n[item.id]; return n; }), 5000);
  };

  // ── Resolve conflict ──────────────────────────────────────────────────────
  const resolveConflict = (id: number) => {
    const updated = conflicts.map(c => c.id === id ? { ...c, status:"resolved" as const } : c);
    setConflicts(updated);
    saveConflicts(updated);
  };

  // ── Add new SKU ───────────────────────────────────────────────────────────
  const handleAddSKU = (item: InventoryItem) => {
    const updated = [item, ...items];
    setItems(updated);
    saveInventory(updated);
    createInventoryItemInDb(item); // DB write in background
    setShowAdd(false);
  };

  // ── Per-item Auto-PO: creates a Purchase Order directly (requires linked supplier) ──
  const createAutoPo = async (item: InventoryItem) => {
    const wid = typeof window !== "undefined" ? localStorage.getItem("workspaceDbId") : null;
    if (!wid) { alert("No workspace selected."); return; }
    if (!confirm(`Create a Purchase Order for ${item.sku} (${item.name})?\n\nSends a PO to the linked supplier for ${item.reorderQty} units.`)) return;
    try {
      const res  = await fetch("/api/purchase-orders/auto-create", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ workspaceId: wid, inventoryItemId: item.id }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data?.error || "Could not create PO."); return; }
      setReorderDone(`✓ PO created for ${item.sku}. Check the Purchase Orders tab.`);
      setTimeout(() => setReorderDone(""), 6000);
    } catch (e: any) {
      alert(e?.message || "Network error");
    }
  };

  // ── Approve reorder: creates a ticket per unique supplier ────────────────────
  const approveReorder = async () => {
    const wid = typeof window !== "undefined" ? localStorage.getItem("workspaceDbId") : null;
    if (!wid || reorderQueue.length === 0) return;
    setReorderBusy(true);
    try {
      // Group by supplier
      const bySupplier: Record<string, InventoryItem[]> = {};
      for (const item of reorderQueue) {
        const key = item.supplier || "Unknown Supplier";
        if (!bySupplier[key]) bySupplier[key] = [];
        bySupplier[key].push(item);
      }
      for (const [supplier, items] of Object.entries(bySupplier)) {
        const lines = items.map(i => `${i.sku} — ${i.name}: order ${i.reorderQty} units (est. $${(i.unitCost * i.reorderQty).toFixed(2)})`).join("\n");
        await fetch("/api/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title:       `Reorder Request — ${supplier}`,
            description: `The following items need restocking:\n\n${lines}\n\nPlease place purchase order with ${supplier}.`,
            type:        "reorder",
            priority:    items.some(i => getStockStatus(i) === "out_of_stock" || getStockStatus(i) === "critical") ? "high" : "medium",
            status:      "open",
            workspaceId: wid,
          }),
        });
      }
      setReorderDone(`✓ ${Object.keys(bySupplier).length} reorder ticket(s) created. Check the Tickets tab.`);
      setShowReorderModal(false);
      setTimeout(() => setReorderDone(""), 6000);
    } catch {
      setReorderDone("Failed to create tickets. Please try again.");
    } finally {
      setReorderBusy(false);
    }
  };

  const cats     = ["Fasteners","Bearings","Hydraulics","Pneumatics","Tools","Safety Gear","Structural","Electronics","Mechanical"];
  const selStyle = { background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px", fontSize:13, color:C.text, outline:"none" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>

      {showAdd && <AddSKUModal onSave={handleAddSKU} onClose={() => setShowAdd(false)} />}

      {/* ── Reorder Approval Modal ── */}
      {showReorderModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:16 }}>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:28, width:"100%", maxWidth:600, maxHeight:"85vh", overflowY:"auto", boxShadow:"0 24px 80px rgba(0,0,0,0.18)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <h2 style={{ fontSize:17, fontWeight:800, color:C.text }}>Reorder Approval</h2>
              <button onClick={() => setShowReorderModal(false)} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted }}><X size={18}/></button>
            </div>
            <p style={{ fontSize:13, color:C.muted, marginBottom:16 }}>
              Review the items below. On approval, a reorder ticket will be created per supplier.
            </p>
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:20 }}>
              {reorderQueue.map(item => {
                const status = getStockStatus(item);
                const s = STATUS_COLOR[status];
                const estCost = item.unitCost * item.reorderQty;
                return (
                  <div key={item.id} style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:12, padding:"12px 14px", background:s.bg, border:`1px solid ${s.border}`, borderRadius:10 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:13, color:C.text }}>{item.name}</div>
                      <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
                        SKU: <span style={{ fontFamily:"monospace", color:C.blue }}>{item.sku}</span>
                        {" · "}Supplier: <strong>{item.supplier || "—"}</strong>
                        {" · "}Current stock: <strong>{item.stockLevel}</strong>
                      </div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ fontWeight:800, color:s.color, fontSize:13 }}>Order {item.reorderQty} units</div>
                      <div style={{ fontSize:11, color:C.muted }}>Est. {fmtMoney(estCost)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button onClick={() => setShowReorderModal(false)} style={{ padding:"10px 20px", background:"none", border:`1px solid ${C.border}`, borderRadius:9, color:C.muted, fontSize:13, fontWeight:600, cursor:"pointer" }}>Cancel</button>
              <button onClick={approveReorder} disabled={reorderBusy} style={{ padding:"10px 24px", background:reorderBusy ? C.border : C.blue, border:"none", borderRadius:9, color:reorderBusy ? C.muted : "#fff", fontSize:13, fontWeight:700, cursor:reorderBusy ? "not-allowed" : "pointer" }}>
                {reorderBusy ? "Creating tickets…" : "✓ Approve & Create Tickets"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reorder done banner */}
      {reorderDone && (
        <div style={{ padding:"11px 16px", background:reorderDone.startsWith("✓") ? C.greenBg : C.redBg, border:`1px solid ${reorderDone.startsWith("✓") ? C.greenBorder : C.redBorder}`, borderRadius:10, fontSize:13, color:reorderDone.startsWith("✓") ? C.green : C.red, fontWeight:600 }}>
          {reorderDone}
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:C.text, marginBottom:4 }}>Inventory</h1>
          <p style={{ color:C.muted, fontSize:13 }}>Stock levels, warehouse locations and reorder management.</p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {alertItems.length > 0 && (
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 16px", background:C.redBg, border:`1px solid ${C.redBorder}`, borderRadius:10, fontSize:13, color:C.red, fontWeight:700 }}>
              <AlertTriangle size={15}/>
              {alertItems.length} item{alertItems.length !== 1 ? "s" : ""} need reordering
            </div>
          )}
          {alertItems.length > 0 && !isViewer && (
            <button onClick={() => { setReorderQueue(alertItems); setShowReorderModal(true); }} style={{ display:"flex", alignItems:"center", gap:7, padding:"10px 18px", borderRadius:10, background:C.amber, border:"none", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              <Package size={14}/> Reorder All ({alertItems.length})
            </button>
          )}
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={14} style={{ position: "absolute", left: 10, color: C.muted, pointerEvents: "none" }} />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search SKUs…" style={{ padding: "9px 12px 9px 32px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, outline: "none", width: 180 }} />
          </div>
          {!isViewer && (
          <button onClick={() => setShowAdd(true)} style={{ display:"flex", alignItems:"center", gap:7, padding:"10px 20px", borderRadius:10, background:C.blue, border:"none", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
            <Plus size={14}/> Add SKU
          </button>
          )}
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
        {[
          { label:"Total SKUs",     value:totalSKUs,            color:C.blue,  bg:C.blueBg,  border:C.blueBorder  },
          { label:"Stock Value",    value:fmtMoney(totalValue), color:C.green, bg:C.greenBg, border:C.greenBorder },
          { label:"Reorder Alerts", value:alertItems.length,    color:C.red,   bg:C.redBg,   border:C.redBorder   },
          { label:"Open Conflicts", value:openConflicts,        color:C.amber, bg:C.amberBg, border:C.amberBorder },
        ].map((s,i) => (
          <div key={i} style={{ background:s.bg, border:`1px solid ${s.border}`, borderRadius:12, padding:"14px 18px" }}>
            <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Sync status row ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
        {[
          { l:"Last Full Sync",  v:"48s ago", sub:"Next in 12s",    ico:"🔄" },
          { l:"Sources Active",  v:"3 / 3",   sub:"ERP · WMS · CRM", ico:"🔌" },
          { l:"Sync Conflicts",  v:openConflicts, sub:"Pending review", ico:"⚠️" },
        ].map((s,i) => (
          <div key={i} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 18px", display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontSize:22 }}>{s.ico}</span>
            <div>
              <div style={{ fontSize:15, fontWeight:800, color:C.text }}>{s.v}</div>
              <div style={{ fontSize:11, color:C.muted }}>{s.l}</div>
              <div style={{ fontSize:11, color:C.subtle }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Phase 19: Barcode Scanner overlay */}
      {showBarcode && (
        <BarcodeScanner
          onDetected={(value) => {
            setScannedSku(value);
            setShowBarcode(false);
            // Auto-jump to stock tab and highlight the scanned SKU
            setView("stock");
          }}
          onClose={() => setShowBarcode(false)}
        />
      )}

      {/* Scanned SKU banner */}
      {scannedSku && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px", background:C.greenBg, border:`1px solid ${C.greenBorder}`, borderRadius:10 }}>
          <span style={{ fontSize:13, color:C.green, fontWeight:700 }}>
            <ScanLine size={13} style={{ verticalAlign:"middle", marginRight:6 }} />
            Scanned: <strong>{scannedSku}</strong>
          </span>
          <button onClick={() => setScannedSku("")} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted }}><X size={14}/></button>
        </div>
      )}

      {/* ── Tab nav ── */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" as const }}>
        {(["stock","alerts","conflicts","pricing"] as const).map(t => (
          <button key={t} onClick={() => setView(t)} style={{
            padding:"8px 18px", borderRadius:9, fontSize:13, fontWeight:600, cursor:"pointer",
            background: view===t ? C.blue : C.surface,
            color:      view===t ? "#fff" : C.muted,
            border:     view===t ? "none" : `1px solid ${C.border}`,
          }}>
            {t === "stock" ? "📦 Stock" : t === "alerts" ? "⚠️ Alerts" : t === "conflicts" ? "🔀 Conflicts" : "⚡ Pricing"}
          </button>
        ))}
        {/* Phase 19 scan button */}
        <button onClick={() => setShowBarcode(true)} style={{
          display:"flex", alignItems:"center", gap:6,
          padding:"8px 16px", borderRadius:9, fontSize:13, fontWeight:600, cursor:"pointer",
          background:C.surface, color:C.muted, border:`1px solid ${C.border}`,
        }}>
          <ScanLine size={14}/> Scan Barcode
        </button>
        {/* Phase 13/22 AI buttons */}
        {aiReorderOn && (
          <button onClick={runReorder} disabled={reorderLoading} style={{
            display:"flex", alignItems:"center", gap:6,
            padding:"8px 16px", borderRadius:9, fontSize:13, fontWeight:600, cursor:reorderLoading?"not-allowed":"pointer",
            background:C.blueBg, color:C.blue, border:`1px solid ${C.blueBorder}`, opacity:reorderLoading?0.7:1,
          }}>
            <Brain size={14}/> {reorderLoading ? "Predicting…" : "Reorder AI"}
          </button>
        )}
        <button onClick={runForecast} disabled={forecastLoading} style={{
          display:"flex", alignItems:"center", gap:6,
          padding:"8px 16px", borderRadius:9, fontSize:13, fontWeight:600, cursor:forecastLoading?"not-allowed":"pointer",
          background:C.purpleBg, color:C.purple, border:`1px solid ${C.purpleBorder}`, opacity:forecastLoading?0.7:1,
        }}>
          <TrendingUp size={14}/> {forecastLoading ? "Forecasting…" : "Demand Forecast"}
        </button>
      </div>

      {/* ══════════════════════════════════════════════
          STOCK VIEW
      ══════════════════════════════════════════════ */}
      {view === "stock" && (
        <Card>
          <SectionTitle icon={Package}>All SKUs</SectionTitle>
          <SearchSortBar
            search={search}
            setSearch={setSearch}
            sortBy={sortBy}
            setSortBy={setSortBy}
            sortDir={sortDir}
            setSortDir={setSortDir}
            sortOptions={[
              { value: "sku",      label: "SKU" },
              { value: "name",     label: "Name" },
              { value: "stock",    label: "Stock level" },
              { value: "unitCost", label: "Unit cost" },
              { value: "category", label: "Category" },
            ]}
            placeholder="Search inventory…"
          />
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ color:C.muted, fontSize:11, textTransform:"uppercase" as const, letterSpacing:"0.04em" }}>
                  {["SKU","Name","Category","Stock","Reorder Pt","Unit Cost","Warehouse","Zone / Bin","Status","",""].map((h,i)=>(
                    <th key={i} style={{ textAlign:"left", padding:"8px 10px", borderBottom:`1px solid ${C.border}`, whiteSpace:"nowrap" as const }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.filter(item => !searchTerm || item.sku.toLowerCase().includes(searchTerm.toLowerCase()) || item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.category?.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
                  <tr key={item.id} style={{ borderBottom:`1px solid ${C.border}` }}>
                    <td style={{ padding:"10px", fontFamily:"monospace", fontSize:11, color:C.blue, whiteSpace:"nowrap" as const }}>{item.sku}</td>
                    <td style={{ padding:"10px", color:C.text, maxWidth:200 }}>{item.name}</td>
                    <td style={{ padding:"10px", color:C.muted, fontSize:12 }}>{item.category}</td>
                    <td style={{ padding:"10px", fontWeight:700, color: item.stockLevel === 0 ? C.red : C.text }}>{fmtNum(item.stockLevel)}</td>
                    <td style={{ padding:"10px", color:C.muted }}>{item.reorderPoint}</td>
                    <td style={{ padding:"10px", color:C.green, fontWeight:600 }}>{fmtMoney(item.unitCost)}</td>
                    <td style={{ padding:"10px", color:C.muted, fontSize:12 }}>{item.warehouse}</td>
                    <td style={{ padding:"10px" }}>
                      <span style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:C.subtle }}>
                        <MapPin size={10}/>{item.zone} · {item.binLocation}
                      </span>
                    </td>
                    <td style={{ padding:"10px" }}><StatusBadge item={item}/></td>
                    <td style={{ padding:"10px" }}>
                      {adjustId === item.id ? (
                        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                          <div style={{ display:"flex", gap:4 }}>
                            <input
                              value={adjustVal}
                              onChange={e=>{setAdjustVal(e.target.value);setAdjustErr("");}}
                              placeholder="e.g. -10"
                              autoFocus
                              style={{ width:70, padding:"5px 8px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:7, fontSize:12, color:C.text, outline:"none" }}
                            />
                            <button onClick={()=>submitAdjust(item.id)} style={{ padding:"5px 10px", background:C.blue, border:"none", borderRadius:7, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}>✓</button>
                            <button onClick={()=>{setAdjustId(null);setAdjustVal("");setAdjustErr("");}} style={{ padding:"5px 8px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:7, color:C.muted, fontSize:11, cursor:"pointer" }}>✕</button>
                          </div>
                          {adjustErr && <div style={{ fontSize:10, color:C.red }}>{adjustErr}</div>}
                        </div>
                      ) : (
                        <button onClick={()=>{setAdjustId(item.id);setAdjustVal("");}} style={{ padding:"5px 10px", background:C.blueBg, border:`1px solid ${C.blueBorder}`, borderRadius:7, color:C.blue, fontSize:11, fontWeight:700, cursor:"pointer" }}>
                          Adjust
                        </button>
                      )}
                    </td>
                    <td style={{ padding:"10px" }}>
                      {!isViewer && (
                        reorderItemMsg[item.id] ? (
                          <span style={{ fontSize:11, color: reorderItemMsg[item.id].startsWith("✓") ? C.green : C.red, fontWeight:600 }}>
                            {reorderItemMsg[item.id]}
                          </span>
                        ) : (
                          <button onClick={() => reorderItem(item)} style={{ padding:"5px 10px", background:C.amberBg, border:`1px solid ${C.amberBorder}`, borderRadius:7, color:C.amber, fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" as const }}>
                            Reorder
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ══════════════════════════════════════════════
          REORDER ALERTS VIEW
      ══════════════════════════════════════════════ */}
      {view === "alerts" && (
        alertItems.length === 0 ? (
          <Card>
            <div style={{ textAlign:"center", padding:"40px 0", color:C.muted, fontSize:14 }}>
              <CheckCircle size={32} color={C.green} style={{ marginBottom:12 }}/>
              <div>All items are well-stocked. No reorder alerts.</div>
            </div>
          </Card>
        ) : (
          <Card>
            <SectionTitle icon={AlertTriangle}>Items Needing Reorder</SectionTitle>
            {alertItems.map(item => {
              const status = getStockStatus(item);
              const s      = STATUS_COLOR[status];
              return (
                <div key={item.id} style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 14px", borderRadius:10, marginBottom:10, background:s.bg, border:`1px solid ${s.border}` }}>
                  <AlertTriangle size={16} color={s.color}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:C.text }}>{item.name}</div>
                    <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{item.sku} · {item.warehouse} · {item.zone}/{item.binLocation}{item.supplier ? <> · <span style={{ color: C.blue, cursor: "pointer", textDecoration: "underline" }} onClick={() => onNavigate?.("suppliers", item.supplier)}>{item.supplier}</span></> : ""}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:14, fontWeight:800, color:s.color }}>{item.stockLevel} units</div>
                    <div style={{ fontSize:11, color:C.muted }}>Reorder at {item.reorderPoint} · Order {item.reorderQty}</div>
                    <div style={{ fontSize:11, color:C.muted }}>Est. cost: {fmtMoney(item.unitCost * item.reorderQty)}</div>
                  </div>
                  <StatusBadge item={item}/>
                  {!isViewer && (
                    <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                      <button onClick={() => createAutoPo(item)} title="Create PO directly from linked supplier" style={{ padding:"6px 12px", background:C.green, border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                        Auto-PO
                      </button>
                      <button onClick={() => { setReorderQueue([item]); setShowReorderModal(true); }} style={{ padding:"6px 14px", background:C.amber, border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                        Reorder
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        )
      )}

      {/* ══════════════════════════════════════════════
          CONFLICTS VIEW
      ══════════════════════════════════════════════ */}
      {view === "conflicts" && (
        <Card>
          <SectionTitle icon={RefreshCw}>Sync Conflict Log</SectionTitle>
          {conflicts.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:C.muted, fontSize:14 }}>No conflicts logged.</div>
          ) : conflicts.map(c => (
            <div key={c.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:10, marginBottom:8, background:c.status==="alert"?C.redBg:C.bg, border:`1px solid ${c.status==="alert"?C.redBorder:C.border}` }}>
              {c.status === "alert" ? <XCircle size={13} color={C.red}/> : <CheckCircle size={13} color={C.green}/>}
              <span style={{ fontFamily:"monospace", color:C.blue, fontSize:12, width:80, flexShrink:0 }}>{c.sku}</span>
              <span style={{ color:C.muted, fontSize:12, width:44, flexShrink:0 }}>{c.field}</span>
              <span style={{ fontSize:12 }}>
                <span style={{ color:C.red }}>{c.before}</span>
                <span style={{ color:C.subtle }}> → </span>
                <span style={{ color:C.green }}>{c.after}</span>
              </span>
              <span style={{ fontSize:11, color:C.subtle }}>[{c.src}]</span>
              <span style={{ marginLeft:"auto", fontSize:11, color:C.subtle, flexShrink:0 }}>{c.time}</span>
              {c.status === "alert"
                ? <button onClick={()=>resolveConflict(c.id)} style={{ fontSize:11, background:C.redBg, color:C.red, border:`1px solid ${C.redBorder}`, borderRadius:6, padding:"4px 10px", cursor:"pointer", fontWeight:600, flexShrink:0 }}>Resolve</button>
                : <span style={{ fontSize:11, background:C.greenBg, color:C.green, border:`1px solid ${C.greenBorder}`, borderRadius:6, padding:"4px 10px", fontWeight:600, flexShrink:0 }}>Auto-fixed</span>
              }
            </div>
          ))}
        </Card>
      )}

      {/* ══════════════════════════════════════════════
          PRICING RULES VIEW
      ══════════════════════════════════════════════ */}
      {view === "pricing" && (
        <Card>
          <SectionTitle icon={Zap}>Bulk Pricing Rule Engine</SectionTitle>
          <p style={{ fontSize:13, color:C.muted, marginBottom:18, lineHeight:1.6 }}>
            Apply a price or stock adjustment to all SKUs in a category at once.
          </p>
          <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" as const, marginBottom:18 }}>
            <select value={rule.cat} onChange={e=>setRule(r=>({...r,cat:e.target.value}))} style={selStyle}>
              {cats.map(c=><option key={c}>{c}</option>)}
            </select>
            <select value={rule.type} onChange={e=>setRule(r=>({...r,type:e.target.value}))} style={selStyle}>
              <option value="price">Unit Cost</option>
              <option value="stock">Stock Level</option>
              <option value="reorder">Reorder Point</option>
            </select>
            <select value={rule.change} onChange={e=>setRule(r=>({...r,change:e.target.value}))} style={selStyle}>
              {["-20","-10","-5","+5","+10","+20"].map(v=><option key={v}>{v}%</option>)}
            </select>
            <button
              onClick={() => {
                const pct = parseFloat(rule.change) / 100;
                const updated = items.map(i => {
                  if (i.category !== rule.cat) return i;
                  const field = rule.type as "unitCost"|"stockLevel"|"reorderPoint";
                  const cur   = i[field] as number;
                  const next  = Math.max(0, parseFloat((cur * (1 + pct)).toFixed(2)));
                  updateInventoryItemInDb(i.id, { [field]: next }); // DB update in background
                  return { ...i, [field]: next };
                });
                setItems(updated);
                saveInventory(updated);
                setApplied(true);
                setTimeout(() => setApplied(false), 2500);
              }}
              style={{ padding:"9px 22px", background:C.blue, border:"none", borderRadius:9, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}
            >
              Apply Rule
            </button>
            {applied && <span style={{ color:C.green, fontSize:13, fontWeight:600 }}>✓ Applied</span>}
          </div>
          <div style={{ fontSize:12, color:C.subtle }}>
            Affects {items.filter(i=>i.category===rule.cat).length} SKU(s) in the <strong>{rule.cat}</strong> category.
          </div>
        </Card>
      )}

      {/* ── Phase 13: Smart Reorder Results ── */}
      {(reorderResults.length > 0 || reorderMsg || reorderErr) && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"20px 22px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
            <Brain size={16} color={C.blue}/>
            <div style={{ fontWeight:700, fontSize:15, color:C.text }}>Smart Reorder Suggestions</div>
          </div>
          {reorderErr  && <div style={{ padding:"10px 14px", background:C.redBg,  border:`1px solid ${C.redBorder}`,  borderRadius:8, color:C.red,  fontSize:13 }}>{reorderErr}</div>}
          {reorderMsg  && <div style={{ padding:"10px 14px", background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:8, color:C.green,fontSize:13 }}>{reorderMsg}</div>}
          {reorderResults.map(r => (
            <div key={r.sku} style={{ padding:"12px 14px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, marginBottom:8 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                <div style={{ fontWeight:700, fontSize:13, color:C.text }}>{r.name} <span style={{ color:C.muted, fontWeight:400 }}>({r.sku})</span></div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ fontSize:12, fontWeight:700,
                    color: r.urgency==="critical"?C.red:r.urgency==="high"?C.amber:C.blue,
                    background: r.urgency==="critical"?C.redBg:r.urgency==="high"?C.amberBg:C.blueBg,
                    border: `1px solid ${r.urgency==="critical"?C.redBorder:r.urgency==="high"?C.amberBorder:C.blueBorder}`,
                    padding:"2px 8px", borderRadius:6,
                  }}>{r.urgency}</span>
                  <span style={{ fontSize:13, fontWeight:800, color:C.blue }}>Suggest: {r.suggestedQty} units</span>
                </div>
              </div>
              <div style={{ fontSize:12, color:C.muted }}>{r.reasoning}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Phase 22: Demand Forecast Results ── */}
      {(forecastResults.length > 0 || forecastMsg || forecastErr) && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"20px 22px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
            <TrendingUp size={16} color={C.purple}/>
            <div style={{ fontWeight:700, fontSize:15, color:C.text }}>30-Day Demand Forecast</div>
          </div>
          {forecastErr  && <div style={{ padding:"10px 14px", background:C.redBg,  border:`1px solid ${C.redBorder}`,  borderRadius:8, color:C.red,  fontSize:13 }}>{forecastErr}</div>}
          {forecastMsg  && <div style={{ padding:"10px 14px", background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:8, color:C.green,fontSize:13 }}>{forecastMsg}</div>}
          {forecastResults.length > 0 && (
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:C.bg }}>
                  {["SKU","Name","Forecast (30d)","Trend","Stockout Risk","Insight"].map(h => (
                    <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {forecastResults.map(f => (
                  <tr key={f.sku} style={{ borderTop:`1px solid ${C.border}` }}>
                    <td style={{ padding:"10px 12px", fontFamily:"monospace", color:C.blue, fontWeight:700 }}>{f.sku}</td>
                    <td style={{ padding:"10px 12px", color:C.text }}>{f.name}</td>
                    <td style={{ padding:"10px 12px", fontWeight:700, color:C.text }}>{f.forecast30d}</td>
                    <td style={{ padding:"10px 12px" }}>
                      <span style={{ fontSize:12, fontWeight:700,
                        color:f.trend==="rising"?C.green:f.trend==="declining"?C.red:C.muted }}>
                        {f.trend==="rising"?"↑ Rising":f.trend==="declining"?"↓ Declining":"→ Stable"}
                      </span>
                    </td>
                    <td style={{ padding:"10px 12px" }}>
                      <span style={{ fontSize:12, fontWeight:700,
                        color:f.stockoutRisk==="high"?C.red:f.stockoutRisk==="medium"?C.amber:C.green }}>
                        {f.stockoutRisk.charAt(0).toUpperCase()+f.stockoutRisk.slice(1)}
                      </span>
                    </td>
                    <td style={{ padding:"10px 12px", color:C.muted, fontSize:12 }}>{f.insight}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
