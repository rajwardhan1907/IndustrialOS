// mobile/src/screens/DashboardScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from "react-native";
import { theme, s } from "../lib/theme";
import { fetchDashboard, getSession } from "../lib/api";

interface Metric { label: string; value: string | number; sub?: string }
interface Alert  { id: string; title: string; type: string; time: string }

export default function DashboardScreen() {
  const [metrics,     setMetrics]     = useState<Metric[]>([]);
  const [alerts,      setAlerts]      = useState<Alert[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState("");
  const [companyName, setCompanyName] = useState("IndustrialOS");

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) { setError("Not logged in"); return; }
      const data = await fetchDashboard(workspaceId);
      setMetrics([
        { label: "Open Orders",      value: data.openOrders      ?? 0, sub: "awaiting fulfilment" },
        { label: "Low Stock Items",  value: data.lowStockItems   ?? 0, sub: "need reorder"        },
        { label: "Pending Invoices", value: data.pendingInvoices ?? 0, sub: "unpaid"              },
        { label: "Revenue (30d)",    value: `$${(data.revenue30d ?? 0).toLocaleString()}`, sub: "last 30 days" },
      ]);
      setAlerts(data.alerts ?? []);
      setCompanyName(data.companyName ?? "IndustrialOS");
    } catch (e: any) {
      setError(e.message ?? "Failed to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const alertColor = (type: string) => {
    if (type === "critical" || type === "error") return theme.red;
    if (type === "warning")                      return theme.amber;
    return theme.blue;
  };
  const alertBg = (type: string) => {
    if (type === "critical" || type === "error") return theme.redBg;
    if (type === "warning")                      return theme.amberBg;
    return theme.blueBg;
  };

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
      <Text style={styles.heading}>{companyName}</Text>
      <Text style={styles.sub}>Dashboard overview</Text>

      {error ? (
        <View style={[s.card, { backgroundColor: theme.redBg, borderColor: theme.redBorder, borderWidth: 1 }]}>
          <Text style={{ color: theme.red, fontSize: 13 }}>{error}</Text>
          <TouchableOpacity onPress={() => load()} style={{ marginTop: 10 }}>
            <Text style={{ color: theme.blue, fontWeight: "700", fontSize: 13 }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── Metrics grid ── */}
      <View style={styles.grid}>
        {metrics.map((m, i) => (
          <View key={i} style={styles.metricCard}>
            <Text style={styles.metricValue}>{m.value}</Text>
            <Text style={styles.metricLabel}>{m.label}</Text>
            {m.sub ? <Text style={styles.metricSub}>{m.sub}</Text> : null}
          </View>
        ))}
      </View>

      {/* ── Alerts ── */}
      {alerts.length > 0 && (
        <>
          <Text style={[s.heading, { marginTop: 8, marginBottom: 10 }]}>Active Alerts</Text>
          {alerts.slice(0, 10).map((a, i) => (
            <View key={i} style={[s.card, { backgroundColor: alertBg(a.type), borderWidth: 1, borderColor: alertColor(a.type) + "44", marginBottom: 8 }]}>
              <Text style={{ fontWeight: "700", fontSize: 13, color: alertColor(a.type) }}>{a.title}</Text>
              <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>{a.time}</Text>
            </View>
          ))}
        </>
      )}

      {alerts.length === 0 && !error && (
        <View style={[s.card, { backgroundColor: theme.greenBg, borderWidth: 1, borderColor: theme.greenBorder }]}>
          <Text style={{ color: theme.green, fontWeight: "700", fontSize: 13 }}>✓ All systems normal — no alerts</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  heading:     { fontSize: 22, fontWeight: "800", color: theme.text, marginBottom: 2 },
  sub:         { fontSize: 13, color: theme.muted, marginBottom: 18 },
  grid:        { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 18 },
  metricCard:  { flex: 1, minWidth: "45%", backgroundColor: theme.surface, borderRadius: 14, padding: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 5, elevation: 2 },
  metricValue: { fontSize: 28, fontWeight: "800", color: theme.blue, marginBottom: 4 },
  metricLabel: { fontSize: 12, fontWeight: "600", color: theme.text },
  metricSub:   { fontSize: 11, color: theme.muted, marginTop: 2 },
});
