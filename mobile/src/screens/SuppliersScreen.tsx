// mobile/src/screens/SuppliersScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from "react-native";
import { theme, s } from "../lib/theme";
import { fetchSuppliers, getSession } from "../lib/api";

interface Supplier {
  id: string; name: string; contactName?: string; email?: string;
  status?: string; leadTimeDays?: number; rating?: number;
}

function renderStars(rating: number | undefined) {
  if (!rating) return "—";
  const stars = Math.round(rating);
  return "★".repeat(stars) + "☆".repeat(5 - stars);
}

export default function SuppliersScreen() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected,  setSelected]  = useState<Supplier | null>(null);

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

  if (loading) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg }}><ActivityIndicator size="large" color={theme.blue} /></View>;

  if (selected) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 16, paddingBottom: 0 }}>
          <Text style={{ color: theme.blue, fontWeight: "700", fontSize: 14 }}>← All Suppliers</Text>
        </TouchableOpacity>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={s.card}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text, marginBottom: 12 }}>{selected.name}</Text>
            {selected.contactName && <Text style={{ fontSize: 13, color: theme.muted, marginBottom: 4 }}>Contact: {selected.contactName}</Text>}
            {selected.email && <Text style={{ fontSize: 13, color: theme.blue, marginBottom: 8 }}>{selected.email}</Text>}
            {selected.status && (
              <View style={[s.badge(
                selected.status === "active" ? theme.greenBg : theme.redBg,
                selected.status === "active" ? theme.green : theme.red,
                selected.status === "active" ? theme.greenBorder : theme.redBorder
              ), { marginBottom: 8 }]}>
                <Text style={s.badgeText(selected.status === "active" ? theme.green : theme.red)}>{selected.status.toUpperCase()}</Text>
              </View>
            )}
            {selected.leadTimeDays !== undefined && (
              <Text style={{ fontSize: 13, color: theme.muted, marginTop: 12 }}>Lead Time: {selected.leadTimeDays} days</Text>
            )}
            {selected.rating !== undefined && (
              <Text style={{ fontSize: 13, color: theme.amber, fontWeight: "700", marginTop: 6 }}>Rating: {renderStars(selected.rating)}</Text>
            )}
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
        <Text style={[s.heading, { marginBottom: 16 }]}>Suppliers</Text>
        {suppliers.length === 0 ? (
          <View style={[s.card, { alignItems: "center", padding: 32 }]}>
            <Text style={{ color: theme.muted, fontSize: 13 }}>No suppliers found.</Text>
          </View>
        ) : suppliers.map(sup => (
          <TouchableOpacity key={sup.id} style={[s.card, { marginBottom: 10 }]} onPress={() => setSelected(sup)} activeOpacity={0.85}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text, marginBottom: 6 }}>{sup.name}</Text>
            {sup.email && <Text style={{ fontSize: 12, color: theme.muted, marginBottom: 4 }}>{sup.email}</Text>}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 12, color: theme.amber }}>{renderStars(sup.rating)}</Text>
              {sup.leadTimeDays !== undefined && (
                <Text style={{ fontSize: 12, color: theme.muted }}>Lead: {sup.leadTimeDays}d</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
