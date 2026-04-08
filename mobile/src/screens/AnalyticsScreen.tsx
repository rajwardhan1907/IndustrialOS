// mobile/src/screens/AnalyticsScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView,
  RefreshControl, ActivityIndicator, Alert,
} from "react-native";
import { theme, s } from "../lib/theme";
import { fetchAnalytics, getSession } from "../lib/api";
import { SessionExpiredView } from "../lib/sessionGuard";

interface MetricCard {
  label: string;
  value: string | number;
  color: string;
  emoji: string;
}

export default function AnalyticsScreen() {
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) { setSessionExpired(true); return; }
      const data = await fetchAnalytics(workspaceId);
      const m = data.met || {};
      const cards: MetricCard[] = [
        { label: "Active Orders",  value: m.activeOrders ?? 0,      color: theme.blue,   emoji: "🛒" },
        { label: "Revenue (30d)",  value: `$${(m.rev || 0).toLocaleString()}`, color: theme.green,  emoji: "💵" },
        { label: "Total SKUs",     value: m.skus ?? 0,              color: theme.amber,  emoji: "📦" },
        { label: "Processing Queue", value: m.queue ?? 0,           color: theme.purple, emoji: "⏳" },
        { label: "Orders/Month",   value: m.opm ?? 0,               color: theme.blue,   emoji: "📊" },
        { label: "Sync Status",    value: m.sync === "ok" ? "✓ OK" : "⚠ Error", color: m.sync === "ok" ? theme.green : theme.red, emoji: "🔄" },
      ];
      setMetrics(cards);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (sessionExpired) return <SessionExpiredView />;

  if (loading) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg }}><ActivityIndicator size="large" color={theme.blue} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.blue} />}
      >
        <Text style={[s.heading, { marginBottom: 16 }]}>Analytics</Text>
        {metrics.length === 0 ? (
          <View style={[s.card, { alignItems: "center", padding: 32 }]}>
            <Text style={{ color: theme.muted, fontSize: 13 }}>No data available yet.</Text>
          </View>
        ) : (
          <View style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {metrics.map((m, i) => (
              <View key={i} style={[s.card, { paddingVertical: 20 }]}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: theme.muted, fontWeight: "700", marginBottom: 4 }}>{m.emoji} {m.label}</Text>
                    <Text style={{ fontSize: 20, fontWeight: "800", color: m.color }}>
                      {typeof m.value === "number" ? m.value.toLocaleString() : m.value}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
