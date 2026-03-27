// lib/workspace.ts
// Stores each company's workspace configuration.
// For now we use localStorage (browser storage) since we don't have a DB yet.
// When we add the database in Phase 5, we just swap localStorage for API calls.

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
  | "health";

export interface CustomTab {
  id:    string;
  label: string;
  icon:  string; // emoji
  type:  "list" | "kanban" | "notes" | "link";
  url?:  string; // only for type "link"
}

export interface WorkspaceConfig {
  // Company info
  companyName:  string;
  industry:     Industry;
  teamSize:     TeamSize;

  // Which modules are active
  modules: ModuleId[];

  // Custom tabs the company created themselves
  customTabs: CustomTab[];

  // Onboarding complete flag
  onboardingDone: boolean;

  // Suggested plan based on team size
  suggestedPlan: "starter" | "growth" | "business" | "scale" | "enterprise";

  // Phase 16 — Purchase approval threshold in dollars.
  // 0 means disabled (no approval required).
  // Any positive number means POs above that amount need admin approval.
  poApprovalThreshold: number;
}

// ── Default empty workspace ──────────────────────────────────────────────────
export const DEFAULT_WORKSPACE: WorkspaceConfig = {
  companyName:         "",
  industry:            "other",
  teamSize:            "1-5",
  modules:             ["dashboard"],
  customTabs:          [],
  onboardingDone:      false,
  suggestedPlan:       "starter",
  poApprovalThreshold: 0,
};

// ── Pricing tiers ────────────────────────────────────────────────────────────
export const PLANS = {
  starter:    { name: "Starter",    price: 49,  users: "Up to 5",   color: "#3d6fb5" },
  growth:     { name: "Growth",     price: 99,  users: "Up to 15",  color: "#2e7d5e" },
  business:   { name: "Business",   price: 179, users: "Up to 30",  color: "#6b4ca0" },
  scale:      { name: "Scale",      price: 299, users: "Up to 75",  color: "#b86a00" },
  enterprise: { name: "Enterprise", price: 0,   users: "75+",       color: "#c0392b" },
};

// ── Map team size → suggested plan ──────────────────────────────────────────
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

// ── Industry → recommended modules ──────────────────────────────────────────
export function getRecommendedModules(industry: Industry): ModuleId[] {
  const base: ModuleId[] = ["dashboard", "orders", "customers"];
  const map: Record<Industry, ModuleId[]> = {
    manufacturer:  [...base, "inventory", "suppliers", "pipeline", "invoicing", "analytics"],
    distributor:   [...base, "inventory", "invoicing", "shipping", "analytics"],
    services:      [...base, "quotes", "invoicing", "crm", "analytics"],
    import_export: [...base, "inventory", "shipping", "invoicing", "suppliers"],
    construction:  [...base, "quotes", "suppliers", "invoicing", "analytics"],
    pharma:        [...base, "inventory", "suppliers", "pipeline", "invoicing", "health"],
    food_beverage: [...base, "inventory", "suppliers", "shipping", "invoicing"],
    technology:    [...base, "quotes", "invoicing", "crm", "analytics"],
    other:         [...base, "invoicing"],
  };
  return map[industry];
}

// ── localStorage helpers ─────────────────────────────────────────────────────
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
    // Back-fill the new field for existing workspaces that predate Phase 16
    if (parsed.poApprovalThreshold === undefined) {
      parsed.poApprovalThreshold = 0;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearWorkspace(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
