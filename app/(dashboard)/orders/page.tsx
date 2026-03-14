"use client";

import { useEffect, useState } from "react";

type Order = {
  id: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
};

const C = {
  bg: "#0f1117", surface: "#141722", border: "#2a2d3e",
  text: "#e8e6e1", muted: "#7a7d8a", subtle: "#4a4d5a",
  blue: "#5b8de8", blueBg: "#1e2a45",
  green: "#68d391", greenBg: "#0d1f12",
  amber: "#f6c90e", amberBg: "#1f1a00",
  red: "#fc8181", redBg: "#2d1515",
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:    { bg: C.amberBg, color: C.amber },
  processing: { bg: C.blueBg,  color: C.blue  },
  completed:  { bg: C.greenBg, color: C.green },
  cancelled:  { bg: C.redBg,   color: C.red   },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: C.muted, medium: C.amber, high: C.red,
};

export default function OrdersPage() {
  const [orders, setOrders]     = useState<Order[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle]       = useState("");
  const [status, setStatus]     = useState("pending");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving]     = useState(false);

  // Load orders from database
  const loadOrders = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/orders");
      const data = await res.json();
      setOrders(data);
    } catch (err) {
      console.error("Failed to load orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOrders(); }, []);

  // Create a new order
  const createOrder = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/orders", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          status,
          priority,
          workspaceId: "default", // we'll improve this later
        }),
      });
      setTitle("");
      setStatus("pending");
      setPriority("medium");
      setShowForm(false);
      await loadOrders(); // refresh list
    } catch (err) {
      console.error("Failed to create order:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: "32px 24px", background: C.bg, minHeight: "100vh", color: C.text }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Orders</h1>
          <p style={{ color: C.muted, fontSize: 14, margin: "4px 0 0" }}>
            {orders.length} total orders
          </p>
        </div>
        <button
          onClick={() => setShowForm(f => !f)}
          style={{
            padding: "10px 20px", background: C.blue, border: "none",
            borderRadius: 10, color: "#fff", fontWeight: 700,
            fontSize: 14, cursor: "pointer",
          }}
        >
          + New Order
        </button>
      </div>

      {/* New Order Form */}
      {showForm && (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 14, padding: "20px 24px", marginBottom: 24,
        }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>Create New Order</h3>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <input
              placeholder="Order title..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{
                flex: 1, minWidth: 200, padding: "10px 14px",
                background: "#1a1d2e", border: `1px solid ${C.border}`,
                borderRadius: 8, color: C.text, fontSize: 14, outline: "none",
              }}
            />
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              style={{
                padding: "10px 14px", background: "#1a1d2e",
                border: `1px solid ${C.border}`, borderRadius: 8,
                color: C.text, fontSize: 14, cursor: "pointer",
              }}
            >
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              style={{
                padding: "10px 14px", background: "#1a1d2e",
                border: `1px solid ${C.border}`, borderRadius: 8,
                color: C.text, fontSize: 14, cursor: "pointer",
              }}
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </select>
            <button
              onClick={createOrder}
              disabled={saving || !title.trim()}
              style={{
                padding: "10px 20px", background: C.blue, border: "none",
                borderRadius: 8, color: "#fff", fontWeight: 700,
                fontSize: 14, cursor: saving ? "not-allowed" : "pointer",
                opacity: saving || !title.trim() ? 0.6 : 1,
              }}
            >
              {saving ? "Saving..." : "Save Order"}
            </button>
          </div>
        </div>
      )}

      {/* Orders List */}
      {loading ? (
        <div style={{ textAlign: "center", color: C.muted, padding: 60 }}>
          Loading orders...
        </div>
      ) : orders.length === 0 ? (
        <div style={{
          textAlign: "center", color: C.muted, padding: 60,
          background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`,
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <p style={{ fontSize: 16, fontWeight: 600 }}>No orders yet</p>
          <p style={{ fontSize: 13 }}>Click "+ New Order" to create your first one</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {orders.map(order => {
            const s = STATUS_COLORS[order.status] ?? STATUS_COLORS.pending;
            return (
              <div key={order.id} style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 12, padding: "16px 20px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 12,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{order.title}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                    {new Date(order.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "4px 10px",
                    borderRadius: 20, background: s.bg, color: s.color,
                    textTransform: "capitalize",
                  }}>{order.status}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: PRIORITY_COLORS[order.priority] ?? C.muted,
                  }}>
                    {order.priority?.toUpperCase()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
