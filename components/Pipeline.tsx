"use client";
import { useEffect } from "react";
import { Upload, CheckCircle } from "lucide-react";
import { C, fmt, rnd } from "@/lib/utils";
import { Card, SectionTitle } from "./Dashboard";

export default function Pipeline({ pipe, setPipe }: any) {
  const start = () => setPipe({ progress: 0, rows: 0, total: 1000000, errors: 0, conflicts: 0, batches: 0, status: "running", t0: Date.now() });
  const reset = () => setPipe(null);
  const p = pipe;

  // ── Simulation interval ──────────────────────────────────────────────────
  useEffect(() => {
    if (!p || p.status !== "running") return;
    const id = setInterval(() => {
      setPipe((prev: any) => {
        if (!prev || prev.status !== "running") return prev;
        const batchSize  = 1000;
        const newBatches = prev.batches + rnd(1, 3);           // ← was Math.random()
        const newRows    = Math.min(newBatches * batchSize, prev.total);
        const newErrors  = prev.errors    + (rnd(0, 99) < 2 ? 1 : 0); // ~2% chance
        const newConfl   = prev.conflicts + (rnd(0, 99) < 4 ? 1 : 0); // ~4% chance
        const progress   = (newRows / prev.total) * 100;
        const done       = newRows >= prev.total;
        return {
          ...prev,
          batches:   newBatches,
          rows:      newRows,
          errors:    newErrors,
          conflicts: newConfl,
          progress:  done ? 100 : progress,
          status:    done ? "done" : "running",
          elapsed:   done ? ((Date.now() - prev.t0) / 1000).toFixed(1) : undefined,
        };
      });
    }, 120);
    return () => clearInterval(id);
  }, [p?.status]);

  const batchLog = p ? Array.from({ length: Math.min(10, p.batches) }, (_, i) => ({ id: p.batches - i })) : [];
  const dests = [{ label: "PostgreSQL", ico: "🗄️" }, { label: "Storefront API", ico: "🛍️" }, { label: "CRM Webhook", ico: "🔌" }];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* ── Upload zone ── */}
      <div style={{ background: C.surface, border: `2px dashed ${C.border2}`, borderRadius: 14, padding: 44, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ width: 64, height: 64, background: C.blueBg, border: `1px solid ${C.blueBorder}`, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Upload size={26} color={C.blue} />
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>Bulk SKU Upload</div>
          <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>CSV · Excel · JSON — up to 1M rows</div>
          <div style={{ color: C.subtle, fontSize: 12, marginTop: 2 }}>BullMQ parallel batches of 1,000 · 12 workers</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={start}
            disabled={p?.status === "running"}
            style={{ padding: "10px 22px", background: p?.status === "running" ? C.blueBg : C.blue, color: p?.status === "running" ? C.blue : "#fff", border: `1px solid ${C.blueBorder}`, borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: p?.status === "running" ? "not-allowed" : "pointer" }}
          >
            {p?.status === "running" ? "⚡ Processing…" : "▶  Simulate 1M SKU Upload"}
          </button>
          {p?.status === "done" && (
            <button onClick={reset} style={{ padding: "10px 18px", background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Destination connectors ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {dests.map((d) => (
          <div key={d.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>{d.ico}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{d.label}</div>
              <div style={{ fontSize: 11, color: p?.status === "done" ? C.green : p?.status === "running" ? C.blue : C.subtle }}>
                {p?.status === "done" ? "✓ Synced" : p?.status === "running" ? "Syncing…" : "Waiting"}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Live progress ── */}
      {p && (
        <>
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <SectionTitle>Pipeline Progress</SectionTitle>
              <span style={{ padding: "3px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: p.status === "done" ? C.greenBg : C.blueBg, color: p.status === "done" ? C.green : C.blue, border: `1px solid ${p.status === "done" ? C.greenBorder : C.blueBorder}` }}>
                {p.status === "done" ? "✓ COMPLETE" : "⚡ RUNNING"}
              </span>
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted, marginBottom: 6 }}>
                <span>{fmt(p.rows)} / {fmt(p.total)} rows</span>
                <span style={{ fontWeight: 700 }}>{p.progress.toFixed(2)}%</span>
              </div>
              <div style={{ height: 12, background: C.bg, borderRadius: 999, overflow: "hidden", border: `1px solid ${C.border}` }}>
                <div style={{ height: "100%", width: `${p.progress}%`, background: p.status === "done" ? `linear-gradient(90deg,${C.green},#52c89a)` : `linear-gradient(90deg,${C.blue},${C.purple})`, borderRadius: 999, transition: "width .3s" }} />
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
              {[
                ["Batches",   fmt(p.batches),   C.blueBg,  C.blue,  C.blueBorder],
                ["Rows",      fmt(p.rows),       C.greenBg, C.green, C.greenBorder],
                ["Errors",    p.errors,          C.redBg,   C.red,   C.redBorder],
                ["Conflicts", p.conflicts,       C.amberBg, C.amber, C.amberBorder],
              ].map(([l, v, bg, col, bdr]: any, i) => (
                <div key={i} style={{ background: bg, border: `1px solid ${bdr}`, borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, color: C.muted }}>{l}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: col, marginTop: 4 }}>{v}</div>
                </div>
              ))}
            </div>

            {p.status === "done" && (
              <div style={{ marginTop: 14, padding: "10px 14px", background: C.greenBg, border: `1px solid ${C.greenBorder}`, borderRadius: 10, fontSize: 13, color: C.green, display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle size={13} /> Complete — {fmt(p.total)} SKUs synced in {p.elapsed}s
              </div>
            )}
          </Card>

          {/* ── Batch log ── */}
          {batchLog.length > 0 && (
            <Card>
              <SectionTitle>Live Batch Log</SectionTitle>
              {batchLog.map((b: any) => (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                  <CheckCircle size={12} color={C.green} />
                  <span style={{ fontFamily: "monospace", color: C.muted }}>Batch #{b.id}</span>
                  <span style={{ color: C.subtle }}>1,000 rows</span>
                  <span style={{ marginLeft: "auto", color: C.green, fontSize: 11, fontWeight: 700 }}>✓ done</span>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
