// mobile/src/screens/QuotesScreen.tsx
// View quotes + accept/decline + Create Quote
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput,
} from "react-native";
import { theme, s } from "../lib/theme";
import { fetchQuotes, updateQuoteStatus, createQuote, getSession } from "../lib/api";
import { SessionExpiredView } from "../lib/sessionGuard";

interface Quote {
  id: string; quoteNumber: string; customer: string; total: number;
  status: string; validUntil?: string;
}

function statusColor(st: string) {
  if (st === "draft")    return { color: theme.blue,   bg: theme.blueBg,   border: theme.blueBorder   };
  if (st === "sent")     return { color: theme.amber,  bg: theme.amberBg,  border: theme.amberBorder  };
  if (st === "accepted") return { color: theme.green,  bg: theme.greenBg,  border: theme.greenBorder  };
  if (st === "declined") return { color: theme.red,    bg: theme.redBg,    border: theme.redBorder    };
  return                         { color: theme.muted,  bg: theme.bg,       border: theme.border       };
}

export default function QuotesScreen() {
  const [quotes,     setQuotes]     = useState<Quote[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [selected,   setSelected]   = useState<Quote | null>(null);
  // New quote state
  const [showNew,    setShowNew]    = useState(false);
  const [newCustomer,setNewCustomer]= useState("");
  const [newSku,     setNewSku]     = useState("");
  const [newQty,     setNewQty]     = useState("1");
  const [newPrice,   setNewPrice]   = useState("");
  const [newValidUntil, setNewValidUntil] = useState("");
  const [newNotes,   setNewNotes]   = useState("");
  const [creating,   setCreating]   = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) { setSessionExpired(true); return; }
      const data = await fetchQuotes(workspaceId);
      setQuotes(Array.isArray(data) ? data : []);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (sessionExpired) return <SessionExpiredView />;

  const submitNew = async () => {
    if (!newCustomer.trim()) { Alert.alert("Required", "Customer name is required."); return; }
    if (!newSku.trim())      { Alert.alert("Required", "SKU is required."); return; }
    const qty   = parseInt(newQty, 10) || 1;
    const price = parseFloat(newPrice) || 0;
    const total = qty * price;
    setCreating(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) { setSessionExpired(true); return; }
      const quoteNumber = "Q-" + Date.now();
      const q = await createQuote({
        workspaceId, quoteNumber, customer: newCustomer.trim(),
        items: [{ sku: newSku.trim(), qty, unitPrice: price }],
        subtotal: total, total,
        validUntil: newValidUntil.trim() || undefined,
        notes: newNotes.trim() || undefined,
        status: "draft",
      });
      setQuotes(prev => [q, ...prev]);
      setShowNew(false);
      setNewCustomer(""); setNewSku(""); setNewQty("1"); setNewPrice(""); setNewValidUntil(""); setNewNotes("");
      Alert.alert("Created", `Quote ${q.quoteNumber} created.`);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setCreating(false); }
  };

  if (loading) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg }}><ActivityIndicator size="large" color={theme.blue} /></View>;

  if (selected) {
    const st = statusColor(selected.status);
    const updateStatus = async (newStatus: string) => {
      try {
        await updateQuoteStatus(selected.id, newStatus);
        setSelected(prev => prev ? { ...prev, status: newStatus } : prev);
        setQuotes(prev => prev.map(q => q.id === selected.id ? { ...q, status: newStatus } : q));
      } catch (e: any) { Alert.alert("Error", e.message); }
    };
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 16, paddingBottom: 0 }}>
          <Text style={{ color: theme.blue, fontWeight: "700", fontSize: 14 }}>← All Quotes</Text>
        </TouchableOpacity>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={s.card}>
            <Text style={{ fontSize: 11, color: theme.muted, fontWeight: "700", marginBottom: 4 }}>{selected.quoteNumber}</Text>
            <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text, marginBottom: 12 }}>{selected.customer}</Text>
            <Text style={{ fontSize: 20, fontWeight: "800", color: theme.blue, marginBottom: 12 }}>${selected.total ? selected.total.toLocaleString() : "0"}</Text>
            <View style={s.badge(st.bg, st.color, st.border)}><Text style={s.badgeText(st.color)}>{selected.status.toUpperCase()}</Text></View>
            {selected.validUntil ? (
              <Text style={{ fontSize: 12, color: theme.muted, marginTop: 10 }}>Valid until {new Date(selected.validUntil).toLocaleDateString()}</Text>
            ) : null}
          </View>
          <Text style={[s.heading, { marginTop: 16, marginBottom: 10 }]}>Actions</Text>
          {selected.status === "sent" ? (
            <>
              <TouchableOpacity onPress={() => updateStatus("accepted")} style={[s.card, { backgroundColor: theme.greenBg, borderColor: theme.greenBorder, borderWidth: 1, marginBottom: 8 }]}>
                <Text style={{ color: theme.green, fontWeight: "700", fontSize: 14 }}>✓ Accept Quote</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => updateStatus("declined")} style={[s.card, { backgroundColor: theme.redBg, borderColor: theme.redBorder, borderWidth: 1 }]}>
                <Text style={{ color: theme.red, fontWeight: "700", fontSize: 14 }}>✗ Decline Quote</Text>
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
        <Text style={[s.heading, { marginBottom: 16 }]}>Quotes</Text>
        {quotes.length === 0 ? (
          <View style={[s.card, { alignItems: "center", padding: 32 }]}>
            <Text style={{ color: theme.muted, fontSize: 13 }}>No quotes yet. Tap + to create one.</Text>
          </View>
        ) : quotes.map(q => {
          const st = statusColor(q.status);
          return (
            <TouchableOpacity key={q.id} style={[s.card, { marginBottom: 10 }]} onPress={() => setSelected(q)} activeOpacity={0.85}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <Text style={{ fontSize: 11, color: theme.muted, fontWeight: "700" }}>{q.quoteNumber}</Text>
                <View style={s.badge(st.bg, st.color, st.border)}><Text style={s.badgeText(st.color)}>{q.status.toUpperCase()}</Text></View>
              </View>
              <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text, marginBottom: 4 }}>{q.customer}</Text>
              <Text style={{ fontSize: 13, fontWeight: "700", color: theme.green }}>${q.total ? q.total.toLocaleString() : "0"}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity onPress={() => setShowNew(true)} style={styles.fab}>
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "300" }}>+</Text>
      </TouchableOpacity>

      {/* Create Quote Modal */}
      <Modal visible={showNew} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
            <View style={styles.modalCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <Text style={styles.modalTitle}>New Quote</Text>
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
              <Text style={s.label}>VALID UNTIL (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} value={newValidUntil} onChangeText={setNewValidUntil}
                placeholder="e.g. 2026-06-30" placeholderTextColor={theme.subtle} />
              <Text style={s.label}>NOTES</Text>
              <TextInput style={[styles.input, { minHeight: 60 }]} value={newNotes} onChangeText={setNewNotes}
                placeholder="Optional notes…" placeholderTextColor={theme.subtle} multiline />
              <TouchableOpacity onPress={submitNew} disabled={creating}
                style={{ backgroundColor: theme.blue, borderRadius: 10, padding: 14, alignItems: "center", opacity: creating ? 0.6 : 1, marginTop: 4 }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{creating ? "Creating…" : "Create Quote"}</Text>
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
