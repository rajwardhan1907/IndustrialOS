// mobile/src/screens/OrdersScreen.tsx
// View + advance stage orders + Create Order
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput, Platform,
} from "react-native";
import { theme, s } from "../lib/theme";

let Haptics: any = null;
if (Platform.OS !== "web") Haptics = require("expo-haptics");
import { fetchOrders, updateOrderStage, createOrder, getSession } from "../lib/api";
import { SessionExpiredView } from "../lib/sessionGuard";

interface Order {
  id: string; customer: string; sku: string; items: number;
  value: number; stage: string; priority: string; createdAt: string;
}

const STAGES = ["Placed", "Confirmed", "Picking", "Packed", "Shipped", "Delivered"];
const PRIORITIES = ["LOW", "MED", "HIGH"];

const priorityColor = (p: string) =>
  p === "HIGH" ? theme.red : p === "MED" ? theme.amber : theme.green;

function stageColor(stage: string) {
  const i = STAGES.indexOf(stage);
  if (i >= STAGES.length - 1) return { color: theme.green, bg: theme.greenBg, border: theme.greenBorder };
  if (i >= 4) return { color: theme.blue, bg: theme.blueBg, border: theme.blueBorder };
  return { color: theme.amber, bg: theme.amberBg, border: theme.amberBorder };
}

export default function OrdersScreen() {
  const [orders,      setOrders]      = useState<Order[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [filter,      setFilter]      = useState("All");
  const [selected,    setSelected]    = useState<Order | null>(null);
  // Create Order state
  const [showNew,     setShowNew]     = useState(false);
  const [newCustomer, setNewCustomer] = useState("");
  const [newSku,      setNewSku]      = useState("");
  const [newQty,      setNewQty]      = useState("");
  const [newPriority, setNewPriority] = useState("MED");
  const [creating,    setCreating]    = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) { setSessionExpired(true); return; }
      const data = await fetchOrders(workspaceId);
      setOrders(data);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (sessionExpired) return <SessionExpiredView />;

  const advanceStage = async (order: Order, newStage: string) => {
    try {
      await updateOrderStage(order.id, newStage);
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, stage: newStage } : o));
      setSelected(sel => (sel && sel.id === order.id) ? { ...sel, stage: newStage } : sel);
      if (Haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const confirmAdvance = (order: Order) => {
    const idx  = STAGES.indexOf(order.stage);
    const next = STAGES[idx + 1];
    if (!next) return;
    Alert.alert("Move Order", `Mark as "${next}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", onPress: () => advanceStage(order, next) },
    ]);
  };

  const submitNew = async () => {
    if (!newCustomer.trim()) { Alert.alert("Required", "Customer name is required."); return; }
    if (!newSku.trim())      { Alert.alert("Required", "SKU is required."); return; }
    const qty = parseInt(newQty, 10);
    if (isNaN(qty) || qty < 1) { Alert.alert("Required", "Enter a valid quantity."); return; }
    setCreating(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) { setSessionExpired(true); return; }
      const order = await createOrder({
        workspaceId, customer: newCustomer.trim(), sku: newSku.trim(),
        items: qty, priority: newPriority, stage: "Placed",
      });
      setOrders(prev => [order, ...prev]);
      setShowNew(false);
      setNewCustomer(""); setNewSku(""); setNewQty(""); setNewPriority("MED");
      Alert.alert("Created", `Order for ${order.customer} created.`);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setCreating(false); }
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
                    {order.sku} · {order.items} item{order.items !== 1 ? "s" : ""} · ${order.value ? order.value.toLocaleString() : "—"}
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

      {/* FAB */}
      <TouchableOpacity onPress={() => setShowNew(true)} style={styles.fab}>
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "300" }}>+</Text>
      </TouchableOpacity>

      {/* Order detail bottom sheet */}
      <Modal visible={!!selected} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          {selected && (
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{selected.customer}</Text>
              <Text style={{ color: theme.muted, fontSize: 12, marginBottom: 16 }}>
                {selected.sku} · {selected.items} items · ${selected.value ? selected.value.toLocaleString() : "—"}
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

      {/* Create Order Modal */}
      <Modal visible={showNew} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <Text style={styles.modalTitle}>New Order</Text>
              <TouchableOpacity onPress={() => setShowNew(false)}>
                <Text style={{ fontSize: 20, color: theme.muted }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.label}>CUSTOMER NAME *</Text>
            <TextInput value={newCustomer} onChangeText={setNewCustomer}
              placeholder="e.g. Acme Corp" placeholderTextColor={theme.subtle}
              style={styles.input} />
            <Text style={s.label}>SKU *</Text>
            <TextInput value={newSku} onChangeText={setNewSku}
              placeholder="e.g. SKU-001" placeholderTextColor={theme.subtle}
              style={styles.input} />
            <Text style={s.label}>QUANTITY *</Text>
            <TextInput value={newQty} onChangeText={setNewQty}
              placeholder="0" placeholderTextColor={theme.subtle}
              keyboardType="number-pad" style={styles.input} />
            <Text style={s.label}>PRIORITY</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 20, marginTop: 4 }}>
              {PRIORITIES.map(p => (
                <TouchableOpacity key={p} onPress={() => setNewPriority(p)}
                  style={[styles.chip, newPriority === p && { backgroundColor: theme.blue, borderColor: theme.blue }]}>
                  <Text style={[styles.chipText, newPriority === p && { color: "#fff" }]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={submitNew} disabled={creating}
              style={{ backgroundColor: theme.blue, borderRadius: 10, padding: 14, alignItems: "center", opacity: creating ? 0.6 : 1 }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{creating ? "Creating…" : "Create Order"}</Text>
            </TouchableOpacity>
          </View>
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
  fab:         { position: "absolute", bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.blue, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 6 },
  modalOverlay:{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard:   { backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle:  { fontSize: 18, fontWeight: "800", color: theme.text },
  stageBtn:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.bg },
  closeBtn:    { borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 14, alignItems: "center" },
  input:       { borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 10, color: theme.text, fontSize: 13, backgroundColor: theme.bg, marginBottom: 12, marginTop: 4 },
});
