"use client";
// Phase 20 (roadmap): Custom Report Builder
// Lets users pick a data source, choose columns, apply date/status filters,
// and export to CSV or PDF. Uses Recharts for embedded charts.
// jsPDF + jsPDF-autotable are used for PDF export.

import React, { useState, useEffect, useCallback } from "react";
import {
  FileText, BarChart2, Download, RefreshCw, Filter, ChevronDown,
  Table, TrendingUp, X,
} from "lucide-react";
import { C } from "@/lib/utils";
import { downloadCSV } from "@/lib/exportCSV";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type DataSource = "orders" | "invoices" | "inventory" | "customers" | "quotes";

interface ReportColumn { key: string; label: string; type: "string" | "number" | "date" | "currency" }

interface ReportRow { [key: string]: string | number | null }

interface ReportConfig {
  source:    DataSource;
  columns:   string[];
  dateFrom:  string;
  dateTo:    string;
  statusFilter: string;
}

// ─── Column definitions per source ────────────────────────────────────────────

const SOURCE_COLUMNS: Record<DataSource, ReportColumn[]> = {
  orders: [
    { key: "orderNumber", label: "Order #",        type: "string"   },
    { key: "customer",    label: "Customer",        type: "string"   },
    { key: "sku",         label: "SKU",             type: "string"   },
    { key: "qty",         label: "Qty",             type: "number"   },
    { key: "total",       label: "Total",           type: "currency" },
    { key: "status",      label: "Status",          type: "string"   },
    { key: "createdAt",   label: "Date",            type: "date"     },
  ],
  invoices: [
    { key: "invoiceNumber", label: "Invoice #",     type: "string"   },
    { key: "customer",      label: "Customer",      type: "string"   },
    { key: "amount",        label: "Amount",        type: "currency" },
    { key: "dueDate",       label: "Due Date",      type: "date"     },
    { key: "status",        label: "Status",        type: "string"   },
    { key: "createdAt",     label: "Created",       type: "date"     },
  ],
  inventory: [
    { key: "sku",          label: "SKU",            type: "string"   },
    { key: "name",         label: "Name",           type: "string"   },
    { key: "stockLevel",   label: "Stock",          type: "number"   },
    { key: "reorderPoint", label: "Reorder Point",  type: "number"   },
    { key: "unitCost",     label: "Unit Cost",      type: "currency" },
    { key: "supplier",     label: "Supplier",       type: "string"   },
  ],
  customers: [
    { key: "name",         label: "Company",        type: "string"   },
    { key: "email",        label: "Email",          type: "string"   },
    { key: "industry",     label: "Industry",       type: "string"   },
    { key: "status",       label: "Status",         type: "string"   },
    { key: "creditLimit",  label: "Credit Limit",   type: "currency" },
    { key: "balance",      label: "Balance",        type: "currency" },
    { key: "since",        label: "Since",          type: "date"     },
  ],
  quotes: [
    { key: "quoteNumber",  label: "Quote #",        type: "string"   },
    { key: "customer",     label: "Customer",       type: "string"   },
    { key: "total",        label: "Total",          type: "currency" },
    { key: "status",       label: "Status",         type: "string"   },
    { key: "validUntil",   label: "Valid Until",    type: "date"     },
    { key: "createdAt",    label: "Created",        type: "date"     },
  ],
};

const SOURCE_LABELS: Record<DataSource, string> = {
  orders:    "Orders",
  invoices:  "Invoices",
  inventory: "Inventory",
  customers: "Customers",
  quotes:    "Quotes",
};

