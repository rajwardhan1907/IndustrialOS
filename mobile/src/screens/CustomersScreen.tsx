// mobile/src/screens/CustomersScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, SectionList,
} from "react-native";
import { theme, s } from "../lib/theme";
import { fetchCustomers, getSession } from "../lib/api";

interface Customer {
  id: string; name: string; contactName?: string; email?: string;
  status?: string; balanceDue?: number; notes?: string; creditLimit?: number; totalSpend?: number;
}

export default function CustomersScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected,  setSelected]  = useState<Customer | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) return;
      const data = await fetchCustomers(workspaceId);
      setCustomers(Array.isArray(data) ? data : []);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg }}><ActivityIndicator size="large" color={theme.blue} /></View>;

  if (selected) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 16, paddingBottom: 0 }}>
          <Text style={{ color: theme.blue, fontWeight: "700", fontSize: 14 }}>← All Customers</Text>
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
            {selected.balanceDue !== undefined && (
              <Text style={{ fontSize: 13, color: selected.balanceDue > 0 ? theme.red : theme.green, fontWeight: "700", marginTop: 12 }}>
                Balance Due: ${selected.balanceDue?.toLocaleString()}
              </Text>
            )}
            {selected.creditLimit !== undefined && (
              <Text style={{ fontSize: 12, color: theme.muted, marginTop: 6 }}>Credit Limit: ${selected.creditLimit?.toLocaleString()}</Text>
            )}
            {selected.totalSpend !== undefined && (
              <Text style={{ fontSize: 12, color: theme.muted }}>Total Spend: ${selected.totalSpend?.toLocaleString()}</Text>
            )}
            {selected.notes && (
              <Text style={{ fontSize: 12, color: theme.text, marginTop: 12, lineHeight: 18 }}>Notes: {selected.notes}</Text>
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
        <Text style={[s.heading, { marginBottom: 16 }]}>Customers</Text>
        {customers.length === 0 ? (
          <View style={[s.card, { alignItems: "center", padding: 32 }]}>
            <Text style={{ color: theme.muted, fontSize: 13 }}>No customers found.</Text>
          </View>
        ) : customers.map(c => (
          <TouchableOpacity key={c.id} style={[s.card, { marginBottom: 10 }]} onPress={() => setSelected(c)} activeOpacity={0.85}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text, marginBottom: 6 }}>{c.name}</Text>
            {c.email && <Text style={{ fontSize: 12, color: theme.muted, marginBottom: 4 }}>{c.email}</Text>}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 12, color: theme.muted }}>{c.status === "active" ? "✓ Active" : "○ Inactive"}</Text>
              {c.balanceDue !== undefined && (
                <Text style={{ fontSize: 12, fontWeight: "700", color: c.balanceDue > 0 ? theme.red : theme.green }}>
                  ${c.balanceDue?.toLocaleString()}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
