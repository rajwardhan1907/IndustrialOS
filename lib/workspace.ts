// lib/workspace.ts
// Phase 18: Added "returns" to ModuleId.
// Phase 15: Added currency field to WorkspaceConfig.
// Phase 12 (roadmap): Added "contracts" to ModuleId.
// Phase 13 (roadmap): Added AI feature toggles.
// Phase 17 (roadmap): Added accounting integration flags.
// Phase 20 (roadmap): Added "reports" to ModuleId.

export type Industry =
  | "manufacturer"
  | "distributor"
  | "services"
  | "import_export"
  | "construction"
  | "pharma"
  | "food_beverage"
  | "technology"
  | "other";

export type TeamSize = "1-5" | "6-15" | "16-30" | "31-75" | "75+";

export type ModuleId =
  | "dashboard"    // always on
  | "orders"
  | "inventory"
  | "quotes"
  | "invoicing"
  | "shipping"
  | "customers"
  | "suppliers"
  | "analytics"
  | "crm"
  | "pipeline"
  | "health"
  | "returns"      // Phase 18
  | "contracts"    // Phase 12 (roadmap)
  | "reports";     // Phase 20 (roadmap)

export interface CustomTab {
  id:    string;
  label: string;
  icon:  string;
  type:  "list" | "kanban" | "notes" | "link";
  url?:  string;
}

export interface WorkspaceConfig {
  companyName:         string;
  industry:            Industry;
  teamSize:            TeamSize;
  modules:             ModuleId[];
  customTabs:          CustomTab[];
  onboardingDone:      boolean;
  suggestedPlan:       "starter" | "growth" | "business" | "scale" | "enterprise";
  poApprovalThreshold: number;
  currency:            string;   // Phase 15 — ISO 4217 code e.g. "USD"
  whatsappEnabled:     boolean;  // Phase 11
  whatsappStages:      string;   // Phase 11 — comma-separated e.g. "Confirmed,Shipped,Delivered"
  // Phase 13 (roadmap) — AI feature toggles
  aiNegotiation:       boolean;  // Negotiation assistant on quotes
  aiReorder:           boolean;  // Smart reorder prediction in inventory
  aiPriceCompare:      boolean;  // Supplier price comparison in PO creation
  // Phase 17 (roadmap) — Accounting integrations
  quickbooksConnected: boolean;
  xeroConnected:       boolean;
}

export const DEFAULT_WORKSPACE: WorkspaceConfig = {
  companyName:         "",
  industry:            "other",
  teamSize:            "1-5",
  modules:             ["dashboard"],
  customTabs:          [],
  onboardingDone:      false,
  suggestedPlan:       "starter",
  poApprovalThreshold: 0,
  currency:            "USD",
  whatsappEnabled:     false,
  whatsappStages:      "Confirmed,Shipped,Delivered",
  aiNegotiation:       false,
  aiReorder:           false,
  aiPriceCompare:      false,
  quickbooksConnected: false,
  xeroConnected:       false,
};

export const PLANS = {
  starter:    { name: "Starter",    price: 49,  users: "Up to 5",   color: "#3d6fb5" },
  growth:     { name: "Growth",     price: 99,  users: "Up to 15",  color: "#2e7d5e" },
  business:   { name: "Business",   price: 179, users: "Up to 30",  color: "#6b4ca0" },
  scale:      { name: "Scale",      price: 299, users: "Up to 75",  color: "#b86a00" },
  enterprise: { name: "Enterprise", price: 0,   users: "75+",       color: "#c0392b" },
};

export function getPlan(size: TeamSize): WorkspaceConfig["suggestedPlan"] {
  const map: Record<TeamSize, WorkspaceConfig["suggestedPlan"]> = {
    "1-5":  "starter",
    "6-15": "growth",
    "16-30":"business",
    "31-75":"scale",
    "75+":  "enterprise",
  };
  return map[size];
}

export function getRecommendedModules(industry: Industry): ModuleId[] {
  const base: ModuleId[] = ["dashboard", "orders", "customers"];
  const map: Record<Industry, ModuleId[]> = {
    manufacturer:  [...base, "inventory", "suppliers", "pipeline", "invoicing", "analytics", "returns"],
    distributor:   [...base, "inventory", "invoicing", "shipping", "analytics", "returns"],
    services:      [...base, "quotes", "invoicing", "crm", "analytics"],
    import_export: [...base, "inventory", "shipping", "invoicing", "suppliers", "returns"],
    construction:  [...base, "quotes", "suppliers", "invoicing", "analytics"],
    pharma:        [...base, "inventory", "suppliers", "pipeline", "invoicing", "health", "returns"],
    food_beverage: [...base, "inventory", "suppliers", "shipping", "invoicing", "returns"],
    technology:    [...base, "quotes", "invoicing", "crm", "analytics"],
    other:         [...base, "invoicing"],
  };
  return map[industry];
}

const KEY = "industrialos_workspace";

export function saveWorkspace(config: WorkspaceConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(config));
}

export function loadWorkspace(): WorkspaceConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkspaceConfig;
    // Backward-compat defaults for new fields
    if (parsed.poApprovalThreshold === undefined) parsed.poApprovalThreshold = 0;
    if (parsed.currency            === undefined) parsed.currency            = "USD";
    if (parsed.whatsappEnabled     === undefined) parsed.whatsappEnabled     = false;
    if (parsed.whatsappStages      === undefined) parsed.whatsappStages      = "Confirmed,Shipped,Delivered";
    if (parsed.aiNegotiation       === undefined) parsed.aiNegotiation       = false;
    if (parsed.aiReorder           === undefined) parsed.aiReorder           = false;
    if (parsed.aiPriceCompare      === undefined) parsed.aiPriceCompare      = false;
    if (parsed.quickbooksConnected === undefined) parsed.quickbooksConnected = false;
    if (parsed.xeroConnected       === undefined) parsed.xeroConnected       = false;
    return parsed;
  } catch {
    return null;
  }
}

export function clearWorkspace(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
