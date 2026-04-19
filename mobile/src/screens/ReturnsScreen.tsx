// mobile/src/screens/ReturnsScreen.tsx
// View returns + advance status + Create Return
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput,
} from "react-native";
import { theme, s } from "../lib/theme";
import { fetchReturns, updateReturnStatus, createReturn, getSession } from "../lib/api";
import { SessionExpiredView } from "../lib/sessionGuard";
import { useFilterSort, SearchSortBar } from "../lib/useFilterSort";
import { SkuModal, SkuText } from "./SkuModal";

interface Return {
  id: string; rmaNumber: string; customer: string; sku: string;
  qty: number; reason: string; status: string;
}

const REASONS = ["defective", "wrong_item", "damaged", "other"];
const STATUSES = ["requested", "approved", "received", "refunded", "rejected"];

function statusColor(st: string) {
  if (st === "requested") return { color: theme.blue,    bg: theme.blueBg,    border: theme.blueBorder    };
  if (st === "approved")  return { color: theme.amber,   bg: theme.amberBg,   border: theme.amberBorder   };
  if (st === "received")  return { color: theme.purple,  bg: theme.bg,        border: theme.border        };
  if (st === "refunded")  return { color: theme.green,   bg: theme.greenBg,   border: theme.greenBorder   };
  if (st === "rejected")  return { color: theme.red,     bg: theme.redBg,     border: theme.redBorder     };
  return                          { color: theme.muted,   bg: theme.bg,        border: theme.border        };
}

