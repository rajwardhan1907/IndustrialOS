// lib/suppliers.ts
// Shared supplier + purchase order store (localStorage).
// When we add the database in Phase 4, swap localStorage for API calls.

export type SupplierStatus   = "active" | "inactive" | "pending";
export type SupplierCategory = "raw_materials" | "components" | "packaging" | "equipment" | "services" | "logistics" | "other";
export type POStatus         = "draft" | "sent" | "confirmed" | "received" | "cancelled";
export type PaymentTerms     = "Net 15" | "Net 30" | "Net 60" | "Prepaid" | "Cash on Delivery";

export interface Supplier {
  id:            string;
  name:          string;
  contactName:   string;
  email:         string;
  phone:         string;
  country:       string;
  category:      SupplierCategory;
  status:        SupplierStatus;
  paymentTerms:  PaymentTerms;
  leadTimeDays:  number;   // average lead time in days
  rating:        number;   // 1-5
  notes:         string;
  createdAt:     string;
}

export interface POItem {
  id:        string;
  desc:      string;
  sku:       string;
  qty:       number;
  unitPrice: number;
  total:     number;
}

export interface PurchaseOrder {
  id:           string;
  poNumber:     string;
  supplierId:   string;
  supplierName: string;
  items:        POItem[];
  subtotal:     number;
  tax:          number;
  total:        number;
  status:       POStatus;
  paymentTerms: PaymentTerms;
  expectedDate: string;   // ISO date
  notes:        string;
  createdAt:    string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export const makeSupplierId = () => Math.random().toString(36).slice(2, 9);
export const makePONumber   = () =>
  `PO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

export const CATEGORY_LABEL: Record<SupplierCategory, string> = {
  raw_materials: "Raw Materials",
  components:    "Components",
  packaging:     "Packaging",
  equipment:     "Equipment",
  services:      "Services",
  logistics:     "Logistics",
  other:         "Other",
};

export const CATEGORY_EMOJI: Record<SupplierCategory, string> = {
  raw_materials: "🪨",
  components:    "⚙️",
  packaging:     "📦",
  equipment:     "🔧",
  services:      "🛠️",
  logistics:     "🚛",
  other:         "🏭",
};

// ── Demo seed data ────────────────────────────────────────────────────────────
function seedSuppliers(): Supplier[] {
  const ago = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
  return [
    {
      id: "sup1", name: "SteelCo Industries", contactName: "Mark Patterson",
      email: "mark@steelco.com", phone: "+1 312 555 0192", country: "USA",
      category: "raw_materials", status: "active", paymentTerms: "Net 30",
      leadTimeDays: 14, rating: 4, notes: "Preferred supplier for structural steel.",
      createdAt: ago(120),
    },
    {
      id: "sup2", name: "PrecisionParts GmbH", contactName: "Anna Müller",
      email: "anna@precisionparts.de", phone: "+49 89 555 0234", country: "Germany",
      category: "components", status: "active", paymentTerms: "Net 60",
      leadTimeDays: 21, rating: 5, notes: "ISO 9001 certified. Excellent quality.",
      createdAt: ago(90),
    },
    {
      id: "sup3", name: "PackRight Solutions", contactName: "Lisa Chen",
      email: "lisa@packright.com", phone: "+1 415 555 0871", country: "USA",
      category: "packaging", status: "active", paymentTerms: "Net 15",
      leadTimeDays: 7, rating: 3, notes: "Good pricing, occasional delays.",
      createdAt: ago(60),
    },
    {
      id: "sup4", name: "GlobalLogix Ltd", contactName: "Raj Patel",
      email: "raj@globallogix.com", phone: "+44 20 555 0345", country: "UK",
      category: "logistics", status: "inactive", paymentTerms: "Prepaid",
      leadTimeDays: 5, rating: 2, notes: "On hold — reviewing contract terms.",
      createdAt: ago(200),
    },
    {
      id: "sup5", name: "TechEquip Asia", contactName: "Wei Zhang",
      email: "wei@techequip.asia", phone: "+86 21 555 0567", country: "China",
      category: "equipment", status: "pending", paymentTerms: "Net 30",
      leadTimeDays: 45, rating: 4, notes: "New supplier — awaiting first delivery.",
      createdAt: ago(10),
    },
  ];
}

function seedPurchaseOrders(suppliers: Supplier[]): PurchaseOrder[] {
  const ago     = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
  const future  = (d: number) => new Date(Date.now() + d * 86400000).toISOString().split("T")[0];
  return [
    {
      id: "po1", poNumber: "PO-2026-1042",
      supplierId: "sup1", supplierName: "SteelCo Industries",
      items: [
        { id:"pi1", desc:"Hot-rolled steel sheet 3mm", sku:"STL-3MM-HR", qty:500, unitPrice:12.50, total:6250 },
        { id:"pi2", desc:"Galvanised angle iron 40x40", sku:"STL-ANG-40", qty:200, unitPrice:8.75,  total:1750 },
      ],
      subtotal:8000, tax:640, total:8640,
      status:"confirmed", paymentTerms:"Net 30",
      expectedDate: future(7), notes:"Urgent — for Q2 production run.",
      createdAt: ago(5),
    },
    {
      id: "po2", poNumber: "PO-2026-0891",
      supplierId: "sup2", supplierName: "PrecisionParts GmbH",
      items: [
        { id:"pi3", desc:"Bearing assembly B-204", sku:"BRG-B204", qty:100, unitPrice:45.00, total:4500 },
      ],
      subtotal:4500, tax:360, total:4860,
      status:"received", paymentTerms:"Net 60",
      expectedDate: ago(3).split("T")[0], notes:"",
      createdAt: ago(30),
    },
    {
      id: "po3", poNumber: "PO-2026-1103",
      supplierId: "sup3", supplierName: "PackRight Solutions",
      items: [
        { id:"pi4", desc:"Corrugated box 300x200x150mm", sku:"PKG-BOX-300", qty:2000, unitPrice:1.20, total:2400 },
        { id:"pi5", desc:"Bubble wrap roll 50m",         sku:"PKG-BWR-50",  qty:20,   unitPrice:8.50, total:170  },
      ],
      subtotal:2570, tax:205.60, total:2775.60,
      status:"draft", paymentTerms:"Net 15",
      expectedDate: future(14), notes:"",
      createdAt: ago(1),
    },
  ];
}

// ── localStorage — Suppliers ──────────────────────────────────────────────────
const SUP_KEY = "industrialos_suppliers";

export function loadSuppliers(): Supplier[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SUP_KEY);
    if (!raw) {
      const demo = seedSuppliers();
      localStorage.setItem(SUP_KEY, JSON.stringify(demo));
      return demo;
    }
    return JSON.parse(raw);
  } catch { return []; }
}

export function saveSuppliers(suppliers: Supplier[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SUP_KEY, JSON.stringify(suppliers));
}

// ── localStorage — Purchase Orders ────────────────────────────────────────────
const PO_KEY = "industrialos_pos";

export function loadPOs(): PurchaseOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PO_KEY);
    if (!raw) {
      const sups  = loadSuppliers();
      const demo  = seedPurchaseOrders(sups);
      localStorage.setItem(PO_KEY, JSON.stringify(demo));
      return demo;
    }
    return JSON.parse(raw);
  } catch { return []; }
}

export function savePOs(pos: PurchaseOrder[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PO_KEY, JSON.stringify(pos));
}
