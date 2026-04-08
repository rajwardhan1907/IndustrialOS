"use client";
// components/AIInsights.tsx

import { useState, useEffect } from "react";
import { Sparkles, RefreshCw, AlertCircle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { C } from "@/lib/utils";

type AITab = "forecast" | "reorder" | "negotiate" | "pricecompare";

function getWorkspaceId() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("workspaceDbId") ?? "";
}

const DISCLAIMER = "AI suggestions are for review only. No automatic actions are taken.";

function AICard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px" }}>
      {children}
    </div>
  );
}

function Disclaimer() {
  return (
    <div style={{ marginTop: 16, padding: "8px 12px", background: C.amberBg, border: `1px solid ${C.amberBorder}`, borderRadius: 8, display: "flex", gap: 8, alignItems: "flex-start" }}>
      <AlertCircle size={13} color={C.amber} style={{ marginTop: 1, flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: C.amber, lineHeight: 1.5 }}>{DISCLAIMER}</span>
    </div>
  );
}

function LoadingBlock({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 0", color: C.muted, fontSize: 13 }}>
      <RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} />
      {text}
    </div>
  );
}

function RunButton({ onClick, loading, label }: { onClick: () => void; loading: boolean; label: string }) {
  return (
    <button onClick={onClick} disabled={loading}
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 20px", background: loading ? C.border : C.blue, border: "none", borderRadius: 9, color: loading ? C.muted : "#fff", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
      <Sparkles size={13} />
      {loading ? "Analysing…" : label}
    </button>
  );
}

function ErrorBlock({ msg }: { msg: string }) {
  return (
    <div style={{ fontSize: 13, color: C.red, marginTop: 12, padding: "10px 14px", background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 8 }}>{msg}</div>
  );
}

// ── Forecast result cards ─────────────────────────────────────────────────────
interface ForecastItem {
  sku: string; name?: string; forecast30d: number;
  trend?: string; stockoutRisk?: string; insight?: string;
}

