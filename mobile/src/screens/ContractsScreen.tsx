// mobile/src/screens/ContractsScreen.tsx
// View contracts + Create Contract
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput,
} from "react-native";
import { theme, s } from "../lib/theme";
import { fetchContracts, createContract, getSession } from "../lib/api";

interface Contract {
  id: string; contractNumber: string; title: string;
  customer: string; value: number; status: string; expiryDate?: string;
}

function statusColor(st: string) {
  if (st === "active")   return { color: theme.green,  bg: theme.greenBg,  border: theme.greenBorder  };
  if (st === "expiring") return { color: theme.amber,  bg: theme.amberBg,  border: theme.amberBorder  };
  if (st === "expired")  return { color: theme.red,    bg: theme.redBg,    border: theme.redBorder    };
  if (st === "draft")    return { color: theme.blue,   bg: theme.blueBg,   border: theme.blueBorder   };
  return                         { color: theme.muted,  bg: theme.bg,       border: theme.border       };
}

export default function ContractsScreen() {
  const [contracts,  setContracts]  = useState<Contract[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected,   setSelected]   = useState<Contract | null>(null);
  // New contract state
  const [showNew,    setShowNew]    = useState(false);
  const [newTitle,   setNewTitle]   = useState("");
  const [newCustomer,setNewCustomer]= useState("");
  const [newValue,   setNewValue]   = useState("");
  const [newStart,   setNewStart]   = useState("");
  const [newExpiry,  setNewExpiry]  = useState("");
  const [newMinQty,  setNewMinQty]  = useState("");
  const [newSLA,     setNewSLA]     = useState("");
  const [creating,   setCreating]   = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) return;
      const data = await fetchContracts(workspaceId);
      setContracts(Array.isArray(data) ? data : []);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submitNew = async () => {
    if (!newTitle.trim())    { Alert.alert("Required", "Title is required."); return; }
    if (!newCustomer.trim()) { Alert.alert("Required", "Customer is required."); return; }
    setCreating(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) return;
      const contractNumber = "CTR-" + Date.now();
      const c = await createContract({
        workspaceId, contractNumber, title: newTitle.trim(), customer: newCustomer.trim(),
        value: parseFloat(newValue) || 0,
        startDate: newStart.trim() || undefined,
        expiryDate: newExpiry.trim() || undefined,
        minOrderQty: parseInt(newMinQty, 10) || 0,
        deliverySLA: parseInt(newSLA, 10) || 0,
        status: "draft",
      });
      setContracts(prev => [c, ...prev]);
      setShowNew(false);
      setNewTitle(""); setNewCustomer(""); setNewValue(""); setNewStart(""); setNewExpiry(""); setNewMinQty(""); setNewSLA("");
      Alert.alert("Created", `Contract ${c.contractNumber} created.`);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setCreating(false); }
  };

  if (loading) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg }}><ActivityIndicator size="large" color={theme.blue} /></View>;

  if (selected) {
    const st = statusColor(selected.status);

    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 16, paddingBottom: 0 }}>
          <Text style={{ color: theme.blue, fontWeight: "700", fontSize: 14 }}>← All Contracts</Text>
        </TouchableOpacity>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={s.card}>
            <Text style={{ fontSize: 11, color: theme.muted, fontWeight: "700", marginBottom: 4 }}>{selected.contractNumber}</Text>
            <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text, marginBottom: 6 }}>{selected.title}</Text>
            <Text style={{ fontSize: 13, color: theme.muted, marginBottom: 12 }}>Customer: {selected.customer}</Text>
            <View style={s.badge(st.bg, st.color, st.border)}><Text style={s.badgeText(st.color)}>{selected.status.toUpperCase()}</Text></View>
            <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.border }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                <Text style={{ color: theme.muted, fontSize: 13 }}>Contract Value</Text>
                <Text style={{ color: theme.green, fontWeight: "700", fontSize: 13 }}>${selected.value ? selected.value.toLocaleString() : "0"}</Text>
              </View>
              {selected.expiryDate ? (
                <Text style={{ fontSize: 12, color: theme.muted }}>Expiry: {new Date(selected.expiryDate).toLocaleDateString()}</Text>
              ) : null}
            </View>
          </View>
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
        <Text style={[s.heading, { marginBottom: 16 }]}>Contracts</Text>
        {contracts.length === 0 ? (
          <View style={[s.card, { alignItems: "center", padding: 32 }]}>
            <Text style={{ color: theme.muted, fontSize: 13 }}>No contracts found. Tap + to create one.</Text>
          </View>
        ) : contracts.map(c => {
          const st = statusColor(c.status);
          return (
            <TouchableOpacity key={c.id} style={[s.card, { marginBottom: 10 }]} onPress={() => setSelected(c)} activeOpacity={0.85}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <Text style={{ fontSize: 11, color: theme.muted, fontWeight: "700" }}>{c.contractNumber}</Text>
                <View style={s.badge(st.bg, st.color, st.border)}><Text style={s.badgeText(st.color)}>{c.status.toUpperCase()}</Text></View>
              </View>
              <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text, marginBottom: 4 }}>{c.title}</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 12, color: theme.muted }}>{c.customer}</Text>
                <Text style={{ fontSize: 12, fontWeight: "700", color: theme.green }}>${c.value ? c.value.toLocaleString() : "0"}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity onPress={() => setShowNew(true)} style={styles.fab}>
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "300" }}>+</Text>
      </TouchableOpacity>

      {/* Create Contract Modal */}
      <Modal visible={showNew} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
            <View style={styles.modalCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <Text style={styles.modalTitle}>New Contract</Text>
                <TouchableOpacity onPress={() => setShowNew(false)}>
                  <Text style={{ fontSize: 20, color: theme.muted }}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.label}>TITLE *</Text>
              <TextInput style={styles.input} value={newTitle} onChangeText={setNewTitle}
                placeholder="Contract title" placeholderTextColor={theme.subtle} />
              <Text style={s.label}>CUSTOMER *</Text>
              <TextInput style={styles.input} value={newCustomer} onChangeText={setNewCustomer}
                placeholder="Customer name" placeholderTextColor={theme.subtle} />
              <Text style={s.label}>VALUE ($)</Text>
              <TextInput style={styles.input} value={newValue} onChangeText={setNewValue}
                keyboardType="numeric" placeholder="0.00" placeholderTextColor={theme.subtle} />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>START DATE</Text>
                  <TextInput style={styles.input} value={newStart} onChangeText={setNewStart}
                    placeholder="YYYY-MM-DD" placeholderTextColor={theme.subtle} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>EXPIRY DATE</Text>
                  <TextInput style={styles.input} value={newExpiry} onChangeText={setNewExpiry}
                    placeholder="YYYY-MM-DD" placeholderTextColor={theme.subtle} />
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>MIN ORDER QTY</Text>
                  <TextInput style={styles.input} value={newMinQty} onChangeText={setNewMinQty}
                    keyboardType="number-pad" placeholder="0" placeholderTextColor={theme.subtle} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>DELIVERY SLA (days)</Text>
                  <TextInput style={styles.input} value={newSLA} onChangeText={setNewSLA}
                    keyboardType="number-pad" placeholder="0" placeholderTextColor={theme.subtle} />
                </View>
              </View>
              <TouchableOpacity onPress={submitNew} disabled={creating}
                style={{ backgroundColor: theme.blue, borderRadius: 10, padding: 14, alignItems: "center", opacity: creating ? 0.6 : 1, marginTop: 4 }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{creating ? "Creating…" : "Create Contract"}</Text>
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
