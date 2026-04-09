// mobile/src/lib/constants.ts — Shared constants across mobile app

const FEATURES_KEY = "mobile_features";

const DEFAULT_FEATURES: Record<string, boolean> = {
  Dashboard: true,
  Orders: true,
  Inventory: true,
  Shipments: true,
  Notifications: true,
  Tickets: true,
  Quotes: false,
  Customers: false,
  Suppliers: false,
  Returns: false,
  "Purchase Orders": false,
  Invoicing: false,
  Analytics: false,
  Contracts: false,
};

const HIGH_PRIORITY = ["Dashboard", "Orders", "Inventory", "Shipments", "Notifications", "Tickets"];

export { FEATURES_KEY, DEFAULT_FEATURES, HIGH_PRIORITY };