const SOURCE_ICONS: Record<DataSource, React.ReactNode> = {
  orders:    <TrendingUp size={14} />,
  invoices:  <FileText   size={14} />,
  inventory: <Table      size={14} />,
  customers: <BarChart2  size={14} />,
  quotes:    <FileText   size={14} />,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCell(value: string | number | null, type: ReportColumn["type"]): string {
  if (value === null || value === undefined) return "—";
  if (type === "currency") return `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (type === "date") {
    const d = new Date(value as string);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
  }
  return String(value);
}

function getWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("workspaceDbId");
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportBuilder() {
  const [source,       setSource]       = useState<DataSource>("orders");
  const [selectedCols, setSelectedCols] = useState<string[]>(["orderNumber", "customer", "total", "status", "createdAt"]);
  const [dateFrom,     setDateFrom]     = useState("");
  const [dateTo,       setDateTo]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rows,         setRows]         = useState<ReportRow[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [showChart,    setShowChart]    = useState(false);
  const [colPicker,    setColPicker]    = useState(false);

  // ── When source changes, reset columns to sensible defaults ──────────────
  useEffect(() => {
    const defaults: Record<DataSource, string[]> = {
      orders:    ["orderNumber", "customer", "total", "status", "createdAt"],
      invoices:  ["invoiceNumber", "customer", "amount", "dueDate", "status"],
      inventory: ["sku", "name", "stockLevel", "reorderPoint", "unitCost"],
      customers: ["name", "email", "industry", "status", "creditLimit"],
      quotes:    ["quoteNumber", "customer", "total", "status", "createdAt"],
    };
    setSelectedCols(defaults[source]);
    setRows([]);
    setError("");
  }, [source]);

  // ── Run report ────────────────────────────────────────────────────────────
  const runReport = useCallback(async () => {
    const wid = getWorkspaceId();
    if (!wid) { setError("Workspace not found. Please refresh."); return; }
    setLoading(true);
    setError("");
    setRows([]);

    try {
      const params = new URLSearchParams({ workspaceId: wid });
      if (dateFrom)              params.set("dateFrom", dateFrom);
      if (dateTo)                params.set("dateTo",   dateTo);
      if (statusFilter !== "all") params.set("status",  statusFilter);

      const endpointMap: Record<DataSource, string> = {
        orders:    `/api/orders?${params}`,
        invoices:  `/api/invoices?${params}`,
        inventory: `/api/inventory?${params}`,
        customers: `/api/customers?${params}`,
        quotes:    `/api/quotes?${params}`,
      };

      const res  = await fetch(endpointMap[source]);
      const data = await res.json();

      // Different API shapes
      const raw: ReportRow[] =
        data.orders    ?? data.invoices ?? data.items  ??
        data.customers ?? data.quotes   ?? [];

      setRows(raw);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [source, dateFrom, dateTo, statusFilter]);

  // ── Export CSV ────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const cols = SOURCE_COLUMNS[source].filter(c => selectedCols.includes(c.key));
    const exportRows = rows.map(row => {
      const obj: Record<string, string> = {};
      cols.forEach(c => { obj[c.label] = formatCell(row[c.key] as string | number | null, c.type); });
      return obj;
    });
    downloadCSV(`${source}_report_${new Date().toISOString().split("T")[0]}.csv`, exportRows);
  };

  // ── Export PDF ────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const cols = SOURCE_COLUMNS[source].filter(c => selectedCols.includes(c.key));
    const doc  = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`${SOURCE_LABELS[source]} Report — ${new Date().toLocaleDateString()}`, 14, 15);
    autoTable(doc, {
      startY:   22,
      head:     [cols.map(c => c.label)],
      body:     rows.map(row => cols.map(c => formatCell(row[c.key] as string | number | null, c.type))),
      styles:   { fontSize: 9 },
      headStyles: { fillColor: [61, 111, 181] },
    });
    doc.save(`${source}_report_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  // ── Chart data (aggregate by date or status) ───────────────────────────────
  const chartData = (() => {
    if (!showChart || rows.length === 0) return [];
    const numericKey = selectedCols.find(k => {
      const col = SOURCE_COLUMNS[source].find(c => c.key === k);
      return col?.type === "currency" || col?.type === "number";
    });
    if (!numericKey) return [];

    const grouped: Record<string, number> = {};
    rows.forEach(row => {
      const dateKey = (row["createdAt"] as string | null)
        ? new Date(row["createdAt"] as string).toLocaleDateString("en-US", { month: "short", year: "2-digit" })
        : "N/A";
      grouped[dateKey] = (grouped[dateKey] ?? 0) + Number(row[numericKey] ?? 0);
    });
    return Object.entries(grouped).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));
  })();

  const allCols   = SOURCE_COLUMNS[source];
  const activeCols = allCols.filter(c => selectedCols.includes(c.key));

  return (
    <div style={{ padding: 24, fontFamily: "inherit" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 22, color: C.text }}>Report Builder</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>Build, filter, and export custom reports</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {rows.length > 0 && (
            <>
              <button onClick={handleExportCSV} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 8, cursor: "pointer", fontSize: 13, color: C.text, fontWeight: 600,
              }}>
                <Download size={14} /> CSV
              </button>
              <button onClick={handleExportPDF} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 8, cursor: "pointer", fontSize: 13, color: C.text, fontWeight: 600,
              }}>
                <FileText size={14} /> PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* Config panel */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: 20, marginBottom: 20,
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16,
      }}>

        {/* Data source */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: "block", marginBottom: 6 }}>
            DATA SOURCE
          </label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["orders", "invoices", "inventory", "customers", "quotes"] as DataSource[]).map(s => (
              <button key={s} onClick={() => setSource(s)} style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: source === s ? C.blue : C.bg,
                color:      source === s ? "#fff"  : C.muted,
                border:     `1px solid ${source === s ? C.blue : C.border}`,
              }}>
                {SOURCE_ICONS[s]} {SOURCE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: "block", marginBottom: 6 }}>
            DATE RANGE
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{
              flex: 1, padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.border}`,
              background: C.bg, color: C.text, fontSize: 13,
            }} />
            <span style={{ color: C.muted, fontSize: 12 }}>to</span>
            <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   style={{
              flex: 1, padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.border}`,
              background: C.bg, color: C.text, fontSize: 13,
            }} />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(""); setDateTo(""); }} style={{
                background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 2,
              }}><X size={14} /></button>
            )}
          </div>
        </div>

        {/* Status filter */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: "block", marginBottom: 6 }}>
            STATUS FILTER
          </label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{
            width: "100%", padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.border}`,
            background: C.bg, color: C.text, fontSize: 13, cursor: "pointer",
          }}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="confirmed">Confirmed</option>
            <option value="shipped">Shipped</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        {/* Columns */}
        <div style={{ position: "relative" }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: "block", marginBottom: 6 }}>
            COLUMNS ({selectedCols.length}/{allCols.length})
          </label>
          <button onClick={() => setColPicker(v => !v)} style={{
            display: "flex", alignItems: "center", gap: 6, width: "100%",
            padding: "7px 12px", borderRadius: 8, border: `1px solid ${C.border}`,
            background: C.bg, color: C.text, fontSize: 13, cursor: "pointer", justifyContent: "space-between",
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Filter size={13} /> Choose columns</span>
            <ChevronDown size={13} />
          </button>
          {colPicker && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
              boxShadow: "0 8px 24px rgba(0,0,0,0.1)", padding: 12, marginTop: 4,
            }}>
              {allCols.map(col => (
                <label key={col.key} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 4px", cursor: "pointer", fontSize: 13,
                  color: selectedCols.includes(col.key) ? C.text : C.muted,
                }}>
                  <input type="checkbox"
                    checked={selectedCols.includes(col.key)}
                    onChange={e => {
                      if (e.target.checked) setSelectedCols(s => [...s, col.key]);
                      else setSelectedCols(s => s.filter(k => k !== col.key));
                    }}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Run + Chart toggle */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button onClick={runReport} disabled={loading} style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 24px", background: C.blue, color: "#fff",
          border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14,
          cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
        }}>
          <RefreshCw size={15} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          {loading ? "Running…" : "Run Report"}
        </button>
        {rows.length > 0 && (
          <button onClick={() => setShowChart(v => !v)} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 20px", background: showChart ? C.blue : C.surface,
            color: showChart ? "#fff" : C.text,
            border: `1px solid ${showChart ? C.blue : C.border}`,
            borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}>
            <BarChart2 size={14} /> {showChart ? "Hide Chart" : "Show Chart"}
          </button>
        )}
        {rows.length > 0 && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", fontSize: 13, color: C.muted }}>
            {rows.length} row{rows.length !== 1 ? "s" : ""} returned
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: "12px 16px", background: C.redBg, border: `1px solid ${C.redBorder}`,
          borderRadius: 10, color: C.red, fontSize: 13, marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* Chart */}
      {showChart && chartData.length > 0 && (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: 20, marginBottom: 20,
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 16 }}>
            {SOURCE_LABELS[source]} — by Month
          </div>
          <ResponsiveContainer width="100%" height={220}>
            {source === "inventory" || source === "customers" ? (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.muted }} />
                <YAxis tick={{ fontSize: 11, fill: C.muted }} />
                <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" fill={C.blue} radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.muted }} />
                <YAxis tick={{ fontSize: 11, fill: C.muted }} />
                <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Line type="monotone" dataKey="value" stroke={C.blue} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      {rows.length > 0 && (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 12, overflow: "hidden",
        }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: C.bg, borderBottom: `2px solid ${C.border}` }}>
                  {activeCols.map(col => (
                    <th key={col.key} style={{
                      padding: "10px 14px", textAlign: col.type === "number" || col.type === "currency" ? "right" : "left",
                      fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em",
                      whiteSpace: "nowrap",
                    }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} style={{
                    borderBottom: `1px solid ${C.border}`,
                    background: ri % 2 === 0 ? "transparent" : C.bg,
                  }}>
                    {activeCols.map(col => (
                      <td key={col.key} style={{
                        padding: "9px 14px", fontSize: 13, color: C.text,
                        textAlign: col.type === "number" || col.type === "currency" ? "right" : "left",
                        whiteSpace: "nowrap",
                      }}>
                        {formatCell(row[col.key] as string | number | null, col.type)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && rows.length === 0 && !error && (
        <div style={{
          textAlign: "center", padding: "60px 24px",
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
        }}>
          <BarChart2 size={40} color={C.muted} style={{ marginBottom: 16 }} />
          <div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 6 }}>No data yet</div>
          <div style={{ fontSize: 13, color: C.muted }}>Choose a data source, set filters, then click Run Report.</div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
