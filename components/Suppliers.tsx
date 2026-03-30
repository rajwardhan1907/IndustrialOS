"use client";
// components/Suppliers.tsx
// Phase 16: Purchase Approval Workflows added.
// Phase 17: CSV export added.
// POs above the workspace threshold need admin approval before advancing.
// Admins see Approve / Reject buttons. Non-admins see a "pending approval" banner.

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Plus, ChevronLeft, X, Star, Package,
  Phone, Mail, Globe, Clock, ChevronRight,
  CheckCircle, Send, FileText, XCircle, Truck,
  ShieldCheck, ShieldX, AlertTriangle, Download,
} from "lucide-react";
import { downloadCSV } from "@/lib/exportCSV";
import { C } from "@/lib/utils";
import {
  Supplier, PurchaseOrder, POItem, SupplierStatus, SupplierCategory,
  POStatus, PaymentTerms, ApprovalStatus,
  loadSuppliers, saveSuppliers, loadPOs, savePOs,
  makeSupplierId, makePONumber,
  CATEGORY_LABEL, CATEGORY_EMOJI, APPROVAL_CONFIG,
  fetchSuppliersFromDb, fetchPOsFromDb,
  createSupplierInDb, createPOInDb, updatePOInDb,
  approvePOInDb, rejectPOInDb,
} from "@/lib/suppliers";

// ── Status configs ────────────────────────────────────────────────────────────
const SUP_STATUS: Record<SupplierStatus, { label: string; color: string; bg: string; border: string }> = {
  active:   { label:"Active",   color:C.green,  bg:C.greenBg,  border:C.greenBorder  },
  inactive: { label:"Inactive", color:C.muted,  bg:"#f0f0f0",  border:C.border       },
  pending:  { label:"Pending",  color:C.amber,  bg:C.amberBg,  border:C.amberBorder  },
}

const PO_STATUS: Record<POStatus, { label: string; color: string; bg: string; border: string; icon: any }> = {
  draft:     { label:"Draft",     color:C.muted,  bg:"#f0f0f0",  border:C.border,       icon:FileText    },
  sent:      { label:"Sent",      color:C.blue,   bg:C.blueBg,   border:C.blueBorder,   icon:Send        },
  confirmed: { label:"Confirmed", color:C.purple, bg:C.purpleBg, border:C.purpleBorder, icon:CheckCircle },
  received:  { label:"Received",  color:C.green,  bg:C.greenBg,  border:C.greenBorder,  icon:Truck       },
  cancelled: { label:"Cancelled", color:C.red,    bg:C.redBg,    border:C.redBorder,    icon:XCircle     },
}

