// lib/utils.ts
// Removed genChart() and genOrders() — those generated fake random data.
// Real data will come from your database via API routes later.

import { LayoutDashboard, Upload, ShoppingCart, Package, GitMerge, Heart } from "lucide-react";

// Random number helper — still used by Pipeline progress simulation
export const rnd = (a: number, b: number) =>
  Math.floor(Math.random() * (b - a + 1)) + a;

// Number formatter — used across all components
export const fmt = (n: number) =>
  n >= 1e6 ? (n / 1e6).toFixed(2) + "M"
  : n >= 1e3 ? (n / 1e3).toFixed(1) + "K"
  : String(n);

// Color palette — used across all components
export const C = {
  bg: "#f5f3ef",       surface: "#fffefb",
  border: "#e8e3da",   border2: "#d6cfc3",
  text: "#2d2a24",     muted: "#7a7060",      subtle: "#a89e8e",
  blue: "#3d6fb5",     blueBg: "#eef3fb",     blueBorder: "#c3d5f0",
  green: "#2e7d5e",    greenBg: "#edf6f1",    greenBorder: "#b8dece",
  amber: "#b86a00",    amberBg: "#fef5e7",    amberBorder: "#f5d9a0",
  red: "#c0392b",      redBg: "#fdf0ee",      redBorder: "#f0b8b2",
  purple: "#6b4ca0",   purpleBg: "#f3eefb",   purpleBorder: "#cfc0ed",
};

// Navigation tabs
export const TABS = [
  { id: "dashboard", label: "Dashboard",      icon: LayoutDashboard },
  { id: "pipeline",  label: "SKU Pipeline",   icon: Upload          },
  { id: "orders",    label: "Order Kanban",   icon: ShoppingCart    },
  { id: "inventory", label: "Inventory Sync", icon: Package         },
  { id: "crm",       label: "CRM",            icon: GitMerge        },
  { id: "health",    label: "System Health",  icon: Heart           },
];

// Order stages
export const STAGES = ["Placed", "Confirmed", "Picked", "Shipped", "Delivered"];