function ForecastResults({ items }: { items: ForecastItem[] }) {
  if (!items.length) return <div style={{ fontSize: 13, color: C.muted, marginTop: 12 }}>No forecast data returned.</div>;
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item, i) => {
          const trend = (item.trend ?? "stable").toLowerCase();
          const risk  = (item.stockoutRisk ?? "low").toLowerCase();
          const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
          const trendColor = trend === "up" ? C.green : trend === "down" ? C.red : C.muted;
          const riskColor  = risk === "high" ? C.red : risk === "medium" ? C.amber : C.green;
          return (
            <div key={i} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{item.sku}</div>
                  {item.name && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{item.name}</div>}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700, color: C.blue }}>
                    📦 {item.forecast30d.toLocaleString()} units / 30d
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: C.surface, border: `1px solid ${C.border}`, color: trendColor, display: "flex", alignItems: "center", gap: 4 }}>
                    <TrendIcon size={11} /> {trend}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: C.surface, border: `1px solid ${C.border}`, color: riskColor }}>
                    {risk} risk
                  </span>
                </div>
              </div>
              {item.insight && (
                <div style={{ fontSize: 12, color: C.muted, marginTop: 8, lineHeight: 1.5, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                  {item.insight}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Disclaimer />
    </div>
  );
}

// ── Reorder result cards ──────────────────────────────────────────────────────
interface ReorderItem {
  sku: string; name?: string; suggestedQty: number;
  urgency?: string; reasoning?: string; supplier?: string;
}

function ReorderResults({ items }: { items: ReorderItem[] }) {
  if (!items.length) return <div style={{ fontSize: 13, color: C.muted, marginTop: 12 }}>No reorder suggestions.</div>;
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item, i) => {
          const urgency = (item.urgency ?? "normal").toLowerCase();
          const urgencyColor = urgency === "high" || urgency === "critical" ? C.red : urgency === "medium" ? C.amber : C.green;
          return (
            <div key={i} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{item.sku}</div>
                  {item.name && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{item.name}</div>}
                  {item.supplier && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Supplier: {item.supplier}</div>}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.blue }}>
                    Order {item.suggestedQty.toLocaleString()} units
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: C.surface, border: `1px solid ${C.border}`, color: urgencyColor }}>
                    {urgency} urgency
                  </span>
                </div>
              </div>
              {item.reasoning && (
                <div style={{ fontSize: 12, color: C.muted, marginTop: 8, lineHeight: 1.5, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                  {item.reasoning}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Disclaimer />
    </div>
  );
}

// ── Negotiate result (plain text) ─────────────────────────────────────────────
function NegotiateResult({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 18px", marginTop: 16 }}>
      {paragraphs.map((p, i) => (
        <p key={i} style={{ margin: 0, marginBottom: i < paragraphs.length - 1 ? 12 : 0, fontSize: 13, color: C.text, lineHeight: 1.7 }}>
          {p}
        </p>
      ))}
      <Disclaimer />
    </div>
  );
}

// ── Tab 1: Demand Forecast ────────────────────────────────────────────────────
function ForecastTab({ workspaceId }: { workspaceId: string }) {
  const [loading,   setLoading]   = useState(false);
  const [forecasts, setForecasts] = useState<ForecastItem[]>([]);
  const [error,     setError]     = useState("");

  const run = async () => {
    setLoading(true); setError(""); setForecasts([]);
    try {
      const res = await fetch("/api/ai/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Request failed"); return; }
      const list: ForecastItem[] = data.forecasts ?? data.result ?? [];
      setForecasts(Array.isArray(list) ? list : []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <AICard>
      <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 6 }}>📈 Demand Forecast</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
        Analyses your order history over 30/60/90-day windows and projects demand for the next 30 days per SKU.
      </div>
      <RunButton onClick={run} loading={loading} label="Run Forecast" />
      {loading && <LoadingBlock text="Analysing order history…" />}
      {error && <ErrorBlock msg={error} />}
      {forecasts.length > 0 && <ForecastResults items={forecasts} />}
    </AICard>
  );
}

// ── Tab 2: Reorder Suggestions ────────────────────────────────────────────────
function ReorderTab({ workspaceId }: { workspaceId: string }) {
  const [loading,     setLoading]     = useState(false);
  const [suggestions, setSuggestions] = useState<ReorderItem[]>([]);
  const [error,       setError]       = useState("");

  const run = async () => {
    setLoading(true); setError(""); setSuggestions([]);
    try {
      const res = await fetch("/api/ai/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Request failed"); return; }
      const list: ReorderItem[] = data.suggestions ?? data.result ?? [];
      setSuggestions(Array.isArray(list) ? list : []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <AICard>
      <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 6 }}>📦 Reorder Suggestions</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
        Compares current stock levels against predicted demand and suggests which SKUs to reorder, how many units, and from which supplier.
      </div>
      <RunButton onClick={run} loading={loading} label="Get Suggestions" />
      {loading && <LoadingBlock text="Analysing stock levels…" />}
      {error && <ErrorBlock msg={error} />}
      {suggestions.length > 0 && <ReorderResults items={suggestions} />}
    </AICard>
  );
}

