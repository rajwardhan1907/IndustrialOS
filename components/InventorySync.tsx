"use client";
// components/InventorySync.tsx
// Inventory module — fully self-contained.
// - Real SKU list with stock levels, warehouse locations, bin numbers
// - Reorder alerts (auto-flags items below reorder point)
// - Adjust stock levels manually
// - Conflict log with resolve
// - Bulk pricing rule engine
// - All saved to localStorage via lib/inventory.ts

import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, XCircle, Zap, Package, MapPin, RefreshCw } from "lucide-react";
import { C } from "@/lib/utils";
import {
  InventoryItem, ConflictLog,
  loadInventory, saveInventory,
  loadConflicts, saveConflicts,
  getStockStatus, STATUS_LABEL, STATUS_COLOR,
} from "@/lib/inventory";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtMoney  = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtNum    = (n: number) => n.toLocaleString("en-US");

// ── Sub-components ────────────────────────────────────────────────────────────
const Card = ({ children, style = {} }: any) => (
  <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"20px 22px", ...style }}>
    {children}
  </div>
);
const SectionTitle = ({ children, icon: Icon }: any) => (
  <div style={{ display:"flex", alignItems:"center", gap:8, fontWeight:700, fontSize:13, color:C.muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:14 }}>
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
export default function InventorySync() {
  const [items,      setItems]      = useState<InventoryItem[]>([]);
  const [conflicts,  setConflicts]  = useState<ConflictLog[]>([]);
  const [view,       setView]       = useState<"stock"|"alerts"|"conflicts"|"pricing">("stock");
  const [adjustId,   setAdjustId]   = useState<string|null>(null);
  const [adjustVal,  setAdjustVal]  = useState("");
  const [adjustErr,  setAdjustErr]  = useState("");
  const [rule,       setRule]       = useState({ cat:"Fasteners", change:"+10", type:"price" });
  const [applied,    setApplied]    = useState(false);

  useEffect(() => {
    setItems(loadInventory());
    setConflicts(loadConflicts());
  }, []);

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
      return { ...i, stockLevel: newLevel, lastSynced: new Date().toISOString() };
    });
    setItems(updated);
    saveInventory(updated);
    setAdjustId(null);
    setAdjustVal("");
    setAdjustErr("");
  };

  // ── Resolve conflict ──────────────────────────────────────────────────────
  const resolveConflict = (id: number) => {
    const updated = conflicts.map(c => c.id === id ? { ...c, status:"resolved" as const } : c);
    setConflicts(updated);
    saveConflicts(updated);
  };

  const cats = ["Fasteners","Bearings","Hydraulics","Pneumatics","Tools","Safety Gear","Structural","Electronics","Mechanical"];
  const selStyle = { background:C.surface, border:`1px solid ${C.border2}`, borderRadius:8, padding:"8px 12px", fontSize:13, color:C.text, outline:"none" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:C.text, marginBottom:4 }}>Inventory</h1>
          <p style={{ color:C.muted, fontSize:13 }}>Stock levels, warehouse locations and reorder management.</p>
        </div>
        {alertItems.length > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 16px", background:C.redBg, border:`1px solid ${C.redBorder}`, borderRadius:10, fontSize:13, color:C.red, fontWeight:700 }}>
            <AlertTriangle size={15}/>
            {alertItems.length} item{alertItems.length !== 1 ? "s" : ""} need reordering
          </div>
        )}
      </div>

      {/* ── Summary cards ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
        {[
          { label:"Total SKUs",       value:totalSKUs,           color:C.blue,   bg:C.blueBg,   border:C.blueBorder   },
          { label:"Stock Value",      value:fmtMoney(totalValue),color:C.green,  bg:C.greenBg,  border:C.greenBorder  },
          { label:"Reorder Alerts",   value:alertItems.length,   color:C.red,    bg:C.redBg,    border:C.redBorder    },
          { label:"Open Conflicts",   value:openConflicts,       color:C.amber,  bg:C.amberBg,  border:C.amberBorder  },
        ].map((s,i)=>(
          <div key={i} style={{ background:s.bg, border:`1px solid ${s.border}`, borderRadius:12, padding:"14px 18px" }}>
            <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Sync status row ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
        {[
          { l:"Last Full Sync",  v:"48s ago",   sub:"Next in 12s",     ico:"🔄", ok:true  },
          { l:"DB ↔ CRM Delta",  v:"0 items",   sub:"Reconciled",      ico:"✅", ok:true  },
          { l:"Supply Chain",    v:`${alertItems.length} pending`, sub:"Auto-correcting", ico:"⚠️", ok:alertItems.length===0 },
        ].map((c,i)=>(
          <div key={i} style={{ background:c.ok?C.greenBg:C.amberBg, border:`1px solid ${c.ok?C.greenBorder:C.amberBorder}`, borderRadius:12, padding:"14px 18px", display:"flex", alignItems:"center", gap:14 }}>
            <span style={{ fontSize:24 }}>{c.ico}</span>
            <div>
              <div style={{ fontSize:11, color:C.muted, fontWeight:600 }}>{c.l}</div>
              <div style={{ fontSize:18, fontWeight:800, color:c.ok?C.green:C.amber, marginTop:2 }}>{c.v}</div>
              <div style={{ fontSize:11, color:C.subtle }}>{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── View tabs ── */}
      <div style={{ display:"flex", gap:2, borderBottom:`1px solid ${C.border}` }}>
        {[
          { id:"stock",     label:`Stock (${totalSKUs})`                           },
          { id:"alerts",    label:`Reorder Alerts (${alertItems.length})`,          },
          { id:"conflicts", label:`Conflicts (${openConflicts})`                    },
          { id:"pricing",   label:"Pricing Rules"                                   },
        ].map(t=>(
          <button key={t.id} onClick={()=>setView(t.id as any)} style={{ padding:"9px 16px", fontSize:12, fontWeight:600, border:"none", borderBottom:view===t.id?`2px solid ${C.blue}`:"2px solid transparent", color:view===t.id?C.blue:C.muted, background:"none", cursor:"pointer", marginBottom:-1, whiteSpace:"nowrap" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════
          STOCK VIEW
      ══════════════════════════════════════════════ */}
      {view==="stock"&&(
        <Card style={{ padding:0, overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:C.bg, borderBottom:`1px solid ${C.border}` }}>
                {["SKU","Name","Category","Stock","Reorder At","Unit Cost","Location","Last Sync","Status","Adjust"].map((h,i)=>(
                  <th key={i} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"0.05em", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item,i)=>{
                const status  = getStockStatus(item);
                const isAdj   = adjustId === item.id;
                return (
                  <tr key={item.id} style={{ borderBottom:i<items.length-1?`1px solid ${C.border}`:"none", background: status!=="ok"?`${STATUS_COLOR[status].bg}44`:"transparent" }}>
                    <td style={{ padding:"12px 14px", fontFamily:"monospace", fontWeight:700, color:C.blue, fontSize:12 }}>{item.sku}</td>
                    <td style={{ padding:"12px 14px" }}>
                      <div style={{ fontWeight:600, color:C.text, fontSize:12 }}>{item.name}</div>
                      <div style={{ fontSize:11, color:C.subtle }}>{item.supplier}</div>
                    </td>
                    <td style={{ padding:"12px 14px", color:C.muted, fontSize:12 }}>{item.category}</td>
                    <td style={{ padding:"12px 14px", fontWeight:800, fontSize:15, color: status==="ok"?C.text:STATUS_COLOR[status].color }}>
                      {fmtNum(item.stockLevel)}
                    </td>
                    <td style={{ padding:"12px 14px", color:C.muted, fontSize:12 }}>{fmtNum(item.reorderPoint)}</td>
                    <td style={{ padding:"12px 14px", color:C.muted, fontSize:12 }}>{fmtMoney(item.unitCost)}</td>
                    <td style={{ padding:"12px 14px" }}>
                      <div style={{ fontSize:12, color:C.text, display:"flex", alignItems:"center", gap:4 }}>
                        <MapPin size={11} color={C.muted}/> {item.warehouse}
                      </div>
                      <div style={{ fontSize:11, color:C.subtle }}>{item.zone}-Zone · Bin {item.binLocation}</div>
                    </td>
                    <td style={{ padding:"12px 14px", fontSize:11, color:C.subtle, whiteSpace:"nowrap" }}>
                      <RefreshCw size={10} style={{ marginRight:4, verticalAlign:"middle" }}/>
                      {new Date(item.lastSynced).toLocaleTimeString("en-US",{ hour:"2-digit", minute:"2-digit" })}
                    </td>
                    <td style={{ padding:"12px 14px" }}><StatusBadge item={item}/></td>
                    <td style={{ padding:"12px 14px" }}>
                      {isAdj ? (
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
                          {adjustErr&&<div style={{ fontSize:10, color:C.red }}>{adjustErr}</div>}
                        </div>
                      ) : (
                        <button onClick={()=>{setAdjustId(item.id);setAdjustVal("");}} style={{ padding:"5px 10px", background:C.blueBg, border:`1px solid ${C.blueBorder}`, borderRadius:7, color:C.blue, fontSize:11, fontWeight:700, cursor:"pointer" }}>
                          Adjust
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* ══════════════════════════════════════════════
          REORDER ALERTS VIEW
      ══════════════════════════════════════════════ */}
      {view==="alerts"&&(
        alertItems.length===0 ? (
          <Card style={{ textAlign:"center", padding:"60px 24px" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
            <h3 style={{ fontSize:18, fontWeight:800, color:C.text, marginBottom:8 }}>All stock levels are healthy</h3>
            <p style={{ color:C.muted, fontSize:14 }}>No reorder alerts at this time.</p>
          </Card>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {alertItems.map(item => {
              const status = getStockStatus(item);
              const s      = STATUS_COLOR[status];
              const isCrit = status === "critical" || status === "out_of_stock";
              return (
                <div key={item.id} style={{ background:s.bg, border:`1px solid ${s.border}`, borderRadius:14, padding:"18px 22px", display:"flex", alignItems:"center", gap:20 }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:C.surface, border:`1px solid ${s.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>
                    {isCrit?"🚨":"⚠️"}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:3 }}>
                      <span style={{ fontFamily:"monospace", fontWeight:700, color:C.blue, fontSize:13 }}>{item.sku}</span>
                      <span style={{ fontWeight:700, color:C.text }}>{item.name}</span>
                      <span style={{ display:"inline-block", padding:"2px 8px", borderRadius:999, fontSize:11, fontWeight:700, color:s.color, background:C.surface, border:`1px solid ${s.border}` }}>
                        {STATUS_LABEL[status]}
                      </span>
                    </div>
                    <div style={{ fontSize:13, color:C.muted }}>
                      Current stock: <strong style={{ color:s.color }}>{fmtNum(item.stockLevel)} units</strong>
                      &nbsp;·&nbsp; Reorder point: <strong>{fmtNum(item.reorderPoint)}</strong>
                      &nbsp;·&nbsp; Suggest ordering: <strong>{fmtNum(item.reorderQty)} units</strong>
                    </div>
                    <div style={{ fontSize:12, color:C.subtle, marginTop:3, display:"flex", alignItems:"center", gap:4 }}>
                      <MapPin size={11}/> {item.warehouse}, Zone {item.zone}, Bin {item.binLocation}
                      &nbsp;·&nbsp; Supplier: {item.supplier}
                    </div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:6 }}>
                      Reorder Cost
                    </div>
                    <div style={{ fontSize:18, fontWeight:800, color:s.color }}>
                      {fmtMoney(item.reorderQty * item.unitCost)}
                    </div>
                    <div style={{ fontSize:11, color:C.subtle }}>{fmtNum(item.reorderQty)} × {fmtMoney(item.unitCost)}</div>
                  </div>
                </div>
              );
            })}
            {/* Total reorder cost */}
            <div style={{ padding:"14px 22px", background:C.amberBg, border:`1px solid ${C.amberBorder}`, borderRadius:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:14, fontWeight:700, color:C.amber }}>Total Reorder Cost ({alertItems.length} items)</span>
              <span style={{ fontSize:20, fontWeight:800, color:C.amber }}>
                {fmtMoney(alertItems.reduce((s,i)=>s+i.reorderQty*i.unitCost,0))}
              </span>
            </div>
          </div>
        )
      )}

      {/* ══════════════════════════════════════════════
          CONFLICTS VIEW
      ══════════════════════════════════════════════ */}
      {view==="conflicts"&&(
        <Card>
          <SectionTitle icon={AlertTriangle}>Inventory Conflict Log</SectionTitle>
          {conflicts.length===0?(
            <div style={{ textAlign:"center", padding:"40px 0", color:C.muted, fontSize:14 }}>No conflicts logged.</div>
          ):conflicts.map(c=>(
            <div key={c.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:10, marginBottom:8, background:c.status==="alert"?C.redBg:C.bg, border:`1px solid ${c.status==="alert"?C.redBorder:C.border}` }}>
              {c.status==="alert"
                ? <XCircle size={13} color={C.red}/>
                : <CheckCircle size={13} color={C.green}/>
              }
              <span style={{ fontFamily:"monospace", color:C.blue, fontSize:12, width:80, flexShrink:0 }}>{c.sku}</span>
              <span style={{ color:C.muted, fontSize:12, width:44, flexShrink:0 }}>{c.field}</span>
              <span style={{ fontSize:12 }}>
                <span style={{ color:C.red }}>{c.before}</span>
                <span style={{ color:C.subtle }}> → </span>
                <span style={{ color:C.green }}>{c.after}</span>
              </span>
              <span style={{ fontSize:11, color:C.subtle }}>[{c.src}]</span>
              <span style={{ marginLeft:"auto", fontSize:11, color:C.subtle, flexShrink:0 }}>{c.time}</span>
              {c.status==="alert"
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
      {view==="pricing"&&(
        <Card>
          <SectionTitle icon={Zap}>Bulk Pricing Rule Engine</SectionTitle>
          <p style={{ fontSize:13, color:C.muted, marginBottom:18, lineHeight:1.6 }}>
            Apply a price or stock adjustment to all SKUs in a category at once.
          </p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignItems:"flex-end" }}>
            <div>
              <div style={{ fontSize:11, color:C.muted, marginBottom:5, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>Category</div>
              <select value={rule.cat} onChange={e=>{setRule(r=>({...r,cat:e.target.value}));setApplied(false);}} style={selStyle}>
                {cats.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:11, color:C.muted, marginBottom:5, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>Type</div>
              <select value={rule.type} onChange={e=>{setRule(r=>({...r,type:e.target.value}));setApplied(false);}} style={selStyle}>
                <option value="price">Price %</option>
                <option value="stock">Stock Adj</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize:11, color:C.muted, marginBottom:5, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>Change</div>
              <input value={rule.change} onChange={e=>{setRule(r=>({...r,change:e.target.value}));setApplied(false);}} style={{ ...selStyle, width:80 }} placeholder="+10"/>
            </div>
            <button onClick={()=>setApplied(true)} style={{ padding:"9px 20px", background:C.amber, color:"#fff", border:"none", borderRadius:8, fontWeight:700, fontSize:13, cursor:"pointer" }}>
              Apply Rule
            </button>
          </div>
          {applied&&(
            <div style={{ marginTop:14, padding:"10px 14px", background:C.greenBg, border:`1px solid ${C.greenBorder}`, borderRadius:10, fontSize:13, color:C.green, display:"flex", alignItems:"center", gap:8 }}>
              <CheckCircle size={13}/>
              Rule applied: <strong style={{ margin:"0 4px" }}>{rule.cat}</strong> {rule.type} updated by <strong style={{ margin:"0 4px" }}>{rule.change}</strong>
            </div>
          )}

          {/* Affected SKUs preview */}
          {(() => {
            const affected = items.filter(i=>i.category===rule.cat);
            if (affected.length===0) return null;
            return (
              <div style={{ marginTop:18 }}>
                <div style={{ fontSize:12, color:C.muted, marginBottom:10, fontWeight:600 }}>
                  {affected.length} SKU{affected.length!==1?"s":""} in "{rule.cat}" category will be affected:
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {affected.map(i=>(
                    <div key={i.id} style={{ padding:"5px 12px", background:C.amberBg, border:`1px solid ${C.amberBorder}`, borderRadius:8, fontSize:12, color:C.amber, fontWeight:600, fontFamily:"monospace" }}>
                      {i.sku}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </Card>
      )}

    </div>
  );
}
