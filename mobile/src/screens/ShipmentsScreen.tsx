// mobile/src/screens/ShipmentsScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, Platform,
} from "react-native";
import { theme, s } from "../lib/theme";

let Haptics: any = null;
if (Platform.OS !== "web") Haptics = require("expo-haptics");
import { fetchShipments, updateShipmentStatus, getSession } from "../lib/api";

interface Shipment {
  id: string; shipmentNumber: string; customer: string; carrier: string;
  trackingNumber: string; status: string; origin: string; destination: string;
  estimatedDate: string; deliveredDate: string; createdAt: string;
}

const STATUS_FLOW = ["pending", "picked_up", "in_transit", "out_for_delivery", "delivered"];

function statusBadge(status: string) {
  if (status === "delivered")        return { label: "Delivered",       color: theme.green, bg: theme.greenBg, border: theme.greenBorder };
  if (status === "out_for_delivery") return { label: "Out for Delivery", color: theme.blue, bg: theme.blueBg, border: theme.blueBorder };
  if (status === "in_transit")       return { label: "In Transit",       color: theme.blue, bg: theme.blueBg, border: theme.blueBorder };
  if (status === "picked_up")        return { label: "Picked Up",        color: theme.amber, bg: theme.amberBg, border: theme.amberBorder };
  return                                    { label: "Pending",          color: theme.muted, bg: theme.bg, border: theme.border };
}

export default function ShipmentsScreen() {
  const [shipments,  setShipments]  = useState<Shipment[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState("All");
  const [selected,   setSelected]   = useState<Shipment | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) return;
      const data = await fetchShipments(workspaceId);
      setShipments(data);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const advanceStatus = async (ship: Shipment, newStatus: string) => {
    try {
      await updateShipmentStatus(ship.id, newStatus);
      setShipments(prev => prev.map(s => s.id === ship.id ? { ...s, status: newStatus } : s));
      setSelected(sel => sel && sel.id === ship.id ? { ...sel, status: newStatus } : sel);
      if (Haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const filterKeys = ["All", ...STATUS_FLOW];
  const displayed  = filter === "All" ? shipments : shipments.filter(s => s.status === filter);

  if (loading) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg }}>
      <ActivityIndicator size="large" color={theme.blue} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
        {filterKeys.map(k => {
          const active = filter === k;
          const count  = k === "All" ? shipments.length : shipments.filter(s => s.status === k).length;
          const label  = k === "All" ? "All" : statusBadge(k).label;
          return (
            <TouchableOpacity key={k} onPress={() => setFilter(k)}
              style={[styles.chip, active && { backgroundColor: theme.blue, borderColor: theme.blue }]}>
              <Text style={[styles.chipText, active && { color: "#fff" }]}>{label} ({count})</Text>
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
          <Text style={{ textAlign: "center", color: theme.muted, marginTop: 40, fontSize: 14 }}>No shipments in this status.</Text>
        )}
        {displayed.map(ship => {
          const badge  = statusBadge(ship.status);
          const idx    = STATUS_FLOW.indexOf(ship.status);
          const hasNext = idx >= 0 && idx < STATUS_FLOW.length - 1;
          return (
            <TouchableOpacity key={ship.id} style={s.card} onPress={() => setSelected(ship)} activeOpacity={0.85}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "700", fontSize: 14, color: theme.text }}>{ship.shipmentNumber}</Text>
                  <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>
                    {ship.customer} · {ship.carrier || "—"}
                  </Text>
                  {ship.trackingNumber ? (
                    <Text style={{ fontSize: 11, color: theme.subtle, marginTop: 2 }}>Track: {ship.trackingNumber}</Text>
                  ) : null}
                </View>
                <View style={s.badge(badge.bg, badge.color, badge.border)}>
                  <Text style={s.badgeText(badge.color)}>{badge.label}</Text>
                </View>
              </View>
              {ship.destination ? (
                <Text style={{ fontSize: 12, color: theme.muted, marginTop: 8 }}>
                  {ship.origin ? `${ship.origin} → ` : ""}{ship.destination}
                </Text>
              ) : null}
              {hasNext && (
                <TouchableOpacity
                  style={[styles.advBtn, { backgroundColor: badge.bg, borderColor: badge.border }]}
                  onPress={() => Alert.alert("Update Status", `Mark as "${statusBadge(STATUS_FLOW[idx + 1]).label}"?`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Confirm", onPress: () => advanceStatus(ship, STATUS_FLOW[idx + 1]) },
                  ])}
                >
                  <Text style={{ color: badge.color, fontWeight: "700", fontSize: 12 }}>
                    → Mark as {statusBadge(STATUS_FLOW[idx + 1]).label}
                  </Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Modal visible={!!selected} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          {selected && (
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{selected.shipmentNumber}</Text>
              <Text style={{ color: theme.muted, fontSize: 12, marginBottom: 12 }}>
                {selected.customer} · {selected.carrier || "No carrier"} · {selected.trackingNumber || "No tracking"}
              </Text>
              {selected.origin ? (
                <Text style={{ fontSize: 13, color: theme.text, marginBottom: 4 }}>
                  {selected.origin} → {selected.destination}
                </Text>
              ) : null}
              {selected.estimatedDate ? (
                <Text style={{ fontSize: 12, color: theme.muted, marginBottom: 16 }}>ETA: {selected.estimatedDate}</Text>
              ) : null}
              <Text style={s.label}>Update Status</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {STATUS_FLOW.map(st => {
                    const b      = statusBadge(st);
                    const active = selected.status === st;
                    return (
                      <TouchableOpacity key={st} onPress={() => !active && advanceStatus(selected, st)}
                        style={[styles.stageBtn, active && { backgroundColor: theme.blue, borderColor: theme.blue }]}>
                        <Text style={[{ fontSize: 11, fontWeight: "700", color: theme.muted }, active && { color: "#fff" }]}>{b.label}</Text>
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