// ── Tab 3: Negotiation Assistant ──────────────────────────────────────────────
function NegotiateTab({ workspaceId }: { workspaceId: string }) {
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState("");
  const [error,     setError]     = useState("");
  const [quotes,    setQuotes]    = useState<any[]>([]);
  const [quoteId,   setQuoteId]   = useState("");
  const [context,   setContext]   = useState("");

  useEffect(() => {
    if (!workspaceId) return;
    fetch(`/api/quotes?workspaceId=${workspaceId}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setQuotes(Array.isArray(data) ? data : []); })
      .catch(() => {});
  }, [workspaceId]);

  const run = async () => {
    if (!quoteId) return;
    const quote = quotes.find(q => q.id === quoteId);
    if (!quote) return;
    setLoading(true); setError(""); setResult("");
    try {
      const res = await fetch("/api/ai/negotiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote, prompt: context }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Request failed"); return; }
      setResult(data.suggestion ?? data.result ?? "");
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const inp: React.CSSProperties = {
    width: "100%", padding: "9px 11px", background: C.bg,
    border: `1px solid ${C.border}`, borderRadius: 8, color: C.text,
    fontSize: 13, outline: "none", boxSizing: "border-box" as const,
  };

  return (
    <AICard>
      <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 6 }}>🤝 Negotiation Assistant</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
        Select a quote and get an AI-powered counter-offer strategy to help close the deal while protecting your margin.
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5, textTransform: "uppercase" }}>Select Quote</div>
        <select value={quoteId} onChange={e => setQuoteId(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
          <option value="">— Pick a quote —</option>
          {quotes.map(q => (
            <option key={q.id} value={q.id}>
              {q.quoteNumber} · {q.customer} · ${q.total?.toLocaleString()} · {q.status}
            </option>
          ))}
        </select>
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5, textTransform: "uppercase" }}>Additional Context (optional)</div>
        <textarea value={context} onChange={e => setContext(e.target.value)} rows={2}
          placeholder="e.g. Customer mentioned they have a competing offer from a rival supplier…"
          style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} />
      </div>
      <RunButton onClick={run} loading={loading} label={quoteId ? "Get Strategy" : "Select a Quote First"} />
      {loading && <LoadingBlock text="Generating negotiation strategy…" />}
      {error && <ErrorBlock msg={error} />}
      {result && <NegotiateResult text={result} />}
    </AICard>
  );
}

// ── Tab 4: Price Comparison ───────────────────────────────────────────────────
function PriceCompareTab({ workspaceId }: { workspaceId: string }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [sku,     setSku]     = useState("");
  const [error,   setError]   = useState("");
  const [searched, setSearched] = useState(false);

  const run = async () => {
    if (!sku.trim()) return;
    setLoading(true); setError(""); setResults([]); setSearched(false);
    try {
      const res = await fetch(`/api/ai/price-compare?workspaceId=${workspaceId}&sku=${encodeURIComponent(sku.trim())}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Request failed"); return; }
      setResults(data.comparisons ?? []);
      setSearched(true);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <AICard>
      <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 6 }}>💹 Supplier Price Compare</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
        See what the same SKU has cost across all your supplier purchase orders. No AI needed — pure data.
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
        <input value={sku} onChange={e => setSku(e.target.value)} placeholder="Enter SKU code…"
          onKeyDown={e => e.key === "Enter" && run()}
          style={{ flex: 1, padding: "9px 11px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, outline: "none" }} />
        <RunButton onClick={run} loading={loading} label="Compare" />
      </div>
      {error && <ErrorBlock msg={error} />}
      {searched && results.length === 0 && (
        <div style={{ fontSize: 13, color: C.muted, padding: "12px 0" }}>No purchase orders found for that SKU.</div>
      )}
      {results.length > 0 && (
        <div style={{ marginTop: 16, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {["Supplier", "Unit Price", "Qty", "Date", "PO Status"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", borderBottom: `1px solid ${C.border}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "8px 12px", color: C.text, fontWeight: 600 }}>{r.supplier}</td>
                  <td style={{ padding: "8px 12px", color: C.green, fontWeight: 700 }}>${r.unitPrice?.toFixed(2)}</td>
                  <td style={{ padding: "8px 12px", color: C.text }}>{r.qty}</td>
                  <td style={{ padding: "8px 12px", color: C.muted }}>{r.date ? new Date(r.date).toLocaleDateString() : "—"}</td>
                  <td style={{ padding: "8px 12px", color: C.text }}>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AICard>
  );
}

// ── Main AIInsights Component ─────────────────────────────────────────────────
export default function AIInsights({ workspaceId: wsProp }: { workspaceId?: string }) {
  const wsId = wsProp ?? getWorkspaceId();
  const [activeTab, setActiveTab] = useState<AITab>("forecast");

  const TABS: { id: AITab; label: string; emoji: string }[] = [
    { id: "forecast",     label: "Demand Forecast",    emoji: "📈" },
    { id: "reorder",      label: "Reorder Suggestions", emoji: "📦" },
    { id: "negotiate",    label: "Negotiation",         emoji: "🤝" },
    { id: "pricecompare", label: "Price Compare",       emoji: "💹" },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <div style={{ width: 40, height: 40, background: "linear-gradient(135deg,#5b8de8,#9c6fdd)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sparkles size={18} color="#fff" />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20, color: C.text }}>AI Insights</div>
          <div style={{ fontSize: 12, color: C.muted }}>Powered by Claude · Human review required for all suggestions</div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: C.bg, padding: 4, borderRadius: 10, width: "fit-content" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: "7px 16px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
              background: activeTab === t.id ? C.surface : "transparent",
              color: activeTab === t.id ? C.text : C.muted,
              boxShadow: activeTab === t.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {activeTab === "forecast"     && <ForecastTab     workspaceId={wsId} />}
      {activeTab === "reorder"      && <ReorderTab      workspaceId={wsId} />}
      {activeTab === "negotiate"    && <NegotiateTab    workspaceId={wsId} />}
      {activeTab === "pricecompare" && <PriceCompareTab workspaceId={wsId} />}
    </div>
  );
}