const PO_STAGES: POStatus[] = ["draft", "sent", "confirmed", "received"]

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtMoney = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 })}`
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })

// Phase 16: can this PO advance to the next stage?
// A PO with approvalStatus "pending" or "rejected" is BLOCKED from advancing past draft.
function canAdvancePO(po: PurchaseOrder): boolean {
  if (!PO_STAGES.includes(po.status as POStatus)) return false
  if (po.status === "received") return false
  // If approval is pending or rejected, block advancing
  if (po.approvalStatus === "pending")  return false
  if (po.approvalStatus === "rejected") return false
  return true
}

// ── New Supplier Modal ────────────────────────────────────────────────────────
function NewSupplierModal({ onSave, onClose }: {
  onSave: (s: Supplier) => void
  onClose: () => void
}) {
  const [name,        setName]        = useState("")
  const [contactName, setContactName] = useState("")
  const [email,       setEmail]       = useState("")
  const [phone,       setPhone]       = useState("")
  const [country,     setCountry]     = useState("")
  const [category,    setCategory]    = useState<SupplierCategory>("raw_materials")
  const [paymentTerms,setPaymentTerms]= useState<PaymentTerms>("Net 30")
  const [leadTime,    setLeadTime]    = useState("14")
  const [notes,       setNotes]       = useState("")
  const [error,       setError]       = useState("")

  const inp: any = { width:"100%", padding:"10px 12px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:9, color:C.text, fontSize:13, outline:"none", boxSizing:"border-box", fontFamily:"inherit" }
  const lbl: any = { display:"block", fontSize:11, fontWeight:700, color:C.muted, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.05em" }

  const submit = () => {
    if (!name.trim())        { setError("Company name is required."); return }
    if (!contactName.trim()) { setError("Contact name is required."); return }
    if (!email.trim())       { setError("Email is required."); return }
    const sup: Supplier = {
      id: makeSupplierId(), name: name.trim(), contactName: contactName.trim(),
      email: email.trim(), phone: phone.trim(), country: country.trim(),
      category, status:"pending", paymentTerms,
      leadTimeDays: parseInt(leadTime) || 14, rating:3,
      notes: notes.trim(), createdAt: new Date().toISOString(),
    }
    onSave(sup)
  }

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
  )
}

// ── New PO Modal ──────────────────────────────────────────────────────────────
function NewPOModal({ suppliers, onSave, onClose, approvalThreshold }: {
  suppliers: Supplier[]
  onSave: (po: PurchaseOrder) => void
  onClose: () => void
  approvalThreshold: number
}) {
  const [supplierId,   setSupplierId]   = useState(suppliers[0]?.id ?? "")
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>("Net 30")
  const [expectedDate, setExpectedDate] = useState("")
  const [notes,        setNotes]        = useState("")
  const [items,        setItems]        = useState<POItem[]>([{ id:"pi-0", desc:"", sku:"", qty:1, unitPrice:0, total:0 }])
  const [error,        setError]        = useState("")

  const inp: any = { padding:"8px 10px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, fontSize:12, outline:"none", fontFamily:"inherit" }

  const updateItem = (idx: number, field: keyof POItem, val: string) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it
      const updated = { ...it, [field]: field === "desc" || field === "sku" ? val : parseFloat(val) || 0 }
      updated.total = updated.qty * updated.unitPrice
      return updated
    }))
  }

  const addItem    = () => setItems(p => [...p, { id:`pi-${p.length}`, desc:"", sku:"", qty:1, unitPrice:0, total:0 }])
  const removeItem = (idx: number) => setItems(p => p.filter((_,i)=>i!==idx))

  const subtotal = items.reduce((s,i)=>s+i.total, 0)
  const tax      = parseFloat((subtotal * 0.08).toFixed(2))
  const total    = subtotal + tax

  // Phase 16: show approval warning if total exceeds threshold
  const willNeedApproval = approvalThreshold > 0 && total >= approvalThreshold

  const submit = () => {
    const sup = suppliers.find(s=>s.id===supplierId)
    if (!sup) { setError("Select a supplier."); return }
    if (items.some(i=>!i.desc.trim())) { setError("All items need a description."); return }

    const po: PurchaseOrder = {
      id: Math.random().toString(36).slice(2,9),
      poNumber: makePONumber(), supplierId, supplierName: sup.name,
      items, subtotal, tax, total,
      status:"draft", paymentTerms,
      expectedDate: expectedDate || new Date(Date.now()+14*86400000).toISOString().split("T")[0],
      notes: notes.trim(), createdAt: new Date().toISOString(),
      // Phase 16: set approvalStatus based on threshold
      approvalStatus: willNeedApproval ? "pending" : "not_required",
      approvedBy: "",
      approvedAt: "",
    }
    onSave(po)
  }

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

        {/* Phase 16: approval warning banner */}
        {willNeedApproval && (
          <div style={{ marginBottom:16, padding:"10px 14px", background:C.amberBg, border:`1px solid ${C.amberBorder}`, borderRadius:9, fontSize:13, color:C.amber, display:"flex", alignItems:"center", gap:8 }}>
            <AlertTriangle size={15}/>
            This PO ({fmtMoney(total)}) exceeds the approval threshold of {fmtMoney(approvalThreshold)}.
            It will be created as <strong>Pending Approval</strong> and must be approved by an admin before it can be sent.
          </div>
        )}

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

        {error && <div style={{ marginBottom:12, padding:"9px 13px", background:C.redBg, border:`1px solid ${C.redBorder}`, borderRadius:8, fontSize:13, color:C.red }}>{error}</div>}
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={submit} style={{ flex:1, padding:"12px", borderRadius:10, background:C.blue, border:"none", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>Create PO</button>
          <button onClick={onClose} style={{ padding:"12px 18px", borderRadius:10, background:C.bg, border:`1px solid ${C.border}`, color:C.muted, fontSize:13, cursor:"pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Suppliers() {
  const { data: session } = useSession()
  const isViewer  = session?.user?.role === "viewer"
  const isAdmin   = !session?.user?.role || session?.user?.role === "admin"

  const [view,       setView]       = useState<"list"|"detail"|"pos">("list")
  const [suppliers,  setSuppliers]  = useState<Supplier[]>([])
  const [pos,        setPOs]        = useState<PurchaseOrder[]>([])
  const [selected,   setSelected]   = useState<Supplier | null>(null)
  const [showNewSup, setShowNewSup] = useState(false)
  const [showNewPO,  setShowNewPO]  = useState(false)
  const [subTab,     setSubTab]     = useState<"info"|"pos">("info")

  // Phase 16: approval threshold loaded from DB / localStorage
  const [approvalThreshold,    setApprovalThreshold]    = useState(0)
  const [thresholdInput,       setThresholdInput]       = useState("0")
  const [thresholdSaved,       setThresholdSaved]       = useState(false)

  useEffect(() => {
    setSuppliers(loadSuppliers())
    setPOs(loadPOs())
    fetchSuppliersFromDb().then(data => { if (data.length > 0) setSuppliers(data) })
    fetchPOsFromDb().then(data => { if (data.length > 0) setPOs(data) })

    // Phase 16: load approval threshold from workspace in DB
    const wsId = typeof window !== "undefined" ? localStorage.getItem("workspaceDbId") : null
    if (wsId) {
      fetch(`/api/workspaces`)
        .then(r => r.json())
        .then((workspaces: any[]) => {
          const ws = workspaces.find((w: any) => w.id === wsId)
          if (ws && ws.poApprovalThreshold !== undefined) {
            setApprovalThreshold(ws.poApprovalThreshold)
            setThresholdInput(String(ws.poApprovalThreshold))
          }
        })
        .catch(() => {})
    }
  }, [])

  // Phase 16: save threshold to DB
  const saveThreshold = async () => {
    const val = parseFloat(thresholdInput) || 0
    setApprovalThreshold(val)
    const wsId = typeof window !== "undefined" ? localStorage.getItem("workspaceDbId") : null
    if (wsId) {
      await fetch("/api/workspaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: wsId, poApprovalThreshold: val }),
      }).catch(() => {})
    }
    setThresholdSaved(true)
    setTimeout(() => setThresholdSaved(false), 2500)
  }

  const handleNewSupplier = (s: Supplier) => {
    const updated = [s, ...suppliers]
    setSuppliers(updated); saveSuppliers(updated)
    createSupplierInDb(s)
    setShowNewSup(false)
  }

  const handleNewPO = (po: PurchaseOrder) => {
    const updated = [po, ...pos]
    setPOs(updated); savePOs(updated)
    createPOInDb(po)
    setShowNewPO(false)
  }

  const advancePO = (id: string) => {
    const updated = pos.map(po => {
      if (po.id !== id) return po
      const idx = PO_STAGES.indexOf(po.status as POStatus)
      if (idx < 0 || idx >= PO_STAGES.length - 1) return po
      const newStatus = PO_STAGES[idx + 1]
      updatePOInDb(id, { status: newStatus })
      return { ...po, status: newStatus }
    })
    setPOs(updated); savePOs(updated)
  }

  const cancelPO = (id: string) => {
    const updated = pos.map(po => po.id === id ? { ...po, status:"cancelled" as POStatus } : po)
    setPOs(updated); savePOs(updated)
    updatePOInDb(id, { status: "cancelled" })
  }

  // Phase 16: approve a PO
  const approvePO = (id: string) => {
    const adminEmail = session?.user?.email || "admin"
    const updated = pos.map(po => {
      if (po.id !== id) return po
      return { ...po, approvalStatus: "approved" as ApprovalStatus, approvedBy: adminEmail, approvedAt: new Date().toISOString() }
    })
    setPOs(updated); savePOs(updated)
    approvePOInDb(id, adminEmail)
  }

  // Phase 16: reject a PO
  const rejectPO = (id: string) => {
    const adminEmail = session?.user?.email || "admin"
    const updated = pos.map(po => {
      if (po.id !== id) return po
      return { ...po, approvalStatus: "rejected" as ApprovalStatus, approvedBy: adminEmail, approvedAt: new Date().toISOString() }
    })
    setPOs(updated); savePOs(updated)
    rejectPOInDb(id, adminEmail)
  }

  const activeCount  = suppliers.filter(s=>s.status==="active").length
  const pendingCount = suppliers.filter(s=>s.status==="pending").length
  const openPOs      = pos.filter(p=>!["received","cancelled"].includes(p.status)).length
  const openPOValue  = pos.filter(p=>!["received","cancelled"].includes(p.status)).reduce((s,p)=>s+p.total,0)
  // Phase 16: count POs waiting for approval
  const pendingApprovalCount = pos.filter(p => p.approvalStatus === "pending").length
  const supplierPOs  = (supId: string) => pos.filter(p=>p.supplierId===supId)

  const Card = ({ children, style={} }: any) => (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"20px 22px", ...style }}>{children}</div>
  )

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {showNewSup && <NewSupplierModal onSave={handleNewSupplier} onClose={()=>setShowNewSup(false)}/>}
      {showNewPO  && <NewPOModal suppliers={suppliers} onSave={handleNewPO} onClose={()=>setShowNewPO(false)} approvalThreshold={approvalThreshold}/>}

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:C.text, marginBottom:4 }}>Suppliers & Procurement</h1>
          <p style={{ color:C.muted, fontSize:13 }}>Manage suppliers, track purchase orders and deliveries.</p>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          {/* Phase 17: CSV Export */}
          <button
            onClick={() => downloadCSV(`suppliers_${new Date().toISOString().split("T")[0]}`, suppliers.map(s => ({
              Name:          s.name,
              Category:      s.category,
              Status:        s.status,
              Rating:        s.rating,
              "Contact Name": s.contactName,
              Email:          s.email,
              Phone:          s.phone,
              Country:        s.country,
              "Payment Terms":s.paymentTerms,
              "Lead Time":    s.leadTimeDays + " days",
            })))}
            style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 14px", borderRadius:10, background:C.surface, border:`1px solid ${C.border}`, color:C.muted, fontSize:13, fontWeight:600, cursor:"pointer" }}
          >
            <Download size={13}/> Export CSV
          </button>
          {!isViewer && (
          <>
            <button onClick={()=>setShowNewPO(true)} style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 16px", borderRadius:10, background:C.blueBg, border:`1px solid ${C.blueBorder}`, color:C.blue, fontSize:13, fontWeight:700, cursor:"pointer" }}>
              <FileText size={14}/> New PO
            </button>
            <button onClick={()=>setShowNewSup(true)} style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 18px", borderRadius:10, background:C.blue, border:"none", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              <Plus size={14}/> Add Supplier
            </button>
          </>
          )}
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:14 }}>
        {[
          { label:"Active Suppliers",    value:activeCount,           color:C.green,  bg:C.greenBg,  border:C.greenBorder  },
          { label:"Pending Review",      value:pendingCount,          color:C.amber,  bg:C.amberBg,  border:C.amberBorder  },
          { label:"Open POs",            value:openPOs,               color:C.blue,   bg:C.blueBg,   border:C.blueBorder   },
          { label:"Open PO Value",       value:fmtMoney(openPOValue), color:C.purple, bg:C.purpleBg, border:C.purpleBorder },
          // Phase 16: pending approval card
          { label:"Awaiting Approval",   value:pendingApprovalCount,  color:pendingApprovalCount>0?C.amber:C.muted, bg:pendingApprovalCount>0?C.amberBg:"#f0f0f0", border:pendingApprovalCount>0?C.amberBorder:C.border },
        ].map((s,i)=>(
          <div key={i} style={{ background:s.bg, border:`1px solid ${s.border}`, borderRadius:12, padding:"14px 18px" }}>
            <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Phase 16: approval threshold config — admins only */}
      {isAdmin && (
        <Card>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:2 }}>Purchase Approval Threshold</div>
              <div style={{ fontSize:12, color:C.muted }}>
                POs at or above this value will require admin approval before being sent to the supplier.
                Set to <strong>0</strong> to disable approval requirements.
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ position:"relative" }}>
                <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:C.muted, fontSize:13 }}>$</span>
                <input
                  type="number" min="0" step="100"
                  value={thresholdInput}
                  onChange={e => setThresholdInput(e.target.value)}
                  style={{ padding:"9px 12px 9px 24px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:9, color:C.text, fontSize:13, outline:"none", width:140 }}
                />
              </div>
              <button
                onClick={saveThreshold}
                style={{ padding:"9px 20px", background:thresholdSaved?C.green:C.blue, border:"none", borderRadius:9, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", transition:"background 0.3s" }}
              >
                {thresholdSaved ? "✓ Saved" : "Save"}
              </button>
            </div>
          </div>
          {approvalThreshold > 0 && (
            <div style={{ marginTop:12, padding:"8px 12px", background:C.amberBg, border:`1px solid ${C.amberBorder}`, borderRadius:8, fontSize:12, color:C.amber }}>
              ⚠️ Approval required for POs of <strong>{fmtMoney(approvalThreshold)}</strong> or more.
            </div>
          )}
        </Card>
      )}

      {/* ── Tab nav ── */}
      <div style={{ display:"flex", gap:8 }}>
        {([["list","🏭 Suppliers"],["pos","📋 Purchase Orders"]] as const).map(([t,l])=>(
          <button key={t} onClick={()=>{ setView(t); setSelected(null) }} style={{
            padding:"8px 18px", borderRadius:9, fontSize:13, fontWeight:600, cursor:"pointer",
            background: view===t&&selected===null ? C.blue : C.surface,
            color:      view===t&&selected===null ? "#fff" : C.muted,
            border:     view===t&&selected===null ? "none" : `1px solid ${C.border}`,
          }}>
            {l}
            {t === "pos" && pendingApprovalCount > 0 && (
              <span style={{ marginLeft:6, background:C.amber, color:"#fff", borderRadius:999, fontSize:10, fontWeight:800, padding:"1px 6px" }}>
                {pendingApprovalCount}
              </span>
            )}
          </button>
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
              const cfg  = SUP_STATUS[s.status]
              const sPOs = supplierPOs(s.id)
              return (
                <Card key={s.id} style={{ cursor:"pointer" }} onClick={()=>{ setSelected(s); setSubTab("info") }}>
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
              )
            })}
          </div>
        )
      )}

      {/* ══════════════════════════════════════════════
          SUPPLIER DETAIL
      ══════════════════════════════════════════════ */}
      {view==="list" && selected && (() => {
        const cfg  = SUP_STATUS[selected.status]
        const sPOs = supplierPOs(selected.id)
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
                    { icon:Mail,  label:"Email",     val:selected.email                },
                    { icon:Phone, label:"Phone",     val:selected.phone||"—"           },
                    { icon:Globe, label:"Country",   val:selected.country||"—"         },
                    { icon:Clock, label:"Lead Time", val:`${selected.leadTimeDays} days`},
                    { icon:Package, label:"Terms",   val:selected.paymentTerms         },
                    { icon:Package, label:"Contact", val:selected.contactName          },
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
                  ) : sPOs.map(po=>{
                    const cfg   = PO_STATUS[po.status]
                    const Icon  = cfg.icon
                    const appCfg = APPROVAL_CONFIG[po.approvalStatus]
                    const canAdv = canAdvancePO(po)
                    return (
                      <Card key={po.id} style={{ padding:"14px 16px" }}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                          <div>
                            <div style={{ fontWeight:700, color:C.blue, fontFamily:"monospace", fontSize:13 }}>{po.poNumber}</div>
                            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{po.items.length} item{po.items.length!==1?"s":""} · {fmtDate(po.expectedDate)}</div>
                          </div>
                          <div style={{ textAlign:"right" }}>
                            <div style={{ fontWeight:800, color:C.text, marginBottom:4 }}>{fmtMoney(po.total)}</div>
                            <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:999, fontSize:11, fontWeight:700, color:cfg.color, background:cfg.bg, border:`1px solid ${cfg.border}` }}>
                              <Icon size={10}/>{cfg.label}
                            </span>
                          </div>
                        </div>
                        {/* Phase 16: approval status badge + buttons */}
                        {po.approvalStatus !== "not_required" && (
                          <div style={{ marginBottom:10, padding:"8px 12px", background:appCfg.bg, border:`1px solid ${appCfg.border}`, borderRadius:8, fontSize:12, color:appCfg.color, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                            <span>{appCfg.emoji} {appCfg.label}{po.approvedBy ? ` — by ${po.approvedBy}` : ""}</span>
                            {po.approvalStatus === "pending" && isAdmin && !isViewer && (
                              <div style={{ display:"flex", gap:8 }}>
                                <button onClick={()=>approvePO(po.id)} style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 12px", borderRadius:7, background:C.greenBg, border:`1px solid ${C.greenBorder}`, color:C.green, fontSize:11, fontWeight:700, cursor:"pointer" }}>
                                  <ShieldCheck size={11}/> Approve
                                </button>
                                <button onClick={()=>rejectPO(po.id)} style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 12px", borderRadius:7, background:C.redBg, border:`1px solid ${C.redBorder}`, color:C.red, fontSize:11, fontWeight:700, cursor:"pointer" }}>
                                  <ShieldX size={11}/> Reject
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        {canAdv && !isViewer && (
                          <button onClick={()=>advancePO(po.id)} style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 14px", borderRadius:8, background:C.blueBg, border:`1px solid ${C.blueBorder}`, color:C.blue, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                            Advance to next stage <ChevronRight size={12}/>
                          </button>
                        )}
                        {po.approvalStatus === "rejected" && (
                          <div style={{ fontSize:12, color:C.red, marginTop:4 }}>
                            This PO was rejected and cannot be sent. Cancel it or create a new one.
                          </div>
                        )}
                      </Card>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>
        )
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
                  {["PO Number","Supplier","Items","Total","Expected","Status","Approval","Actions"].map((h,i)=>(
                    <th key={i} style={{ padding:"10px 16px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase" as const, letterSpacing:"0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pos.map((po,i)=>{
                  const cfg    = PO_STATUS[po.status]
                  const appCfg = APPROVAL_CONFIG[po.approvalStatus]
                  const Icon   = cfg.icon
                  const canAdv = canAdvancePO(po)
                  const canCan = !["received","cancelled"].includes(po.status)
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
                      {/* Phase 16: approval column */}
                      <td style={{ padding:"13px 16px" }}>
                        {po.approvalStatus === "not_required" ? (
                          <span style={{ fontSize:11, color:C.subtle }}>—</span>
                        ) : (
                          <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"3px 10px", borderRadius:999, fontSize:11, fontWeight:700, color:appCfg.color, background:appCfg.bg, border:`1px solid ${appCfg.border}` }}>
                            {appCfg.emoji} {appCfg.label}
                          </span>
                        )}
                      </td>
                      <td style={{ padding:"13px 16px" }}>
                        <div style={{ display:"flex", gap:6 }}>
                          {/* Phase 16: approve/reject for pending POs (admins only) */}
                          {po.approvalStatus === "pending" && isAdmin && !isViewer && (
                            <>
                              <button onClick={()=>approvePO(po.id)} style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 10px", borderRadius:7, background:C.greenBg, border:`1px solid ${C.greenBorder}`, color:C.green, fontSize:11, fontWeight:700, cursor:"pointer" }}>
                                <ShieldCheck size={11}/> Approve
                              </button>
                              <button onClick={()=>rejectPO(po.id)} style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 10px", borderRadius:7, background:C.redBg, border:`1px solid ${C.redBorder}`, color:C.red, fontSize:11, fontWeight:700, cursor:"pointer" }}>
                                <ShieldX size={11}/> Reject
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
                  )
                })}
              </tbody>
            </table>
          </Card>
        )
      )}
    </div>
  )
}
