// mobile/src/screens/InventoryScreen.tsx
// Stock list + barcode scanning + Add Item + extended edit (reorder, zone, bin)
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert, Modal, Platform,
} from "react-native";
import { theme, s } from "../lib/theme";

let CameraView: any           = null;
let useCameraPermissions: any = () => [null, async () => ({ granted: false })];
let Haptics: any              = null;
if (Platform.OS !== "web") {
  const cam            = require("expo-camera");
  CameraView           = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
  Haptics              = require("expo-haptics");
}
import { fetchInventory, updateInventoryItem, createInventoryItem, createAutoPo, getSession } from "../lib/api";
import { SessionExpiredView } from "../lib/sessionGuard";
import { useFilterSort, SearchSortBar } from "../lib/useFilterSort";

interface Item {
  id: string; sku: string; name: string; category: string;
  stockLevel: number; reorderPoint: number; warehouse: string;
  zone: string; binLocation: string; supplier: string;
}

function stockBadge(item: Item) {
  if (item.stockLevel === 0)                              return { label: "Out",      color: theme.red,   bg: theme.redBg,   border: theme.redBorder   };
  if (item.stockLevel <= item.reorderPoint * 0.5)         return { label: "Critical", color: theme.red,   bg: theme.redBg,   border: theme.redBorder   };
  if (item.stockLevel <= item.reorderPoint)               return { label: "Low",      color: theme.amber, bg: theme.amberBg, border: theme.amberBorder };
  return                                                         { label: "OK",       color: theme.green, bg: theme.greenBg, border: theme.greenBorder };
}

