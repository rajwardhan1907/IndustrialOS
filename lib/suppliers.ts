// lib/suppliers.ts
// Phase 16: Added approvalStatus field to PurchaseOrder + approval DB helpers

export type SupplierStatus   = "active" | "inactive" | "pending"
export type SupplierCategory = "raw_materials" | "components" | "packaging" | "equipment" | "services" | "logistics" | "other"
export type POStatus         = "draft" | "sent" | "confirmed" | "received" | "cancelled"
export type PaymentTerms     = "Net 15" | "Net 30" | "Net 60" | "Prepaid" | "Cash on Delivery"

// Phase 16: approval states
// not_required → PO total is below the workspace threshold (or threshold is 0/disabled)
// pending      → above threshold, waiting for admin approval
// approved     → admin approved — PO can be sent to supplier
// rejected     → admin rejected — PO is blocked
export type ApprovalStatus = "not_required" | "pending" | "approved" | "rejected"

export interface Supplier {
  id:           string
  name:         string
  contactName:  string
  email:        string
  phone:        string
  country:      string
  category:     SupplierCategory
  status:       SupplierStatus
  paymentTerms: PaymentTerms
  leadTimeDays: number
  rating:       number
  notes:        string
  createdAt:    string
}

export interface POItem {
  id:        string
  desc:      string
  sku:       string
  qty:       number
  unitPrice: number
  total:     number
}

