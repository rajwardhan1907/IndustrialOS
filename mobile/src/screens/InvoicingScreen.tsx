// mobile/src/screens/InvoicingScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from "react-native";
import { theme, s } from "../lib/theme";
import { fetchInvoices, getSession } from "../lib/api";

interface Invoice {
  id: string; invoiceNumber: string; customer: string;
  total: number; amountPaid: number; status: string; dueDate?: string;
}

function statusColor(st: string) {
  if (st === "draft")    return { color: theme.blue,   bg: theme.blueBg,   border: theme.blueBorder   };
  if (st === "sent")     return { color: theme.amber,  bg: theme.amberBg,  border: theme.amberBorder  };
  if (st === "paid")     return { color: theme.green,  bg: theme.greenBg,  border: theme.greenBorder  };
  if (st === "overdue")  return { color: theme.red,    bg: theme.redBg,    border: theme.redBorder    };
  return                         { color: theme.muted,  bg: theme.bg,       border: theme.border       };
}

export default function InvoicingScreen() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Invoice | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) return;
      const data = await fetchInvoices(workspaceId);
      setInvoices(Array.isArray(data) ? data : []);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg }}><ActivityIndicator size="large" color={theme.blue} /></View>;

  if (selected) {
    const st = statusColor(selected.status);
    const outstanding = (selected.total || 0) - (selected.amountPaid || 0);

    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 16, paddingBottom: 0 }}>
          <Text style={{ color: theme.blue, fontWeight: "700", fontSize: 14 }}>← All Invoices</Text>
        </TouchableOpacity>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={s.card}>
            <Text style={{ fontSize: 11, color: theme.muted, fontWeight: "700", marginBottom: 4 }}>{selected.invoiceNumber}</Text>
            <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text, marginBottom: 12 }}>{selected.customer}</Text>
            <View style={s.badge(st.bg, st.color, st.border)}><Text style={s.badgeText(st.color)}>{selected.status.toUpperCase()}</Text></View>
            <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.border }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                <Text style={{ color: theme.muted, fontSize: 13 }}>Total</Text>
                <Text style={{ color: theme.text, fontWeight: "700", fontSize: 13 }}>${selected.total?.toLocaleString()}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                <Text style={{ color: theme.muted, fontSize: 13 }}>Paid</Text>
                <Text style={{ color: theme.green, fontWeight: "700", fontSize: 13 }}>${selected.amountPaid?.toLocaleString()}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: theme.muted, fontSize: 13 }}>Outstanding</Text>
                <Text style={{ color: outstanding > 0 ? theme.red : theme.green, fontWeight: "700", fontSize: 13 }}>
                  ${outstanding.toLocaleString()}
                </Text>
              </View>
            </View>
            {selected.dueDate && (
              <Text style={{ fontSize: 12, color: theme.muted, marginTop: 12 }}>Due: {new Date(selected.dueDate).toLocaleDateString()}</Text>
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
        <Text style={[s.heading, { marginBottom: 16 }]}>Invoices</Text>
        {invoices.length === 0 ? (
          <View style={[s.card, { alignItems: "center", padding: 32 }]}>
            <Text style={{ color: theme.muted, fontSize: 13 }}>No invoices found.</Text>
          </View>
        ) : invoices.map(inv => {
          const st = statusColor(inv.status);
          const outstanding = (inv.total || 0) - (inv.amountPaid || 0);
          return (
            <TouchableOpacity key={inv.id} style={[s.card, { marginBottom: 10 }]} onPress={() => setSelected(inv)} activeOpacity={0.85}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <Text style={{ fontSize: 11, color: theme.muted, fontWeight: "700" }}>{inv.invoiceNumber}</Text>
                <View style={s.badge(st.bg, st.color, st.border)}><Text style={s.badgeText(st.color)}>{inv.status.toUpperCase()}</Text></View>
              </View>
              <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text, marginBottom: 4 }}>{inv.customer}</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 12, color: theme.muted }}>Total: ${inv.total?.toLocaleString()}</Text>
                <Text style={{ fontSize: 12, fontWeight: "700", color: outstanding > 0 ? theme.red : theme.green }}>Outstanding: ${outstanding.toLocaleString()}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
