"use client";
import { useRef, useState, useCallback } from "react";
import { Upload, CheckCircle, XCircle, AlertTriangle, FileText, RefreshCw } from "lucide-react";
import { C, fmt } from "@/lib/utils";
import { Card, SectionTitle } from "./Dashboard";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ParsedRow {
  sku:          string;
  name:         string;
  category?:    string;
  stockLevel?:  number;
  reorderPoint?:number;
  reorderQty?:  number;
  unitCost?:    number;
  warehouse?:   string;
  zone?:        string;
  binLocation?: string;
  supplier?:    string;
}

interface PipeState {
  status:       "idle" | "parsing" | "uploading" | "done" | "error";
  fileName:     string;
  totalRows:    number;
  sentRows:     number;
  inserted:     number;
  updated:      number;
  errors:       number;
  errorDetails: { row: number; sku: string; msg: string }[];
  elapsed?:     string;
  message?:     string;
}

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const rawHeaders = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());

  const colMap: Record<string, keyof ParsedRow> = {
    "sku": "sku", "sku code": "sku", "sku_code": "sku", "item code": "sku", "itemcode": "sku",
    "name": "name", "item name": "name", "product name": "name", "description": "name",
    "category": "category", "cat": "category",
    "stock level": "stockLevel", "stocklevel": "stockLevel", "stock": "stockLevel",
    "qty": "stockLevel", "quantity": "stockLevel",
    "reorder point": "reorderPoint", "reorderpoint": "reorderPoint", "min stock": "reorderPoint",
    "reorder qty": "reorderQty", "reorderqty": "reorderQty", "order qty": "reorderQty",
    "unit cost": "unitCost", "unitcost": "unitCost", "cost": "unitCost", "price": "unitCost",
    "warehouse": "warehouse",
    "zone": "zone",
    "bin location": "binLocation", "binlocation": "binLocation", "bin": "binLocation",
    "supplier": "supplier", "supplier name": "supplier",
  };

  const headers = rawHeaders.map(h => colMap[h] ?? null);

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols: string[] = [];
    let inQuote = false, cur = "";
    for (const ch of line + ",") {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === "," && !inQuote) { cols.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }

    const row: any = {};
    headers.forEach((field, idx) => { if (field) row[field] = cols[idx] ?? ""; });

    if (row.sku || row.name) {
      rows.push({
        sku:          (row.sku ?? "").trim(),
        name:         (row.name ?? "").trim(),
        category:     row.category      ?? "",
        stockLevel:   Number(row.stockLevel)    || 0,
        reorderPoint: Number(row.reorderPoint)  || 0,
        reorderQty:   Number(row.reorderQty)    || 0,
        unitCost:     Number(row.unitCost)       || 0,
        warehouse:    row.warehouse     ?? "",
        zone:         row.zone          ?? "A",
        binLocation:  row.binLocation   ?? "",
        supplier:     row.supplier      ?? "",
      });
    }
  }
  return rows;
}

// ── JSON parser ───────────────────────────────────────────────────────────────
function parseJSON(text: string): ParsedRow[] {
  try {
    const data = JSON.parse(text);
    const arr: any[] = Array.isArray(data) ? data : data.items ?? data.skus ?? data.products ?? [];
    return arr.map((r: any) => ({
      sku:          (r.sku ?? r.SKU ?? r.code ?? r.itemCode ?? "").toString().trim(),
      name:         (r.name ?? r.Name ?? r.productName ?? r.description ?? "").toString().trim(),
      category:     r.category  ?? r.Category  ?? "",
      stockLevel:   Number(r.stockLevel  ?? r.stock ?? r.qty ?? 0),
      reorderPoint: Number(r.reorderPoint ?? r.minStock ?? 0),
      reorderQty:   Number(r.reorderQty  ?? r.orderQty  ?? 0),
      unitCost:     Number(r.unitCost     ?? r.cost      ?? r.price ?? 0),
      warehouse:    r.warehouse    ?? "",
      zone:         r.zone         ?? "A",
      binLocation:  r.binLocation  ?? r.bin ?? "",
      supplier:     r.supplier     ?? "",
    })).filter((r: ParsedRow) => r.sku || r.name);
  } catch {
    return [];
  }
}

