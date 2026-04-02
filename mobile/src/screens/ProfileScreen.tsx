// mobile/src/screens/ProfileScreen.tsx
// FIX 2: async feature load/save via SecureStore (native) / localStorage (web)
import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Switch, Alert, Platform,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { theme, s } from "../lib/theme";
import { getSession, clearSession } from "../lib/api";
import ChangePasswordScreen from "./ChangePasswordScreen";

const FEATURES_KEY = "mobile_features";

const DEFAULT_FEATURES: Record<string, boolean> = {
  Dashboard: true, Orders: true, Inventory: true, Shipments: true,
  Notifications: true, Tickets: true,
  Quotes: false, Customers: false, Suppliers: false, Returns: false, "Purchase Orders": false,
  Invoicing: false, Analytics: false, Contracts: false,
};

const HIGH_PRIORITY = ["Dashboard", "Orders", "Inventory", "Shipments", "Notifications", "Tickets"];

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

async function saveFeatures(f: Record<string, boolean>): Promise<void> {
  try {
    const val = JSON.stringify(f);
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") localStorage.setItem(FEATURES_KEY, val);
    } else {
      await SecureStore.setItemAsync(FEATURES_KEY, val);
    }
  } catch {}
}

interface Props {
  onLogout: () => void;
}

export default function ProfileScreen({ onLogout }: Props) {
  const [session,       setSession]       = useState<any>({});
  const [features,      setFeatures]      = useState<Record<string, boolean>>(DEFAULT_FEATURES);
  const [showChangePwd, setShowChangePwd] = useState(false);

  useEffect(() => {
    getSession().then(setSession);
    loadFeatures().then(setFeatures);
  }, []);

  const toggleFeature = (name: string) => {
    if (HIGH_PRIORITY.includes(name)) return;
    setFeatures(prev => {
      const next = { ...prev, [name]: !prev[name] };
      saveFeatures(next); // fire-and-forget async save
      return next;
    });
  };

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: () => { clearSession(); onLogout(); } },
    ]);
  };

  if (showChangePwd) {
    return <ChangePasswordScreen onBack={() => setShowChangePwd(false)} />;
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16 }}>
      {/* Account info */}
      <View style={[s.card, { marginBottom: 16 }]}>
        <View style={styles.avatar}>
          <Text style={{ fontSize: 24, fontWeight: "800", color: theme.blue }}>
            {session.name ? session.name[0].toUpperCase() : "?"}
          </Text>
        </View>
        <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text, textAlign: "center", marginTop: 10 }}>
          {session.name ?? "—"}
        </Text>
        <Text style={{ fontSize: 13, color: theme.muted, textAlign: "center", marginTop: 4 }}>
          {session.email ?? "—"}
        </Text>
        <View style={[styles.roleBadge, { marginTop: 10, alignSelf: "center" }]}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: theme.blue }}>
            {(session.role ?? "operator").toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Change Password */}
      <TouchableOpacity style={[s.card, styles.row, { marginBottom: 16 }]} onPress={() => setShowChangePwd(true)}>
        <Text style={{ fontSize: 14, color: theme.text, fontWeight: "600" }}>🔑 Change Password</Text>
        <Text style={{ color: theme.muted, fontSize: 18 }}>›</Text>
      </TouchableOpacity>

      {/* Feature Settings */}
      <Text style={[s.heading, { marginBottom: 12 }]}>Feature Settings</Text>
      {Object.entries(features).map(([name, enabled]) => {
        const locked = HIGH_PRIORITY.includes(name);
        return (
          <View key={name} style={[s.card, { marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: theme.text }}>
                {locked ? "🔒 " : ""}{name}
              </Text>
              {locked && <Text style={{ fontSize: 11, color: theme.subtle, marginTop: 2 }}>Always enabled</Text>}
            </View>
            <Switch
              value={enabled}
              onValueChange={() => toggleFeature(name)}
              disabled={locked}
              trackColor={{ false: theme.border, true: theme.blue }}
              thumbColor="#fff"
            />
          </View>
        );
      })}

      {/* Log Out */}
      <TouchableOpacity onPress={handleLogout} style={[styles.logoutBtn, { marginTop: 20, marginBottom: 40 }]}>
        <Text style={{ color: theme.red, fontWeight: "700", fontSize: 14 }}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  avatar:    { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.blueBg, borderWidth: 2, borderColor: theme.blueBorder, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 4, backgroundColor: theme.blueBg, borderRadius: 999, borderWidth: 1, borderColor: theme.blueBorder },
  row:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logoutBtn: { padding: 14, backgroundColor: theme.redBg, borderRadius: 10, borderWidth: 1, borderColor: theme.redBorder, alignItems: "center" },
});