export default function ReturnsScreen() {
  const [returns,    setReturns]    = useState<Return[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [selected,   setSelected]   = useState<Return | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [skuOpen,    setSkuOpen]    = useState<string | null>(null);
  // New return state
  const [showNew,    setShowNew]    = useState(false);
  const [newCustomer,setNewCustomer]= useState("");
  const [newSku,     setNewSku]     = useState("");
  const [newQty,     setNewQty]     = useState("1");
  const [newReason,  setNewReason]  = useState("defective");
  const [newDesc,    setNewDesc]    = useState("");
  const [creating,   setCreating]   = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) { setSessionExpired(true); return; }
      setWorkspaceId(workspaceId);
      const data = await fetchReturns(workspaceId);
      setReturns(Array.isArray(data) ? data : []);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (sessionExpired) return <SessionExpiredView />;

  const submitNew = async () => {
    if (!newCustomer.trim()) { Alert.alert("Required", "Customer is required."); return; }
    if (!newSku.trim())      { Alert.alert("Required", "SKU is required."); return; }
    const qty = parseInt(newQty, 10) || 1;
    setCreating(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) { setSessionExpired(true); return; }
      const rmaNumber = "RMA-" + Date.now();
      const r = await createReturn({
        workspaceId, rmaNumber, customer: newCustomer.trim(),
        sku: newSku.trim(), qty, reason: newReason,
        description: newDesc.trim() || undefined, status: "requested",
      });
      setReturns(prev => [r, ...prev]);
      setShowNew(false);
      setNewCustomer(""); setNewSku(""); setNewQty("1"); setNewReason("defective"); setNewDesc("");
      Alert.alert("Created", `Return ${r.rmaNumber} created.`);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setCreating(false); }
  };

  const { search, setSearch, sortBy, setSortBy, sortDir, setSortDir, filtered } = useFilterSort(returns, {
    searchFields: (i) => [i.customer, i.sku, i.reason, i.rmaNumber],
    sortOptions: [
      { value: "date",     label: "Date",     get: (i) => (i as any).createdAt ?? i.rmaNumber },
      { value: "customer", label: "Customer", get: (i) => (i.customer || "").toLowerCase() },
      { value: "status",   label: "Status",   get: (i) => STATUSES.indexOf(i.status) },
    ],
    defaultSort: "date",
    defaultDir: "desc",
  });

  if (loading) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg }}><ActivityIndicator size="large" color={theme.blue} /></View>;

  if (selected) {
    const st = statusColor(selected.status);
    const currentIdx = STATUSES.indexOf(selected.status);
    const canAdvance = currentIdx >= 0 && currentIdx < STATUSES.length - 1;
    const nextStatus = canAdvance ? STATUSES[currentIdx + 1] : null;

    const changeStatus = async (newStatus: string) => {
      try {
        await updateReturnStatus(selected.id, newStatus);
        const updated = { ...selected, status: newStatus };
        setSelected(updated);
        setReturns(prev => prev.map(r => r.id === selected.id ? { ...r, status: newStatus } : r));
      } catch (e: any) { Alert.alert("Error", e.message); }
    };

    const confirmReject = () => {
      Alert.alert("Reject Return", `Reject ${selected.rmaNumber}?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Reject", style: "destructive", onPress: () => changeStatus("rejected") },
      ]);
    };

    const canReject = selected.status === "requested" || selected.status === "approved";

    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 16, paddingBottom: 0 }}>
          <Text style={{ color: theme.blue, fontWeight: "700", fontSize: 14 }}>← All Returns</Text>
        </TouchableOpacity>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={s.card}>
            <Text style={{ fontSize: 11, color: theme.muted, fontWeight: "700", marginBottom: 4 }}>{selected.rmaNumber}</Text>
            <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text, marginBottom: 12 }}>{selected.customer}</Text>
            <View style={s.badge(st.bg, st.color, st.border)}><Text style={s.badgeText(st.color)}>{selected.status.toUpperCase()}</Text></View>
            <Text style={{ fontSize: 13, color: theme.muted, marginTop: 12 }}>SKU: {selected.sku}</Text>
            <Text style={{ fontSize: 13, color: theme.muted }}>Qty: {selected.qty}</Text>
            <Text style={{ fontSize: 13, color: theme.muted, marginTop: 8 }}>Reason: {selected.reason.replace("_", " ")}</Text>
          </View>
          {canAdvance && nextStatus ? (
            <TouchableOpacity onPress={() => changeStatus(nextStatus)} style={[s.card, { backgroundColor: theme.blueBg, borderColor: theme.blueBorder, borderWidth: 1, marginTop: 16 }]}>
              <Text style={{ color: theme.blue, fontWeight: "700", fontSize: 14 }}>
                ✓ Move to {nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}
              </Text>
            </TouchableOpacity>
          ) : null}
          {canReject ? (
            <TouchableOpacity onPress={confirmReject} style={[s.card, { backgroundColor: theme.redBg, borderColor: theme.redBorder, borderWidth: 1, marginTop: 12 }]}>
              <Text style={{ color: theme.red, fontWeight: "700", fontSize: 14 }}>✕ Reject Return</Text>
            </TouchableOpacity>
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
        <Text style={[s.heading, { marginBottom: 16 }]}>Returns</Text>
        <SearchSortBar
          search={search} setSearch={setSearch}
          sortBy={sortBy} setSortBy={setSortBy}
          sortDir={sortDir} setSortDir={setSortDir}
          sortOptions={[
            { value: "date", label: "Date" },
            { value: "customer", label: "Customer" },
            { value: "status", label: "Status" },
          ]}
          placeholder="Search customer, SKU, or reason…"
        />
        {returns.length === 0 ? (
          <View style={[s.card, { alignItems: "center", padding: 32 }]}>
            <Text style={{ color: theme.muted, fontSize: 13 }}>No returns found. Tap + to log one.</Text>
          </View>
        ) : filtered.map(r => {
          const st = statusColor(r.status);
          return (
            <TouchableOpacity key={r.id} style={[s.card, { marginBottom: 10 }]} onPress={() => setSelected(r)} activeOpacity={0.85}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <Text style={{ fontSize: 11, color: theme.muted, fontWeight: "700" }}>{r.rmaNumber}</Text>
                <View style={s.badge(st.bg, st.color, st.border)}><Text style={s.badgeText(st.color)}>{r.status.toUpperCase()}</Text></View>
              </View>
              <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text, marginBottom: 4 }}>{r.customer}</Text>
              <Text style={{ fontSize: 12, color: theme.muted }}>
                SKU: <SkuText sku={r.sku} onPress={() => setSkuOpen(r.sku)} /> · Qty: {r.qty}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity onPress={() => setShowNew(true)} style={styles.fab}>
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "300" }}>+</Text>
      </TouchableOpacity>

      {/* Create Return Modal */}
      <Modal visible={showNew} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
            <View style={styles.modalCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <Text style={styles.modalTitle}>New Return</Text>
                <TouchableOpacity onPress={() => setShowNew(false)}>
                  <Text style={{ fontSize: 20, color: theme.muted }}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.label}>CUSTOMER *</Text>
              <TextInput style={styles.input} value={newCustomer} onChangeText={setNewCustomer}
                placeholder="Customer name" placeholderTextColor={theme.subtle} />
              <Text style={s.label}>SKU *</Text>
              <TextInput style={styles.input} value={newSku} onChangeText={setNewSku}
                placeholder="e.g. SKU-001" placeholderTextColor={theme.subtle} />
              <Text style={s.label}>QUANTITY</Text>
              <TextInput style={styles.input} value={newQty} onChangeText={setNewQty}
                keyboardType="number-pad" placeholder="1" placeholderTextColor={theme.subtle} />
              <Text style={s.label}>REASON</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12, marginTop: 4 }}>
                {REASONS.map(r => (
                  <TouchableOpacity key={r} onPress={() => setNewReason(r)}
                    style={[styles.chip, newReason === r && { backgroundColor: theme.blue, borderColor: theme.blue }]}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: newReason === r ? "#fff" : theme.muted }}>
                      {r.replace("_", " ")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.label}>DESCRIPTION</Text>
              <TextInput style={[styles.input, { minHeight: 60 }]} value={newDesc} onChangeText={setNewDesc}
                placeholder="Additional details…" placeholderTextColor={theme.subtle} multiline />
              <TouchableOpacity onPress={submitNew} disabled={creating}
                style={{ backgroundColor: theme.blue, borderRadius: 10, padding: 14, alignItems: "center", opacity: creating ? 0.6 : 1, marginTop: 4 }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{creating ? "Creating…" : "Create Return"}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <SkuModal sku={skuOpen} workspaceId={workspaceId} onClose={() => setSkuOpen(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  fab:         { position: "absolute", bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.blue, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 6 },
  modalOverlay:{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard:   { backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle:  { fontSize: 18, fontWeight: "800", color: theme.text },
  input:       { borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 10, color: theme.text, fontSize: 13, backgroundColor: theme.bg, marginBottom: 12, marginTop: 4 },
  chip:        { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.bg },
});