// ── Batch sender ──────────────────────────────────────────────────────────────
const BATCH = 100;

async function sendBatches(
  rows:        ParsedRow[],
  workspaceId: string,
  mode:        "upsert" | "replace",
  onProgress:  (sent: number, inserted: number, updated: number, errors: number, errDet: any[]) => void,
): Promise<{ inserted: number; updated: number; errors: number; errorDetails: any[] }> {
  let inserted = 0, updated = 0, errors = 0;
  const allErrors: any[] = [];

  for (let offset = 0; offset < rows.length; offset += BATCH) {
    const chunk     = rows.slice(offset, offset + BATCH);
    const isFirst   = offset === 0;
    const batchMode = mode === "replace" && isFirst ? "replace" : "upsert";

    const res = await fetch("/api/inventory/bulk", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ workspaceId, rows: chunk, mode: batchMode }),
    });

    if (res.ok) {
      const d = await res.json();
      inserted += d.inserted ?? 0;
      updated  += d.updated  ?? 0;
      errors   += d.errors   ?? 0;
      allErrors.push(...(d.errorDetails ?? []));
    } else {
      errors += chunk.length;
    }

    onProgress(offset + chunk.length, inserted, updated, errors, allErrors);
  }

  return { inserted, updated, errors, errorDetails: allErrors };
}

