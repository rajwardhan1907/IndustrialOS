// mobile/src/screens/InvoicingScreen.tsx
// Full create + view invoices — matches web app Invoicing component
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput,
} from "react-native";
import { theme, s } from "../lib/theme";
import { fetchInvoices, createInvoice, updateInvoiceStatus, fetchInventoryBySku, getSession } from "../lib/api";
import { SessionExpiredView } from "../lib/sessionGuard";
import { useFilterSort, SearchSortBar } from "../lib/useFilterSort";

interface InvoiceItem { id: string; desc: string; qty: number; unitPrice: number; total: number; }
interface Invoice {
  id: string; invoiceNumber: string; customer: string;
  items: InvoiceItem[]; subtotal: number; tax: number;
  total: number; amountPaid: number; paymentTerms: string;
  issueDate: string; dueDate: string; status: string;
  notes: string; currency: string;
}

const PAYMENT_TERMS = ["Net 15", "Net 30", "Net 60", "Prepaid", "Cash on Delivery"];
const TERMS_DAYS: Record<string, number> = {
  "Net 15": 15, "Net 30": 30, "Net 60": 60, "Prepaid": 0, "Cash on Delivery": 0,
};

function calcDueDate(issueDate: string, terms: string): string {
  const d = new Date(issueDate);
  d.setDate(d.getDate() + (TERMS_DAYS[terms] ?? 30));
  return d.toISOString().split("T")[0];
}

function statusColor(st: string) {
  if (st === "draft")   return { color: theme.blue,   bg: theme.blueBg,   border: theme.blueBorder   };
  if (st === "sent")    return { color: theme.amber,  bg: theme.amberBg,  border: theme.amberBorder  };
  if (st === "paid")    return { color: theme.green,  bg: theme.greenBg,  border: theme.greenBorder  };
  if (st === "overdue") return { color: theme.red,    bg: theme.redBg,    border: theme.redBorder    };
  if (st === "partial") return { color: theme.amber,  bg: theme.amberBg,  border: theme.amberBorder  };
  if (st === "unpaid")  return { color: theme.red,    bg: theme.redBg,    border: theme.redBorder    };
  return                        { color: theme.muted,  bg: theme.bg,       border: theme.border       };
}

