// Reusable SKU details modal for mobile.
// Usage:
//   const [sku, setSku] = useState<string | null>(null);
//   <SkuModal sku={sku} workspaceId={workspaceId} onClose={() => setSku(null)} />
//   ... <SkuText sku={item.sku} onPress={() => setSku(item.sku)} />

import React, { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { fetchInventory } from "../lib/api";

type InvItem = {
  id: string;
  sku: string;
  name: string;
  category: string;
  stockLevel: number;
  reorderPoint: number;
  reorderQty: number;
  unitCost: number;
  warehouse: string;
  zone: string;
  binLocation: string;
  supplier: string;
};

export function SkuModal({
  sku,
  workspaceId,
  onClose,
}: {
  sku: string | null;
  workspaceId: string;
  onClose: () => void;
}) {
  const [item, setItem] = useState<InvItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!sku) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        setItem(null);
        const rows: InvItem[] = await fetchInventory(workspaceId);
        if (cancelled) return;
        const hit = rows.find((r) => r.sku === sku) ?? null;
        setItem(hit);
        if (!hit) setErr(`No inventory item matches SKU "${sku}"`);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Fetch error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sku, workspaceId]);

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value ?? "—"}</Text>
    </View>
  );

  return (
    <Modal visible={!!sku} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <View style={s.header}>
            <Text style={s.title}>Inventory: {sku}</Text>
            <Pressable onPress={onClose} style={s.closeBtn}>
              <Text style={s.closeX}>×</Text>
            </Pressable>
          </View>
          {loading && <ActivityIndicator color="#5b8de8" style={{ marginVertical: 24 }} />}
          {err && !loading && <Text style={s.err}>{err}</Text>}
          {item && !loading && (
            <View>
              <Row label="Name"        value={item.name} />
              <Row label="Category"    value={item.category} />
              <Row label="Stock level" value={String(item.stockLevel)} />
              <Row label="Reorder at"  value={String(item.reorderPoint)} />
              <Row label="Reorder qty" value={String(item.reorderQty)} />
              <Row label="Unit cost"   value={`$${Number(item.unitCost).toFixed(2)}`} />
              <Row label="Warehouse"   value={item.warehouse || "—"} />
              <Row label="Zone"        value={item.zone} />
              <Row label="Bin"         value={item.binLocation || "—"} />
              <Row label="Supplier"    value={item.supplier || "—"} />
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Clickable SKU text helper for mobile screens.
export function SkuText({ sku, onPress, style }: { sku: string; onPress: () => void; style?: any }) {
  if (!sku) return <Text style={style}>—</Text>;
  return (
    <Text onPress={onPress} style={[{ color: "#5b8de8", textDecorationLine: "underline" }, style]}>
      {sku}
    </Text>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#1a1d24",
    borderColor: "#2a2f3a",
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title:  { color: "#e5e7eb", fontSize: 15, fontWeight: "800" },
  closeBtn: { padding: 4 },
  closeX: { color: "#8a93a6", fontSize: 22, lineHeight: 22 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  rowLabel: { color: "#8a93a6", fontSize: 12 },
  rowValue: { color: "#e5e7eb", fontSize: 13, fontWeight: "600", maxWidth: "60%", textAlign: "right" },
  err: { color: "#ef8a8a", fontSize: 13, paddingVertical: 10 },
});
