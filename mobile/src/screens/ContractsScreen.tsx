// mobile/src/screens/ContractsScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from "react-native";
import { theme, s } from "../lib/theme";
import { fetchContracts, getSession } from "../lib/api";

interface Contract {
  id: string; contractNumber: string; title: string;
  customer: string; value: number; status: string; expiryDate?: string;
}

function statusColor(st: string) {
  if (st === "active")    return { color: theme.green,  bg: theme.greenBg,  border: theme.greenBorder  };
  if (st === "expiring")  return { color: theme.amber,  bg: theme.amberBg,  border: theme.amberBorder  };
  if (st === "expired")   return { color: theme.red,    bg: theme.redBg,    border: theme.redBorder    };
  if (st === "draft")     return { color: theme.blue,   bg: theme.blueBg,   border: theme.blueBorder   };
  return                          { color: theme.muted,  bg: theme.bg,       border: theme.border       };
}

export default function ContractsScreen() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected,  setSelected]  = useState<Contract | null>(null);

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
                <Text style={{ color: theme.green, fontWeight: "700", fontSize: 13 }}>${selected.value?.toLocaleString()}</Text>
              </View>
              {selected.expiryDate && (
                <Text style={{ fontSize: 12, color: theme.muted }}>Expiry: {new Date(selected.expiryDate).toLocaleDateString()}</Text>
              )}
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
            <Text style={{ color: theme.muted, fontSize: 13 }}>No contracts found.</Text>
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
                <Text style={{ fontSize: 12, fontWeight: "700", color: theme.green }}>${c.value?.toLocaleString()}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
