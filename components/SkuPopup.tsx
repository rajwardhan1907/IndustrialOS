"use client";
// Shared SKU detail popup — fetches inventory item and shows a small modal.

import { useState, useEffect } from "react";
import { X, Package } from "lucide-react";
import { C } from "@/lib/utils";

interface SkuItem {
  sku:          string;
  name:         string;
  stockLevel:   number;
  reorderPoint: number;
  unitCost:     number;
}

interface Props {
  sku:      string;
  onClose:  () => void;
}

function getWorkspaceId() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("workspaceDbId");
}

export default function SkuPopup({ sku, onClose }: Props) {
  const [item,    setItem]    = useState<SkuItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    const wid = getWorkspaceId();
    if (!wid) { setError("No workspace"); setLoading(false); return; }
    fetch(`/api/inventory?workspaceId=${wid}&sku=${encodeURIComponent(sku)}`)
      .then(r => r.json())
      .then(data => { setItem(data); setLoading(false); })
      .catch(() => { setError("Failed to load item"); setLoading(false); });
  }, [sku]);

  const fmtMoney = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px", width: "100%", maxWidth: 340, boxShadow: "0 16px 48px rgba(0,0,0,0.18)" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Package size={15} color={C.blue} />
            <span style={{ fontWeight: 800, fontSize: 14, color: C.text }}>SKU Details</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }}>
            <X size={16} />
          </button>
        </div>

        {loading && <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "16px 0" }}>Loading…</div>}
        {error   && <div style={{ fontSize: 13, color: C.red }}>{error}</div>}
        {!loading && !error && !item && (
          <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "16px 0" }}>No inventory record found for <strong>{sku}</strong>.</div>
        )}
        {item && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "SKU",           value: item.sku,                     mono: true  },
              { label: "Name",          value: item.name,                    mono: false },
              { label: "Stock",         value: String(item.stockLevel),      mono: false },
              { label: "Reorder Point", value: String(item.reorderPoint),    mono: false },
              { label: "Unit Cost",     value: fmtMoney(item.unitCost),      mono: false },
            ].map(({ label, value, mono }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: mono ? C.blue : C.text, fontFamily: mono ? "monospace" : "inherit" }}>{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
