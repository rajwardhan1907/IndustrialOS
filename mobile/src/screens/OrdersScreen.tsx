// mobile/src/screens/OrdersScreen.tsx
// View orders grouped by stage + update stage with one tap
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, Platform,
} from "react-native";
import { theme, s } from "../lib/theme";

let Haptics: any = null;
if (Platform.OS !== "web") Haptics = require("expo-haptics");
import { fetchOrders, updateOrderStage, getSession } from "../lib/api";

interface Order {
  id: string; customer: string; sku: string; items: number;
  value: number; stage: string; priority: string; createdAt: string;
}

const STAGES = ["Placed", "Confirmed", "Picking", "Packed", "Shipped", "Delivered"];

const priorityColor = (p: string) =>
  p === "HIGH" ? theme.red : p === "MED" ? theme.amber : theme.green;

function stageColor(stage: string) {
  const i = STAGES.indexOf(stage);
  if (i >= STAGES.length - 1) return { color: theme.green, bg: theme.greenBg, border: theme.greenBorder };
  if (i >= 4) return { color: theme.blue, bg: theme.blueBg, border: theme.blueBorder };
  return { color: theme.amber, bg: theme.amberBg, border: theme.amberBorder };
}

export default function OrdersScreen() {
  const [orders,     setOrders]     = useState<Order[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState("All");
  const [selected,   setSelected]   = useState<Order | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) return;
      const data = await fetchOrders(workspaceId);
      setOrders(data);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const advanceStage = async (order: Order, newStage: string) => {
    try {
      await updateOrderStage(order.id, newStage);
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, stage: newStage } : o));
      setSelected(sel => sel && sel.id === order.id ? { ...sel, stage: newStage } : sel);
      if (Haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const confirmAdvance = (order: Order) => {
    const idx     = STAGES.indexOf(order.stage);
    const next    = STAGES[idx + 1];
    if (!next) return;
    Alert.alert("Move Order", `Mark as "${next}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", onPress: () => advanceStage(order, next) },
    ]);
  };

  const displayed = filter === "All" ? orders : orders.filter(o => o.stage === filter);

  if (loading) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg }}>
      <ActivityIndicator size="large" color={theme.blue} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Stage filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
        {["All", ...STAGES].map(st => {
          const active = filter === st;
          const count  = st === "All" ? orders.length : orders.filter(o => o.stage === st).length;
          return (
            <TouchableOpacity key={st} onPress={() => setFilter(st)}
              style={[styles.chip, active && { backgroundColor: theme.blue, borderColor: theme.blue }]}>
              <Text style={[styles.chipText, active && { color: "#fff" }]}>{st} ({count})</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: 12 }}
        refreshControl={Platform.OS !== "web"
          ? <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.blue} />
          : undefined}
      >
        {displayed.length === 0 && (
          <Text style={{ textAlign: "center", color: theme.muted, marginTop: 40, fontSize: 14 }}>No orders in this stage.</Text>
        )}
        {displayed.map(order => {
          const sc     = stageColor(order.stage);
          const idx    = STAGES.indexOf(order.stage);
          const hasNext = idx < STAGES.length - 1;
          return (
            <TouchableOpacity key={order.id} style={s.card} onPress={() => setSelected(order)} activeOpacity={0.85}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "700", fontSize: 14, color: theme.text }}>{order.customer}</Text>
                  <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>
                    {order.sku} · {order.items} item{order.items !== 1 ? "s" : ""} · ${order.value.toLocaleString()}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <View style={s.badge(sc.bg, sc.color, sc.border)}>
                    <Text style={s.badgeText(sc.color)}>{order.stage}</Text>
                  </View>
                  <View style={s.badge(theme.bg, priorityColor(order.priority), theme.border)}>
                    <Text style={[s.badgeText(priorityColor(order.priority)), { fontSize: 10 }]}>{order.priority}</Text>
                  </View>
                </View>
              </View>
              {hasNext && (
                <TouchableOpacity
                  style={[styles.advBtn, { backgroundColor: sc.bg, borderColor: sc.border }]}
                  onPress={() => confirmAdvance(order)}
                >
                  <Text style={{ color: sc.color, fontWeight: "700", fontSize: 12 }}>
                    → Move to {STAGES[idx + 1]}
                  </Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Order detail bottom sheet */}
      <Modal visible={!!selected} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          {selected && (
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{selected.customer}</Text>
              <Text style={{ color: theme.muted, fontSize: 12, marginBottom: 16 }}>
                {selected.sku} · {selected.items} items · ${selected.value.toLocaleString()}
              </Text>
              <Text style={s.label}>Move to stage</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {STAGES.map(st => {
                    const active = selected.stage === st;
                    return (
                      <TouchableOpacity key={st} onPress={() => !active && advanceStage(selected, st)}
                        style={[styles.stageBtn, active && { backgroundColor: theme.blue, borderColor: theme.blue }]}>
                        <Text style={[{ fontSize: 12, fontWeight: "700", color: theme.muted }, active && { color: "#fff" }]}>{st}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setSelected(null)}>
                <Text style={{ color: theme.muted, fontWeight: "700", fontSize: 14 }}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow:     { maxHeight: 52, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  chip:        { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.bg, marginVertical: 8 },
  chipText:    { fontSize: 12, fontWeight: "600", color: theme.muted },
  advBtn:      { marginTop: 10, padding: 8, borderRadius: 8, borderWidth: 1, alignItems: "center" },
  modalOverlay:{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard:   { backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle:  { fontSize: 18, fontWeight: "800", color: theme.text, marginBottom: 2 },
  stageBtn:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.bg },
  closeBtn:    { borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 14, alignItems: "center" },
});
