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

// ── localStorage (cache) ──────────────────────────────────────────────────────
const SUP_KEY = "industrialos_suppliers"
const PO_KEY  = "industrialos_pos"

export function loadSuppliers(): Supplier[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(SUP_KEY)
    return raw ? JSON.parse(raw) : []
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
    if (!raw) return []
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
