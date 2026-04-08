// mobile/src/screens/PurchaseOrdersScreen.tsx
// View POs + approve/reject + Create PO
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput,
} from "react-native";
import { theme, s } from "../lib/theme";
import { fetchPurchaseOrders, updatePOApproval, createPurchaseOrder, getSession } from "../lib/api";
import { SessionExpiredView } from "../lib/sessionGuard";

interface PurchaseOrder {
  id: string; poNumber: string; supplierName: string; total: number;
  status: string; expectedDate?: string; approvalStatus?: string;
}

function statusColor(st: string) {
  if (st === "draft")    return { color: theme.blue,   bg: theme.blueBg,   border: theme.blueBorder   };
  if (st === "sent")     return { color: theme.amber,  bg: theme.amberBg,  border: theme.amberBorder  };
  if (st === "received") return { color: theme.green,  bg: theme.greenBg,  border: theme.greenBorder  };
  return                         { color: theme.muted,  bg: theme.bg,       border: theme.border       };
}

export default function PurchaseOrdersScreen() {
  const [orders,     setOrders]     = useState<PurchaseOrder[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [selected,   setSelected]   = useState<PurchaseOrder | null>(null);
  // New PO state
  const [showNew,    setShowNew]    = useState(false);
  const [newSupplier,setNewSupplier]= useState("");
  const [newSku,     setNewSku]     = useState("");
  const [newQty,     setNewQty]     = useState("1");
  const [newPrice,   setNewPrice]   = useState("");
  const [newExpected,setNewExpected]= useState("");
  const [newNotes,   setNewNotes]   = useState("");
  const [creating,   setCreating]   = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) { setSessionExpired(true); return; }
      const data = await fetchPurchaseOrders(workspaceId);
      setOrders(Array.isArray(data) ? data : []);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (sessionExpired) return <SessionExpiredView />;

  const submitNew = async () => {
    if (!newSupplier.trim()) { Alert.alert("Required", "Supplier name is required."); return; }
    if (!newSku.trim())      { Alert.alert("Required", "SKU is required."); return; }
    const qty   = parseInt(newQty, 10) || 1;
    const price = parseFloat(newPrice) || 0;
    const total = qty * price;
    setCreating(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) { setSessionExpired(true); return; }
      const poNumber = "PO-" + Date.now();
      const po = await createPurchaseOrder({
        workspaceId, poNumber, supplierName: newSupplier.trim(), supplierId: "",
        items: [{ sku: newSku.trim(), qty, unitPrice: price }],
        subtotal: total, total,
        expectedDate: newExpected.trim() || undefined,
        notes: newNotes.trim() || undefined,
        status: "draft", approvalStatus: "pending",
      });
      setOrders(prev => [po, ...prev]);
      setShowNew(false);
      setNewSupplier(""); setNewSku(""); setNewQty("1"); setNewPrice(""); setNewExpected(""); setNewNotes("");
      Alert.alert("Created", `PO ${po.poNumber} created.`);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setCreating(false); }
  };

  if (loading) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg }}><ActivityIndicator size="large" color={theme.blue} /></View>;

  if (selected) {
    const st = statusColor(selected.status);
    const canApprove = selected.approvalStatus === "pending";

    const approve = async () => {
      try {
        const { userId } = await getSession();
        await updatePOApproval(selected.id, "approved", userId ?? undefined);
        const updated = { ...selected, approvalStatus: "approved" };
        setSelected(updated);
        setOrders(prev => prev.map(o => o.id === selected.id ? updated : o));
      } catch (e: any) { Alert.alert("Error", e.message); }
    };

    const reject = async () => {
      try {
        const { userId } = await getSession();
        await updatePOApproval(selected.id, "rejected", userId ?? undefined);
        const updated = { ...selected, approvalStatus: "rejected" };
        setSelected(updated);
        setOrders(prev => prev.map(o => o.id === selected.id ? updated : o));
      } catch (e: any) { Alert.alert("Error", e.message); }
    };

    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 16, paddingBottom: 0 }}>
          <Text style={{ color: theme.blue, fontWeight: "700", fontSize: 14 }}>← All POs</Text>
        </TouchableOpacity>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={s.card}>
            <Text style={{ fontSize: 11, color: theme.muted, fontWeight: "700", marginBottom: 4 }}>{selected.poNumber}</Text>
            <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text, marginBottom: 12 }}>{selected.supplierName}</Text>
            <Text style={{ fontSize: 20, fontWeight: "800", color: theme.green, marginBottom: 12 }}>${selected.total ? selected.total.toLocaleString() : "0"}</Text>
            <View style={s.badge(st.bg, st.color, st.border)}><Text style={s.badgeText(st.color)}>{selected.status.toUpperCase()}</Text></View>
            {selected.expectedDate ? (
              <Text style={{ fontSize: 12, color: theme.muted, marginTop: 10 }}>Expected: {new Date(selected.expectedDate).toLocaleDateString()}</Text>
            ) : null}
            {selected.approvalStatus ? (
              <Text style={{ fontSize: 12, color: theme.muted, marginTop: 6 }}>Approval: {selected.approvalStatus}</Text>
            ) : null}
          </View>
          {canApprove ? (
            <>
              <TouchableOpacity onPress={approve} style={[s.card, { backgroundColor: theme.greenBg, borderColor: theme.greenBorder, borderWidth: 1, marginTop: 16, marginBottom: 8 }]}>
                <Text style={{ color: theme.green, fontWeight: "700", fontSize: 14 }}>✓ Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={reject} style={[s.card, { backgroundColor: theme.redBg, borderColor: theme.redBorder, borderWidth: 1 }]}>
                <Text style={{ color: theme.red, fontWeight: "700", fontSize: 14 }}>✗ Reject</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.blue} />}
      >
        <Text style={[s.heading, { marginBottom: 16 }]}>Purchase Orders</Text>
        {orders.length === 0 ? (
          <View style={[s.card, { alignItems: "center", padding: 32 }]}>
            <Text style={{ color: theme.muted, fontSize: 13 }}>No purchase orders found. Tap + to create one.</Text>
          </View>
        ) : orders.map(o => {
          const st = statusColor(o.status);
          return (
            <TouchableOpacity key={o.id} style={[s.card, { marginBottom: 10 }]} onPress={() => setSelected(o)} activeOpacity={0.85}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <Text style={{ fontSize: 11, color: theme.muted, fontWeight: "700" }}>{o.poNumber}</Text>
                <View style={s.badge(st.bg, st.color, st.border)}><Text style={s.badgeText(st.color)}>{o.status.toUpperCase()}</Text></View>
              </View>
              <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text, marginBottom: 4 }}>{o.supplierName}</Text>
              <Text style={{ fontSize: 13, fontWeight: "700", color: theme.green }}>${o.total ? o.total.toLocaleString() : "0"}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity onPress={() => setShowNew(true)} style={styles.fab}>
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "300" }}>+</Text>
      </TouchableOpacity>

      {/* Create PO Modal */}
      <Modal visible={showNew} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
            <View style={styles.modalCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <Text style={styles.modalTitle}>New Purchase Order</Text>
                <TouchableOpacity onPress={() => setShowNew(false)}>
                  <Text style={{ fontSize: 20, color: theme.muted }}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.label}>SUPPLIER *</Text>
              <TextInput style={styles.input} value={newSupplier} onChangeText={setNewSupplier}
                placeholder="Supplier name" placeholderTextColor={theme.subtle} />
              <Text style={s.label}>SKU *</Text>
              <TextInput style={styles.input} value={newSku} onChangeText={setNewSku}
                placeholder="e.g. SKU-001" placeholderTextColor={theme.subtle} />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>QTY</Text>
                  <TextInput style={styles.input} value={newQty} onChangeText={setNewQty}
                    keyboardType="number-pad" placeholder="1" placeholderTextColor={theme.subtle} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>UNIT PRICE ($)</Text>
                  <TextInput style={styles.input} value={newPrice} onChangeText={setNewPrice}
                    keyboardType="numeric" placeholder="0.00" placeholderTextColor={theme.subtle} />
                </View>
              </View>
              {newQty && newPrice ? (
                <Text style={{ fontSize: 13, color: theme.green, fontWeight: "700", marginBottom: 12 }}>
                  Total: ${((parseInt(newQty, 10) || 0) * (parseFloat(newPrice) || 0)).toLocaleString()}
                </Text>
              ) : null}
              <Text style={s.label}>EXPECTED DATE (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} value={newExpected} onChangeText={setNewExpected}
                placeholder="e.g. 2026-05-01" placeholderTextColor={theme.subtle} />
              <Text style={s.label}>NOTES</Text>
              <TextInput style={[styles.input, { minHeight: 60 }]} value={newNotes} onChangeText={setNewNotes}
                placeholder="Optional notes…" placeholderTextColor={theme.subtle} multiline />
              <TouchableOpacity onPress={submitNew} disabled={creating}
                style={{ backgroundColor: theme.blue, borderRadius: 10, padding: 14, alignItems: "center", opacity: creating ? 0.6 : 1, marginTop: 4 }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{creating ? "Creating…" : "Create PO"}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fab:         { position: "absolute", bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.blue, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 6 },
  modalOverlay:{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard:   { backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle:  { fontSize: 18, fontWeight: "800", color: theme.text },
  input:       { borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 10, color: theme.text, fontSize: 13, backgroundColor: theme.bg, marginBottom: 12, marginTop: 4 },
});
