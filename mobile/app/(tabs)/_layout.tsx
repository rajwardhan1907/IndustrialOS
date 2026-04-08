// mobile/app/(tabs)/_layout.tsx — Dynamic bottom tab bar
// FIX 2: async feature load via SecureStore (native) / localStorage (web)
// FIX 3: AppState listener so toggling features in Profile refreshes tabs when foregrounded
// FIX 7: featureEmitter listener for immediate refresh when Profile saves toggles
import React, { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { Text, Platform, AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import { theme } from "../../src/lib/theme";
import featureEmitter from "../../src/lib/featureEvents";

const FEATURES_KEY = "mobile_features";

// All tabs enabled by default — matches web app behaviour
const DEFAULT_FEATURES: Record<string, boolean> = {
  Dashboard: true, Orders: true, Inventory: true, Shipments: true,
  Notifications: true, Tickets: true,
  Quotes: true, Customers: true, Suppliers: true, Returns: true, "Purchase Orders": true,
  Invoicing: true, Analytics: true, Contracts: true,
};

async function loadFeatures(): Promise<Record<string, boolean>> {
  try {
    let raw: string | null = null;
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") raw = localStorage.getItem(FEATURES_KEY);
    } else {
      raw = await SecureStore.getItemAsync(FEATURES_KEY);
    }
    if (raw) return { ...DEFAULT_FEATURES, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_FEATURES };
}

function Icon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.6 }}>{emoji}</Text>;
}

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
  const [features, setFeatures] = useState<Record<string, boolean>>(DEFAULT_FEATURES);

  useEffect(() => {
    // Initial load
    loadFeatures().then(setFeatures);

    // Reload whenever the app comes back to the foreground
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        loadFeatures().then(setFeatures);
      }
    });

    // Reload immediately when ProfileScreen saves feature toggles
    const onFeaturesChanged = () => { loadFeatures().then(setFeatures); };
    featureEmitter.on("featuresChanged", onFeaturesChanged);

    return () => {
      appStateSub.remove();
      featureEmitter.off("featuresChanged", onFeaturesChanged);
    };
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
