// mobile/src/screens/InventoryScreen.tsx
// Stock list + barcode scanning for warehouse workers
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
import { fetchInventory, updateInventoryItem, getSession } from "../lib/api";

interface Item {
  id: string; sku: string; name: string; category: string;
  stockLevel: number; reorderPoint: number; warehouse: string;
  zone: string; binLocation: string; supplier: string;
}

function stockBadge(item: Item) {
  if (item.stockLevel === 0)                              return { label: "Out",      ...badgeStyle(theme.red,   theme.redBg,   theme.redBorder)   };
  if (item.stockLevel <= item.reorderPoint * 0.5)         return { label: "Critical", ...badgeStyle(theme.red,   theme.redBg,   theme.redBorder)   };
  if (item.stockLevel <= item.reorderPoint)               return { label: "Low",      ...badgeStyle(theme.amber, theme.amberBg, theme.amberBorder) };
  return                                                         { label: "OK",       ...badgeStyle(theme.green, theme.greenBg, theme.greenBorder) };
}

function badgeStyle(color: string, bg: string, border: string) {
  return { color, bg, border };
}

export default function InventoryScreen() {
  const [items,      setItems]      = useState<Item[]>([]);
  const [filtered,   setFiltered]   = useState<Item[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState("");
  const [scanning,   setScanning]   = useState(false);
  const [scanned,    setScanned]    = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [editItem,   setEditItem]   = useState<Item | null>(null);
  const [editQty,    setEditQty]    = useState("");

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) return;
      const data = await fetchInventory(workspaceId);
      setItems(data);
      setFiltered(data);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const q = search.toLowerCase().trim();
    setFiltered(q ? items.filter(i => i.sku.toLowerCase().includes(q) || i.name.toLowerCase().includes(q) || i.binLocation.toLowerCase().includes(q)) : items);
  }, [search, items]);

  const openScanner = async () => {
    if (Platform.OS === "web") { setScanning(true); return; }
    if (!permission?.granted) {
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
    // Auto-search for the scanned SKU
    setSearch(data);
    const found = items.find(i => i.sku === data || i.binLocation === data);
    if (found) {
      Alert.alert("SKU Found", `${found.name}\nStock: ${found.stockLevel} · Bin: ${found.binLocation || "—"}`);
    } else {
      Alert.alert("Not Found", `No item found for: ${data}`);
    }
  };

  const saveStockEdit = async () => {
    if (!editItem) return;
    const qty = parseInt(editQty, 10);
    if (isNaN(qty) || qty < 0) { Alert.alert("Invalid qty"); return; }
    try {
      await updateInventoryItem(editItem.id, { stockLevel: qty });
      setItems(prev => prev.map(i => i.id === editItem.id ? { ...i, stockLevel: qty } : i));
      setEditItem(null);
      if (Haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
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
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search SKU, name or bin…"
          placeholderTextColor={theme.subtle}
          returnKeyType="search"
        />
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
            <TouchableOpacity key={item.id} style={s.card} onPress={() => { setEditItem(item); setEditQty(String(item.stockLevel)); }} activeOpacity={0.85}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "700", fontSize: 14, color: theme.text }}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>
                    {item.sku}{item.binLocation ? ` · Bin ${item.binLocation}` : ""}
                    {item.warehouse ? ` · ${item.warehouse}${item.zone ? " " + item.zone : ""}` : ""}
                  </Text>
                </View>
                <View style={[s.badge(badge.bg, badge.color, badge.border)]}>
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
                {item.supplier && (
                  <View>
                    <Text style={styles.statLabel}>Supplier</Text>
                    <Text style={{ fontSize: 12, color: theme.muted }}>{item.supplier}</Text>
                  </View>
                )}
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

      {/* Barcode scanner modal — camera on native, text input on web */}
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

      {/* Edit stock modal */}
      <Modal visible={!!editItem} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editItem?.name}</Text>
            <Text style={{ color: theme.muted, fontSize: 12, marginBottom: 16 }}>{editItem?.sku}</Text>
            <Text style={s.label}>Update Stock Level</Text>
            <TextInput
              style={styles.input}
              value={editQty}
              onChangeText={setEditQty}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={theme.subtle}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={saveStockEdit}>
                <Text style={styles.btnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnOutline, { flex: 1 }]} onPress={() => setEditItem(null)}>
                <Text style={styles.btnOutlineText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  scanOverlay:  { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center" },
  scanFrame:    { width: 260, height: 180, borderWidth: 2, borderColor: theme.green, borderRadius: 12 },
  scanHint:     { color: "#fff", marginTop: 16, fontSize: 14 },
  cancelBtn:    { marginTop: 32, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard:    { backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle:   { fontSize: 18, fontWeight: "800", color: theme.text, marginBottom: 2 },
  input:        { borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 12, fontSize: 16, color: theme.text, backgroundColor: theme.bg, marginBottom: 16 },
  btn:          { backgroundColor: theme.blue, borderRadius: 10, padding: 14, alignItems: "center" },
  btnText:      { color: "#fff", fontWeight: "700", fontSize: 14 },
  btnOutline:   { borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 14, alignItems: "center" },
  btnOutlineText:{ color: theme.muted, fontWeight: "700", fontSize: 14 },
});
