"use client";
// components/Suppliers.tsx
// Suppliers & Procurement module.
// - Supplier list with status, category, rating
// - Add / view supplier
// - Purchase Orders: create, track status (Draft → Sent → Confirmed → Received)
// - All saved to localStorage via lib/suppliers.ts

import { useState, useEffect } from "react";
import {
  Plus, ChevronLeft, X, Star, Package,
  Phone, Mail, Globe, Clock, ChevronRight,
  CheckCircle, Send, FileText, XCircle, Truck,
} from "lucide-react";
import { C } from "@/lib/utils";
import {
  Supplier, PurchaseOrder, POItem, SupplierStatus, SupplierCategory,
  POStatus, PaymentTerms,
  loadSuppliers, saveSuppliers, loadPOs, savePOs,
  makeSupplierId, makePONumber,
  CATEGORY_LABEL, CATEGORY_EMOJI,
} from "@/lib/suppliers";

// ── Status configs ────────────────────────────────────────────────────────────
const SUP_STATUS: Record<SupplierStatus, { label: string; color: string; bg: string; border: string }> = {
  active:   { label: "Active",   color: C.green,  bg: C.greenBg,  border: C.greenBorder  },
  inactive: { label: "Inactive", color: C.muted,  bg: "#f0f0f0",  border: C.border       },
  pending:  { label: "Pending",  color: C.amber,  bg: C.amberBg,  border: C.amberBorder  },
};

const PO_STATUS: Record<POStatus, { label: string; color: string; bg: string; border: string; icon: any }> = {
  draft:     { label: "Draft",     color: C.muted,  bg: "#f0f0f0",  border: C.border,       icon: FileText    },
  sent:      { label: "Sent",      color: C.blue,   bg: C.blueBg,   border: C.blueBorder,   icon: Send        },
  confirmed: { label: "Confirmed", color: C.purple, bg: C.purpleBg, border: C.purpleBorder, icon: CheckCircle },
  received:  { label: "Received",  color: C.green,  bg: C.greenBg,  border: C.greenBorder,  icon: Truck       },
  cancelled: { label: "Cancelled", color: C.red,    bg: C.redBg,    border: C.redBorder,    icon: XCircle     },
};

const PO_STAGES: POStatus[] = ["draft", "sent", "confirmed", "received"];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtMoney = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate  = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
const makeId   = () => Math.random().toString(36).slice(2, 9);

