// mobile/app/(tabs)/_layout.tsx — Dynamic bottom tab bar
import React, { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { Text, Platform } from "react-native";
import { theme } from "../../src/lib/theme";

const HIGH_PRIORITY = ["Dashboard","Orders","Inventory","Shipments","Notifications","Tickets"];

const DEFAULT_FEATURES: Record<string, boolean> = {
  Dashboard: true, Orders: true, Inventory: true, Shipments: true,
  Notifications: true, Tickets: true,
  Quotes: false, Customers: false, Suppliers: false, Returns: false, "Purchase Orders": false,
  Invoicing: false, Analytics: false, Contracts: false,
};

function loadFeatures(): Record<string, boolean> {
  try {
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      const raw = localStorage.getItem("mobile_features");
      if (raw) return { ...DEFAULT_FEATURES, ...JSON.parse(raw) };
    }
  } catch {}
  return { ...DEFAULT_FEATURES };
}

function Icon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.6 }}>{emoji}</Text>;
}

// Map feature name to tab config
const TAB_MAP: { name: string; feature: string; title: string; emoji: string }[] = [
  { name: "index",           feature: "Dashboard",      title: "Dashboard",  emoji: "⚡" },
  { name: "inventory",       feature: "Inventory",      title: "Inventory",  emoji: "📦" },
  { name: "orders",          feature: "Orders",         title: "Orders",     emoji: "🛒" },
  { name: "shipments",       feature: "Shipments",      title: "Shipments",  emoji: "🚚" },
  { name: "notifications",   feature: "Notifications",  title: "Alerts",     emoji: "🔔" },
  { name: "tickets",         feature: "Tickets",        title: "Tickets",    emoji: "🎫" },
  { name: "quotes",          feature: "Quotes",         title: "Quotes",     emoji: "📋" },
  { name: "customers",       feature: "Customers",      title: "Customers",  emoji: "🤝" },
  { name: "suppliers",       feature: "Suppliers",      title: "Suppliers",  emoji: "🏭" },
  { name: "returns",         feature: "Returns",        title: "Returns",    emoji: "↩️" },
  { name: "purchase-orders", feature: "Purchase Orders",title: "Purchase",   emoji: "📑" },
  { name: "invoicing",       feature: "Invoicing",      title: "Invoicing",  emoji: "🧾" },
  { name: "analytics",       feature: "Analytics",      title: "Analytics",  emoji: "📊" },
  { name: "contracts",       feature: "Contracts",      title: "Contracts",  emoji: "📄" },
  { name: "profile",         feature: "Profile",        title: "Profile",    emoji: "👤" },
];

export default function TabLayout() {
  const [features, setFeatures] = useState(loadFeatures());

  useEffect(() => {
    // Reload on mount in case features changed
    setFeatures(loadFeatures());
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerStyle:            { backgroundColor: theme.surface },
        headerTitleStyle:       { fontWeight: "800", fontSize: 16, color: theme.text },
        headerShadowVisible:    false,
        tabBarStyle:            { backgroundColor: theme.surface, borderTopColor: theme.border, borderTopWidth: 1, height: 64, paddingBottom: 10 },
        tabBarActiveTintColor:   theme.blue,
        tabBarInactiveTintColor: theme.muted,
        tabBarLabelStyle:        { fontSize: 11, fontWeight: "600" },
      }}
    >
      {TAB_MAP.map(tab => {
        const enabled = tab.feature === "Profile" || (features[tab.feature] ?? false);
        return (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title,
              href: enabled ? undefined : null,
              tabBarIcon: ({ focused }) => <Icon emoji={tab.emoji} focused={focused} />,
            }}
          />
        );
      })}
    </Tabs>
  );
}
