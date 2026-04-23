// mobile/src/screens/AIInsightsScreen.tsx
// AI-powered insights: demand forecast, reorder suggestions, negotiate tips,
// price comparison — mirrors the web AIInsights component.
import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, StyleSheet,
} from "react-native";
import { theme, s } from "../lib/theme";
import { fetchAIForecast, fetchAIReorder, fetchAINegotiate, fetchAIPriceCompare, getSession } from "../lib/api";
import { SessionExpiredView } from "../lib/sessionGuard";

type AITab = "forecast" | "reorder" | "negotiate" | "pricecompare";

const TABS: { key: AITab; label: string; emoji: string; btnLabel: string }[] = [
  { key: "forecast",    label: "Demand Forecast",  emoji: "📈", btnLabel: "Run Forecast"       },
  { key: "reorder",     label: "Reorder Signals",  emoji: "🔄", btnLabel: "Find Reorder Items"  },
  { key: "negotiate",   label: "Negotiate",        emoji: "🤝", btnLabel: "Get Negotiate Tips"  },
  { key: "pricecompare",label: "Price Compare",    emoji: "💰", btnLabel: "Compare Prices"      },
];

const DISCLAIMER = "AI suggestions are for review only. No automatic actions are taken.";

export default function AIInsightsScreen() {
  const [activeTab,       setActiveTab]       = useState<AITab>("forecast");
  const [loading,         setLoading]         = useState(false);
  const [sessionExpired,  setSessionExpired]  = useState(false);
  const [results,         setResults]         = useState<Record<AITab, any | null>>({
    forecast: null, reorder: null, negotiate: null, pricecompare: null,
  });
  const [errors, setErrors] = useState<Record<AITab, string>>({
    forecast: "", reorder: "", negotiate: "", pricecompare: "",
  });

  const run = useCallback(async (tab: AITab) => {
    setLoading(true);
    setErrors(prev => ({ ...prev, [tab]: "" }));
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) { setSessionExpired(true); return; }
      let data: any;
      if (tab === "forecast")     data = await fetchAIForecast(workspaceId);
      else if (tab === "reorder") data = await fetchAIReorder(workspaceId);
      else if (tab === "negotiate") data = await fetchAINegotiate(workspaceId);
      else                        data = await fetchAIPriceCompare(workspaceId);
      setResults(prev => ({ ...prev, [tab]: data }));
    } catch (e: any) {
      setErrors(prev => ({ ...prev, [tab]: e.message ?? "Failed to fetch AI data." }));
    } finally {
      setLoading(false);
    }
  }, []);

  if (sessionExpired) return <SessionExpiredView />;

  const currentTab = TABS.find(t => t.key === activeTab)!;
  const result     = results[activeTab];
  const error      = errors[activeTab];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Tab Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={{ paddingHorizontal: 12 }}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
          >
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.emoji} {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={[s.heading, { marginBottom: 4 }]}>{currentTab.emoji} {currentTab.label}</Text>
        <Text style={{ fontSize: 12, color: theme.muted, marginBottom: 16 }}>
          Powered by Claude AI — results are advisory only.
        </Text>

        {/* Run button */}
        <TouchableOpacity
          onPress={() => run(activeTab)}
          disabled={loading}
          style={[styles.runBtn, loading && { opacity: 0.6 }]}
        >
          {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.runBtnText}>{currentTab.btnLabel}</Text>
          }
        </TouchableOpacity>

        {/* Error */}
        {!!error && (
          <View style={styles.errorBox}>
            <Text style={{ color: theme.red, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {/* Results */}
        {result && !loading && <ResultView tab={activeTab} data={result} />}

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={{ fontSize: 11, color: theme.amber, lineHeight: 17 }}>⚠ {DISCLAIMER}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function ResultView({ tab, data }: { tab: AITab; data: any }) {
  if (tab === "forecast") {
    const items: any[] = Array.isArray(data?.forecast) ? data.forecast : Array.isArray(data) ? data : [];
    if (!items.length) return <EmptyResult />;
    return (
      <>
        {items.map((item: any, i: number) => (
          <View key={i} style={styles.card}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", fontSize: 14, color: theme.text }}>{item.sku}</Text>
                {!!item.name && <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>{item.name}</Text>}
              </View>
              <View style={styles.metricBadge}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: theme.blue }}>
                  {item.forecast30d ?? 0} units/30d
                </Text>
              </View>
            </View>
            {!!item.stockoutRisk && (
              <Text style={{ fontSize: 12, color: riskColor(item.stockoutRisk), marginTop: 6, fontWeight: "600" }}>
                Stockout risk: {item.stockoutRisk}
              </Text>
            )}
            {!!item.insight && (
              <Text style={{ fontSize: 12, color: theme.muted, marginTop: 4 }}>{item.insight}</Text>
            )}
          </View>
        ))}
      </>
    );
  }

  if (tab === "reorder") {
    const items: any[] = Array.isArray(data?.reorders) ? data.reorders : Array.isArray(data) ? data : [];
    if (!items.length) return <EmptyResult msg="No reorder signals at this time." />;
    return (
      <>
        {items.map((item: any, i: number) => (
          <View key={i} style={styles.card}>
            <Text style={{ fontWeight: "700", fontSize: 14, color: theme.text }}>{item.sku}</Text>
            {!!item.name && <Text style={{ fontSize: 12, color: theme.muted }}>{item.name}</Text>}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
              {item.currentStock != null && (
                <Text style={{ fontSize: 12, color: theme.text }}>
                  Stock: <Text style={{ fontWeight: "700" }}>{item.currentStock}</Text>
                </Text>
              )}
              {item.reorderQty != null && (
                <Text style={{ fontSize: 12, color: theme.blue }}>
                  Order: <Text style={{ fontWeight: "700" }}>{item.reorderQty}</Text>
                </Text>
              )}
            </View>
            {!!item.reason && (
              <Text style={{ fontSize: 12, color: theme.muted, marginTop: 4 }}>{item.reason}</Text>
            )}
          </View>
        ))}
      </>
    );
  }

  if (tab === "negotiate") {
    const items: any[] = Array.isArray(data?.tips) ? data.tips : Array.isArray(data) ? data : [];
    if (!items.length) return <EmptyResult msg="No negotiation tips generated." />;
    return (
      <>
        {items.map((item: any, i: number) => (
          <View key={i} style={styles.card}>
            <Text style={{ fontWeight: "700", fontSize: 14, color: theme.text }}>{item.supplier ?? `Tip ${i + 1}`}</Text>
            {!!item.tip && <Text style={{ fontSize: 13, color: theme.muted, marginTop: 6, lineHeight: 19 }}>{item.tip}</Text>}
            {!!item.potentialSaving && (
              <Text style={{ fontSize: 12, color: theme.green, marginTop: 6, fontWeight: "600" }}>
                Potential saving: {item.potentialSaving}
              </Text>
            )}
          </View>
        ))}
      </>
    );
  }

  if (tab === "pricecompare") {
    const items: any[] = Array.isArray(data?.comparisons) ? data.comparisons : Array.isArray(data) ? data : [];
    if (!items.length) return <EmptyResult msg="No price comparison data available." />;
    return (
      <>
        {items.map((item: any, i: number) => (
          <View key={i} style={styles.card}>
            <Text style={{ fontWeight: "700", fontSize: 14, color: theme.text }}>{item.sku}</Text>
            {!!item.name && <Text style={{ fontSize: 12, color: theme.muted }}>{item.name}</Text>}
            <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
              {item.currentCost != null && (
                <Text style={{ fontSize: 12, color: theme.text }}>
                  Current: <Text style={{ fontWeight: "700" }}>${item.currentCost}</Text>
                </Text>
              )}
              {item.marketPrice != null && (
                <Text style={{ fontSize: 12, color: theme.blue }}>
                  Market: <Text style={{ fontWeight: "700" }}>${item.marketPrice}</Text>
                </Text>
              )}
            </View>
            {!!item.recommendation && (
              <Text style={{ fontSize: 12, color: theme.muted, marginTop: 4 }}>{item.recommendation}</Text>
            )}
          </View>
        ))}
      </>
    );
  }

  return <EmptyResult />;
}

function EmptyResult({ msg = "No data returned." }: { msg?: string }) {
  return (
    <View style={[styles.card, { alignItems: "center", padding: 24 }]}>
      <Text style={{ color: theme.muted, fontSize: 13 }}>{msg}</Text>
    </View>
  );
}

function riskColor(risk: string) {
  const r = risk?.toLowerCase();
  if (r === "high")   return theme.red;
  if (r === "medium") return theme.amber;
  return theme.green;
}

const styles = StyleSheet.create({
  tabBar:        { backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border, maxHeight: 52 },
  tabBtn:        { paddingHorizontal: 14, paddingVertical: 14, marginRight: 4 },
  tabBtnActive:  { borderBottomWidth: 2, borderBottomColor: theme.blue },
  tabLabel:      { fontSize: 12, fontWeight: "600", color: theme.muted },
  tabLabelActive:{ color: theme.blue },
  runBtn:        { backgroundColor: theme.blue, borderRadius: 10, padding: 14, alignItems: "center", marginBottom: 14, flexDirection: "row", justifyContent: "center", gap: 8 },
  runBtnText:    { color: "#fff", fontWeight: "700", fontSize: 14 },
  errorBox:      { backgroundColor: theme.redBg, borderWidth: 1, borderColor: theme.redBorder, borderRadius: 10, padding: 12, marginBottom: 12 },
  card:          { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 14, marginBottom: 10 },
  metricBadge:   { backgroundColor: theme.blueBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: theme.blueBorder },
  disclaimer:    { backgroundColor: theme.amberBg, borderWidth: 1, borderColor: theme.amberBorder, borderRadius: 10, padding: 12, marginTop: 16 },
});
