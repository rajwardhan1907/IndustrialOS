// mobile/src/screens/SuppliersScreen.tsx
// View suppliers + Add Supplier + Edit Supplier
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput,
} from "react-native";
import { theme, s } from "../lib/theme";
import { fetchSuppliers, createSupplier, updateSupplier, getSession } from "../lib/api";

interface Supplier {
  id: string; name: string; contactName?: string; email?: string;
  phone?: string; country?: string; status?: string;
  leadTimeDays?: number; rating?: number;
}

const EMPTY_FORM = { name: "", contactName: "", email: "", phone: "", country: "", leadTime: "", rating: "3" };

function renderStars(rating: number | undefined) {
  if (!rating) return "—";
  const stars = Math.round(rating);
  return "★".repeat(stars) + "☆".repeat(5 - stars);
}

export default function SuppliersScreen() {
  const [suppliers,  setSuppliers]  = useState<Supplier[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected,   setSelected]   = useState<Supplier | null>(null);
  const [showNew,    setShowNew]    = useState(false);
  const [showEdit,   setShowEdit]   = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) return;
      const data = await fetchSuppliers(workspaceId);
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (sup: Supplier) => {
    setForm({
      name: sup.name || "",
      contactName: sup.contactName || "",
      email: sup.email || "",
      phone: sup.phone || "",
      country: sup.country || "",
      leadTime: sup.leadTimeDays != null ? String(sup.leadTimeDays) : "",
      rating: sup.rating != null ? String(sup.rating) : "3",
    });
    setShowEdit(true);
  };

  const submitCreate = async () => {
    if (!form.name.trim()) { Alert.alert("Required", "Name is required."); return; }
    setSubmitting(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) return;
      const sup = await createSupplier({
        workspaceId, name: form.name.trim(), contactName: form.contactName.trim(),
        email: form.email.trim(), phone: form.phone.trim(), country: form.country.trim(),
        leadTimeDays: parseInt(form.leadTime, 10) || 0,
        rating: parseInt(form.rating, 10) || 3,
      });
      setSuppliers(prev => [sup, ...prev]);
      setShowNew(false);
      setForm(EMPTY_FORM);
      Alert.alert("Created", `${sup.name} added.`);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setSubmitting(false); }
  };

  const submitEdit = async () => {
    if (!selected) return;
    if (!form.name.trim()) { Alert.alert("Required", "Name is required."); return; }
    setSubmitting(true);
    try {
      const updated = await updateSupplier(selected.id, {
        name: form.name.trim(), contactName: form.contactName.trim(),
        email: form.email.trim(), phone: form.phone.trim(), country: form.country.trim(),
        leadTimeDays: parseInt(form.leadTime, 10) || 0,
        rating: parseInt(form.rating, 10) || 3,
      });
      const merged = { ...selected, ...updated };
      setSuppliers(prev => prev.map(s => s.id === selected.id ? merged : s));
      setSelected(merged);
      setShowEdit(false);
      Alert.alert("Saved", "Supplier updated.");
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setSubmitting(false); }
  };

  const SupplierForm = ({ onSubmit, submitLabel }: { onSubmit: () => void; submitLabel: string }) => (
    <>
      <Text style={s.label}>NAME *</Text>
      <TextInput style={styles.input} value={form.name} onChangeText={v => setForm(p => ({ ...p, name: v }))}
        placeholder="Supplier company name" placeholderTextColor={theme.subtle} />
      <Text style={s.label}>CONTACT NAME</Text>
      <TextInput style={styles.input} value={form.contactName} onChangeText={v => setForm(p => ({ ...p, contactName: v }))}
        placeholder="Account manager" placeholderTextColor={theme.subtle} />
      <Text style={s.label}>EMAIL</Text>
      <TextInput style={styles.input} value={form.email} onChangeText={v => setForm(p => ({ ...p, email: v }))}
        placeholder="email@supplier.com" placeholderTextColor={theme.subtle} keyboardType="email-address" />
      <Text style={s.label}>PHONE</Text>
      <TextInput style={styles.input} value={form.phone} onChangeText={v => setForm(p => ({ ...p, phone: v }))}
        placeholder="+1 555 000 0000" placeholderTextColor={theme.subtle} keyboardType="phone-pad" />
      <Text style={s.label}>COUNTRY</Text>
      <TextInput style={styles.input} value={form.country} onChangeText={v => setForm(p => ({ ...p, country: v }))}
        placeholder="e.g. Germany" placeholderTextColor={theme.subtle} />
      <Text style={s.label}>LEAD TIME (DAYS)</Text>
      <TextInput style={styles.input} value={form.leadTime} onChangeText={v => setForm(p => ({ ...p, leadTime: v }))}
        placeholder="e.g. 14" placeholderTextColor={theme.subtle} keyboardType="number-pad" />
      <Text style={s.label}>RATING (1–5)</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 20, marginTop: 4 }}>
        {["1","2","3","4","5"].map(r => (
          <TouchableOpacity key={r} onPress={() => setForm(p => ({ ...p, rating: r }))}
            style={[styles.ratingBtn, form.rating === r && { backgroundColor: theme.amber, borderColor: theme.amber }]}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: form.rating === r ? "#fff" : theme.muted }}>{"★".repeat(parseInt(r, 10))}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity onPress={onSubmit} disabled={submitting}
        style={{ backgroundColor: theme.blue, borderRadius: 10, padding: 14, alignItems: "center", opacity: submitting ? 0.6 : 1 }}>
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{submitting ? "Saving…" : submitLabel}</Text>
      </TouchableOpacity>
    </>
  );

  if (loading) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg }}><ActivityIndicator size="large" color={theme.blue} /></View>;

  if (selected) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 16, paddingBottom: 0 }}>
          <Text style={{ color: theme.blue, fontWeight: "700", fontSize: 14 }}>← All Suppliers</Text>
        </TouchableOpacity>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={s.card}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text, flex: 1 }}>{selected.name}</Text>
              <TouchableOpacity onPress={() => openEdit(selected)}
                style={{ backgroundColor: theme.blueBg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: theme.blueBorder }}>
                <Text style={{ color: theme.blue, fontWeight: "700", fontSize: 12 }}>Edit</Text>
              </TouchableOpacity>
            </View>
            {selected.contactName ? <Text style={{ fontSize: 13, color: theme.muted, marginBottom: 4 }}>Contact: {selected.contactName}</Text> : null}
            {selected.email ? <Text style={{ fontSize: 13, color: theme.blue, marginBottom: 8 }}>{selected.email}</Text> : null}
            {selected.status ? (
              <View style={[s.badge(
                selected.status === "active" ? theme.greenBg : theme.redBg,
                selected.status === "active" ? theme.green : theme.red,
                selected.status === "active" ? theme.greenBorder : theme.redBorder
              ), { marginBottom: 8 }]}>
                <Text style={s.badgeText(selected.status === "active" ? theme.green : theme.red)}>{selected.status.toUpperCase()}</Text>
              </View>
            ) : null}
            {selected.leadTimeDays != null ? (
              <Text style={{ fontSize: 13, color: theme.muted, marginTop: 12 }}>Lead Time: {selected.leadTimeDays} days</Text>
            ) : null}
            {selected.rating != null ? (
              <Text style={{ fontSize: 13, color: theme.amber, fontWeight: "700", marginTop: 6 }}>Rating: {renderStars(selected.rating)}</Text>
            ) : null}
          </View>
        </ScrollView>
        <Modal visible={showEdit} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
              <View style={styles.modalCard}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <Text style={styles.modalTitle}>Edit Supplier</Text>
                  <TouchableOpacity onPress={() => setShowEdit(false)}>
                    <Text style={{ fontSize: 20, color: theme.muted }}>✕</Text>
                  </TouchableOpacity>
                </View>
                <SupplierForm onSubmit={submitEdit} submitLabel="Save Changes" />
              </View>
            </ScrollView>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.blue} />}
      >
        <Text style={[s.heading, { marginBottom: 16 }]}>Suppliers</Text>
        {suppliers.length === 0 ? (
          <View style={[s.card, { alignItems: "center", padding: 32 }]}>
            <Text style={{ color: theme.muted, fontSize: 13 }}>No suppliers found. Tap + to add one.</Text>
          </View>
        ) : suppliers.map(sup => (
          <TouchableOpacity key={sup.id} style={[s.card, { marginBottom: 10 }]} onPress={() => setSelected(sup)} activeOpacity={0.85}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text, marginBottom: 6 }}>{sup.name}</Text>
            {sup.email ? <Text style={{ fontSize: 12, color: theme.muted, marginBottom: 4 }}>{sup.email}</Text> : null}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 12, color: theme.amber }}>{renderStars(sup.rating)}</Text>
              {sup.leadTimeDays != null ? (
                <Text style={{ fontSize: 12, color: theme.muted }}>Lead: {sup.leadTimeDays}d</Text>
              ) : null}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TouchableOpacity onPress={() => { setForm(EMPTY_FORM); setShowNew(true); }} style={styles.fab}>
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "300" }}>+</Text>
      </TouchableOpacity>
      <Modal visible={showNew} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
            <View style={styles.modalCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <Text style={styles.modalTitle}>Add Supplier</Text>
                <TouchableOpacity onPress={() => setShowNew(false)}>
                  <Text style={{ fontSize: 20, color: theme.muted }}>✕</Text>
                </TouchableOpacity>
              </View>
              <SupplierForm onSubmit={submitCreate} submitLabel="Add Supplier" />
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
  ratingBtn:   { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.bg },
});
