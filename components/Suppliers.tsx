"use client";
// components/Suppliers.tsx
// Phase 16: PO Approval Workflow added.
// - POs over the workspace threshold are created as "pending_approval"
// - Admins see Approve / Reject buttons with optional rejection note
// - Rejected POs are cancelled with the note saved

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Plus, ChevronLeft, X, Star, Package,
  Phone, Mail, Globe, Clock, ChevronRight,
  CheckCircle, Send, FileText, XCircle, Truck,
  AlertTriangle,
} from "lucide-react";
import { C } from "@/lib/utils";
import {
  Supplier, PurchaseOrder, POItem, SupplierStatus, SupplierCategory,
  POStatus, PaymentTerms,
  loadSuppliers, saveSuppliers, loadPOs, savePOs,
  makeSupplierId, makePONumber,
  CATEGORY_LABEL, CATEGORY_EMOJI,
  fetchSuppliersFromDb, fetchPOsFromDb,
  createSupplierInDb, createPOInDb, updatePOInDb,
  PO_ADVANCE_STAGES,
} from "@/lib/suppliers";
import { loadWorkspace } from "@/lib/workspace";

// ── Status configs ────────────────────────────────────────────────────────────
const SUP_STATUS: Record<SupplierStatus, { label: string; color: string; bg: string; border: string }> = {
  active:   { label:"Active",   color:C.green,  bg:C.greenBg,  border:C.greenBorder  },
  inactive: { label:"Inactive", color:C.muted,  bg:"#f0f0f0",  border:C.border       },
  pending:  { label:"Pending",  color:C.amber,  bg:C.amberBg,  border:C.amberBorder  },
};

const PO_STATUS: Record<POStatus, { label: string; color: string; bg: string; border: string; icon: any }> = {
  pending_approval: { label:"Pending Approval", color:C.amber,  bg:C.amberBg,   border:C.amberBorder,   icon:AlertTriangle },
  draft:            { label:"Draft",            color:C.muted,  bg:"#f0f0f0",   border:C.border,        icon:FileText      },
  sent:             { label:"Sent",             color:C.blue,   bg:C.blueBg,    border:C.blueBorder,    icon:Send          },
  confirmed:        { label:"Confirmed",        color:C.purple, bg:C.purpleBg,  border:C.purpleBorder,  icon:CheckCircle   },
  received:         { label:"Received",         color:C.green,  bg:C.greenBg,   border:C.greenBorder,   icon:Truck         },
  cancelled:        { label:"Cancelled",        color:C.red,    bg:C.redBg,     border:C.redBorder,     icon:XCircle       },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtMoney = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });

// ── New Supplier Modal ────────────────────────────────────────────────────────
function NewSupplierModal({ onSave, onClose }: {
  onSave: (s: Supplier) => void;
  onClose: () => void;
}) {
  const [name,        setName]        = useState("");
  const [contactName, setContactName] = useState("");
  const [email,       setEmail]       = useState("");
  const [phone,       setPhone]       = useState("");
  const [country,     setCountry]     = useState("");
  const [category,    setCategory]    = useState<SupplierCategory>("raw_materials");
  const [paymentTerms,setPaymentTerms]= useState<PaymentTerms>("Net 30");
  const [leadTime,    setLeadTime]    = useState("14");
  const [notes,       setNotes]       = useState("");
  const [error,       setError]       = useState("");

  const inp: any = { width:"100%", padding:"10px 12px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:9, color:C.text, fontSize:13, outline:"none", boxSizing:"border-box", fontFamily:"inherit" };
  const lbl: any = { display:"block", fontSize:11, fontWeight:700, color:C.muted, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.05em" };

  const submit = () => {
    if (!name.trim())        { setError("Company name is required."); return; }
    if (!contactName.trim()) { setError("Contact name is required."); return; }
    if (!email.trim())       { setError("Email is required."); return; }
    const sup: Supplier = {
      id: makeSupplierId(), name: name.trim(), contactName: contactName.trim(),
      email: email.trim(), phone: phone.trim(), country: country.trim(),
      category, status:"pending", paymentTerms,
      leadTimeDays: parseInt(leadTime) || 14, rating:3,
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
          <div style={{ marginBottom:14, gridColumn:"1/-1" }}><label style={lbl}>Company Name *</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. SteelCo Industries" style={inp}/></div>
          <div style={{ marginBottom:14, gridColumn:"1/-1" }}><label style={lbl}>Contact Name *</label><input value={contactName} onChange={e=>setContactName(e.target.value)} placeholder="e.g. Mark Patterson" style={inp}/></div>
          <div style={{ marginBottom:14 }}><label style={lbl}>Email *</label><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="contact@supplier.com" style={inp}/></div>
          <div style={{ marginBottom:14 }}><label style={lbl}>Phone</label><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+1 555 000 0000" style={inp}/></div>
          <div style={{ marginBottom:14 }}><label style={lbl}>Country</label><input value={country} onChange={e=>setCountry(e.target.value)} placeholder="e.g. USA" style={inp}/></div>
          <div style={{ marginBottom:14 }}><label style={lbl}>Lead Time (days)</label><input type="number" min="1" value={leadTime} onChange={e=>setLeadTime(e.target.value)} style={inp}/></div>
          <div style={{ marginBottom:14 }}>
            <label style={lbl}>Category</label>
            <select value={category} onChange={e=>setCategory(e.target.value as SupplierCategory)} style={inp}>
              {(Object.keys(CATEGORY_LABEL) as SupplierCategory[]).map(k=><option key={k} value={k}>{CATEGORY_LABEL[k]}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={lbl}>Payment Terms</label>
            <select value={paymentTerms} onChange={e=>setPaymentTerms(e.target.value as PaymentTerms)} style={inp}>
              {(["Net 15","Net 30","Net 60","Prepaid","Cash on Delivery"] as PaymentTerms[]).map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:14, gridColumn:"1/-1" }}><label style={lbl}>Notes</label><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional notes" style={inp}/></div>
        </div>
        {error && <div style={{ marginBottom:12, padding:"9px 13px", background:C.redBg, border:`1px solid ${C.redBorder}`, borderRadius:8, fontSize:13, color:C.red }}>{error}</div>}
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={submit} style={{ flex:1, padding:"12px", borderRadius:10, background:C.blue, border:"none", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>Add Supplier</button>
          <button onClick={onClose} style={{ padding:"12px 18px", borderRadius:10, background:C.bg, border:`1px solid ${C.border}`, color:C.muted, fontSize:13, cursor:"pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── New PO Modal ──────────────────────────────────────────────────────────────
function NewPOModal({ suppliers, approvalThreshold, onSave, onClose }: {
  suppliers: Supplier[];
  approvalThreshold: number;
  onSave: (po: PurchaseOrder) => void;
  onClose: () => void;
}) {
  const [supplierId,   setSupplierId]   = useState(suppliers[0]?.id ?? "");
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>("Net 30");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes,        setNotes]        = useState("");
  const [items,        setItems]        = useState<POItem[]>([{ id:"pi-0", desc:"", sku:"", qty:1, unitPrice:0, total:0 }]);
  const [error,        setError]        = useState("");

  const inp: any = { padding:"8px 10px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, fontSize:12, outline:"none", fontFamily:"inherit" };

  const updateItem = (idx: number, field: keyof POItem, val: string) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [field]: field === "desc" || field === "sku" ? val : parseFloat(val) || 0 };
      updated.total = updated.qty * updated.unitPrice;
      return updated;
    }));
  };

  const addItem    = () => setItems(p => [...p, { id:`pi-${p.length}`, desc:"", sku:"", qty:1, unitPrice:0, total:0 }]);
  const removeItem = (idx: number) => setItems(p => p.filter((_,i)=>i!==idx));

  const subtotal = items.reduce((s,i)=>s+i.total, 0);
  const tax      = parseFloat((subtotal * 0.08).toFixed(2));
  const total    = subtotal + tax;

  // Does this PO need approval?
  const needsApproval = approvalThreshold > 0 && total > approvalThreshold;

  const submit = () => {
    const sup = suppliers.find(s=>s.id===supplierId);
    if (!sup) { setError("Select a supplier."); return; }
    if (items.some(i=>!i.desc.trim())) { setError("All items need a description."); return; }
    const po: PurchaseOrder = {
      id: Math.random().toString(36).slice(2,9),
      poNumber: makePONumber(), supplierId, supplierName: sup.name,
      items, subtotal, tax, total,
      // Phase 16: set status based on approval threshold
      status: needsApproval ? "pending_approval" : "draft",
      paymentTerms,
      expectedDate: expectedDate || new Date(Date.now()+14*86400000).toISOString().split("T")[0],
      notes: notes.trim(), createdAt: new Date().toISOString(),
    };
    onSave(po);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:24 }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"28px", width:"100%", maxWidth:640, boxShadow:"0 20px 60px rgba(0,0,0,0.15)", maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
          <h2 style={{ fontSize:17, fontWeight:800, color:C.text }}>New Purchase Order</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted }}><X size={18}/></button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px", marginBottom:18 }}>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.muted, marginBottom:5, textTransform:"uppercase" as const }}>Supplier</label>
            <select value={supplierId} onChange={e=>setSupplierId(e.target.value)} style={{ ...inp, width:"100%", padding:"10px 12px" }}>
              {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.muted, marginBottom:5, textTransform:"uppercase" as const }}>Payment Terms</label>
            <select value={paymentTerms} onChange={e=>setPaymentTerms(e.target.value as PaymentTerms)} style={{ ...inp, width:"100%", padding:"10px 12px" }}>
              {(["Net 15","Net 30","Net 60","Prepaid","Cash on Delivery"] as PaymentTerms[]).map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.muted, marginBottom:5, textTransform:"uppercase" as const }}>Expected Date</label>
            <input type="date" value={expectedDate} onChange={e=>setExpectedDate(e.target.value)} style={{ ...inp, width:"100%", padding:"10px 12px" }}/>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.muted, marginBottom:5, textTransform:"uppercase" as const }}>Notes</label>
            <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional" style={{ ...inp, width:"100%", padding:"10px 12px" }}/>
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:"uppercase" as const }}>Line Items</span>
            <button onClick={addItem} style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 12px", borderRadius:7, background:C.blueBg, border:`1px solid ${C.blueBorder}`, color:C.blue, fontSize:11, fontWeight:700, cursor:"pointer" }}>
              <Plus size={11}/> Add Item
            </button>
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr style={{ color:C.muted, fontSize:10, textTransform:"uppercase" as const }}>
                {["Description","SKU","Qty","Unit Price","Total",""].map((h,i)=>(
                  <th key={i} style={{ textAlign:"left", padding:"6px 8px", borderBottom:`1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it,idx)=>(
                <tr key={it.id}>
                  <td style={{ padding:"6px 4px" }}><input value={it.desc} onChange={e=>updateItem(idx,"desc",e.target.value)} placeholder="Description" style={{ ...inp, width:"100%" }}/></td>
                  <td style={{ padding:"6px 4px" }}><input value={it.sku} onChange={e=>updateItem(idx,"sku",e.target.value)} placeholder="SKU" style={{ ...inp, width:80 }}/></td>
                  <td style={{ padding:"6px 4px" }}><input type="number" min="1" value={it.qty} onChange={e=>updateItem(idx,"qty",e.target.value)} style={{ ...inp, width:56 }}/></td>
                  <td style={{ padding:"6px 4px" }}><input type="number" min="0" step="0.01" value={it.unitPrice} onChange={e=>updateItem(idx,"unitPrice",e.target.value)} style={{ ...inp, width:80 }}/></td>
                  <td style={{ padding:"6px 8px", fontWeight:700, color:C.green }}>{fmtMoney(it.total)}</td>
                  <td style={{ padding:"6px 4px" }}>
                    {items.length > 1 && <button onClick={()=>removeItem(idx)} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted }}><X size={13}/></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ textAlign:"right", marginTop:10, fontSize:13 }}>
            <span style={{ color:C.muted }}>Subtotal: </span><strong style={{ color:C.text }}>{fmtMoney(subtotal)}</strong>
            <span style={{ color:C.muted, marginLeft:16 }}>Tax (8%): </span><strong style={{ color:C.text }}>{fmtMoney(tax)}</strong>
            <span style={{ color:C.muted, marginLeft:16 }}>Total: </span><strong style={{ color:C.green, fontSize:15 }}>{fmtMoney(total)}</strong>
          </div>
        </div>

        {/* Phase 16 — approval warning */}
        {needsApproval && (
          <div style={{ marginBottom:14, padding:"10px 14px", background:C.amberBg, border:`1px solid ${C.amberBorder}`, borderRadius:9, fontSize:13, color:C.amber, display:"flex", alignItems:"center", gap:8 }}>
            <AlertTriangle size={14}/>
            This PO exceeds the ${approvalThreshold.toLocaleString()} approval threshold and will be sent for admin approval before it can proceed.
          </div>
        )}

        {error && <div style={{ marginBottom:12, padding:"9px 13px", background:C.redBg, border:`1px solid ${C.redBorder}`, borderRadius:8, fontSize:13, color:C.red }}>{error}</div>}
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={submit} style={{ flex:1, padding:"12px", borderRadius:10, background:C.blue, border:"none", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>
            {needsApproval ? "Submit for Approval" : "Create PO"}
          </button>
          <button onClick={onClose} style={{ padding:"12px 18px", borderRadius:10, background:C.bg, border:`1px solid ${C.border}`, color:C.muted, fontSize:13, cursor:"pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Reject Modal ──────────────────────────────────────────────────────────────
function RejectModal({ po, onConfirm, onClose }: {
  po: PurchaseOrder;
  onConfirm: (note: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, padding:24 }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"24px", width:"100%", maxWidth:440, boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }}>
        <h3 style={{ fontSize:16, fontWeight:800, color:C.text, marginBottom:8 }}>Reject Purchase Order</h3>
        <p style={{ fontSize:13, color:C.muted, marginBottom:16 }}>
          {po.poNumber} — {fmtMoney(po.total)} to {po.supplierName}
        </p>
        <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.muted, marginBottom:6, textTransform:"uppercase" as const, letterSpacing:"0.05em" }}>
          Rejection Note (optional)
        </label>
        <textarea
          value={note}
          onChange={e=>setNote(e.target.value)}
          placeholder="e.g. Budget exceeded for this quarter. Please resubmit below $5,000."
          rows={3}
          style={{ width:"100%", padding:"10px 12px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:9, color:C.text, fontSize:13, outline:"none", resize:"vertical", fontFamily:"inherit", boxSizing:"border-box" as const, marginBottom:16 }}
        />
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={() => onConfirm(note)} style={{ flex:1, padding:"11px", borderRadius:9, background:C.red, border:"none", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
            Reject PO
          </button>
          <button onClick={onClose} style={{ padding:"11px 18px", borderRadius:9, background:C.bg, border:`1px solid ${C.border}`, color:C.muted, fontSize:13, cursor:"pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Suppliers() {
  const { data: session } = useSession();
  const isViewer  = session?.user?.role === "viewer";
  const isAdmin   = !session?.user?.role || session.user.role === "admin";

  const [view,       setView]       = useState<"list"|"detail"|"pos">("list");
  const [suppliers,  setSuppliers]  = useState<Supplier[]>([]);
  const [pos,        setPOs]        = useState<PurchaseOrder[]>([]);
  const [selected,   setSelected]   = useState<Supplier | null>(null);
  const [showNewSup, setShowNewSup] = useState(false);
  const [showNewPO,  setShowNewPO]  = useState(false);
  const [rejectPO,   setRejectPO]   = useState<PurchaseOrder | null>(null);
  const [subTab,     setSubTab]     = useState<"info"|"pos">("info");

  // Phase 16 — load approval threshold from workspace config
  const approvalThreshold = loadWorkspace()?.poApprovalThreshold ?? 0;

  useEffect(() => {
    setSuppliers(loadSuppliers());
    setPOs(loadPOs());
    fetchSuppliersFromDb().then(data => { if (data.length > 0) setSuppliers(data); });
    fetchPOsFromDb().then(data => { if (data.length > 0) setPOs(data); });
  }, []);

  // ── Add supplier ──────────────────────────────────────────────────────────
  const handleNewSupplier = (s: Supplier) => {
    const updated = [s, ...suppliers];
    setSuppliers(updated);
    saveSuppliers(updated);
    createSupplierInDb(s);
    setShowNewSup(false);
  };

  // ── Add PO ────────────────────────────────────────────────────────────────
  const handleNewPO = (po: PurchaseOrder) => {
    const updated = [po, ...pos];
    setPOs(updated);
    savePOs(updated);
    createPOInDb(po);
    setShowNewPO(false);
  };

  // ── Advance PO status ─────────────────────────────────────────────────────
  const advancePO = (id: string) => {
    const updated = pos.map(po => {
      if (po.id !== id) return po;
      const idx = PO_ADVANCE_STAGES.indexOf(po.status as any);
      if (idx < 0 || idx >= PO_ADVANCE_STAGES.length - 1) return po;
      const newStatus = PO_ADVANCE_STAGES[idx + 1];
      updatePOInDb(id, { status: newStatus });
      return { ...po, status: newStatus };
    });
    setPOs(updated);
    savePOs(updated);
  };

  // ── Phase 16: Approve PO ──────────────────────────────────────────────────
  const approvePO = (id: string) => {
    const updated = pos.map(po => {
      if (po.id !== id) return po;
      updatePOInDb(id, { status: "draft" });
      return { ...po, status: "draft" as POStatus };
    });
    setPOs(updated);
    savePOs(updated);
  };

  // ── Phase 16: Reject PO ───────────────────────────────────────────────────
  const confirmReject = (note: string) => {
    if (!rejectPO) return;
    const updated = pos.map(po => {
      if (po.id !== rejectPO.id) return po;
      updatePOInDb(rejectPO.id, { status: "cancelled", rejectionNote: note || undefined });
      return { ...po, status: "cancelled" as POStatus, rejectionNote: note || undefined };
    });
    setPOs(updated);
    savePOs(updated);
    setRejectPO(null);
  };

  // ── Cancel PO ─────────────────────────────────────────────────────────────
  const cancelPO = (id: string) => {
    const updated = pos.map(po => po.id === id ? { ...po, status:"cancelled" as POStatus } : po);
    setPOs(updated);
    savePOs(updated);
    updatePOInDb(id, { status: "cancelled" });
  };

  const activeCount  = suppliers.filter(s=>s.status==="active").length;
  const pendingCount = suppliers.filter(s=>s.status==="pending").length;
  const openPOs      = pos.filter(p=>!["received","cancelled"].includes(p.status)).length;
  const openPOValue  = pos.filter(p=>!["received","cancelled"].includes(p.status)).reduce((s,p)=>s+p.total,0);
  const pendingApprovalCount = pos.filter(p=>p.status==="pending_approval").length;
  const supplierPOs  = (supId: string) => pos.filter(p=>p.supplierId===supId);

  const Card = ({ children, style={} }: any) => (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"20px 22px", ...style }}>{children}</div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {showNewSup && <NewSupplierModal onSave={handleNewSupplier} onClose={()=>setShowNewSup(false)}/>}
      {showNewPO  && <NewPOModal suppliers={suppliers} approvalThreshold={approvalThreshold} onSave={handleNewPO} onClose={()=>setShowNewPO(false)}/>}
      {rejectPO   && <RejectModal po={rejectPO} onConfirm={confirmReject} onClose={()=>setRejectPO(null)}/>}

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:C.text, marginBottom:4 }}>Suppliers & Procurement</h1>
          <p style={{ color:C.muted, fontSize:13 }}>Manage suppliers, track purchase orders and deliveries.</p>
        </div>
        {!isViewer && (
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={()=>setShowNewPO(true)} style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 16px", borderRadius:10, background:C.blueBg, border:`1px solid ${C.blueBorder}`, color:C.blue, fontSize:13, fontWeight:700, cursor:"pointer" }}>
              <FileText size={14}/> New PO
            </button>
            <button onClick={()=>setShowNewSup(true)} style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 18px", borderRadius:10, background:C.blue, border:"none", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              <Plus size={14}/> Add Supplier
            </button>
          </div>
        )}
      </div>

      {/* ── Phase 16 — Pending Approval Banner ── */}
      {pendingApprovalCount > 0 && isAdmin && (
        <div style={{ padding:"12px 16px", background:C.amberBg, border:`1px solid ${C.amberBorder}`, borderRadius:10, fontSize:13, color:C.amber, display:"flex", alignItems:"center", gap:10 }}>
          <AlertTriangle size={15}/>
          <strong>{pendingApprovalCount} purchase order{pendingApprovalCount !== 1 ? "s" : ""} waiting for your approval.</strong>
          <button onClick={()=>setView("pos")} style={{ marginLeft:"auto", padding:"5px 12px", background:C.amberBg, border:`1px solid ${C.amberBorder}`, borderRadius:7, color:C.amber, fontSize:12, fontWeight:700, cursor:"pointer" }}>
            Review Now →
          </button>
        </div>
      )}

      {/* ── Summary cards ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
        {[
          { label:"Active Suppliers",    value:activeCount,           color:C.green,  bg:C.greenBg,  border:C.greenBorder  },
          { label:"Pending Review",      value:pendingCount,          color:C.amber,  bg:C.amberBg,  border:C.amberBorder  },
          { label:"Open POs",            value:openPOs,               color:C.blue,   bg:C.blueBg,   border:C.blueBorder   },
          { label:"Pending Approval",    value:pendingApprovalCount,  color:pendingApprovalCount>0?C.amber:C.muted, bg:pendingApprovalCount>0?C.amberBg:"#f0f0f0", border:pendingApprovalCount>0?C.amberBorder:C.border },
        ].map((s,i)=>(
          <div key={i} style={{ background:s.bg, border:`1px solid ${s.border}`, borderRadius:12, padding:"14px 18px" }}>
            <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Tab nav ── */}
      <div style={{ display:"flex", gap:8 }}>
        {([["list","🏭 Suppliers"],["pos","📋 Purchase Orders"]] as const).map(([t,l])=>(
          <button key={t} onClick={()=>{ setView(t); setSelected(null); }} style={{
            padding:"8px 18px", borderRadius:9, fontSize:13, fontWeight:600, cursor:"pointer",
            background: view===t&&selected===null ? C.blue : C.surface,
            color:      view===t&&selected===null ? "#fff" : C.muted,
            border:     view===t&&selected===null ? "none" : `1px solid ${C.border}`,
          }}>{l}</button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════
          SUPPLIER LIST
      ══════════════════════════════════════════════ */}
      {view==="list" && !selected && (
        suppliers.length === 0 ? (
          <Card style={{ textAlign:"center", padding:"60px 24px" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>🏭</div>
            <h3 style={{ fontSize:18, fontWeight:800, color:C.text, marginBottom:8 }}>No suppliers yet</h3>
            <p style={{ color:C.muted, fontSize:14, marginBottom:24 }}>Add your first supplier to get started.</p>
            <button onClick={()=>setShowNewSup(true)} style={{ padding:"11px 24px", borderRadius:10, background:C.blue, border:"none", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>Add Supplier</button>
          </Card>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:16 }}>
            {suppliers.map(s => {
              const cfg  = SUP_STATUS[s.status];
              const sPOs = supplierPOs(s.id);
              return (
                <Card key={s.id} style={{ cursor:"pointer" }} onClick={()=>{ setSelected(s); setSubTab("info"); }}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:12 }}>
                    <div style={{ width:40, height:40, borderRadius:10, background:C.bg, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>
                      {CATEGORY_EMOJI[s.category]}
                    </div>
                    <span style={{ padding:"3px 10px", borderRadius:999, fontSize:11, fontWeight:700, color:cfg.color, background:cfg.bg, border:`1px solid ${cfg.border}` }}>{cfg.label}</span>
                  </div>
                  <div style={{ fontWeight:800, fontSize:15, color:C.text, marginBottom:4 }}>{s.name}</div>
                  <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>{CATEGORY_LABEL[s.category]} · {s.country}</div>
                  <div style={{ fontSize:12, color:C.subtle, marginBottom:12 }}>
                    <Mail size={10} style={{ marginRight:4 }}/>{s.email}
                  </div>
                  <div style={{ display:"flex", gap:16, fontSize:12 }}>
                    <div><span style={{ color:C.muted }}>Lead time: </span><strong style={{ color:C.text }}>{s.leadTimeDays}d</strong></div>
                    <div><span style={{ color:C.muted }}>Terms: </span><strong style={{ color:C.text }}>{s.paymentTerms}</strong></div>
                    <div><span style={{ color:C.muted }}>POs: </span><strong style={{ color:C.blue }}>{sPOs.length}</strong></div>
                  </div>
                  <div style={{ display:"flex", gap:2, marginTop:10 }}>
                    {[1,2,3,4,5].map(i=>(
                      <Star key={i} size={12} fill={i<=s.rating?"#f6c90e":"none"} color={i<=s.rating?"#f6c90e":C.border}/>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        )
      )}

      {/* ══════════════════════════════════════════════
          SUPPLIER DETAIL
      ══════════════════════════════════════════════ */}
      {view==="list" && selected && (() => {
        const cfg  = SUP_STATUS[selected.status];
        const sPOs = supplierPOs(selected.id);
        return (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <button onClick={()=>setSelected(null)} style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", color:C.muted, fontSize:13, cursor:"pointer", alignSelf:"flex-start" }}>
              <ChevronLeft size={14}/> Back to suppliers
            </button>
            <Card>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16 }}>
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ width:52, height:52, borderRadius:12, background:C.bg, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26 }}>
                    {CATEGORY_EMOJI[selected.category]}
                  </div>
                  <div>
                    <h2 style={{ fontSize:20, fontWeight:800, color:C.text, marginBottom:4 }}>{selected.name}</h2>
                    <div style={{ fontSize:13, color:C.muted }}>{CATEGORY_LABEL[selected.category]} · {selected.country}</div>
                  </div>
                </div>
                <span style={{ padding:"4px 12px", borderRadius:999, fontSize:12, fontWeight:700, color:cfg.color, background:cfg.bg, border:`1px solid ${cfg.border}` }}>{cfg.label}</span>
              </div>
              <div style={{ display:"flex", gap:8, marginBottom:20 }}>
                {(["info","pos"] as const).map(t=>(
                  <button key={t} onClick={()=>setSubTab(t)} style={{ padding:"7px 16px", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer", background:subTab===t?C.blue:C.bg, color:subTab===t?"#fff":C.muted, border:subTab===t?"none":`1px solid ${C.border}` }}>
                    {t==="info"?"Info":"Purchase Orders"} {t==="pos"&&sPOs.length>0?`(${sPOs.length})`:""}
                  </button>
                ))}
              </div>
              {subTab==="info" && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                  {[
                    { icon:Mail,    label:"Email",     val:selected.email           },
                    { icon:Phone,   label:"Phone",     val:selected.phone||"—"      },
                    { icon:Globe,   label:"Country",   val:selected.country||"—"    },
                    { icon:Clock,   label:"Lead Time", val:`${selected.leadTimeDays} days` },
                    { icon:Package, label:"Terms",     val:selected.paymentTerms    },
                    { icon:Package, label:"Contact",   val:selected.contactName     },
                  ].map((r,i)=>(
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:C.bg, borderRadius:10, border:`1px solid ${C.border}` }}>
                      <r.icon size={14} color={C.muted}/>
                      <div>
                        <div style={{ fontSize:10, color:C.subtle, textTransform:"uppercase" as const, letterSpacing:"0.05em" }}>{r.label}</div>
                        <div style={{ fontSize:13, color:C.text, fontWeight:600 }}>{r.val}</div>
                      </div>
                    </div>
                  ))}
                  {selected.notes && (
                    <div style={{ gridColumn:"1/-1", padding:"12px 14px", background:C.bg, borderRadius:10, border:`1px solid ${C.border}`, fontSize:13, color:C.muted }}>
                      📝 {selected.notes}
                    </div>
                  )}
                </div>
              )}
              {subTab==="pos" && (
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {sPOs.length===0 ? (
                    <div style={{ textAlign:"center", padding:"32px 0", color:C.muted, fontSize:14 }}>No purchase orders for this supplier yet.</div>
                  ) : sPOs.map(po=>renderPOCard(po, isAdmin, isViewer, advancePO, approvePO, setRejectPO, cancelPO))}
                </div>
              )}
            </Card>
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════
          PURCHASE ORDERS LIST
      ══════════════════════════════════════════════ */}
      {view==="pos" && (
        pos.length===0 ? (
          <Card style={{ textAlign:"center", padding:"60px 24px" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>📋</div>
            <h3 style={{ fontSize:18, fontWeight:800, color:C.text, marginBottom:8 }}>No purchase orders yet</h3>
            <p style={{ color:C.muted, fontSize:14, marginBottom:24 }}>Create a PO to start ordering from your suppliers.</p>
            <button onClick={()=>setShowNewPO(true)} style={{ padding:"11px 24px", borderRadius:10, background:C.blue, border:"none", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>Create First PO</button>
          </Card>
        ) : (
          <Card style={{ padding:0, overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:C.bg, borderBottom:`1px solid ${C.border}` }}>
                  {["PO Number","Supplier","Items","Total","Expected","Status","Actions"].map((h,i)=>(
                    <th key={i} style={{ padding:"10px 16px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase" as const, letterSpacing:"0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pos.map((po,i)=>{
                  const cfg    = PO_STATUS[po.status];
                  const Icon   = cfg.icon;
                  const canAdv = PO_ADVANCE_STAGES.includes(po.status as any) && po.status !== "received";
                  const canCan = !["received","cancelled","pending_approval"].includes(po.status);
                  const isPending = po.status === "pending_approval";
                  return (
                    <tr key={po.id} style={{ borderBottom:i<pos.length-1?`1px solid ${C.border}`:"none", background: isPending ? C.amberBg : "transparent" }}>
                      <td style={{ padding:"13px 16px", fontWeight:700, color:C.blue, fontFamily:"monospace" }}>{po.poNumber}</td>
                      <td style={{ padding:"13px 16px", fontWeight:600, color:C.text }}>{po.supplierName}</td>
                      <td style={{ padding:"13px 16px", color:C.muted }}>{po.items.length} item{po.items.length!==1?"s":""}</td>
                      <td style={{ padding:"13px 16px", fontWeight:700, color:C.text }}>{fmtMoney(po.total)}</td>
                      <td style={{ padding:"13px 16px", color:C.muted }}>{fmtDate(po.expectedDate)}</td>
                      <td style={{ padding:"13px 16px" }}>
                        <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:999, fontSize:11, fontWeight:700, color:cfg.color, background:cfg.bg, border:`1px solid ${cfg.border}` }}>
                          <Icon size={10}/>{cfg.label}
                        </span>
                        {po.rejectionNote && (
                          <div style={{ fontSize:10, color:C.red, marginTop:3 }}>Reason: {po.rejectionNote}</div>
                        )}
                      </td>
                      <td style={{ padding:"13px 16px" }}>
                        <div style={{ display:"flex", gap:6 }}>
                          {/* Phase 16 — Approve / Reject buttons for pending_approval POs */}
                          {isPending && isAdmin && (
                            <>
                              <button onClick={()=>approvePO(po.id)} style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 10px", borderRadius:7, background:C.greenBg, border:`1px solid ${C.greenBorder}`, color:C.green, fontSize:11, fontWeight:700, cursor:"pointer" }}>
                                <CheckCircle size={10}/> Approve
                              </button>
                              <button onClick={()=>setRejectPO(po)} style={{ padding:"5px 10px", borderRadius:7, background:C.redBg, border:`1px solid ${C.redBorder}`, color:C.red, fontSize:11, fontWeight:700, cursor:"pointer" }}>
                                Reject
                              </button>
                            </>
                          )}
                          {canAdv && !isViewer && (
                            <button onClick={()=>advancePO(po.id)} style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 10px", borderRadius:7, background:C.blueBg, border:`1px solid ${C.blueBorder}`, color:C.blue, fontSize:11, fontWeight:700, cursor:"pointer" }}>
                              Next <ChevronRight size={11}/>
                            </button>
                          )}
                          {canCan && !isViewer && (
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
    </div>
  );
}

// ── Shared PO card renderer (used in supplier detail view) ────────────────────
function renderPOCard(
  po: PurchaseOrder,
  isAdmin: boolean,
  isViewer: boolean,
  advancePO: (id: string) => void,
  approvePO: (id: string) => void,
  setRejectPO: (po: PurchaseOrder) => void,
  cancelPO: (id: string) => void,
) {
  const cfg     = PO_STATUS[po.status];
  const Icon    = cfg.icon;
  const canAdv  = PO_ADVANCE_STAGES.includes(po.status as any) && po.status !== "received";
  const isPending = po.status === "pending_approval";

  return (
    <div key={po.id} style={{ background:C.surface, border:`1px solid ${isPending ? "#f5d9a0" : C.border}`, borderRadius:12, padding:"14px 16px", background: isPending ? "#fef5e7" : C.surface } as any}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
        <div>
          <div style={{ fontWeight:700, color:C.blue, fontFamily:"monospace", fontSize:13 }}>{po.poNumber}</div>
          <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{po.items.length} item{po.items.length!==1?"s":""} · {new Date(po.expectedDate).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })}</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontWeight:800, color:"#2d2a24", marginBottom:4 }}>${po.total.toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 })}</div>
          <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:999, fontSize:11, fontWeight:700, color:cfg.color, background:cfg.bg, border:`1px solid ${cfg.border}` }}>
            <Icon size={10}/>{cfg.label}
          </span>
        </div>
      </div>
      {po.rejectionNote && (
        <div style={{ fontSize:11, color:"#c0392b", marginBottom:8, padding:"6px 10px", background:"#fdf0ee", borderRadius:7, border:"1px solid #f0b8b2" }}>
          Rejected: {po.rejectionNote}
        </div>
      )}
      <div style={{ display:"flex", gap:6 }}>
        {isPending && isAdmin && (
          <>
            <button onClick={()=>approvePO(po.id)} style={{ display:"flex", alignItems:"center", gap:4, padding:"6px 12px", borderRadius:7, background:"#edf6f1", border:"1px solid #b8dece", color:"#2e7d5e", fontSize:11, fontWeight:700, cursor:"pointer" }}>
              <CheckCircle size={10}/> Approve
            </button>
            <button onClick={()=>setRejectPO(po)} style={{ padding:"6px 12px", borderRadius:7, background:"#fdf0ee", border:"1px solid #f0b8b2", color:"#c0392b", fontSize:11, fontWeight:700, cursor:"pointer" }}>
              Reject
            </button>
          </>
        )}
        {canAdv && !isViewer && (
          <button onClick={()=>advancePO(po.id)} style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 14px", borderRadius:8, background:"#eef3fb", border:"1px solid #c3d5f0", color:"#3d6fb5", fontSize:12, fontWeight:700, cursor:"pointer" }}>
            Advance to next stage <ChevronRight size={12}/>
          </button>
        )}
      </div>
    </div>
  );
}
