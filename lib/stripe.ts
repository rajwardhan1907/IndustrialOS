// lib/stripe.ts
// Phase 14 — Stripe Payment Collection
// Lazy initialization — client is only created when a route actually calls getStripe().
// This prevents build failures when STRIPE_SECRET_KEY is not yet set in the environment.

import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set. Add it to your environment variables.");
  }
  _stripe = new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
  return _stripe;
}
