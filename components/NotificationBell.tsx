"use client";
// components/NotificationBell.tsx
// Phase 8 — Live notification bell.

import React, { useState, useEffect, useRef } from "react";
import { Bell, X, AlertTriangle, XCircle, CheckCircle } from "lucide-react";
import { C } from "@/lib/utils";

const READ_KEY = "industrialos_read_notifications";

function loadReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = localStorage.getItem(READ_KEY);
    return raw ? new Set<string>(JSON.parse(raw) as string[]) : new Set<string>();
  } catch { return new Set<string>(); }
}

function saveReadIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(READ_KEY, JSON.stringify(Array.from(ids)));
}

interface Notification {
  id:        string;
  type:      "invoice" | "inventory" | "order" | "contract";
  severity:  "error" | "warn" | "info";
  title:     string;
  body:      string;
  tab:       string;
  createdAt: string;
}

const SEV_STYLE: Record<string, { color: string; bg: string; border: string; Icon: React.ElementType }> = {
  error: { color: C.red,   bg: C.redBg,   border: C.redBorder,   Icon: XCircle      },
  warn:  { color: C.amber, bg: C.amberBg, border: C.amberBorder, Icon: AlertTriangle },
  info:  { color: C.blue,  bg: C.blueBg,  border: C.blueBorder,  Icon: CheckCircle  },
};

export default function NotificationBell({ onNavigate, workspaceId }: {
  onNavigate:   (tab: string) => void;
  workspaceId?: string | null;
}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds,       setReadIds]       = useState<Set<string>>(new Set<string>());
  const [open,          setOpen]          = useState(false);
  const [loading,       setLoading]       = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setReadIds(loadReadIds()); }, []);

  const fetchNotifications = async () => {
    const wid = workspaceId || (typeof window !== "undefined" ? localStorage.getItem("workspaceDbId") : null);
    if (!wid) return;
    setLoading(true);
    try {
      const res  = await fetch(`/api/notifications?workspaceId=${wid}`);
      const data = await res.json() as { notifications?: Notification[] };
      if (data.notifications) setNotifications(data.notifications);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(id);
  }, [workspaceId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unreadCount = notifications.filter((n: Notification) => !readIds.has(n.id)).length;

  const markAllRead = () => {
    const allIds = new Set<string>(notifications.map((n: Notification) => n.id));
    setReadIds(allIds);
    saveReadIds(allIds);
  };

  const markOneRead = (id: string) => {
    const updated = new Set<string>(readIds);
    updated.add(id);
    setReadIds(updated);
    saveReadIds(updated);
  };

  const handleClick = (n: Notification) => {
    markOneRead(n.id);
    onNavigate(n.tab);
    setOpen(false);
  };

  const grouped: Record<string, Notification[]> = {
    contract:  notifications.filter((n: Notification) => n.type === "contract"),
    order:     notifications.filter((n: Notification) => n.type === "order"),
    invoice:   notifications.filter((n: Notification) => n.type === "invoice"),
    inventory: notifications.filter((n: Notification) => n.type === "inventory"),
  };

  const groupLabels: Record<string, string> = {
    contract:  "📋 Contract Alerts",
    order:     "🛒 New Portal Orders",
    invoice:   "🧾 Overdue Invoices",
    inventory: "📦 Stock Alerts",
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>

      {/* Bell button */}
      <button
        onClick={() => setOpen((v: boolean) => !v)}
        style={{
          position: "relative", width: 34, height: 34,
          background: open ? C.blueBg : "none",
          border: `1px solid ${open ? C.blueBorder : C.border}`,
          borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", transition: "all 0.15s",
        }}
      >
        <Bell size={15} color={open ? C.blue : C.muted} />
        {unreadCount > 0 && (
          <div style={{
            position: "absolute", top: -4, right: -4,
            background: C.red, color: "#fff", borderRadius: "50%",
            width: 17, height: 17, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, fontWeight: 800, border: `2px solid ${C.surface}`,
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </div>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: 42, right: 0, zIndex: 200,
          width: 380, maxHeight: 520, overflowY: "auto",
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        }}>
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px 12px", borderBottom: `1px solid ${C.border}`,
            position: "sticky", top: 0, background: C.surface, zIndex: 1,
          }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: C.text }}>Notifications</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {unreadCount > 0 && (
                <button onClick={markAllRead}
                  style={{ fontSize: 11, color: C.blue, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 2 }}>
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Empty */}
          {notifications.length === 0 && !loading && (
            <div style={{ textAlign: "center", padding: "40px 24px", color: C.muted }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🎉</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 4 }}>All clear!</div>
              <div style={{ fontSize: 12 }}>No overdue invoices, expiring contracts, low stock, or new portal orders.</div>
            </div>
          )}
          {loading && notifications.length === 0 && (
            <div style={{ textAlign: "center", padding: "30px 24px", color: C.muted, fontSize: 13 }}>Loading alerts…</div>
          )}

          {/* Groups */}
          {(["contract", "order", "invoice", "inventory"] as const).map((type) => {
            const items = grouped[type];
            if (!items?.length) return null;
            return (
              <div key={type}>
                <div style={{
                  padding: "8px 16px 4px", fontSize: 10, fontWeight: 800, color: C.muted,
                  textTransform: "uppercase", letterSpacing: "0.07em",
                  background: C.bg, borderBottom: `1px solid ${C.border}`,
                }}>
                  {groupLabels[type]}
                </div>
                {items.map((n: Notification) => {
                  const isRead = readIds.has(n.id);
                  const s      = SEV_STYLE[n.severity] ?? SEV_STYLE.info;
                  const Icon   = s.Icon;
                  return (
                    <div key={n.id} onClick={() => handleClick(n)}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 10,
                        padding: "11px 16px", cursor: "pointer",
                        background: isRead ? "transparent" : s.bg,
                        borderBottom: `1px solid ${C.border}`,
                        opacity: isRead ? 0.6 : 1,
                      }}
                      onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.background = C.bg)}
                      onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.background = isRead ? "transparent" : s.bg)}
                    >
                      <Icon size={14} color={s.color} style={{ marginTop: 2, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: isRead ? 500 : 700, color: C.text, marginBottom: 2 }}>{n.title}</div>
                        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.body}</div>
                      </div>
                      {!isRead && <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, flexShrink: 0, marginTop: 5 }} />}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {notifications.length > 0 && (
            <div style={{ padding: "10px 16px", textAlign: "center", borderTop: `1px solid ${C.border}` }}>
              <button onClick={fetchNotifications}
                style={{ fontSize: 11, color: C.muted, background: "none", border: "none", cursor: "pointer" }}>
                Refresh
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
