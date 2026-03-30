// lib/pricingRules.ts
// Phase 12 — Pricing Rules Engine
// Pure functions — no DB calls. Works from rules already loaded in the component.
//
// Rule types:
//   "volume"   — discount when line-item qty >= minQty
//   "customer" — flat discount for a specific customer on every line item

export interface PricingRule {
  id:           string;
  name:         string;
  type:         "volume" | "customer";
  minQty:       number;       // volume rules only
  customerName: string;       // customer rules only
  discountPct:  number;       // e.g. 10 means 10%
  active:       boolean;
}

export interface RuleLineItem {
  id:        string;
  sku:       string;
  desc:      string;
  qty:       number;
  unitPrice: number;
  discount:  number;  // existing discount % on this line (0–100)
  total:     number;
}

/**
 * Apply active pricing rules to a list of line items.
 * Returns a NEW array — never mutates the input.
 *
 * Logic:
 *  - For each item, collect all rules that apply (volume rules where qty >= minQty,
 *    customer rules where customer matches).
 *  - The highest discount from any matching rule wins.
 *  - The rule discount only replaces the existing discount if it's HIGHER
 *    (we never reduce a discount the user set manually).
 */
export function applyPricingRules(
  rules:        PricingRule[],
  customerName: string,
  items:        RuleLineItem[],
): RuleLineItem[] {
  const activeRules = rules.filter(r => r.active);
  if (activeRules.length === 0) return items;

  // Customer rules that match this customer (case-insensitive)
  const custRules = activeRules.filter(
    r => r.type === "customer" &&
         r.customerName.trim().toLowerCase() === customerName.trim().toLowerCase()
  );
  const maxCustDiscount = custRules.length
    ? Math.max(...custRules.map(r => r.discountPct))
    : 0;

  return items.map(item => {
    // Volume rules that match this item's qty
    const volRules = activeRules.filter(
      r => r.type === "volume" && item.qty >= r.minQty && r.minQty > 0
    );
    const maxVolDiscount = volRules.length
      ? Math.max(...volRules.map(r => r.discountPct))
      : 0;

    // Best discount from rules (don't lower what's already there)
    const ruleDiscount = Math.max(maxCustDiscount, maxVolDiscount);
    const finalDiscount = Math.max(item.discount, ruleDiscount);

    if (finalDiscount === item.discount) return item; // no change

    const total = parseFloat(
      (item.qty * item.unitPrice * (1 - finalDiscount / 100)).toFixed(2)
    );
    return { ...item, discount: finalDiscount, total };
  });
}

/**
 * Describe which rules fired, for the UI tooltip / banner.
 * Returns a short human-readable string like "Volume rule: 5% off (200+ units)"
 */
export function getRulesSummary(
  rules:        PricingRule[],
  customerName: string,
  items:        RuleLineItem[],
): string {
  const active = rules.filter(r => r.active);
  const fired: string[] = [];

  const custMatch = active.filter(
    r => r.type === "customer" &&
         r.customerName.trim().toLowerCase() === customerName.trim().toLowerCase()
  );
  if (custMatch.length) {
    const best = custMatch.reduce((a, b) => a.discountPct > b.discountPct ? a : b);
    fired.push(`Customer rule "${best.name}": ${best.discountPct}% off all items`);
  }

  const usedVol = new Set<string>();
  for (const item of items) {
    const volMatch = active.filter(
      r => r.type === "volume" && item.qty >= r.minQty && r.minQty > 0
    );
    if (volMatch.length) {
      const best = volMatch.reduce((a, b) => a.discountPct > b.discountPct ? a : b);
      if (!usedVol.has(best.id)) {
        usedVol.add(best.id);
        fired.push(`Volume rule "${best.name}": ${best.discountPct}% off (${best.minQty}+ units)`);
      }
    }
  }

  return fired.join(" · ");
}
