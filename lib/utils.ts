import { LayoutDashboard, Upload, ShoppingCart, Package, GitMerge, Heart } from "lucide-react";

export const rnd = (a: number, b: number) =>
  Math.floor(Math.random() * (b - a + 1)) + a;

export const fmt = (n: number) =>
  n >= 1e6 ? (n / 1e6).toFixed(2) + "M"
  : n >= 1e3 ? (n / 1e3).toFixed(1) + "K"
  : String(n);

export const C = {
  bg: "#f5f3ef",          surface: "#fffefb",
  border: "#e8e3da",      border2: "#d6cfc3",
  text: "#2d2a24",        muted: "#7a7060",        subtle: "#a89e8e",
  blue: "#3d6fb5",        blueBg: "#eef3fb",       blueBorder: "#c3d5f0",
  green: "#2e7d5e",       greenBg: "#edf6f1",      greenBorder: "#b8dece",
  amber: "#b86a00",       amberBg: "#fef5e7",      amberBorder: "#f5d9a0",
  red: "#c0392b",         redBg: "#fdf0ee",        redBorder: "#f0b8b2",
  purple: "#6b4ca0",      purpleBg: "#f3eefb",     purpleBorder: "#cfc0ed",
};

export const TABS = [
  { id: "dashboard", label: "Dashboard",      icon: LayoutDashboard },
  { id: "pipeline",  label: "SKU Pipeline",   icon: Upload          },
  { id: "orders",    label: "Order Kanban",   icon: ShoppingCart    },
  { id: "inventory", label: "Inventory Sync", icon: Package         },
  { id: "crm",       label: "CRM",            icon: GitMerge        },
  { id: "health",    label: "System Health",  icon: Heart           },
];

export const STAGES = ["Placed", "Confirmed", "Picked", "Shipped", "Delivered"];

const CUSTOMERS = [
  "Acme Corp","TechWave Ltd","NovaBuild","HeavyMach","ProTools Inc",
  "MetalWorks","FactoryHub","IndusFlow","CoreDrive","SteelFlex",
];

export const genChart = (n = 22) =>
  Array.from({ length: n }, (_, i) => ({
    t: `${i}m`, orders: rnd(40,130), latency: rnd(12,55),
    errors: rnd(0,9), sync: rnd(82,100),
  }));

export const genOrders = () =>
  Array.from({ length: 20 }, (_, i) => ({
    id:       `ORD-${10234 + i}`,
    customer: CUSTOMERS[i % 10],
    sku:      `SKU-${rnd(1000, 9999)}`,
    value:    rnd(1200, 52000),
    stage:    STAGES[i % 5],
    items:    rnd(3, 140),
    time:     `${rnd(1, 59)}m ago`,
    priority: (["HIGH", "MED", "LOW"] as const)[i % 3],
  }));
