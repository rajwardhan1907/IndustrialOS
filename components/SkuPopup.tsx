"use client";
import { useEffect, useState } from "react";

interface InvItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  stockLevel: number;
  reorderPoint: number;
  reorderQty: number;
  unitCost: number;
  warehouse: string;
  zone: string;
  binLocation: string;
  supplier: string;
  supplierId?: string | null;
}

export function SkuPopup({
  sku,
  workspaceId,
  onClose,
}: {
  sku: string;
  workspaceId: string;
  onClose: () => void;
}) {
  const [item, setItem] = useState<InvItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        if (!workspaceId) { setErr("Workspace not available"); return; }
        const res = await fetch(`/api/inventory?workspaceId=${encodeURIComponent(workspaceId)}`);
        if (!res.ok) { setErr(`Could not load inventory (${res.status})`); return; }
        const rows = await res.json();
        if (cancelled) return;
        if (!Array.isArray(rows)) { setErr("Unexpected inventory response"); return; }
        const hit: InvItem | null = rows.find((r: InvItem) => r.sku === sku) ?? null;
        setItem(hit);
        if (!hit) setErr(`No inventory item matches SKU "${sku}"`);
      } catch (e: any) {
        if (!cancelled) setErr(e.message ?? "Fetch error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sku, workspaceId]);

  const Row = ({ label, value }: { label: string; value: any }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <span style={{ color: "#8a93a6", fontSize: 12 }}>{label}</span>
      <span style={{ color: "#e5e7eb", fontSize: 13, fontWeight: 600 }}>{value ?? "—"}</span>
    </div>
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(420px, 92vw)",
          background: "#1a1d24",
          border: "1px solid #2a2f3a",
          borderRadius: 12,
          padding: 20,
          color: "#e5e7eb",
          boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Inventory: {sku}</div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#8a93a6", fontSize: 20, cursor: "pointer", lineHeight: 1 }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {loading && <div style={{ padding: 20, textAlign: "center", color: "#8a93a6" }}>Loading…</div>}
        {err && !loading && <div style={{ padding: 14, color: "#ef8a8a", fontSize: 13 }}>{err}</div>}
        {item && !loading && (
          <div>
            <Row label="Name"        value={item.name} />
            <Row label="Category"    value={item.category} />
            <Row label="Stock level" value={item.stockLevel} />
            <Row label="Reorder at"  value={item.reorderPoint} />
            <Row label="Reorder qty" value={item.reorderQty} />
            <Row label="Unit cost"   value={`$${Number(item.unitCost).toFixed(2)}`} />
            <Row label="Warehouse"   value={item.warehouse || "—"} />
            <Row label="Zone"        value={item.zone} />
            <Row label="Bin"         value={item.binLocation || "—"} />
            <Row label="Supplier"    value={item.supplier || "—"} />
          </div>
        )}
      </div>
    </div>
  );
}

// Clickable SKU span — wraps a SKU string with popup handler.
export function SkuLink({
  sku,
  workspaceId,
  style,
}: {
  sku: string;
  workspaceId: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  if (!sku) return <span style={style}>—</span>;
  return (
    <>
      <span
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        style={{
          cursor: "pointer",
          color: "#5b8de8",
          textDecoration: "underline",
          textDecorationStyle: "dotted",
          ...style,
        }}
      >
        {sku}
      </span>
      {open && <SkuPopup sku={sku} workspaceId={workspaceId} onClose={() => setOpen(false)} />}
    </>
  );
}
