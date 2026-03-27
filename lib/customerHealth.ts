// lib/customerHealth.ts
// Phase 10 — Customer Health Score
// Pure calculation — no DB calls, works from data already loaded in the Customers component.

export type HealthGrade = "A" | "B" | "C" | "D";

export interface HealthScore {
  score:   number;      // 0–100
  grade:   HealthGrade;
  label:   string;
  color:   string;
  bg:      string;
  border:  string;
  reasons: string[];    // short list of what's hurting or helping the score
}

// Each customer has these fields relevant to scoring
interface ScoringInput {
  status:      "active" | "on_hold" | "inactive";
  balance:     number;  // outstanding balance due
  creditLimit: number;
  totalSpend:  number;
  orders:      any[];   // order history array
}

export function getHealthScore(c: ScoringInput): HealthScore {
  let score   = 100;
  const good: string[] = [];
  const bad:  string[] = [];

  // ── 1. Account status ──────────────────────────────────────────────────────
  if (c.status === "on_hold") {
    score -= 35;
    bad.push("Account on hold");
  } else if (c.status === "inactive") {
    score -= 20;
    bad.push("Account inactive");
  } else {
    good.push("Account active");
  }

  // ── 2. Credit utilisation ──────────────────────────────────────────────────
  if (c.creditLimit > 0) {
    const util = (c.balance / c.creditLimit) * 100;
    if (util > 90) {
      score -= 30;
      bad.push("Credit limit nearly exceeded");
    } else if (util > 70) {
      score -= 15;
      bad.push("High credit utilisation");
    } else if (util > 40) {
      score -= 5;
    } else {
      good.push("Low credit utilisation");
    }
  }

  // ── 3. Outstanding balance ─────────────────────────────────────────────────
  if (c.balance > 0) {
    if (c.totalSpend > 0) {
      const balancePct = (c.balance / c.totalSpend) * 100;
      if (balancePct > 30) {
        score -= 20;
        bad.push("Large outstanding balance");
      } else if (balancePct > 10) {
        score -= 8;
      }
    } else {
      score -= 10;
      bad.push("Outstanding balance with no spend history");
    }
  } else if (c.balance === 0 && c.totalSpend > 0) {
    good.push("No outstanding balance");
  }

  // ── 4. Order activity ──────────────────────────────────────────────────────
  if (c.orders.length === 0) {
    score -= 10;
    bad.push("No order history");
  } else if (c.orders.length >= 3) {
    good.push("Repeat customer");
  }

  // ── 5. Spend history ───────────────────────────────────────────────────────
  if (c.totalSpend > 100000) {
    good.push("High-value account");
  }

  // ── Clamp ──────────────────────────────────────────────────────────────────
  score = Math.max(0, Math.min(100, score));

  // ── Grade + style ──────────────────────────────────────────────────────────
  let grade: HealthGrade;
  let label: string;
  let color: string;
  let bg:    string;
  let border: string;

  if (score >= 80) {
    grade = "A"; label = "Healthy";
    color = "#2e7d5e"; bg = "#edf6f1"; border = "#b8dece";
  } else if (score >= 60) {
    grade = "B"; label = "Good";
    color = "#3d6fb5"; bg = "#eef3fb"; border = "#c3d5f0";
  } else if (score >= 40) {
    grade = "C"; label = "At Risk";
    color = "#b86a00"; bg = "#fef5e7"; border = "#f5d9a0";
  } else {
    grade = "D"; label = "Critical";
    color = "#c0392b"; bg = "#fdf0ee"; border = "#f0b8b2";
  }

  const reasons = bad.length > 0 ? bad : good.slice(0, 2);

  return { score, grade, label, color, bg, border, reasons };
}