export interface PurchaseOrder {
  id:             string
  poNumber:       string
  supplierId:     string
  supplierName:   string
  items:          POItem[]
  subtotal:       number
  tax:            number
  total:          number
  status:         POStatus
  paymentTerms:   PaymentTerms
  expectedDate:   string
  notes:          string
  // Phase 16 fields
  approvalStatus: ApprovalStatus
  approvedBy:     string
  approvedAt:     string
  createdAt:      string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export const makeSupplierId = () => Math.random().toString(36).slice(2, 9)
export const makePONumber   = () =>
  `PO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`

export const CATEGORY_LABEL: Record<SupplierCategory, string> = {
  raw_materials: "Raw Materials",
  components:    "Components",
  packaging:     "Packaging",
  equipment:     "Equipment",
  services:      "Services",
  logistics:     "Logistics",
  other:         "Other",
}

export const CATEGORY_EMOJI: Record<SupplierCategory, string> = {
  raw_materials: "🪨",
  components:    "⚙️",
  packaging:     "📦",
  equipment:     "🔧",
  services:      "🛠️",
  logistics:     "🚛",
  other:         "🏭",
}

// Phase 16: approval status display config
export const APPROVAL_CONFIG: Record<ApprovalStatus, {
  label: string; color: string; bg: string; border: string; emoji: string
}> = {
  not_required: { label: "No approval needed", color: "#6b7280", bg: "#f0f0f0",   border: "#d1d5db", emoji: "—"  },
  pending:      { label: "Awaiting approval",  color: "#b86a00", bg: "#fef5e7",   border: "#f5d9a0", emoji: "⏳" },
  approved:     { label: "Approved",            color: "#2e7d5e", bg: "#edf6f1",   border: "#b8dece", emoji: "✅" },
  rejected:     { label: "Rejected",            color: "#c0392b", bg: "#fdf0ee",   border: "#f0b8b2", emoji: "❌" },
}

// ── Get workspaceId ───────────────────────────────────────────────────────────
function getWorkspaceId(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem("workspaceDbId") ?? ""
}

// ── Seed demo data ────────────────────────────────────────────────────────────
function seedSuppliers(): Supplier[] {
  const ago = (d: number) => new Date(Date.now() - d * 86400000).toISOString()
  return [
    { id:"sup1", name:"SteelCo Industries",   contactName:"Mark Patterson", email:"mark@steelco.com",       phone:"+1 312 555 0192", country:"USA",     category:"raw_materials", status:"active",   paymentTerms:"Net 30", leadTimeDays:14, rating:4, notes:"Preferred supplier for structural steel.", createdAt:ago(120) },
    { id:"sup2", name:"PrecisionParts GmbH",  contactName:"Anna Müller",    email:"anna@precisionparts.de", phone:"+49 89 555 0234", country:"Germany", category:"components",    status:"active",   paymentTerms:"Net 60", leadTimeDays:21, rating:5, notes:"ISO 9001 certified. Excellent quality.",   createdAt:ago(90)  },
    { id:"sup3", name:"PackRight Solutions",  contactName:"Lisa Chen",      email:"lisa@packright.com",     phone:"+1 415 555 0871", country:"USA",     category:"packaging",     status:"active",   paymentTerms:"Net 15", leadTimeDays:7,  rating:3, notes:"Good pricing, occasional delays.",          createdAt:ago(60)  },
    { id:"sup4", name:"GlobalLogix Ltd",      contactName:"Raj Patel",      email:"raj@globallogix.com",    phone:"+44 20 555 0345", country:"UK",      category:"logistics",     status:"inactive", paymentTerms:"Prepaid",leadTimeDays:5,  rating:2, notes:"On hold — reviewing contract terms.",       createdAt:ago(200) },
    { id:"sup5", name:"TechEquip Asia",       contactName:"Wei Zhang",      email:"wei@techequip.asia",     phone:"+86 21 555 0567", country:"China",   category:"equipment",     status:"pending",  paymentTerms:"Net 30", leadTimeDays:45, rating:4, notes:"New supplier — awaiting first delivery.",   createdAt:ago(10)  },
  ]
}

function seedPurchaseOrders(): PurchaseOrder[] {
  const ago    = (d: number) => new Date(Date.now() - d * 86400000).toISOString()
  const future = (d: number) => new Date(Date.now() + d * 86400000).toISOString().split("T")[0]
  return [
    {
      id:"po1", poNumber:"PO-2026-1042", supplierId:"sup1", supplierName:"SteelCo Industries",
      items:[
        { id:"pi1", desc:"Hot-rolled steel sheet 3mm",  sku:"STL-3MM-HR", qty:500, unitPrice:12.50, total:6250 },
        { id:"pi2", desc:"Galvanised angle iron 40x40", sku:"STL-ANG-40", qty:200, unitPrice:8.75,  total:1750 },
      ],
      subtotal:8000, tax:640, total:8640, status:"confirmed", paymentTerms:"Net 30",
      expectedDate:future(7), notes:"Urgent — for Q2 production run.",
      approvalStatus:"approved", approvedBy:"admin@demo.com", approvedAt:ago(4),
      createdAt:ago(5),
    },
    {
      id:"po2", poNumber:"PO-2026-0891", supplierId:"sup2", supplierName:"PrecisionParts GmbH",
      items:[
        { id:"pi3", desc:"Bearing assembly B-204", sku:"BRG-B204", qty:100, unitPrice:45.00, total:4500 },
      ],
      subtotal:4500, tax:360, total:4860, status:"received", paymentTerms:"Net 60",
      expectedDate:ago(3).split("T")[0], notes:"",
      approvalStatus:"not_required", approvedBy:"", approvedAt:"",
      createdAt:ago(30),
    },
    {
      id:"po3", poNumber:"PO-2026-1103", supplierId:"sup3", supplierName:"PackRight Solutions",
      items:[
        { id:"pi4", desc:"Corrugated box 300x200x150mm", sku:"PKG-BOX-300", qty:2000, unitPrice:1.20, total:2400 },
        { id:"pi5", desc:"Bubble wrap roll 50m",          sku:"PKG-BWR-50",  qty:20,   unitPrice:8.50, total:170  },
      ],
      subtotal:2570, tax:205.60, total:2775.60, status:"draft", paymentTerms:"Net 15",
      expectedDate:future(14), notes:"",
      approvalStatus:"pending", approvedBy:"", approvedAt:"",
      createdAt:ago(1),
    },
  ]
}

// ── localStorage (cache) ──────────────────────────────────────────────────────
const SUP_KEY = "industrialos_suppliers"
const PO_KEY  = "industrialos_pos"

export function loadSuppliers(): Supplier[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(SUP_KEY)
    if (!raw) {
      const demo = seedSuppliers()
      localStorage.setItem(SUP_KEY, JSON.stringify(demo))
      return demo
    }
    return JSON.parse(raw)
  } catch { return [] }
}