// ── Sub-components ────────────────────────────────────────────────────────────
const Card = ({ children, style = {} }: any) => (
  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px", ...style }}>
    {children}
  </div>
);
const SectionTitle = ({ children }: any) => (
  <div style={{ fontWeight: 700, fontSize: 13, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
    {children}
  </div>
);
const Badge = ({ cfg }: { cfg: { label: string; color: string; bg: string; border: string } }) => (
  <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
    {cfg.label}
  </span>
);
const Stars = ({ rating }: { rating: number }) => (
  <span>
    {[1,2,3,4,5].map(i => (
      <Star key={i} size={12} color={i <= rating ? C.amber : C.border} fill={i <= rating ? C.amber : "none"} />
    ))}
  </span>
);

const inputStyle: any = {
  width: "100%", padding: "10px 12px",
  background: C.bg, border: `1px solid ${C.border}`,
  borderRadius: 9, color: C.text, fontSize: 13,
  outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};
const labelStyle: any = {
  display: "block", fontSize: 11, fontWeight: 700, color: C.muted,
  marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em",
};

// ── New Supplier Modal ────────────────────────────────────────────────────────
function NewSupplierModal({ onSave, onClose }: { onSave: (s: Supplier) => void; onClose: () => void }) {
  const [name,         setName]         = useState("");
  const [contactName,  setContactName]  = useState("");
  const [email,        setEmail]        = useState("");
  const [phone,        setPhone]        = useState("");
  const [country,      setCountry]      = useState("");
  const [category,     setCategory]     = useState<SupplierCategory>("components");
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>("Net 30");
  const [leadTime,     setLeadTime]     = useState("14");
  const [notes,        setNotes]        = useState("");
  const [error,        setError]        = useState("");

  const submit = () => {
    if (!name.trim())        { setError("Supplier name is required."); return; }
    if (!contactName.trim()) { setError("Contact name is required."); return; }
    if (!email.trim())       { setError("Email is required."); return; }
    const sup: Supplier = {
      id: makeSupplierId(), name: name.trim(), contactName: contactName.trim(),
      email: email.trim(), phone: phone.trim(), country: country.trim(),
      category, status: "pending", paymentTerms,
      leadTimeDays: parseInt(leadTime) || 14, rating: 3,
      notes: notes.trim(), createdAt: new Date().toISOString(),
    };
    onSave(sup);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:24 }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"28px", width:"100%", maxWidth:520, boxShadow:"0 20px 60px rgba(0,0,0,0.15)", maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
          <h2 style={{ fontSize:17, fontWeight:800, color:C.text }}>New Supplier</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted }}><X size={18}/></button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
          {/* Full width fields */}
          {[
            { label:"Company Name *",  val:name,        set:setName,        placeholder:"e.g. SteelCo Industries", full:true  },
            { label:"Contact Name *",  val:contactName, set:setContactName, placeholder:"e.g. Mark Patterson",     full:true  },
            { label:"Email *",         val:email,       set:setEmail,       placeholder:"contact@supplier.com",    full:false },
            { label:"Phone",           val:phone,       set:setPhone,       placeholder:"+1 555 000 0000",         full:false },
            { label:"Country",         val:country,     set:setCountry,     placeholder:"e.g. USA",               full:false },
          ].map(f => (
            <div key={f.label} style={{ marginBottom:14, gridColumn: f.full ? "1 / -1" : "auto" }}>
              <label style={labelStyle}>{f.label}</label>
              <input value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.placeholder} style={inputStyle}/>
            </div>
          ))}

          {/* Lead time */}
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Lead Time (days)</label>
            <input type="number" min="1" value={leadTime} onChange={e=>setLeadTime(e.target.value)} style={inputStyle}/>
          </div>

          {/* Category */}
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Category</label>
            <select value={category} onChange={e=>setCategory(e.target.value as SupplierCategory)} style={inputStyle}>
              {(Object.keys(CATEGORY_LABEL) as SupplierCategory[]).map(c => (
                <option key={c} value={c}>{CATEGORY_EMOJI[c]} {CATEGORY_LABEL[c]}</option>
              ))}
            </select>
          </div>

          {/* Payment terms */}
          <div style={{ marginBottom:14, gridColumn:"1 / -1" }}>
            <label style={labelStyle}>Payment Terms</label>
            <select value={paymentTerms} onChange={e=>setPaymentTerms(e.target.value as PaymentTerms)} style={inputStyle}>
              {(["Net 15","Net 30","Net 60","Prepaid","Cash on Delivery"] as PaymentTerms[]).map(t=>(
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div style={{ marginBottom:14, gridColumn:"1 / -1" }}>
            <label style={labelStyle}>Notes (optional)</label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Any notes about this supplier…" style={{ ...inputStyle, resize:"vertical" }}/>
          </div>
        </div>

        {error && <div style={{ marginBottom:14, padding:"9px 13px", background:C.redBg, border:`1px solid ${C.redBorder}`, borderRadius:8, fontSize:13, color:C.red }}>{error}</div>}

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={submit} style={{ flex:1, padding:"12px", borderRadius:10, background:`linear-gradient(135deg,${C.blue},${C.purple})`, border:"none", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>
            Add Supplier
          </button>
          <button onClick={onClose} style={{ padding:"12px 18px", borderRadius:10, background:C.bg, border:`1px solid ${C.border}`, color:C.muted, fontSize:13, fontWeight:600, cursor:"pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── New PO Modal ──────────────────────────────────────────────────────────────
function NewPOModal({ suppliers, onSave, onClose }: {
  suppliers: Supplier[];
  onSave: (po: PurchaseOrder) => void;
  onClose: () => void;
}) {
  const activeSuppliers = suppliers.filter(s => s.status === "active");
  const [supplierId,   setSupplierId]   = useState(activeSuppliers[0]?.id || "");
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>("Net 30");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes,        setNotes]        = useState("");
  const [items,        setItems]        = useState<POItem[]>([
    { id: makeId(), desc:"", sku:"", qty:1, unitPrice:0, total:0 },
  ]);
  const [error, setError] = useState("");

  const updateItem = (id: string, field: keyof POItem, val: string) => {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const upd = { ...it, [field]: ["qty","unitPrice"].includes(field) ? parseFloat(val)||0 : val };
      upd.total = upd.qty * upd.unitPrice;
      return upd;
    }));
  };

  const addItem    = () => setItems(p => [...p, { id:makeId(), desc:"", sku:"", qty:1, unitPrice:0, total:0 }]);
  const removeItem = (id: string) => setItems(p => p.length > 1 ? p.filter(i=>i.id!==id) : p);

  const subtotal = items.reduce((s,i)=>s+i.total,0);
  const tax      = parseFloat((subtotal*0.08).toFixed(2));
  const total    = parseFloat((subtotal+tax).toFixed(2));

  const submit = () => {
    if (!supplierId)                          { setError("Select a supplier."); return; }
    if (items.some(i=>!i.desc.trim()))        { setError("All items need a description."); return; }
    if (items.some(i=>i.unitPrice<=0))        { setError("All items need a price."); return; }
    const sup = suppliers.find(s=>s.id===supplierId)!;
    const po: PurchaseOrder = {
      id:           makeId(),
      poNumber:     makePONumber(),
      supplierId,
      supplierName: sup.name,
      items, subtotal, tax, total,
      status:       "draft",
      paymentTerms,
      expectedDate: expectedDate || new Date(Date.now()+sup.leadTimeDays*86400000).toISOString().split("T")[0],
      notes:        notes.trim(),
      createdAt:    new Date().toISOString(),
    };
    onSave(po);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:24 }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"28px", width:"100%", maxWidth:620, boxShadow:"0 20px 60px rgba(0,0,0,0.15)", maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
          <h2 style={{ fontSize:17, fontWeight:800, color:C.text }}>New Purchase Order</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted }}><X size={18}/></button>
        </div>

        {/* Supplier + terms */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px", marginBottom:4 }}>
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Supplier *</label>
            <select value={supplierId} onChange={e=>setSupplierId(e.target.value)} style={inputStyle}>
              {activeSuppliers.length === 0
                ? <option value="">No active suppliers</option>
                : activeSuppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)
              }
            </select>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Payment Terms</label>
            <select value={paymentTerms} onChange={e=>setPaymentTerms(e.target.value as PaymentTerms)} style={inputStyle}>
              {(["Net 15","Net 30","Net 60","Prepaid","Cash on Delivery"] as PaymentTerms[]).map(t=>(
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Expected Delivery</label>
            <input type="date" value={expectedDate} onChange={e=>setExpectedDate(e.target.value)} style={inputStyle}/>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Notes (optional)</label>
            <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any special instructions…" style={inputStyle}/>
          </div>
        </div>

        {/* Line items */}
        <div style={{ marginBottom:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ ...labelStyle, marginBottom:0 }}>Line Items</span>
            <button onClick={addItem} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px", borderRadius:7, background:C.blueBg, border:`1px solid ${C.blueBorder}`, color:C.blue, fontSize:12, fontWeight:700, cursor:"pointer" }}>
              <Plus size={12}/> Add Item
            </button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 24px", gap:8, marginBottom:6 }}>
            {["Description","SKU","Qty","Unit Price","Total",""].map((h,i)=>(
              <div key={i} style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</div>
            ))}
          </div>
          {items.map(item=>(
            <div key={item.id} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 24px", gap:8, marginBottom:8 }}>
              <input value={item.desc} onChange={e=>updateItem(item.id,"desc",e.target.value)} placeholder="Item description" style={{ ...inputStyle, padding:"8px 10px" }}/>
              <input value={item.sku}  onChange={e=>updateItem(item.id,"sku",e.target.value)}  placeholder="SKU" style={{ ...inputStyle, padding:"8px 10px" }}/>
              <input type="number" min="1" value={item.qty} onChange={e=>updateItem(item.id,"qty",e.target.value)} style={{ ...inputStyle, padding:"8px 10px", textAlign:"center" }}/>
              <input type="number" min="0" step="0.01" value={item.unitPrice||""} onChange={e=>updateItem(item.id,"unitPrice",e.target.value)} placeholder="0.00" style={{ ...inputStyle, padding:"8px 10px" }}/>
              <div style={{ ...inputStyle, padding:"8px 10px", fontWeight:700, color:C.text, background:C.bg }}>{fmtMoney(item.total)}</div>
              <button onClick={()=>removeItem(item.id)} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted, display:"flex", alignItems:"center" }}><X size={14}/></button>
            </div>
          ))}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5, marginTop:10, paddingTop:10, borderTop:`1px solid ${C.border}` }}>
            {[["Subtotal",fmtMoney(subtotal),false],["Tax (8%)",fmtMoney(tax),false],["Total",fmtMoney(total),true]].map(([l,v,b])=>(
              <div key={l as string} style={{ display:"flex", gap:32 }}>
                <span style={{ fontSize:13, color:C.muted, minWidth:70 }}>{l}</span>
                <span style={{ fontSize:b?15:13, fontWeight:b?800:600, color:b?C.text:C.muted, minWidth:90, textAlign:"right" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {error && <div style={{ marginBottom:14, padding:"9px 13px", background:C.redBg, border:`1px solid ${C.redBorder}`, borderRadius:8, fontSize:13, color:C.red }}>{error}</div>}

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={submit} style={{ flex:1, padding:"12px", borderRadius:10, background:`linear-gradient(135deg,${C.blue},${C.purple})`, border:"none", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>
            Create Purchase Order
          </button>
          <button onClick={onClose} style={{ padding:"12px 18px", borderRadius:10, background:C.bg, border:`1px solid ${C.border}`, color:C.muted, fontSize:13, fontWeight:600, cursor:"pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Suppliers() {
  const [view,      setView]      = useState<"list"|"detail"|"pos">("list");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pos,       setPOs]       = useState<PurchaseOrder[]>([]);
  const [selected,  setSelected]  = useState<Supplier | null>(null);
  const [showNewSup,setShowNewSup]= useState(false);
  const [showNewPO, setShowNewPO] = useState(false);
  const [subTab,    setSubTab]    = useState<"info"|"pos">("info");

  useEffect(() => {
    setSuppliers(loadSuppliers());
    setPOs(loadPOs());
  }, []);

  // ── Add supplier ──────────────────────────────────────────────────────────
  const handleNewSupplier = (s: Supplier) => {
    const updated = [s, ...suppliers];
    setSuppliers(updated);
    saveSuppliers(updated);
    setShowNewSup(false);
  };

  // ── Add PO ────────────────────────────────────────────────────────────────
  const handleNewPO = (po: PurchaseOrder) => {
    const updated = [po, ...pos];
    setPOs(updated);
    savePOs(updated);
    setShowNewPO(false);
  };

  // ── Advance PO status ─────────────────────────────────────────────────────
  const advancePO = (id: string) => {
    const updated = pos.map(po => {
      if (po.id !== id) return po;
      const idx = PO_STAGES.indexOf(po.status as any);
      if (idx < 0 || idx >= PO_STAGES.length - 1) return po;
      return { ...po, status: PO_STAGES[idx + 1] };
    });
    setPOs(updated);
    savePOs(updated);
  };

  // ── Cancel PO ─────────────────────────────────────────────────────────────
  const cancelPO = (id: string) => {
    const updated = pos.map(po => po.id === id ? { ...po, status:"cancelled" as POStatus } : po);
    setPOs(updated);
    savePOs(updated);
  };

  // ── Summary stats ─────────────────────────────────────────────────────────
  const activeCount  = suppliers.filter(s=>s.status==="active").length;
  const pendingCount = suppliers.filter(s=>s.status==="pending").length;
  const openPOs      = pos.filter(p=>!["received","cancelled"].includes(p.status)).length;
  const openPOValue  = pos.filter(p=>!["received","cancelled"].includes(p.status)).reduce((s,p)=>s+p.total,0);

  const supplierPOs = (supId: string) => pos.filter(p=>p.supplierId===supId);

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW: LIST
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {showNewSup && <NewSupplierModal onSave={handleNewSupplier} onClose={()=>setShowNewSup(false)}/>}
      {showNewPO  && <NewPOModal suppliers={suppliers} onSave={handleNewPO} onClose={()=>setShowNewPO(false)}/>}

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:C.text, marginBottom:4 }}>Suppliers & Procurement</h1>
          <p style={{ color:C.muted, fontSize:13 }}>Manage suppliers, track purchase orders and deliveries.</p>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={()=>setShowNewPO(true)} style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 16px", borderRadius:10, background:C.blueBg, border:`1px solid ${C.blueBorder}`, color:C.blue, fontSize:13, fontWeight:700, cursor:"pointer" }}>
            <FileText size={14}/> New PO
          </button>
          <button onClick={()=>setShowNewSup(true)} style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 18px", borderRadius:10, background:`linear-gradient(135deg,${C.blue},${C.purple})`, border:"none", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
            <Plus size={14}/> Add Supplier
          </button>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
        {[
          { label:"Active Suppliers", value:activeCount,            color:C.green,  bg:C.greenBg,  border:C.greenBorder  },
          { label:"Pending Review",   value:pendingCount,           color:C.amber,  bg:C.amberBg,  border:C.amberBorder  },
          { label:"Open POs",         value:openPOs,                color:C.blue,   bg:C.blueBg,   border:C.blueBorder   },
          { label:"Open PO Value",    value:fmtMoney(openPOValue),  color:C.purple, bg:C.purpleBg, border:C.purpleBorder },
        ].map((s,i)=>(
          <div key={i} style={{ background:s.bg, border:`1px solid ${s.border}`, borderRadius:12, padding:"14px 18px" }}>
            <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs: Suppliers / Purchase Orders ── */}
      <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, gap:2 }}>
        {[
          { id:"list", label:`Suppliers (${suppliers.length})` },
          { id:"pos",  label:`Purchase Orders (${pos.length})` },
        ].map(t=>(
          <button key={t.id} onClick={()=>setView(t.id as any)} style={{ padding:"10px 18px", fontSize:13, fontWeight:600, border:"none", borderBottom:view===t.id?`2px solid ${C.blue}`:"2px solid transparent", color:view===t.id?C.blue:C.muted, background:"none", cursor:"pointer", marginBottom:-1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════
          SUPPLIERS LIST
      ══════════════════════════════════════════════ */}
      {view==="list"&&(
        suppliers.length===0 ? (
          <Card style={{ textAlign:"center", padding:"60px 24px" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>🏭</div>
            <h3 style={{ fontSize:18, fontWeight:800, color:C.text, marginBottom:8 }}>No suppliers yet</h3>
            <p style={{ color:C.muted, fontSize:14, marginBottom:24 }}>Add your first supplier to start managing procurement.</p>
            <button onClick={()=>setShowNewSup(true)} style={{ padding:"11px 24px", borderRadius:10, background:`linear-gradient(135deg,${C.blue},${C.purple})`, border:"none", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              Add First Supplier
            </button>
          </Card>
        ) : (
          <Card style={{ padding:0, overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:C.bg, borderBottom:`1px solid ${C.border}` }}>
                  {["Supplier","Category","Contact","Terms","Lead Time","Rating","Status",""].map((h,i)=>(
                    <th key={i} style={{ padding:"10px 16px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s,i)=>(
                  <tr key={s.id} onClick={()=>{setSelected(s);setSubTab("info");setView("detail");}}
                    style={{ borderBottom:i<suppliers.length-1?`1px solid ${C.border}`:"none", cursor:"pointer" }}
                    onMouseEnter={e=>(e.currentTarget.style.background=C.bg)}
                    onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                    <td style={{ padding:"13px 16px" }}>
                      <div style={{ fontWeight:700, color:C.text }}>{s.name}</div>
                      <div style={{ fontSize:11, color:C.subtle }}>{s.country}</div>
                    </td>
                    <td style={{ padding:"13px 16px", color:C.muted }}>
                      {CATEGORY_EMOJI[s.category]} {CATEGORY_LABEL[s.category]}
                    </td>
                    <td style={{ padding:"13px 16px" }}>
                      <div style={{ fontWeight:600, color:C.text, fontSize:12 }}>{s.contactName}</div>
                      <div style={{ fontSize:11, color:C.subtle }}>{s.email}</div>
                    </td>
                    <td style={{ padding:"13px 16px", color:C.muted }}>{s.paymentTerms}</td>
                    <td style={{ padding:"13px 16px", color:C.muted }}>{s.leadTimeDays}d</td>
                    <td style={{ padding:"13px 16px" }}><Stars rating={s.rating}/></td>
                    <td style={{ padding:"13px 16px" }}><Badge cfg={SUP_STATUS[s.status]}/></td>
                    <td style={{ padding:"13px 16px", color:C.muted }}><ChevronRight size={16}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      )}

      {/* ══════════════════════════════════════════════
          PURCHASE ORDERS LIST
      ══════════════════════════════════════════════ */}
      {view==="pos"&&(
        pos.length===0 ? (
          <Card style={{ textAlign:"center", padding:"60px 24px" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>📋</div>
            <h3 style={{ fontSize:18, fontWeight:800, color:C.text, marginBottom:8 }}>No purchase orders yet</h3>
            <p style={{ color:C.muted, fontSize:14, marginBottom:24 }}>Create a PO to start ordering from your suppliers.</p>
            <button onClick={()=>setShowNewPO(true)} style={{ padding:"11px 24px", borderRadius:10, background:`linear-gradient(135deg,${C.blue},${C.purple})`, border:"none", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              Create First PO
            </button>
          </Card>
        ) : (
          <Card style={{ padding:0, overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:C.bg, borderBottom:`1px solid ${C.border}` }}>
                  {["PO Number","Supplier","Items","Total","Expected","Status","Actions"].map((h,i)=>(
                    <th key={i} style={{ padding:"10px 16px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pos.map((po,i)=>{
                  const cfg    = PO_STATUS[po.status];
                  const Icon   = cfg.icon;
                  const canAdv = PO_STAGES.includes(po.status as any) && po.status!=="received";
                  const canCan = !["received","cancelled"].includes(po.status);
                  return (
                    <tr key={po.id} style={{ borderBottom:i<pos.length-1?`1px solid ${C.border}`:"none" }}>
                      <td style={{ padding:"13px 16px", fontWeight:700, color:C.blue, fontFamily:"monospace" }}>{po.poNumber}</td>
                      <td style={{ padding:"13px 16px", fontWeight:600, color:C.text }}>{po.supplierName}</td>
                      <td style={{ padding:"13px 16px", color:C.muted }}>{po.items.length} item{po.items.length!==1?"s":""}</td>
                      <td style={{ padding:"13px 16px", fontWeight:700, color:C.text }}>{fmtMoney(po.total)}</td>
                      <td style={{ padding:"13px 16px", color:C.muted }}>{fmtDate(po.expectedDate)}</td>
                      <td style={{ padding:"13px 16px" }}>
                        <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:999, fontSize:11, fontWeight:700, color:cfg.color, background:cfg.bg, border:`1px solid ${cfg.border}` }}>
                          <Icon size={10}/>{cfg.label}
                        </span>
                      </td>
                      <td style={{ padding:"13px 16px" }}>
                        <div style={{ display:"flex", gap:6 }}>
                          {canAdv&&(
                            <button onClick={()=>advancePO(po.id)} style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 10px", borderRadius:7, background:C.blueBg, border:`1px solid ${C.blueBorder}`, color:C.blue, fontSize:11, fontWeight:700, cursor:"pointer" }}>
                              Next <ChevronRight size={11}/>
                            </button>
                          )}
                          {canCan&&(
                            <button onClick={()=>cancelPO(po.id)} style={{ padding:"5px 10px", borderRadius:7, background:C.redBg, border:`1px solid ${C.redBorder}`, color:C.red, fontSize:11, fontWeight:700, cursor:"pointer" }}>
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )
      )}

      {/* ══════════════════════════════════════════════
          SUPPLIER DETAIL
      ══════════════════════════════════════════════ */}
      {view==="detail"&&selected&&(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"flex-end", justifyContent:"flex-end", zIndex:100 }}>
          <div style={{ background:C.surface, borderLeft:`1px solid ${C.border}`, width:"100%", maxWidth:480, height:"100vh", overflowY:"auto", display:"flex", flexDirection:"column" }}>

            {/* Panel header */}
            <div style={{ padding:"20px 24px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, background:C.surface, zIndex:10 }}>
              <div>
                <div style={{ fontWeight:800, fontSize:16, color:C.text }}>{selected.name}</div>
                <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
                  {CATEGORY_EMOJI[selected.category]} {CATEGORY_LABEL[selected.category]} · {selected.country}
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <Badge cfg={SUP_STATUS[selected.status]}/>
                <button onClick={()=>setView("list")} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted }}><X size={18}/></button>
              </div>
            </div>

            {/* Sub-tabs */}
            <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, padding:"0 24px" }}>
              {[{id:"info",label:"Info"},{id:"pos",label:`POs (${supplierPOs(selected.id).length})`}].map(t=>(
                <button key={t.id} onClick={()=>setSubTab(t.id as any)} style={{ padding:"10px 16px", fontSize:13, fontWeight:600, border:"none", borderBottom:subTab===t.id?`2px solid ${C.blue}`:"2px solid transparent", color:subTab===t.id?C.blue:C.muted, background:"none", cursor:"pointer", marginBottom:-1 }}>
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ padding:"24px", flex:1 }}>

              {/* ── Info tab ── */}
              {subTab==="info"&&(
                <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                  {/* Contact */}
                  <Card>
                    <SectionTitle>Contact</SectionTitle>
                    {[
                      { icon:Mail,  label:selected.email         },
                      { icon:Phone, label:selected.phone||"—"    },
                      { icon:Globe, label:selected.country||"—"  },
                    ].map(({icon:Icon,label})=>(
                      <div key={label} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderBottom:`1px solid ${C.border}`, fontSize:13 }}>
                        <Icon size={13} color={C.muted}/>
                        <span style={{ color:C.text }}>{label}</span>
                      </div>
                    ))}
                    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", fontSize:13 }}>
                      <Star size={13} color={C.muted}/>
                      <Stars rating={selected.rating}/>
                      <span style={{ color:C.muted, fontSize:11 }}>({selected.rating}/5)</span>
                    </div>
                  </Card>

                  {/* Terms */}
                  <Card>
                    <SectionTitle>Terms & Logistics</SectionTitle>
                    {[
                      { label:"Payment Terms", value:selected.paymentTerms         },
                      { label:"Lead Time",     value:`${selected.leadTimeDays} days`},
                      { label:"Supplier Since",value:fmtDate(selected.createdAt)   },
                    ].map(({label,value})=>(
                      <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}`, fontSize:13 }}>
                        <span style={{ color:C.muted }}>{label}</span>
                        <span style={{ fontWeight:600, color:C.text }}>{value}</span>
                      </div>
                    ))}
                  </Card>

                  {/* Notes */}
                  {selected.notes&&(
                    <Card>
                      <SectionTitle>Notes</SectionTitle>
                      <p style={{ fontSize:13, color:C.muted, lineHeight:1.6 }}>{selected.notes}</p>
                    </Card>
                  )}

                  {/* Create PO */}
                  <button onClick={()=>setShowNewPO(true)} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"12px", borderRadius:10, background:`linear-gradient(135deg,${C.blue},${C.purple})`, border:"none", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                    <FileText size={14}/> Create Purchase Order
                  </button>
                </div>
              )}

              {/* ── POs tab ── */}
              {subTab==="pos"&&(
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {supplierPOs(selected.id).length===0?(
                    <div style={{ textAlign:"center", padding:"40px 0", color:C.muted, fontSize:14 }}>
                      No purchase orders yet for this supplier.
                    </div>
                  ):supplierPOs(selected.id).map(po=>{
                    const cfg  = PO_STATUS[po.status];
                    const Icon = cfg.icon;
                    const canAdv = PO_STAGES.includes(po.status as any) && po.status!=="received";
                    return (
                      <Card key={po.id}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                          <div>
                            <div style={{ fontWeight:700, color:C.blue, fontFamily:"monospace", fontSize:13 }}>{po.poNumber}</div>
                            <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{po.items.length} item{po.items.length!==1?"s":""} · {fmtDate(po.expectedDate)}</div>
                          </div>
                          <div style={{ textAlign:"right" }}>
                            <div style={{ fontWeight:800, color:C.text, marginBottom:4 }}>{fmtMoney(po.total)}</div>
                            <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:999, fontSize:11, fontWeight:700, color:cfg.color, background:cfg.bg, border:`1px solid ${cfg.border}` }}>
                              <Icon size={10}/>{cfg.label}
                            </span>
                          </div>
                        </div>
                        {canAdv&&(
                          <button onClick={()=>advancePO(po.id)} style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 14px", borderRadius:8, background:C.blueBg, border:`1px solid ${C.blueBorder}`, color:C.blue, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                            Advance to next stage <ChevronRight size={12}/>
                          </button>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
