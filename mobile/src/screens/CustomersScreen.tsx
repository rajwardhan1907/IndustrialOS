// mobile/src/screens/CustomersScreen.tsx
// View customers + Add Customer + Edit Customer
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput,
} from "react-native";
import { theme, s } from "../lib/theme";
import { fetchCustomers, createCustomer, updateCustomer, getSession } from "../lib/api";
import { SessionExpiredView } from "../lib/sessionGuard";

interface Customer {
  id: string; name: string; contactName?: string; email?: string; phone?: string;
  country?: string; status?: string; balanceDue?: number; notes?: string;
  creditLimit?: number; totalSpend?: number;
}

const EMPTY_FORM = { name: "", contactName: "", email: "", phone: "", country: "", creditLimit: "" };
const EMPTY_EDIT = { creditLimit: "", notes: "" };

type FormState = typeof EMPTY_FORM;
type EditState  = typeof EMPTY_EDIT;

// IMPORTANT: keep this component OUTSIDE CustomersScreen. If it's defined inside
// the parent, every keystroke re-creates the component, unmounts TextInputs and
// focus is lost after each character.
function CustomerForm({
  form, setForm, submitting, onSubmit, submitLabel,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  submitting: boolean;
  onSubmit: () => void;
  submitLabel: string;
}) {
  return (
    <>
      <Text style={s.label}>NAME *</Text>
      <TextInput style={styles.input} value={form.name} onChangeText={v => setForm(p => ({ ...p, name: v }))}
        placeholder="Company or person name" placeholderTextColor={theme.subtle} />
      <Text style={s.label}>CONTACT NAME</Text>
      <TextInput style={styles.input} value={form.contactName} onChangeText={v => setForm(p => ({ ...p, contactName: v }))}
        placeholder="Primary contact" placeholderTextColor={theme.subtle} />
      <Text style={s.label}>EMAIL</Text>
      <TextInput style={styles.input} value={form.email} onChangeText={v => setForm(p => ({ ...p, email: v }))}
        placeholder="email@example.com" placeholderTextColor={theme.subtle} keyboardType="email-address" />
      <Text style={s.label}>PHONE</Text>
      <TextInput style={styles.input} value={form.phone} onChangeText={v => setForm(p => ({ ...p, phone: v }))}
        placeholder="+1 555 000 0000" placeholderTextColor={theme.subtle} keyboardType="phone-pad" />
      <Text style={s.label}>COUNTRY</Text>
      <TextInput style={styles.input} value={form.country} onChangeText={v => setForm(p => ({ ...p, country: v }))}
        placeholder="e.g. United States" placeholderTextColor={theme.subtle} />
      <Text style={s.label}>CREDIT LIMIT ($)</Text>
      <TextInput style={styles.input} value={form.creditLimit} onChangeText={v => setForm(p => ({ ...p, creditLimit: v }))}
        placeholder="0" placeholderTextColor={theme.subtle} keyboardType="numeric" />
      <TouchableOpacity onPress={onSubmit} disabled={submitting}
        style={{ backgroundColor: theme.blue, borderRadius: 10, padding: 14, alignItems: "center", opacity: submitting ? 0.6 : 1 }}>
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{submitting ? "Saving…" : submitLabel}</Text>
      </TouchableOpacity>
    </>
  );
}

// Supplier-side edit: only creditLimit + notes are mutable here.
// Customer-owned fields (name/email/phone) flow in via the customer portal.
function EditCustomerLimitedForm({
  form, setForm, submitting, onSubmit,
}: {
  form: EditState;
  setForm: React.Dispatch<React.SetStateAction<EditState>>;
  submitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <>
      <Text style={{ color: theme.muted, fontSize: 11, marginBottom: 14, lineHeight: 16 }}>
        Only credit limit and notes are editable. Name, email and phone are managed by the customer through their portal.
      </Text>
      <Text style={s.label}>CREDIT LIMIT ($)</Text>
      <TextInput style={styles.input} value={form.creditLimit} onChangeText={v => setForm(p => ({ ...p, creditLimit: v }))}
        placeholder="0" placeholderTextColor={theme.subtle} keyboardType="numeric" />
      <Text style={s.label}>NOTES</Text>
      <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]} value={form.notes}
        onChangeText={v => setForm(p => ({ ...p, notes: v }))}
        placeholder="Internal notes about this customer…" placeholderTextColor={theme.subtle} multiline />
      <TouchableOpacity onPress={onSubmit} disabled={submitting}
        style={{ backgroundColor: theme.blue, borderRadius: 10, padding: 14, alignItems: "center", opacity: submitting ? 0.6 : 1 }}>
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{submitting ? "Saving…" : "Save"}</Text>
      </TouchableOpacity>
    </>
  );
}