export function saveSuppliers(suppliers: Supplier[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(SUP_KEY, JSON.stringify(suppliers))
}

export function loadPOs(): PurchaseOrder[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(PO_KEY)
    if (!raw) {
      const demo = seedPurchaseOrders()
      localStorage.setItem(PO_KEY, JSON.stringify(demo))
      return demo
    }
    // Phase 16: backfill approvalStatus for any POs created before this phase
    const parsed: PurchaseOrder[] = JSON.parse(raw)
    return parsed.map(po => ({
      ...po,
      approvalStatus: po.approvalStatus ?? "not_required",
      approvedBy:     po.approvedBy     ?? "",
      approvedAt:     po.approvedAt     ?? "",
    }))
  } catch { return [] }
}

export function savePOs(pos: PurchaseOrder[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(PO_KEY, JSON.stringify(pos))
}

// ── API: fetch suppliers from DB ──────────────────────────────────────────────
export async function fetchSuppliersFromDb(): Promise<Supplier[]> {
  try {
    const workspaceId = getWorkspaceId()
    if (!workspaceId) return loadSuppliers()
    const res = await fetch(`/api/suppliers?workspaceId=${workspaceId}`)
    if (!res.ok) return loadSuppliers()
    const data: Supplier[] = await res.json()
    if (!Array.isArray(data) || data.length === 0) return loadSuppliers()
    saveSuppliers(data)
    return data
  } catch { return loadSuppliers() }
}

// ── API: fetch purchase orders from DB ────────────────────────────────────────
export async function fetchPOsFromDb(): Promise<PurchaseOrder[]> {
  try {
    const workspaceId = getWorkspaceId()
    if (!workspaceId) return loadPOs()
    const res = await fetch(`/api/purchase-orders?workspaceId=${workspaceId}`)
    if (!res.ok) return loadPOs()
    const data: PurchaseOrder[] = await res.json()
    if (!Array.isArray(data) || data.length === 0) return loadPOs()
    // Backfill approval fields for safety
    const normalised = data.map(po => ({
      ...po,
      approvalStatus: (po.approvalStatus ?? "not_required") as ApprovalStatus,
      approvedBy:     po.approvedBy ?? "",
      approvedAt:     po.approvedAt ?? "",
    }))
    savePOs(normalised)
    return normalised
  } catch { return loadPOs() }
}

// ── API: create supplier ──────────────────────────────────────────────────────
export async function createSupplierInDb(supplier: Supplier): Promise<void> {
  try {
    const workspaceId = getWorkspaceId()
    if (!workspaceId) return
    await fetch("/api/suppliers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...supplier, workspaceId }),
    })
  } catch (err) { console.error("Failed to save supplier to DB:", err) }
}

// ── API: update supplier ──────────────────────────────────────────────────────
export async function updateSupplierInDb(id: string, fields: Partial<Supplier>): Promise<void> {
  try {
    await fetch("/api/suppliers", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    })
  } catch (err) { console.error("Failed to update supplier in DB:", err) }
}

// ── API: create purchase order ────────────────────────────────────────────────
export async function createPOInDb(po: PurchaseOrder): Promise<void> {
  try {
    const workspaceId = getWorkspaceId()
    if (!workspaceId) return
    await fetch("/api/purchase-orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...po, workspaceId }),
    })
  } catch (err) { console.error("Failed to save PO to DB:", err) }
}

// ── API: update purchase order ────────────────────────────────────────────────
export async function updatePOInDb(id: string, fields: Partial<PurchaseOrder>): Promise<void> {
  try {
    await fetch("/api/purchase-orders", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    })
  } catch (err) { console.error("Failed to update PO in DB:", err) }
}

// Phase 16: approve a PO ──────────────────────────────────────────────────────
export async function approvePOInDb(id: string, approvedBy: string): Promise<void> {
  try {
    await fetch("/api/purchase-orders", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        approvalStatus: "approved",
        approvedBy,
        approvedAt: new Date().toISOString(),
      }),
    })
  } catch (err) { console.error("Failed to approve PO in DB:", err) }
}

// Phase 16: reject a PO ───────────────────────────────────────────────────────
export async function rejectPOInDb(id: string, approvedBy: string): Promise<void> {
  try {
    await fetch("/api/purchase-orders", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        approvalStatus: "rejected",
        approvedBy,
        approvedAt: new Date().toISOString(),
      }),
    })
  } catch (err) { console.error("Failed to reject PO in DB:", err) }
}
