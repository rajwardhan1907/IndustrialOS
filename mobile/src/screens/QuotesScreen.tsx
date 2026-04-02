// mobile/src/screens/QuotesScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput,
} from "react-native";
import { theme, s } from "../lib/theme";
import { fetchQuotes, updateQuoteStatus, getSession } from "../lib/api";

interface Quote {
  id: string; quoteNumber: string; customer: string; total: number;
  status: string; validUntil?: string;
}

function statusColor(st: string) {
  if (st === "draft")    return { color: theme.blue,   bg: theme.blueBg,   border: theme.blueBorder   };
  if (st === "sent")     return { color: theme.amber,  bg: theme.amberBg,  border: theme.amberBorder  };
  if (st === "accepted") return { color: theme.green,  bg: theme.greenBg,  border: theme.greenBorder  };
  if (st === "declined") return { color: theme.red,    bg: theme.redBg,    border: theme.redBorder    };
  return                         { color: theme.muted,  bg: theme.bg,       border: theme.border       };
}

export default function QuotesScreen() {
  const [quotes,    setQuotes]    = useState<Quote[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected,  setSelected]  = useState<Quote | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) return;
      const data = await fetchQuotes(workspaceId);
      setQuotes(Array.isArray(data) ? data : []);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg }}><ActivityIndicator size="large" color={theme.blue} /></View>;

  if (selected) {
    const st = statusColor(selected.status);
    const updateStatus = async (newStatus: string) => {
      try {
        await updateQuoteStatus(selected.id, newStatus);
        setSelected(prev => prev ? { ...prev, status: newStatus } : prev);
        setQuotes(prev => prev.map(q => q.id === selected.id ? { ...q, status: newStatus } : q));
      } catch (e: any) { Alert.alert("Error", e.message); }
    };
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 16, paddingBottom: 0 }}>
          <Text style={{ color: theme.blue, fontWeight: "700", fontSize: 14 }}>← All Quotes</Text>
        </TouchableOpacity>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={s.card}>
            <Text style={{ fontSize: 11, color: theme.muted, fontWeight: "700", marginBottom: 4 }}>{selected.quoteNumber}</Text>
            <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text, marginBottom: 12 }}>{selected.customer}</Text>
            <Text style={{ fontSize: 20, fontWeight: "800", color: theme.blue, marginBottom: 12 }}>${selected.total?.toLocaleString()}</Text>
            <View style={s.badge(st.bg, st.color, st.border)}><Text style={s.badgeText(st.color)}>{selected.status.toUpperCase()}</Text></View>
            {selected.validUntil && (
              <Text style={{ fontSize: 12, color: theme.muted, marginTop: 10 }}>Valid until {new Date(selected.validUntil).toLocaleDateString()}</Text>
            )}
          </View>
          <Text style={[s.heading, { marginTop: 16, marginBottom: 10 }]}>Actions</Text>
          {selected.status === "sent" && (
            <>
              <TouchableOpacity onPress={() => updateStatus("accepted")} style={[s.card, { backgroundColor: theme.greenBg, borderColor: theme.greenBorder, borderWidth: 1, marginBottom: 8 }]}>
                <Text style={{ color: theme.green, fontWeight: "700", fontSize: 14 }}>✓ Accept Quote</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => updateStatus("declined")} style={[s.card, { backgroundColor: theme.redBg, borderColor: theme.redBorder, borderWidth: 1 }]}>
                <Text style={{ color: theme.red, fontWeight: "700", fontSize: 14 }}>✗ Decline Quote</Text>
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
        <Text style={[s.heading, { marginBottom: 16 }]}>Quotes</Text>
        {quotes.length === 0 ? (
          <View style={[s.card, { alignItems: "center", padding: 32 }]}>
            <Text style={{ color: theme.muted, fontSize: 13 }}>No quotes yet.</Text>
          </View>
        ) : quotes.map(q => {
          const st = statusColor(q.status);
          return (
            <TouchableOpacity key={q.id} style={[s.card, { marginBottom: 10 }]} onPress={() => setSelected(q)} activeOpacity={0.85}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <Text style={{ fontSize: 11, color: theme.muted, fontWeight: "700" }}>{q.quoteNumber}</Text>
                <View style={s.badge(st.bg, st.color, st.border)}><Text style={s.badgeText(st.color)}>{q.status.toUpperCase()}</Text></View>
              </View>
              <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text, marginBottom: 4 }}>{q.customer}</Text>
              <Text style={{ fontSize: 13, fontWeight: "700", color: theme.green }}>${q.total?.toLocaleString()}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