// ── Template download ─────────────────────────────────────────────────────────
function downloadTemplate() {
  const csv = [
    "sku,name,category,stockLevel,reorderPoint,reorderQty,unitCost,warehouse,zone,binLocation,supplier",
    "SKU-001,Example Product,Electronics,100,20,50,29.99,Main,A,A1-01,Supplier Ltd",
    "SKU-002,Another Item,Industrial,50,10,25,14.99,Main,B,B2-05,Another Supplier",
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "sku_upload_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Pipeline() {
  const [state,    setState]    = useState<PipeState | null>(null);
  const [mode,     setMode]     = useState<"upsert" | "replace">("upsert");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const getWorkspaceId = () => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("workspaceDbId") ?? "";
  };

  const processFile = useCallback(async (file: File) => {
    const workspaceId = getWorkspaceId();
    if (!workspaceId) {
      setState({ status: "error", fileName: file.name, totalRows: 0, sentRows: 0, inserted: 0, updated: 0, errors: 0, errorDetails: [], message: "No workspace found. Please log in first." });
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "xlsx" || ext === "xls") {
      setState({ status: "error", fileName: file.name, totalRows: 0, sentRows: 0, inserted: 0, updated: 0, errors: 0, errorDetails: [], message: "Excel upload: please export your sheet as CSV first (File → Save As → CSV), then upload the .csv file here." });
      return;
    }

    setState({ status: "parsing", fileName: file.name, totalRows: 0, sentRows: 0, inserted: 0, updated: 0, errors: 0, errorDetails: [] });

    const text = await file.text();
    const rows: ParsedRow[] = ext === "json" ? parseJSON(text) : parseCSV(text);

    if (rows.length === 0) {
      setState({ status: "error", fileName: file.name, totalRows: 0, sentRows: 0, inserted: 0, updated: 0, errors: 0, errorDetails: [], message: "No valid rows found. Make sure your file has 'sku' and 'name' columns. Download the template to see the expected format." });
      return;
    }

    setState(s => ({ ...s!, status: "uploading", totalRows: rows.length }));
    const t0 = Date.now();

    const result = await sendBatches(rows, workspaceId, mode, (sent, ins, upd, err, errDet) => {
      setState(s => s ? { ...s, sentRows: sent, inserted: ins, updated: upd, errors: err, errorDetails: errDet } : s);
    });

    setState(s => s ? ({
      ...s,
      status:       "done",
      sentRows:     rows.length,
      inserted:     result.inserted,
      updated:      result.updated,
      errors:       result.errors,
      errorDetails: result.errorDetails,
      elapsed:      ((Date.now() - t0) / 1000).toFixed(1),
    }) : s);
  }, [mode]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const p        = state;
  const isRunning = p?.status === "uploading" || p?.status === "parsing";
  const progress  = p && p.totalRows > 0 ? (p.sentRows / p.totalRows) * 100 : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* ── Upload zone ── */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !isRunning && fileRef.current?.click()}
        style={{
          background:    dragging ? C.blueBg : C.surface,
          border:        `2px dashed ${dragging ? C.blue : C.border2}`,
          borderRadius:  14,
          padding:       44,
          display:       "flex",
          flexDirection: "column",
          alignItems:    "center",
          gap:           16,
          cursor:        isRunning ? "not-allowed" : "pointer",
          transition:    "border-color .2s, background .2s",
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.json,.xlsx,.xls"
          style={{ display: "none" }}
          onChange={onFileChange}
        />
        <div style={{ width: 64, height: 64, background: C.blueBg, border: `1px solid ${C.blueBorder}`, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Upload size={26} color={C.blue} />
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>Bulk SKU Upload</div>
          <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Drop a CSV or JSON file here, or click to browse</div>
          <div style={{ color: C.subtle, fontSize: 12, marginTop: 2 }}>Sends 100 rows per batch · upserts by SKU · saves directly to database</div>
        </div>

        {/* Import mode selector */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Import mode:</span>
          {(["upsert", "replace"] as const).map(m => (
            <button
              key={m}
              onClick={e => { e.stopPropagation(); if (!isRunning) setMode(m); }}
              style={{
                padding: "5px 14px", fontSize: 12, fontWeight: 700, borderRadius: 8,
                cursor:     isRunning ? "not-allowed" : "pointer",
                background: mode === m ? C.blue : C.bg,
                color:      mode === m ? "#fff"  : C.muted,
                border:     `1px solid ${mode === m ? C.blueBorder : C.border}`,
              }}
            >
              {m === "upsert" ? "Upsert (add + update)" : "Replace all"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          onClick={() => !isRunning && fileRef.current?.click()}
          disabled={isRunning}
          style={{ padding: "9px 20px", background: isRunning ? C.blueBg : C.blue, color: isRunning ? C.blue : "#fff", border: `1px solid ${C.blueBorder}`, borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: isRunning ? "not-allowed" : "pointer" }}
        >
          {isRunning ? (p?.status === "parsing" ? "⚡ Parsing file…" : "⚡ Uploading…") : "Choose File"}
        </button>
        <button
          onClick={downloadTemplate}
          style={{ padding: "9px 18px", background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          <FileText size={13} /> Download CSV Template
        </button>
        {p && !isRunning && (
          <button
            onClick={() => setState(null)}
            style={{ padding: "9px 18px", background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            <RefreshCw size={12} /> Reset
          </button>
        )}
      </div>

      {/* ── Destination badges ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {[
          { label: "PostgreSQL (Neon)", ico: "🗄️" },
          { label: "Inventory Module",  ico: "📦" },
          { label: "Analytics Cache",   ico: "📊" },
        ].map(d => (
          <div key={d.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>{d.ico}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{d.label}</div>
              <div style={{ fontSize: 11, color: p?.status === "done" ? C.green : p?.status === "uploading" ? C.blue : C.subtle }}>
                {p?.status === "done" ? "✓ Synced" : p?.status === "uploading" ? "Syncing…" : "Waiting"}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Progress / result card ── */}
      {p && p.status !== "idle" && (
        <>
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <SectionTitle>{p.fileName}</SectionTitle>
              <span style={{
                padding: "3px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                background: p.status === "error" ? C.redBg   : p.status === "done" ? C.greenBg : C.blueBg,
                color:      p.status === "error" ? C.red     : p.status === "done" ? C.green   : C.blue,
                border:     `1px solid ${p.status === "error" ? C.redBorder : p.status === "done" ? C.greenBorder : C.blueBorder}`,
              }}>
                {p.status === "parsing"   ? "⚡ PARSING"
                 : p.status === "uploading" ? "⚡ UPLOADING"
                 : p.status === "error"     ? "✗ ERROR"
                 : "✓ COMPLETE"}
              </span>
            </div>

            {p.status === "error" && p.message && (
              <div style={{ padding: "12px 14px", background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 10, fontSize: 13, color: C.red, marginBottom: 12 }}>
                {p.message}
              </div>
            )}

            {(p.status === "uploading" || p.status === "done") && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted, marginBottom: 6 }}>
                    <span>{fmt(p.sentRows)} / {fmt(p.totalRows)} rows</span>
                    <span style={{ fontWeight: 700 }}>{progress.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 12, background: C.bg, borderRadius: 999, overflow: "hidden", border: `1px solid ${C.border}` }}>
                    <div style={{ height: "100%", width: `${progress}%`, background: p.status === "done" ? `linear-gradient(90deg,${C.green},#52c89a)` : `linear-gradient(90deg,${C.blue},${C.purple})`, borderRadius: 999, transition: "width .3s" }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                  {([
                    ["Total Rows", fmt(p.totalRows), C.blueBg,  C.blue,  C.blueBorder],
                    ["Inserted",   fmt(p.inserted),  C.greenBg, C.green, C.greenBorder],
                    ["Updated",    fmt(p.updated),   C.amberBg, C.amber, C.amberBorder],
                    ["Errors",     fmt(p.errors),    C.redBg,   C.red,   C.redBorder],
                  ] as [string, string, string, string, string][]).map(([l, v, bg, col, bdr], i) => (
                    <div key={i} style={{ background: bg, border: `1px solid ${bdr}`, borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ fontSize: 11, color: C.muted }}>{l}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: col, marginTop: 4 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {p.status === "done" && (
              <div style={{ marginTop: 14, padding: "10px 14px", background: C.greenBg, border: `1px solid ${C.greenBorder}`, borderRadius: 10, fontSize: 13, color: C.green, display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle size={13} />
                Done — {fmt(p.inserted)} new SKUs created, {fmt(p.updated)} updated in {p.elapsed}s. Open the Inventory tab to see your items.
              </div>
            )}
          </Card>

          {p.errorDetails.length > 0 && (
            <Card>
              <SectionTitle>Row Errors ({p.errorDetails.length})</SectionTitle>
              <div style={{ maxHeight: 240, overflowY: "auto" }}>
                {p.errorDetails.map((e, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                    <XCircle size={12} color={C.red} style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ color: C.muted }}>Row {e.row}</span>
                    <span style={{ fontFamily: "monospace", color: C.text }}>{e.sku || "(no sku)"}</span>
                    <span style={{ color: C.red, marginLeft: "auto" }}>{e.msg}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── Format guide (shown when nothing is loaded) ── */}
      {!p && (
        <Card>
          <SectionTitle>Supported Formats</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
            <div style={{ background: C.bg, borderRadius: 10, padding: 14, border: `1px solid ${C.border}` }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 6 }}>📄 CSV</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
                Required columns: <span style={{ fontFamily: "monospace", color: C.blue }}>sku</span>, <span style={{ fontFamily: "monospace", color: C.blue }}>name</span><br />
                Optional: category, stockLevel, reorderPoint, reorderQty, unitCost, warehouse, zone, binLocation, supplier<br />
                Header variants like "Stock Level", "stock_level", "qty" are auto-detected.
              </div>
            </div>
            <div style={{ background: C.bg, borderRadius: 10, padding: 14, border: `1px solid ${C.border}` }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 6 }}>🔧 JSON</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
                Array of objects or <span style={{ fontFamily: "monospace", color: C.blue }}>{`{ "items": [] }`}</span><br />
                Field names: sku/SKU/code, name/Name, stock/qty, cost/price, etc.<br />
                <span style={{ color: C.amber }}>⚠ Excel .xlsx: export as CSV first</span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12, padding: "10px 14px", background: C.amberBg, border: `1px solid ${C.amberBorder}`, borderRadius: 10, fontSize: 12, color: C.amber, display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={12} />
            <span><strong>Replace mode</strong> deletes ALL existing inventory before importing. Use <strong>Upsert</strong> to safely add or update without deleting anything.</span>
          </div>
        </Card>
      )}
    </div>
  );
}
