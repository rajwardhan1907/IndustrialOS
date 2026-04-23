// mobile/src/lib/constants.ts — Shared constants across mobile app

const FEATURES_KEY = "mobile_features";

const DEFAULT_FEATURES: Record<string, boolean> = {
  Dashboard: true,
  Orders: true,
  Inventory: true,
  Shipments: true,
  Notifications: true,
  Tickets: true,
  Quotes: true,
  Customers: true,
  Suppliers: true,
  Returns: true,
  "Purchase Orders": true,
  Invoicing: true,
  Analytics: true,
  Contracts: true,
  "AI Insights": true,
  "System Health": true,
  Accounting: true,
};

const HIGH_PRIORITY = ["Dashboard", "Orders", "Inventory", "Shipments", "Notifications", "Tickets"];

export { FEATURES_KEY, DEFAULT_FEATURES, HIGH_PRIORITY };