export default function CustomersScreen() {
  const [customers,  setCustomers]  = useState<Customer[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [selected,   setSelected]   = useState<Customer | null>(null);
  const [showNew,    setShowNew]    = useState(false);
  const [showEdit,   setShowEdit]   = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [editForm,   setEditForm]   = useState(EMPTY_EDIT);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) { setSessionExpired(true); return; }
      const data = await fetchCustomers(workspaceId);
      setCustomers(Array.isArray(data) ? data : []);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (sessionExpired) return <SessionExpiredView />;

  const openEdit = (c: Customer) => {
    setEditForm({
      creditLimit: c.creditLimit != null ? String(c.creditLimit) : "",
      notes: c.notes || "",
    });
    setShowEdit(true);
  };

  const submitCreate = async () => {
    if (!form.name.trim()) { Alert.alert("Required", "Name is required."); return; }
    setSubmitting(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) { setSessionExpired(true); return; }
      const c = await createCustomer({
        workspaceId, name: form.name.trim(), contactName: form.contactName.trim(),
        email: form.email.trim(), phone: form.phone.trim(), country: form.country.trim(),
        creditLimit: parseFloat(form.creditLimit) || 0,
      });
      setCustomers(prev => [c, ...prev]);
      setShowNew(false);
      setForm(EMPTY_FORM);
      Alert.alert("Created", `${c.name} added.`);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setSubmitting(false); }
  };

  // Supplier-side edit — only creditLimit + notes flow through this path.
  const submitEdit = async () => {
    if (!selected) return;
    const cl = parseFloat(editForm.creditLimit);
    if (isNaN(cl) || cl < 0) { Alert.alert("Invalid", "Credit limit must be a non-negative number."); return; }
    setSubmitting(true);
    try {
      const updated = await updateCustomer(selected.id, {
        creditLimit: cl,
        notes: editForm.notes.trim(),
      });
      const merged = { ...selected, ...updated, creditLimit: cl, notes: editForm.notes.trim() };
      setCustomers(prev => prev.map(c => c.id === selected.id ? merged : c));
      setSelected(merged);
      setShowEdit(false);
      Alert.alert("Saved", "Customer updated.");
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setSubmitting(false); }
  };

  if (loading) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg }}><ActivityIndicator size="large" color={theme.blue} /></View>;

  if (selected) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 16, paddingBottom: 0 }}>
          <Text style={{ color: theme.blue, fontWeight: "700", fontSize: 14 }}>← All Customers</Text>
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
            {selected.balanceDue != null ? (
              <Text style={{ fontSize: 13, color: selected.balanceDue > 0 ? theme.red : theme.green, fontWeight: "700", marginTop: 12 }}>
                Balance Due: ${selected.balanceDue.toLocaleString()}
              </Text>
            ) : null}
            {selected.creditLimit != null ? (
              <Text style={{ fontSize: 12, color: theme.muted, marginTop: 6 }}>Credit Limit: ${selected.creditLimit.toLocaleString()}</Text>
            ) : null}
            {selected.totalSpend != null ? (
              <Text style={{ fontSize: 12, color: theme.muted }}>Total Spend: ${selected.totalSpend.toLocaleString()}</Text>
            ) : null}
            {selected.notes ? (
              <Text style={{ fontSize: 12, color: theme.text, marginTop: 12, lineHeight: 18 }}>Notes: {selected.notes}</Text>
            ) : null}
          </View>
        </ScrollView>

        {/* Edit Modal */}
        <Modal visible={showEdit} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
              <View style={styles.modalCard}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <Text style={styles.modalTitle}>Edit Customer</Text>
                  <TouchableOpacity onPress={() => setShowEdit(false)}>
                    <Text style={{ fontSize: 20, color: theme.muted }}>✕</Text>
                  </TouchableOpacity>
                </View>
                <EditCustomerLimitedForm form={editForm} setForm={setEditForm} submitting={submitting} onSubmit={submitEdit} />
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
        <Text style={[s.heading, { marginBottom: 16 }]}>Customers</Text>
        {customers.length === 0 ? (
          <View style={[s.card, { alignItems: "center", padding: 32 }]}>
            <Text style={{ color: theme.muted, fontSize: 13 }}>No customers found. Tap + to add one.</Text>
          </View>
        ) : customers.map(c => (
          <TouchableOpacity key={c.id} style={[s.card, { marginBottom: 10 }]} onPress={() => setSelected(c)} activeOpacity={0.85}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text, marginBottom: 6 }}>{c.name}</Text>
            {c.email ? <Text style={{ fontSize: 12, color: theme.muted, marginBottom: 4 }}>{c.email}</Text> : null}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 12, color: theme.muted }}>{c.status === "active" ? "✓ Active" : "○ Inactive"}</Text>
              {c.balanceDue != null ? (
                <Text style={{ fontSize: 12, fontWeight: "700", color: c.balanceDue > 0 ? theme.red : theme.green }}>
                  ${c.balanceDue.toLocaleString()}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity onPress={() => { setForm(EMPTY_FORM); setShowNew(true); }} style={styles.fab}>
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "300" }}>+</Text>
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal visible={showNew} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
            <View style={styles.modalCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <Text style={styles.modalTitle}>Add Customer</Text>
                <TouchableOpacity onPress={() => setShowNew(false)}>
                  <Text style={{ fontSize: 20, color: theme.muted }}>✕</Text>
                </TouchableOpacity>
              </View>
              <CustomerForm form={form} setForm={setForm} submitting={submitting} onSubmit={submitCreate} submitLabel="Add Customer" />
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
