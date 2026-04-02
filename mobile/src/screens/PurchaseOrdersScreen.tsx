// mobile/src/screens/PurchaseOrdersScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from "react-native";
import { theme, s } from "../lib/theme";
import { fetchPurchaseOrders, updatePOApproval, getSession } from "../lib/api";

interface PurchaseOrder {
  id: string; poNumber: string; supplierName: string; total: number;
  status: string; expectedDate?: string; approvalStatus?: string;
}

function statusColor(st: string) {
  if (st === "draft")    return { color: theme.blue,   bg: theme.blueBg,   border: theme.blueBorder   };
  if (st === "sent")     return { color: theme.amber,  bg: theme.amberBg,  border: theme.amberBorder  };
  if (st === "received") return { color: theme.green,  bg: theme.greenBg,  border: theme.greenBorder  };
  return                         { color: theme.muted,  bg: theme.bg,       border: theme.border       };
}

export default function PurchaseOrdersScreen() {
  const [orders,    setOrders]    = useState<PurchaseOrder[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected,  setSelected]  = useState<PurchaseOrder | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) return;
      const data = await fetchPurchaseOrders(workspaceId);
      setOrders(Array.isArray(data) ? data : []);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg }}><ActivityIndicator size="large" color={theme.blue} /></View>;

  if (selected) {
    const st = statusColor(selected.status);
    const canApprove = selected.approvalStatus === "pending";

    const approve = async () => {
      try {
        const { userId } = await getSession();
        await updatePOApproval(selected.id, "approved", userId ?? undefined);
        setSelected(prev => prev ? { ...prev, approvalStatus: "approved" } : prev);
        setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, approvalStatus: "approved" } : o));
      } catch (e: any) { Alert.alert("Error", e.message); }
    };

    const reject = async () => {
      try {
        const { userId } = await getSession();
        await updatePOApproval(selected.id, "rejected", userId ?? undefined);
        setSelected(prev => prev ? { ...prev, approvalStatus: "rejected" } : prev);
        setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, approvalStatus: "rejected" } : o));
      } catch (e: any) { Alert.alert("Error", e.message); }
    };

    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 16, paddingBottom: 0 }}>
          <Text style={{ color: theme.blue, fontWeight: "700", fontSize: 14 }}>← All POs</Text>
        </TouchableOpacity>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={s.card}>
            <Text style={{ fontSize: 11, color: theme.muted, fontWeight: "700", marginBottom: 4 }}>{selected.poNumber}</Text>
            <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text, marginBottom: 12 }}>{selected.supplierName}</Text>
            <Text style={{ fontSize: 20, fontWeight: "800", color: theme.green, marginBottom: 12 }}>${selected.total?.toLocaleString()}</Text>
            <View style={s.badge(st.bg, st.color, st.border)}><Text style={s.badgeText(st.color)}>{selected.status.toUpperCase()}</Text></View>
            {selected.expectedDate && (
              <Text style={{ fontSize: 12, color: theme.muted, marginTop: 10 }}>Expected: {new Date(selected.expectedDate).toLocaleDateString()}</Text>
            )}
            {selected.approvalStatus && (
              <Text style={{ fontSize: 12, color: theme.muted, marginTop: 6 }}>Approval: {selected.approvalStatus}</Text>
            )}
          </View>
          {canApprove && (
            <>
              <TouchableOpacity onPress={approve} style={[s.card, { backgroundColor: theme.greenBg, borderColor: theme.greenBorder, borderWidth: 1, marginTop: 16, marginBottom: 8 }]}>
                <Text style={{ color: theme.green, fontWeight: "700", fontSize: 14 }}>✓ Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={reject} style={[s.card, { backgroundColor: theme.redBg, borderColor: theme.redBorder, borderWidth: 1 }]}>
                <Text style={{ color: theme.red, fontWeight: "700", fontSize: 14 }}>✗ Reject</Text>
              </TouchableOpacity>
            </>
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
        <Text style={[s.heading, { marginBottom: 16 }]}>Purchase Orders</Text>
        {orders.length === 0 ? (
          <View style={[s.card, { alignItems: "center", padding: 32 }]}>
            <Text style={{ color: theme.muted, fontSize: 13 }}>No purchase orders found.</Text>
          </View>
        ) : orders.map(o => {
          const st = statusColor(o.status);
          return (
            <TouchableOpacity key={o.id} style={[s.card, { marginBottom: 10 }]} onPress={() => setSelected(o)} activeOpacity={0.85}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <Text style={{ fontSize: 11, color: theme.muted, fontWeight: "700" }}>{o.poNumber}</Text>
                <View style={s.badge(st.bg, st.color, st.border)}><Text style={s.badgeText(st.color)}>{o.status.toUpperCase()}</Text></View>
              </View>
              <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text, marginBottom: 4 }}>{o.supplierName}</Text>
              <Text style={{ fontSize: 13, fontWeight: "700", color: theme.green }}>${o.total?.toLocaleString()}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
