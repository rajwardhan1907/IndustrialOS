"use client";
// components/CRMPanel.tsx

import { XCircle } from "lucide-react";
import { C } from "@/lib/utils";
import { Card } from "./Dashboard";

export default function CRMPanel() {
  const adapters = [
    { key: "salesforce", name: "Salesforce", ico: "☁️", desc: "Sales Cloud"       },
    { key: "hubspot",    name: "HubSpot",    ico: "🧲", desc: "Marketing + CRM"   },
    { key: "zoho",       name: "Zoho CRM",   ico: "🔧", desc: "Operations CRM"    },
  ];

  const disabledBtn = {
    fontSize: 12, background: "#f3f4f6", color: C.muted,
    border: `1px solid ${C.border}`, borderRadius: 6,
    padding: "5px 12px", cursor: "not-allowed", fontWeight: 600, opacity: 0.6,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>CRM Integration Layer</div>
        <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>
          Plug-and-play adapters — add your API key in <code>.env.local</code> to connect
        </div>
      </div>

      {/* API key required banner */}
      <div style={{
        padding: "10px 16px",
        background: "#fffbeb", border: "1px solid #f59e0b",
        borderRadius: 10, fontSize: 13, color: "#92400e",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ fontSize: 16 }}>🔑</span>
        <span>
          CRM sync requires API keys — add <code>CRM_API_KEY</code> to <code>.env.local</code> to enable connections.
        </span>
      </div>

      {adapters.map(a => (
        <Card key={a.key}>
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 44, height: 44, background: C.bg,
                border: `1px solid ${C.border}`, borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24
              }}>{a.ico}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{a.name}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{a.desc}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                padding: "3px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                background: "#f0f0f0", color: C.muted, border: `1px solid ${C.border}`
              }}>DISCONNECTED</span>
              <button disabled style={disabledBtn}>Requires API Key</button>
            </div>
          </div>

          {/* API methods */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginBottom: 14 }}>
            {["syncProduct()", "syncOrder()", "syncInventory()", "syncCustomer()"].map(m => (
              <div key={m} style={{
                background: C.bg, border: `1px solid ${C.border}`,
                borderRadius: 8, padding: "8px 10px", fontSize: 11,
                fontFamily: "monospace", display: "flex", alignItems: "center", gap: 6,
                color: C.subtle
              }}>
                <XCircle size={10} />
                {m}
              </div>
            ))}
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {["Last Sync", "Products Synced", "Webhook Latency"].map((l, i) => (
              <div key={i} style={{
                background: C.bg, border: `1px solid ${C.border}`,
                borderRadius: 8, padding: "10px 12px"
              }}>
                <div style={{ fontSize: 11, color: C.muted }}>{l}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginTop: 2 }}>—</div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 14, padding: "10px 14px",
            background: C.amberBg, border: `1px solid ${C.amberBorder}`,
            borderRadius: 10, fontSize: 13, color: C.amber
          }}>
            Add your API key in <code>.env.local</code> to connect {a.name}.
          </div>
        </Card>
      ))}

      {/* ENV example */}
      <div style={{ background: "#f8f5f0", border: `1px dashed ${C.border2}`, borderRadius: 12, padding: 18 }}>
        <div style={{ fontSize: 11, color: C.subtle, fontFamily: "monospace", marginBottom: 10, fontWeight: 600 }}>
          // Add to your .env.local to connect a CRM:
        </div>
        {[
          ["CRM_PROVIDER",     '"salesforce"',                        C.green],
          ["CRM_WEBHOOK_URL",  '"https://hooks.salesforce.com/..."',  C.blue ],
          ["CRM_API_KEY",      '"sk_live_your_key_here"',             C.amber],
        ].map(([k, v, c], i) => (
          <div key={i} style={{ fontFamily: "monospace", fontSize: 13, marginBottom: 4 }}>
            <span style={{ color: C.muted }}>{k}=</span>
            <span style={{ color: c as string }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