const makeId = () => Math.random().toString(36).slice(2, 9);
const makeInvNum = () => `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

export default function InvoicingScreen() {
  const [invoices,    setInvoices]    = useState<Invoice[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [selected,    setSelected]    = useState<Invoice | null>(null);
  const [marking,     setMarking]     = useState(false);
  const [showNew,     setShowNew]     = useState(false);

  // New invoice form state
  const [newCustomer, setNewCustomer] = useState("");
  const [newTerms,    setNewTerms]    = useState("Net 30");
  const [newTaxPct,   setNewTaxPct]   = useState("0");
  const [newNotes,    setNewNotes]    = useState("");
  const [newItems,    setNewItems]    = useState<InvoiceItem[]>([
    { id: makeId(), desc: "", qty: 1, unitPrice: 0, total: 0 },
  ]);
  const [creating,    setCreating]    = useState(false);

  const extractSku = (desc: string) => { const m = desc.match(/[A-Z]{2,}-[\w-]+/i); return m ? m[0].toUpperCase() : null; };

  const showSkuInfo = async (sku: string) => {
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) return;
      const item = await fetchInventoryBySku(workspaceId, sku);
      if (!item) { Alert.alert("Not Found", `No inventory record for ${sku}.`); return; }
      Alert.alert("SKU Details", `SKU: ${item.sku}\nName: ${item.name}\nStock: ${item.stockLevel}\nReorder Point: ${item.reorderPoint}\nUnit Cost: $${Number(item.unitCost).toFixed(2)}`);
    } catch (e: any) { Alert.alert("Error", e.message); }
  };

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) { setSessionExpired(true); return; }
      const data = await fetchInvoices(workspaceId);
      setInvoices(Array.isArray(data) ? data : []);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const { search, setSearch, sortBy, setSortBy, sortDir, setSortDir, filtered } = useFilterSort(invoices, {
    searchFields: (inv) => [inv.customer, inv.invoiceNumber],
    sortOptions: [
      { value: "issueDate", label: "Issue date", get: (inv) => inv.issueDate ?? "" },
      { value: "customer",  label: "Customer",   get: (inv) => (inv.customer || "").toLowerCase() },
      { value: "total",     label: "Total",      get: (inv) => inv.total ?? 0 },
      { value: "dueDate",   label: "Due date",   get: (inv) => inv.dueDate ?? "" },
      { value: "status",    label: "Status",     get: (inv) => inv.status ?? "" },
    ],
    defaultSort: "issueDate",
    defaultDir: "desc",
  });

  if (sessionExpired) return <SessionExpiredView />;

  // ── Line item helpers ──────────────────────────────────────────────────────
  const updateItem = (idx: number, field: keyof InvoiceItem, val: string) => {
    setNewItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: field === "desc" ? val : parseFloat(val) || 0 };
      updated.total = updated.qty * updated.unitPrice;
      return updated;
    }));
  };

  const addItem    = () => setNewItems(prev => [...prev, { id: makeId(), desc: "", qty: 1, unitPrice: 0, total: 0 }]);
  const removeItem = (idx: number) => setNewItems(prev => prev.filter((_, i) => i !== idx));

  const subtotal = newItems.reduce((sum, it) => sum + it.total, 0);
  const taxAmt   = subtotal * (parseFloat(newTaxPct) || 0) / 100;
  const totalAmt = subtotal + taxAmt;

  const resetForm = () => {
    setNewCustomer(""); setNewTerms("Net 30"); setNewTaxPct("0"); setNewNotes("");
    setNewItems([{ id: makeId(), desc: "", qty: 1, unitPrice: 0, total: 0 }]);
  };

  const submitNew = async () => {
    if (!newCustomer.trim()) { Alert.alert("Required", "Customer name is required."); return; }
    const validItems = newItems.filter(it => it.desc.trim());
    if (validItems.length === 0) { Alert.alert("Required", "Add at least one line item with a description."); return; }
    setCreating(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) { setSessionExpired(true); return; }
      const issueDate = new Date().toISOString().split("T")[0];
      const dueDate   = calcDueDate(issueDate, newTerms);
      const inv = await createInvoice({
        workspaceId,
        invoiceNumber: makeInvNum(),
        customer:      newCustomer.trim(),
        items:         validItems,
        subtotal:      parseFloat(subtotal.toFixed(2)),
        tax:           parseFloat(taxAmt.toFixed(2)),
        total:         parseFloat(totalAmt.toFixed(2)),
        amountPaid:    0,
        paymentTerms:  newTerms,
        issueDate,
        dueDate,
        status:        "unpaid",
        notes:         newNotes.trim(),
        currency:      "USD",
      });
      setInvoices(prev => [inv, ...prev]);
      setShowNew(false);
      resetForm();
      Alert.alert("Created", `Invoice ${inv.invoiceNumber} created.`);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setCreating(false); }
  };

  const markPaid = async (inv: Invoice) => {
    Alert.alert("Mark as Paid", `Mark ${inv.invoiceNumber} as fully paid ($${(inv.total || 0).toLocaleString()})?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Mark Paid",
        onPress: async () => {
          setMarking(true);
          try {
            await updateInvoiceStatus(inv.id, "paid", inv.total || 0);
            const updated = { ...inv, status: "paid", amountPaid: inv.total };
            setInvoices(prev => prev.map(i => i.id === inv.id ? updated : i));
            setSelected(updated);
            Alert.alert("Done", "Invoice marked as paid.");
          } catch (e: any) { Alert.alert("Error", e.message); }
          finally { setMarking(false); }
        },
      },
    ]);
  };

  if (loading) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg }}>
      <ActivityIndicator size="large" color={theme.blue} />
    </View>
  );

  // ── Detail view ────────────────────────────────────────────────────────────
  if (selected) {
    const st = statusColor(selected.status);
    const outstanding = (selected.total || 0) - (selected.amountPaid || 0);
    const canMarkPaid = ["unpaid", "partial", "sent", "overdue"].includes(selected.status);

    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 16, paddingBottom: 0 }}>
          <Text style={{ color: theme.blue, fontWeight: "700", fontSize: 14 }}>← All Invoices</Text>
        </TouchableOpacity>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={s.card}>
            <Text style={{ fontSize: 11, color: theme.muted, fontWeight: "700", marginBottom: 4 }}>{selected.invoiceNumber}</Text>
            <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text, marginBottom: 8 }}>{selected.customer}</Text>
            <View style={s.badge(st.bg, st.color, st.border)}>
              <Text style={s.badgeText(st.color)}>{selected.status.toUpperCase()}</Text>
            </View>

            {/* Line items */}
            {Array.isArray(selected.items) && selected.items.length > 0 && (
              <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.border }}>
                <Text style={{ fontSize: 11, color: theme.muted, fontWeight: "700", marginBottom: 8 }}>LINE ITEMS</Text>
                {(selected.items as InvoiceItem[]).map((item, idx) => {
                  const sku = extractSku(item.desc);
                  return (
                    <View key={idx} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        {sku ? (
                          <TouchableOpacity onPress={() => showSkuInfo(sku)}>
                            <Text style={{ fontSize: 13, color: theme.blue, textDecorationLine: "underline" }}>{item.desc}</Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={{ fontSize: 13, color: theme.text }}>{item.desc}</Text>
                        )}
                        <Text style={{ fontSize: 11, color: theme.muted }}>{item.qty} × ${(item.unitPrice || 0).toFixed(2)}</Text>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: theme.text }}>${(item.total || 0).toFixed(2)}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Totals */}
            <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.border }}>
              {(selected.tax > 0) && (
                <>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={{ color: theme.muted, fontSize: 13 }}>Subtotal</Text>
                    <Text style={{ color: theme.text, fontSize: 13 }}>${(selected.subtotal || 0).toFixed(2)}</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={{ color: theme.muted, fontSize: 13 }}>Tax</Text>
                    <Text style={{ color: theme.text, fontSize: 13 }}>${(selected.tax || 0).toFixed(2)}</Text>
                  </View>
                </>
              )}
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                <Text style={{ color: theme.muted, fontSize: 13, fontWeight: "700" }}>Total</Text>
                <Text style={{ color: theme.text, fontWeight: "800", fontSize: 14 }}>${(selected.total || 0).toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                <Text style={{ color: theme.muted, fontSize: 13 }}>Paid</Text>
                <Text style={{ color: theme.green, fontWeight: "700", fontSize: 13 }}>${(selected.amountPaid || 0).toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: theme.muted, fontSize: 13 }}>Outstanding</Text>
                <Text style={{ color: outstanding > 0 ? theme.red : theme.green, fontWeight: "700", fontSize: 13 }}>
                  ${outstanding.toFixed(2)}
                </Text>
              </View>
            </View>

            {selected.paymentTerms ? (
              <Text style={{ fontSize: 12, color: theme.muted, marginTop: 10 }}>Terms: {selected.paymentTerms}</Text>
            ) : null}
            {selected.dueDate ? (
              <Text style={{ fontSize: 12, color: theme.muted }}>Due: {new Date(selected.dueDate).toLocaleDateString()}</Text>
            ) : null}
            {selected.notes ? (
              <Text style={{ fontSize: 12, color: theme.muted, marginTop: 6, fontStyle: "italic" }}>{selected.notes}</Text>
            ) : null}
          </View>

          {canMarkPaid && (
            <TouchableOpacity
              onPress={() => markPaid(selected)}
              disabled={marking}
              style={[s.card, { backgroundColor: theme.greenBg, borderColor: theme.greenBorder, borderWidth: 1, marginTop: 16, opacity: marking ? 0.6 : 1 }]}
            >
              <Text style={{ color: theme.green, fontWeight: "700", fontSize: 14 }}>
                {marking ? "Saving…" : "✓ Mark as Paid"}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.blue} />}
      >
        <Text style={[s.heading, { marginBottom: 16 }]}>Invoices</Text>
        <SearchSortBar
          search={search} setSearch={setSearch}
          sortBy={sortBy} setSortBy={setSortBy}
          sortDir={sortDir} setSortDir={setSortDir}
          sortOptions={[
            { value: "issueDate", label: "Issue" },
            { value: "customer",  label: "Customer" },
            { value: "total",     label: "Total" },
            { value: "dueDate",   label: "Due" },
            { value: "status",    label: "Status" },
          ]}
          placeholder="Search customer or invoice #…"
        />
        {filtered.length === 0 ? (
          <View style={[s.card, { alignItems: "center", padding: 32 }]}>
            <Text style={{ color: theme.muted, fontSize: 13 }}>{invoices.length === 0 ? "No invoices yet. Tap + to create one." : "No invoices match."}</Text>
          </View>
        ) : filtered.map(inv => {
          const st = statusColor(inv.status);
          const outstanding = (inv.total || 0) - (inv.amountPaid || 0);
          return (
            <TouchableOpacity key={inv.id} style={[s.card, { marginBottom: 10 }]} onPress={() => setSelected(inv)} activeOpacity={0.85}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <Text style={{ fontSize: 11, color: theme.muted, fontWeight: "700" }}>{inv.invoiceNumber}</Text>
                <View style={s.badge(st.bg, st.color, st.border)}>
                  <Text style={s.badgeText(st.color)}>{inv.status.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text, marginBottom: 4 }}>{inv.customer}</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 12, color: theme.muted }}>Total: ${(inv.total || 0).toLocaleString()}</Text>
                <Text style={{ fontSize: 12, fontWeight: "700", color: outstanding > 0 ? theme.red : theme.green }}>
                  Due: ${outstanding.toLocaleString()}
                </Text>
              </View>
              {inv.dueDate && (
                <Text style={{ fontSize: 11, color: theme.muted, marginTop: 4 }}>
                  Due: {new Date(inv.dueDate).toLocaleDateString()}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity onPress={() => setShowNew(true)} style={styles.fab}>
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "300" }}>+</Text>
      </TouchableOpacity>

      {/* Create Invoice Modal */}
      <Modal visible={showNew} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <Text style={styles.modalTitle}>New Invoice</Text>
                <TouchableOpacity onPress={() => { setShowNew(false); resetForm(); }}>
                  <Text style={{ fontSize: 20, color: theme.muted }}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Customer */}
              <Text style={s.label}>CUSTOMER *</Text>
              <TextInput style={styles.input} value={newCustomer} onChangeText={setNewCustomer}
                placeholder="Customer name" placeholderTextColor={theme.subtle} />

              {/* Payment terms */}
              <Text style={s.label}>PAYMENT TERMS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, marginTop: 4 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {PAYMENT_TERMS.map(t => (
                    <TouchableOpacity key={t} onPress={() => setNewTerms(t)}
                      style={[styles.chip, newTerms === t && { backgroundColor: theme.blue, borderColor: theme.blue }]}>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: newTerms === t ? "#fff" : theme.muted }}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Tax % */}
              <Text style={s.label}>TAX %</Text>
              <TextInput style={styles.input} value={newTaxPct} onChangeText={setNewTaxPct}
                keyboardType="decimal-pad" placeholder="0" placeholderTextColor={theme.subtle} />

              {/* Line items */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <Text style={s.label}>LINE ITEMS *</Text>
                <TouchableOpacity onPress={addItem}>
                  <Text style={{ color: theme.blue, fontWeight: "700", fontSize: 13 }}>+ Add Item</Text>
                </TouchableOpacity>
              </View>

              {newItems.map((item, idx) => (
                <View key={item.id} style={styles.lineItem}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <Text style={{ fontSize: 11, color: theme.muted, fontWeight: "700" }}>ITEM {idx + 1}</Text>
                    {newItems.length > 1 && (
                      <TouchableOpacity onPress={() => removeItem(idx)}>
                        <Text style={{ color: theme.red, fontSize: 13, fontWeight: "700" }}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TextInput style={styles.input} value={item.desc} onChangeText={v => updateItem(idx, "desc", v)}
                    placeholder="Description" placeholderTextColor={theme.subtle} />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.label, { marginTop: 0 }]}>QTY</Text>
                      <TextInput style={styles.input} value={String(item.qty)}
                        onChangeText={v => updateItem(idx, "qty", v)}
                        keyboardType="decimal-pad" placeholder="1" placeholderTextColor={theme.subtle} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.label, { marginTop: 0 }]}>UNIT PRICE ($)</Text>
                      <TextInput style={styles.input}
                        value={item.unitPrice ? String(item.unitPrice) : ""}
                        onChangeText={v => updateItem(idx, "unitPrice", v)}
                        keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={theme.subtle} />
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, color: theme.muted, textAlign: "right" }}>
                    Line total: ${item.total.toFixed(2)}
                  </Text>
                </View>
              ))}

              {/* Totals summary */}
              <View style={[s.card, { marginTop: 4, marginBottom: 8, backgroundColor: theme.bg }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: theme.muted }}>Subtotal</Text>
                  <Text style={{ fontSize: 12, color: theme.text }}>${subtotal.toFixed(2)}</Text>
                </View>
                {taxAmt > 0 && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: theme.muted }}>Tax ({newTaxPct}%)</Text>
                    <Text style={{ fontSize: 12, color: theme.text }}>${taxAmt.toFixed(2)}</Text>
                  </View>
                )}
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: theme.text }}>Total</Text>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: theme.blue }}>${totalAmt.toFixed(2)}</Text>
                </View>
              </View>

              {/* Notes */}
              <Text style={s.label}>NOTES</Text>
              <TextInput style={[styles.input, { minHeight: 60 }]} value={newNotes} onChangeText={setNewNotes}
                placeholder="Optional notes…" placeholderTextColor={theme.subtle} multiline />

              <TouchableOpacity onPress={submitNew} disabled={creating}
                style={{ backgroundColor: theme.blue, borderRadius: 10, padding: 14, alignItems: "center", opacity: creating ? 0.6 : 1, marginTop: 4 }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
                  {creating ? "Creating…" : "Create Invoice"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fab:          { position: "absolute", bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.blue, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 6 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard:    { backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, maxHeight: "92%" },
  modalTitle:   { fontSize: 18, fontWeight: "800", color: theme.text },
  input:        { borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 10, color: theme.text, fontSize: 13, backgroundColor: theme.bg, marginBottom: 12, marginTop: 4 },
  chip:         { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.bg },
  lineItem:     { borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 12, marginBottom: 10, backgroundColor: theme.bg },
});
