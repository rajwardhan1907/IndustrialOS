// mobile/src/screens/AccountingScreen.tsx
// QuickBooks & Xero integration status — mirrors the web accounting panel.
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, StyleSheet, Alert,
} from "react-native";
import { theme, s } from "../lib/theme";
import { fetchAccountingStatus, getSession } from "../lib/api";
import { SessionExpiredView } from "../lib/sessionGuard";

interface ProviderStatus {
  connected: boolean;
  available: boolean;
}

interface AccountingStatus {
  quickbooks: ProviderStatus;
  xero: ProviderStatus;
}

const PROVIDERS = [
  { key: "quickbooks", name: "QuickBooks", emoji: "📊", desc: "Invoice & accounting sync" },
  { key: "xero",       name: "Xero",       emoji: "🔷", desc: "Cloud accounting platform" },
] as const;

export default function AccountingScreen() {
  const [status,         setStatus]         = useState<AccountingStatus | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) { setSessionExpired(true); return; }
      const data = await fetchAccountingStatus(workspaceId);
      setStatus(data);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (sessionExpired) return <SessionExpiredView />;
  if (loading) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg }}>
      <ActivityIndicator size="large" color={theme.blue} />
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.blue} />}
    >
      <Text style={[s.heading, { marginBottom: 4 }]}>Accounting</Text>
      <Text style={{ fontSize: 13, color: theme.muted, marginBottom: 20 }}>
        Connect your accounting platform to sync invoices automatically.
      </Text>

      {/* API key required notice */}
      <View style={styles.notice}>
        <Text style={{ fontSize: 13, color: "#92400e", lineHeight: 18 }}>
          🔑 Connecting requires OAuth credentials configured in the server environment.
          Contact your administrator if you need to link an accounting platform.
        </Text>
      </View>

      {PROVIDERS.map(p => {
        const info: ProviderStatus | undefined = status?.[p.key as "quickbooks" | "xero"];
        const connected = info?.connected ?? false;
        const available = info?.available ?? false;

        return (
          <View key={p.key} style={styles.card}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
              <View style={styles.iconBox}>
                <Text style={{ fontSize: 26 }}>{p.emoji}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: theme.text }}>{p.name}</Text>
                <Text style={{ fontSize: 12, color: theme.muted }}>{p.desc}</Text>
              </View>
              <StatusBadge connected={connected} />
            </View>

            {/* Info rows */}
            <InfoRow label="OAuth credentials" value={available ? "Configured" : "Not configured"} ok={available} />
            <InfoRow label="Invoice sync" value={connected ? "Active" : "Inactive"} ok={connected} />
            <InfoRow label="Last sync" value={connected ? "Recently" : "—"} ok={connected} />

            {/* Action */}
            <TouchableOpacity
              style={[styles.actionBtn, connected && styles.actionBtnDestructive]}
              onPress={() =>
                Alert.alert(
                  connected ? "Disconnect" : "Connect",
                  connected
                    ? `Disconnect ${p.name}? Invoice sync will stop.`
                    : `To connect ${p.name}, configure OAuth credentials in the server environment and use the web dashboard to authorize.`,
                  [{ text: "OK" }],
                )
              }
            >
              <Text style={[styles.actionBtnText, connected && { color: theme.red }]}>
                {connected ? "Disconnect" : available ? "Connect via Web" : "Requires Setup"}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}

      {/* CRM integrations heading */}
      <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text, marginTop: 8, marginBottom: 12 }}>CRM Integrations</Text>
      {[
        { name: "Salesforce", emoji: "☁️", desc: "Sales Cloud"     },
        { name: "HubSpot",    emoji: "🧲", desc: "Marketing + CRM" },
        { name: "Zoho CRM",   emoji: "🔧", desc: "Operations CRM"  },
      ].map((crm, i) => (
        <View key={i} style={[styles.card, { flexDirection: "row", alignItems: "center" }]}>
          <Text style={{ fontSize: 24, marginRight: 12 }}>{crm.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text }}>{crm.name}</Text>
            <Text style={{ fontSize: 12, color: theme.muted }}>{crm.desc}</Text>
          </View>
          <View style={styles.comingSoon}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: theme.muted }}>Coming Soon</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <View style={[styles.badge, { backgroundColor: connected ? theme.greenBg : "#f0f0f0", borderColor: connected ? theme.greenBorder : theme.border }]}>
      <Text style={{ fontSize: 10, fontWeight: "700", color: connected ? theme.green : theme.muted }}>
        {connected ? "CONNECTED" : "DISCONNECTED"}
      </Text>
    </View>
  );
}

function InfoRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.border }}>
      <Text style={{ fontSize: 12, color: theme.muted }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: "600", color: ok ? theme.green : theme.muted }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice:              { backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#f59e0b", borderRadius: 10, padding: 12, marginBottom: 16 },
  card:                { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 16, marginBottom: 12 },
  iconBox:             { width: 48, height: 48, backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.border, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  badge:               { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  actionBtn:           { marginTop: 12, padding: 12, backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.border, borderRadius: 8, alignItems: "center" },
  actionBtnDestructive:{ borderColor: theme.redBorder, backgroundColor: theme.redBg },
  actionBtnText:       { fontSize: 13, fontWeight: "700", color: theme.muted },
  comingSoon:          { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.border, borderRadius: 6 },
});
