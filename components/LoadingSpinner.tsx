"use client";
import { C } from "@/lib/utils";

interface Props {
  label?:  string;
  height?: number;
  size?:   number;
}

export default function LoadingSpinner({ label = "Loading...", height = 300, size = 32 }: Props) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height, gap: 14,
    }}>
      <div style={{
        width: size, height: size,
        border: `3px solid ${C.border}`,
        borderTop: `3px solid ${C.blue}`,
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <div style={{ fontSize: 13, color: C.muted }}>{label}</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Skeleton block for card placeholders ─────────────────────────────────────
export function Skeleton({ width = "100%", height = 16, borderRadius = 6, style = {} }: {
  width?: string | number;
  height?: number;
  borderRadius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{
      width, height, borderRadius,
      background: `linear-gradient(90deg, ${C.bg} 25%, ${C.border} 50%, ${C.bg} 75%)`,
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
      ...style,
    }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}

// ── Dashboard skeleton ────────────────────────────────────────────────────────
export function DashboardSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 12 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" }}>
            <Skeleton height={10} width="60%" style={{ marginBottom: 10 }} />
            <Skeleton height={28} width="80%" />
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {[0, 1].map(i => (
          <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
            <Skeleton height={12} width="40%" style={{ marginBottom: 14 }} />
            <Skeleton height={145} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Table skeleton ────────────────────────────────────────────────────────────
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", background: C.bg, borderBottom: `1px solid ${C.border}`, display: "flex", gap: 16 }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height={10} width={`${100 / cols}%`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ padding: "14px 16px", borderBottom: i < rows - 1 ? `1px solid ${C.border}` : "none", display: "flex", gap: 16 }}>
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} height={12} width={`${100 / cols}%`} />
          ))}
        </div>
      ))}
    </div>
  );
}
