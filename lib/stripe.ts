// lib/stripe.ts
// Phase 14 — Stripe Payment Collection
// Server-side Stripe client. Requires STRIPE_SECRET_KEY in .env

import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("⚠️  STRIPE_SECRET_KEY is not set — Stripe payments will not work.");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2026-03-25.dahlia",
});