export default function InventoryScreen() {
  const [items,      setItems]      = useState<Item[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [scanning,   setScanning]   = useState(false);
  const [scanned,    setScanned]    = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  // Edit modal state
  const [editItem,    setEditItem]    = useState<Item | null>(null);
  const [editQty,     setEditQty]     = useState("");
  const [editReorder, setEditReorder] = useState("");
  const [editZone,    setEditZone]    = useState("");
  const [editBin,     setEditBin]     = useState("");
  const [saving,      setSaving]      = useState(false);
  // New item modal state
  const [showNew,     setShowNew]     = useState(false);
  const [newSku,      setNewSku]      = useState("");
  const [newName,     setNewName]     = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newStock,    setNewStock]    = useState("");
  const [newReorder,  setNewReorder]  = useState("");
  const [newWarehouse,setNewWarehouse]= useState("");
  const [creating,    setCreating]    = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) { setSessionExpired(true); return; }
      const data = await fetchInventory(workspaceId);
      setItems(data);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const { search, setSearch, sortBy, setSortBy, sortDir, setSortDir, filtered } = useFilterSort(items, {
    searchFields: (i) => [i.sku, i.name, i.category, i.supplier, i.binLocation],
    sortOptions: [
      { value: "sku",        label: "SKU",       get: (i) => (i.sku || "").toLowerCase() },
      { value: "name",       label: "Name",      get: (i) => (i.name || "").toLowerCase() },
      { value: "stockLevel", label: "Stock",     get: (i) => i.stockLevel ?? 0 },
      { value: "unitCost",   label: "Unit cost", get: (i) => (i as any).unitCost ?? 0 },
    ],
    defaultSort: "sku",
    defaultDir: "asc",
  });

  if (sessionExpired) return <SessionExpiredView />;

  const openEdit = (item: Item) => {
    setEditItem(item);
    setEditQty(String(item.stockLevel));
    setEditReorder(String(item.reorderPoint));
    setEditZone(item.zone || "");
    setEditBin(item.binLocation || "");
  };

  const openScanner = async () => {
    if (Platform.OS === "web") { setScanning(true); return; }
    if (!permission || !permission.granted) {
      const result = await requestPermission();
      if (!result.granted) { Alert.alert("Camera permission denied"); return; }
    }
    setScanned(false);
    setScanning(true);
  };

  const handleScan = ({ data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);
    if (Haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setScanning(false);
    setSearch(data);
    const found = items.find(i => i.sku === data || i.binLocation === data);
    if (found) {
      Alert.alert("SKU Found", `${found.name}\nStock: ${found.stockLevel} · Bin: ${found.binLocation || "—"}`);
    } else {
      Alert.alert("Not Found", `No item found for: ${data}`);
    }
  };

  const saveEdit = async () => {
    if (!editItem) return;
    const qty = parseInt(editQty, 10);
    if (isNaN(qty) || qty < 0) { Alert.alert("Invalid qty"); return; }
    setSaving(true);
    try {
      const fields: Record<string, any> = { stockLevel: qty };
      const reorder = parseInt(editReorder, 10);
      if (!isNaN(reorder) && reorder >= 0) fields.reorderPoint = reorder;
      if (editZone.trim()) fields.zone = editZone.trim();
      if (editBin.trim())  fields.binLocation = editBin.trim();
      await updateInventoryItem(editItem.id, fields);
      setItems(prev => prev.map(i => i.id === editItem.id ? { ...i, stockLevel: qty, ...fields } : i));
      setEditItem(null);
      if (Haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally { setSaving(false); }
  };

  const submitNew = async () => {
    if (!newSku.trim())  { Alert.alert("Required", "SKU is required."); return; }
    if (!newName.trim()) { Alert.alert("Required", "Name is required."); return; }
    setCreating(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) { setSessionExpired(true); return; }
      const item = await createInventoryItem({
        workspaceId, sku: newSku.trim(), name: newName.trim(),
        category: newCategory.trim(), stockLevel: parseInt(newStock, 10) || 0,
        reorderPoint: parseInt(newReorder, 10) || 0, warehouse: newWarehouse.trim(),
      });
      setItems(prev => [item, ...prev]);
      setShowNew(false);
      setNewSku(""); setNewName(""); setNewCategory(""); setNewStock(""); setNewReorder(""); setNewWarehouse("");
      Alert.alert("Created", `${item.name} added to inventory.`);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setCreating(false); }
  };

  const reorderItem = async (item: Item) => {
    if (!item.supplier || item.supplier === "—") {
      Alert.alert("No Supplier", "This item has no supplier configured. Add a supplier first.");
      return;
    }
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) { return; }
      await autoCreatePurchaseOrder(workspaceId, item.id);
      Alert.alert("Reorder Created", `Purchase order created for ${item.name} (${item.sku}). Check Purchase Orders for details.`);
    } catch (e: any) { Alert.alert("Error", e.message); }
  };

  if (loading) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg }}>
      <ActivityIndicator size="large" color={theme.blue} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Search + Scan bar */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <SearchSortBar
            search={search} setSearch={setSearch}
            sortBy={sortBy} setSortBy={setSortBy}
            sortDir={sortDir} setSortDir={setSortDir}
            sortOptions={[
              { value: "sku",        label: "SKU" },
              { value: "name",       label: "Name" },
              { value: "stockLevel", label: "Stock" },
              { value: "unitCost",   label: "Unit cost" },
            ]}
            placeholder="Search SKU, name, category, supplier…"
          />
        </View>
        <TouchableOpacity style={styles.scanBtn} onPress={openScanner} activeOpacity={0.85}>
          <Text style={styles.scanBtnText}>📷 Scan</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        refreshControl={Platform.OS !== "web"
          ? <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.blue} />
          : undefined}
      >
        <Text style={styles.count}>{filtered.length} item{filtered.length !== 1 ? "s" : ""}</Text>

        {filtered.map(item => {
          const badge = stockBadge(item);
          return (
            <TouchableOpacity key={item.id} style={s.card} onPress={() => openEdit(item)} activeOpacity={0.85}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "700", fontSize: 14, color: theme.text }}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>
                    {item.sku}{item.binLocation ? ` · Bin ${item.binLocation}` : ""}
                    {item.warehouse ? ` · ${item.warehouse}${item.zone ? " " + item.zone : ""}` : ""}
                  </Text>
                </View>
                <View style={s.badge(badge.bg, badge.color, badge.border)}>
                  <Text style={s.badgeText(badge.color)}>{badge.label}</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", marginTop: 10, gap: 16 }}>
                <View>
                  <Text style={styles.statLabel}>Stock</Text>
                  <Text style={{ fontSize: 20, fontWeight: "800", color: badge.color }}>{item.stockLevel}</Text>
                </View>
                <View>
                  <Text style={styles.statLabel}>Reorder At</Text>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: theme.muted }}>{item.reorderPoint}</Text>
                </View>
                {item.supplier ? (
                  <View>
                    <Text style={styles.statLabel}>Supplier</Text>
                    <Text style={{ fontSize: 12, color: theme.muted }}>{item.supplier}</Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  style={{ marginLeft: "auto", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: theme.amberBorder, backgroundColor: theme.amberBg, alignSelf: "center" }}
                  onPress={() => reorderItem(item)}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: theme.amber }}>Reorder</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}

        {filtered.length === 0 && (
          <Text style={{ textAlign: "center", color: theme.muted, marginTop: 40, fontSize: 14 }}>
            {search ? "No items match your search." : "No inventory items yet."}
          </Text>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity onPress={() => setShowNew(true)} style={styles.fab}>
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "300" }}>+</Text>
      </TouchableOpacity>

      {/* Barcode scanner modal */}
      <Modal visible={scanning} animationType="slide">
        {Platform.OS === "web" ? (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Enter SKU</Text>
              <TextInput style={styles.input} placeholder="e.g. SKU-001" placeholderTextColor={theme.subtle}
                autoFocus returnKeyType="search"
                onSubmitEditing={e => { setScanning(false); setSearch(e.nativeEvent.text.trim()); }} />
              <TouchableOpacity style={styles.btnOutline} onPress={() => setScanning(false)}>
                <Text style={styles.btnOutlineText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ flex: 1, backgroundColor: "#000" }}>
            {CameraView && <CameraView style={{ flex: 1 }} facing="back"
              onBarcodeScanned={scanned ? undefined : handleScan}
              barcodeScannerSettings={{ barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39", "upcA", "upcE"] }} />}
            <View style={styles.scanOverlay}>
              <View style={styles.scanFrame} />
              <Text style={styles.scanHint}>Point camera at a barcode</Text>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setScanning(false)}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>

      {/* Edit item modal — stock + reorder + zone + bin */}
      <Modal visible={!!editItem} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <Text style={styles.modalTitle}>{editItem ? editItem.name : ""}</Text>
              <TouchableOpacity onPress={() => setEditItem(null)}>
                <Text style={{ fontSize: 20, color: theme.muted }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ color: theme.muted, fontSize: 12, marginBottom: 16 }}>{editItem ? editItem.sku : ""}</Text>
            <Text style={s.label}>STOCK LEVEL</Text>
            <TextInput style={styles.input} value={editQty} onChangeText={setEditQty}
              keyboardType="number-pad" placeholder="0" placeholderTextColor={theme.subtle} />
            <Text style={s.label}>REORDER POINT</Text>
            <TextInput style={styles.input} value={editReorder} onChangeText={setEditReorder}
              keyboardType="number-pad" placeholder="0" placeholderTextColor={theme.subtle} />
            <Text style={s.label}>ZONE</Text>
            <TextInput style={styles.input} value={editZone} onChangeText={setEditZone}
              placeholder="e.g. A, B, Cold" placeholderTextColor={theme.subtle} />
            <Text style={s.label}>BIN LOCATION</Text>
            <TextInput style={styles.input} value={editBin} onChangeText={setEditBin}
              placeholder="e.g. A-12-3" placeholderTextColor={theme.subtle} />
            <TouchableOpacity
              style={[styles.btnOutline, { marginBottom: 10, borderColor: theme.greenBorder, backgroundColor: theme.greenBg }]}
              onPress={() => {
                if (!editItem) return;
                Alert.alert(
                  "Auto-PO?",
                  `Create a Purchase Order for ${editItem.sku} (${editItem.name})?\n\nSends a PO to the linked supplier. The item must have a supplier assigned.`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Create PO", onPress: async () => {
                        try {
                          const { workspaceId } = await getSession();
                          if (!workspaceId) { setSessionExpired(true); return; }
                          await createAutoPo(workspaceId, editItem.id);
                          Alert.alert("PO Created", `Purchase Order created for ${editItem.sku}.`);
                          setEditItem(null);
                        } catch (e: any) {
                          Alert.alert("Could not create PO", e?.message || "Make sure this item has a supplier assigned.");
                        }
                      },
                    },
                  ],
                );
              }}
            >
              <Text style={[styles.btnOutlineText, { color: theme.green }]}>📦 Auto-PO</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity style={[styles.btn, { flex: 2, opacity: saving ? 0.6 : 1 }]} onPress={saveEdit} disabled={saving}>
                <Text style={styles.btnText}>{saving ? "Saving…" : "Save Changes"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnOutline, { flex: 1 }]} onPress={() => setEditItem(null)}>
                <Text style={styles.btnOutlineText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* New Item Modal */}
      <Modal visible={showNew} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
            <View style={styles.modalCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <Text style={styles.modalTitle}>Add Item</Text>
                <TouchableOpacity onPress={() => setShowNew(false)}>
                  <Text style={{ fontSize: 20, color: theme.muted }}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.label}>SKU *</Text>
              <TextInput style={styles.input} value={newSku} onChangeText={setNewSku}
                placeholder="e.g. SKU-001" placeholderTextColor={theme.subtle} />
              <Text style={s.label}>NAME *</Text>
              <TextInput style={styles.input} value={newName} onChangeText={setNewName}
                placeholder="Product name" placeholderTextColor={theme.subtle} />
              <Text style={s.label}>CATEGORY</Text>
              <TextInput style={styles.input} value={newCategory} onChangeText={setNewCategory}
                placeholder="e.g. Electronics" placeholderTextColor={theme.subtle} />
              <Text style={s.label}>STOCK LEVEL</Text>
              <TextInput style={styles.input} value={newStock} onChangeText={setNewStock}
                keyboardType="number-pad" placeholder="0" placeholderTextColor={theme.subtle} />
              <Text style={s.label}>REORDER POINT</Text>
              <TextInput style={styles.input} value={newReorder} onChangeText={setNewReorder}
                keyboardType="number-pad" placeholder="0" placeholderTextColor={theme.subtle} />
              <Text style={s.label}>WAREHOUSE</Text>
              <TextInput style={styles.input} value={newWarehouse} onChangeText={setNewWarehouse}
                placeholder="e.g. Main Warehouse" placeholderTextColor={theme.subtle} />
              <TouchableOpacity onPress={submitNew} disabled={creating}
                style={{ backgroundColor: theme.blue, borderRadius: 10, padding: 14, alignItems: "center", opacity: creating ? 0.6 : 1 }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{creating ? "Adding…" : "Add Item"}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:       { flexDirection: "row", padding: 12, gap: 8, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  search:       { flex: 1, backgroundColor: theme.bg, borderRadius: 10, padding: 10, fontSize: 13, color: theme.text, borderWidth: 1, borderColor: theme.border },
  scanBtn:      { backgroundColor: theme.blue, borderRadius: 10, paddingHorizontal: 14, justifyContent: "center" },
  scanBtnText:  { color: "#fff", fontWeight: "700", fontSize: 13 },
  count:        { fontSize: 12, color: theme.muted, marginBottom: 10 },
  statLabel:    { fontSize: 10, color: theme.subtle, fontWeight: "600", textTransform: "uppercase" },
  fab:          { position: "absolute", bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.blue, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 6 },
  scanOverlay:  { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center" },
  scanFrame:    { width: 260, height: 180, borderWidth: 2, borderColor: theme.green, borderRadius: 12 },
  scanHint:     { color: "#fff", marginTop: 16, fontSize: 14 },
  cancelBtn:    { marginTop: 32, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard:    { backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle:   { fontSize: 18, fontWeight: "800", color: theme.text },
  input:        { borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 10, fontSize: 13, color: theme.text, backgroundColor: theme.bg, marginBottom: 12, marginTop: 4 },
  btn:          { backgroundColor: theme.blue, borderRadius: 10, padding: 14, alignItems: "center" },
  btnText:      { color: "#fff", fontWeight: "700", fontSize: 14 },
  btnOutline:   { borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 14, alignItems: "center" },
  btnOutlineText:{ color: theme.muted, fontWeight: "700", fontSize: 14 },
});
