// mobile/src/screens/ReturnsScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from "react-native";
import { theme, s } from "../lib/theme";
import { fetchReturns, updateReturnStatus, getSession } from "../lib/api";

interface Return {
  id: string; rmaNumber: string; customer: string; sku: string;
  qty: number; reason: string; status: string;
}

function statusColor(st: string) {
  if (st === "requested") return { color: theme.blue,    bg: theme.blueBg,    border: theme.blueBorder    };
  if (st === "approved")  return { color: theme.amber,   bg: theme.amberBg,   border: theme.amberBorder   };
  if (st === "received")  return { color: theme.purple,  bg: theme.bg,        border: theme.border        };
  if (st === "refunded")  return { color: theme.green,   bg: theme.greenBg,   border: theme.greenBorder   };
  if (st === "rejected")  return { color: theme.red,     bg: theme.redBg,     border: theme.redBorder     };
  return                          { color: theme.muted,   bg: theme.bg,        border: theme.border        };
}

export default function ReturnsScreen() {
  const [returns,   setReturns]   = useState<Return[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected,  setSelected]  = useState<Return | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) return;
      const data = await fetchReturns(workspaceId);
      setReturns(Array.isArray(data) ? data : []);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg }}><ActivityIndicator size="large" color={theme.blue} /></View>;

  if (selected) {
    const st = statusColor(selected.status);
    const statuses = ["requested", "approved", "received", "refunded"];
    const currentIdx = statuses.indexOf(selected.status);
    const canAdvance = currentIdx >= 0 && currentIdx < statuses.length - 1;
    const nextStatus = canAdvance ? statuses[currentIdx + 1] : null;

    const advanceStatus = async () => {
      if (!nextStatus) return;
      try {
        await updateReturnStatus(selected.id, nextStatus);
        setSelected(prev => prev ? { ...prev, status: nextStatus } : prev);
        setReturns(prev => prev.map(r => r.id === selected.id ? { ...r, status: nextStatus } : r));
      } catch (e: any) { Alert.alert("Error", e.message); }
    };

    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 16, paddingBottom: 0 }}>
          <Text style={{ color: theme.blue, fontWeight: "700", fontSize: 14 }}>← All Returns</Text>
        </TouchableOpacity>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={s.card}>
            <Text style={{ fontSize: 11, color: theme.muted, fontWeight: "700", marginBottom: 4 }}>{selected.rmaNumber}</Text>
            <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text, marginBottom: 12 }}>{selected.customer}</Text>
            <View style={s.badge(st.bg, st.color, st.border)}><Text style={s.badgeText(st.color)}>{selected.status.toUpperCase()}</Text></View>
            <Text style={{ fontSize: 13, color: theme.muted, marginTop: 12 }}>SKU: {selected.sku}</Text>
            <Text style={{ fontSize: 13, color: theme.muted }}>Qty: {selected.qty}</Text>
            <Text style={{ fontSize: 13, color: theme.muted, marginTop: 8 }}>Reason: {selected.reason}</Text>
          </View>
          {canAdvance && nextStatus && (
            <TouchableOpacity onPress={advanceStatus} style={[s.card, { backgroundColor: theme.blueBg, borderColor: theme.blueBorder, borderWidth: 1, marginTop: 16 }]}>
              <Text style={{ color: theme.blue, fontWeight: "700", fontSize: 14 }}>→ Move to {nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}</Text>
            </TouchableOpacity>
          )}
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
        <Text style={[s.heading, { marginBottom: 16 }]}>Returns</Text>
        {returns.length === 0 ? (
          <View style={[s.card, { alignItems: "center", padding: 32 }]}>
            <Text style={{ color: theme.muted, fontSize: 13 }}>No returns found.</Text>
          </View>
        ) : returns.map(r => {
          const st = statusColor(r.status);
          return (
            <TouchableOpacity key={r.id} style={[s.card, { marginBottom: 10 }]} onPress={() => setSelected(r)} activeOpacity={0.85}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <Text style={{ fontSize: 11, color: theme.muted, fontWeight: "700" }}>{r.rmaNumber}</Text>
                <View style={s.badge(st.bg, st.color, st.border)}><Text style={s.badgeText(st.color)}>{r.status.toUpperCase()}</Text></View>
              </View>
              <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text, marginBottom: 4 }}>{r.customer}</Text>
              <Text style={{ fontSize: 12, color: theme.muted }}>SKU: {r.sku} · Qty: {r.qty}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
