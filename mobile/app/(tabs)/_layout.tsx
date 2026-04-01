// mobile/app/(tabs)/_layout.tsx — Bottom tab bar
import React from "react";
import { Tabs } from "expo-router";
import { Text } from "react-native";
import { theme } from "../../src/lib/theme";

function Icon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.6 }}>{emoji}</Text>;
}

export default function TabLayout() {
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
      <Tabs.Screen
        name="index"
        options={{
          title:    "Dashboard",
          tabBarIcon: ({ focused }) => <Icon emoji="⚡" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title:    "Inventory",
          tabBarIcon: ({ focused }) => <Icon emoji="📦" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title:    "Orders",
          tabBarIcon: ({ focused }) => <Icon emoji="🛒" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="shipments"
        options={{
          title:    "Shipments",
          tabBarIcon: ({ focused }) => <Icon emoji="🚚" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title:    "Alerts",
          tabBarIcon: ({ focused }) => <Icon emoji="🔔" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
