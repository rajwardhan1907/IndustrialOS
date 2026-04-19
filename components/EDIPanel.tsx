"use client";
import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Send, Download, RefreshCw, ChevronDown, ChevronRight, AlertTriangle, CheckCircle, XCircle, Clock, Search } from "lucide-react";
import { C } from "@/lib/utils";
import { Card, SectionTitle } from "./Dashboard";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Partner {
  id:           string;
  name:         string;
  standard:     string;
  isaId:        string;
  partnerId:    string;
  unbSenderId:  string;
  unbReceiverId:string;
  txSets:       string;
  active:       boolean;
  notes:        string;
}

interface Transaction {
  id:           string;
  direction:    "inbound" | "outbound";
  standard:     string;
  txSet:        string;
  controlNumber:string;
  partnerId:    string;
  partner?:     { name: string; standard: string };
  status:       string;
  rawPayload:   string;
  parsedJson:   any;
  errorMsg:     string;
  createdAt:    string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function statusColor(s: string) {
  if (s === "processed" || s === "sent" || s === "acked") return { bg: C.greenBg, color: C.green, border: C.greenBorder };
  if (s === "error")                                        return { bg: C.redBg,   color: C.red,   border: C.redBorder };
  if (s === "received")                                     return { bg: C.blueBg,  color: C.blue,  border: C.blueBorder };
  return { bg: C.amberBg, color: C.amber, border: C.amberBorder };
}

function statusIcon(s: string) {
  if (s === "processed" || s === "sent" || s === "acked") return <CheckCircle size={11} />;
  if (s === "error")   return <XCircle size={11} />;
  if (s === "received") return <Clock size={11} />;
  return <Clock size={11} />;
}

const TX_SET_LABELS: Record<string, string> = {
  "850": "850 Purchase Order",  "ORDERS": "ORDERS Purchase Order",
  "855": "855 PO Acknowledgment","ORDRSP": "ORDRSP Order Response",
  "856": "856 Advance Ship Notice","DESADV": "DESADV Dispatch Advice",
  "810": "810 Invoice",          "INVOIC": "INVOIC Invoice",
};

// ── Blank partner form ────────────────────────────────────────────────────────
const blankPartner = (): Omit<Partner, "id" | "active"> => ({
  name: "", standard: "X12", isaId: "", partnerId: "",
  unbSenderId: "", unbReceiverId: "", txSets: "850,855,856,810", notes: "",
});

// ── Main component ────────────────────────────────────────────────────────────
export default function EDIPanel() {
  const [tab,          setTab]         = useState<"partners" | "inbound" | "outbound" | "log">("partners");
  const [partners,     setPartners]    = useState<Partner[]>([]);
  const [transactions, setTransactions]= useState<Transaction[]>([]);
  const [searchTerm,   setSearchTerm]  = useState("");
  const [loading,      setLoading]     = useState(false);
  const [msg,          setMsg]         = useState("");
  const [err,          setErr]         = useState("");

  // Partner form
  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const [partnerForm,     setPartnerForm]     = useState(blankPartner());
  const [editingId,       setEditingId]       = useState<string | null>(null);

  // Inbound test
  const [inboundPartnerId, setInboundPartnerId] = useState("");
  const [inboundPayload,   setInboundPayload]   = useState("");
  const [inboundResult,    setInboundResult]    = useState<any>(null);
  const [inboundLoading,   setInboundLoading]   = useState(false);

  // Outbound generator
  const [outPartnerId, setOutPartnerId] = useState("");
  const [outDocType,   setOutDocType]   = useState("810");
  const [outSourceId,  setOutSourceId]  = useState("");
  const [outResult,    setOutResult]    = useState<any>(null);
  const [outLoading,   setOutLoading]   = useState(false);

  // Expanded transaction
  const [expandedTx, setExpandedTx] = useState<string | null>(null);

  const getWorkspaceId = () =>
    typeof window !== "undefined" ? localStorage.getItem("workspaceDbId") ?? "" : "";

  const load = async () => {
    const wid = getWorkspaceId();
    if (!wid) return;
    setLoading(true);
    try {
      const [pRes, tRes] = await Promise.all([
        fetch(`/api/edi/partners?workspaceId=${wid}`),
        fetch(`/api/edi/transactions?workspaceId=${wid}&limit=100`),
      ]);
      if (pRes.ok) setPartners(await pRes.json());
      if (tRes.ok) setTransactions(await tRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const flash = (m: string, isErr = false) => {
    if (isErr) setErr(m); else setMsg(m);
    setTimeout(() => { setMsg(""); setErr(""); }, 4000);
  };

  // ── Save partner ────────────────────────────────────────────────────────────
  const savePartner = async () => {
    const wid = getWorkspaceId();
    if (!partnerForm.name.trim()) { flash("Partner name is required", true); return; }

    const method = editingId ? "PATCH" : "POST";
    const body   = editingId
      ? { id: editingId, ...partnerForm }
      : { workspaceId: wid, ...partnerForm };

    const res = await fetch("/api/edi/partners", {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      flash(editingId ? "Partner updated" : "Partner added");
      setShowPartnerForm(false);
      setEditingId(null);
      setPartnerForm(blankPartner());
      load();
    } else {
      const d = await res.json();
      flash(d.error ?? "Save failed", true);
    }
  };

  const deletePartner = async (id: string) => {
    if (!confirm("Delete this trading partner and all its transactions?")) return;
    await fetch(`/api/edi/partners?id=${id}`, { method: "DELETE" });
    flash("Partner deleted");
    load();
  };

  // ── Inbound test ────────────────────────────────────────────────────────────
  const submitInbound = async () => {
    if (!inboundPartnerId || !inboundPayload.trim()) {
      flash("Select a partner and paste an EDI payload", true); return;
    }
    setInboundLoading(true); setInboundResult(null);
    const wid = getWorkspaceId();
    const res = await fetch("/api/edi/inbound", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: wid, partnerId: inboundPartnerId, rawPayload: inboundPayload }),
    });
    const d = await res.json();
    setInboundResult(d);
    setInboundLoading(false);
    if (res.ok) { flash("Inbound EDI processed"); load(); }
    else flash(d.error ?? "Processing failed", true);
  };

  // ── Outbound generator ──────────────────────────────────────────────────────
  const generateOutbound = async () => {
    if (!outPartnerId || !outDocType) { flash("Select partner and doc type", true); return; }
    setOutLoading(true); setOutResult(null);
    const wid = getWorkspaceId();
    const res = await fetch("/api/edi/outbound", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: wid, partnerId: outPartnerId, docType: outDocType, sourceId: outSourceId }),
    });
    const d = await res.json();
    setOutResult(d);
    setOutLoading(false);
    if (res.ok) { flash("EDI generated and logged"); load(); }
    else flash(d.error ?? "Generation failed", true);
  };

  const downloadEdi = (payload: string, filename: string) => {
    const blob = new Blob([payload], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const tabs = [
    { key: "partners", label: "Trading Partners" },
    { key: "inbound",  label: "Receive EDI" },
    { key: "outbound", label: "Generate EDI" },
    { key: "log",      label: `Transaction Log (${transactions.length})` },
  ] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Flash messages */}
      {msg && <div style={{ padding: "10px 16px", background: C.greenBg, border: `1px solid ${C.greenBorder}`, borderRadius: 10, fontSize: 13, color: C.green }}>{msg}</div>}
      {err && <div style={{ padding: "10px 16px", background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 10, fontSize: 13, color: C.red }}>{err}</div>}

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, background: C.bg, borderRadius: 10, padding: 4, border: `1px solid ${C.border}` }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ flex: 1, padding: "8px 12px", fontSize: 12, fontWeight: 700, borderRadius: 8, border: "none", cursor: "pointer",
              background: tab === t.key ? C.blue : "transparent",
              color:      tab === t.key ? "#fff"  : C.muted }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── PARTNERS tab ─────────────────────────────────────────────────── */}
      {tab === "partners" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 13, color: C.muted }}>{partners.length} trading partner{partners.length !== 1 ? "s" : ""}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Search size={13} style={{ position: "absolute", left: 9, color: C.muted, pointerEvents: "none" }} />
                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search partners…" style={{ padding: "7px 10px 7px 28px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 12, outline: "none", width: 170 }} />
              </div>
              <button onClick={() => { setShowPartnerForm(true); setEditingId(null); setPartnerForm(blankPartner()); }}
                style={{ padding: "8px 16px", background: C.blue, color: "#fff", border: `1px solid ${C.blueBorder}`, borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <Plus size={13} /> Add Partner
              </button>
            </div>
          </div>

          {showPartnerForm && (
            <Card>
              <SectionTitle>{editingId ? "Edit Partner" : "New Trading Partner"}</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
                {[
                  ["Partner Name",   "name",           partnerForm.name],
                  ["Your ISA ID",    "isaId",          partnerForm.isaId],
                  ["Partner ISA ID", "partnerId",      partnerForm.partnerId],
                  ["UNB Sender ID",  "unbSenderId",    partnerForm.unbSenderId],
                  ["UNB Receiver ID","unbReceiverId",  partnerForm.unbReceiverId],
                  ["TX Sets",        "txSets",         partnerForm.txSets],
                ].map(([label, key, val]) => (
                  <div key={key as string}>
                    <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 4 }}>{label as string}</div>
                    <input value={val as string}
                      onChange={e => setPartnerForm(f => ({ ...f, [key as string]: e.target.value }))}
                      style={{ width: "100%", padding: "7px 10px", border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, background: C.bg, color: C.text, boxSizing: "border-box" }} />
                  </div>
                ))}
                <div>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 4 }}>Standard</div>
                  <select value={partnerForm.standard}
                    onChange={e => setPartnerForm(f => ({ ...f, standard: e.target.value }))}
                    style={{ width: "100%", padding: "7px 10px", border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, background: C.bg, color: C.text }}>
                    <option value="X12">X12 (ANSI ASC X12)</option>
                    <option value="EDIFACT">EDIFACT (UN/EDIFACT)</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 4 }}>Notes</div>
                  <input value={partnerForm.notes}
                    onChange={e => setPartnerForm(f => ({ ...f, notes: e.target.value }))}
                    style={{ width: "100%", padding: "7px 10px", border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, background: C.bg, color: C.text, boxSizing: "border-box" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button onClick={savePartner}
                  style={{ padding: "8px 18px", background: C.blue, color: "#fff", border: `1px solid ${C.blueBorder}`, borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  {editingId ? "Save Changes" : "Add Partner"}
                </button>
                <button onClick={() => { setShowPartnerForm(false); setEditingId(null); }}
                  style={{ padding: "8px 16px", background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </Card>
          )}

          {partners.length === 0 && !showPartnerForm && (
            <div style={{ padding: 40, textAlign: "center", color: C.muted, fontSize: 13 }}>
              No trading partners yet. Click <strong>Add Partner</strong> to configure your first EDI connection.
            </div>
          )}

          {partners.filter(p => !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.standard.toLowerCase().includes(searchTerm.toLowerCase()) || p.isaId?.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
            <Card key={p.id}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: p.standard === "X12" ? C.blueBg : C.amberBg, border: `1px solid ${p.standard === "X12" ? C.blueBorder : C.amberBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: p.standard === "X12" ? C.blue : C.amber }}>
                    {p.standard}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {p.standard === "X12" ? `ISA: ${p.partnerId || "—"}` : `UNB: ${p.unbReceiverId || "—"}`}
                      {" · "}TX: {p.txSets}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: p.active ? C.greenBg : C.bg, color: p.active ? C.green : C.muted, border: `1px solid ${p.active ? C.greenBorder : C.border}` }}>
                    {p.active ? "Active" : "Inactive"}
                  </span>
                  <button onClick={() => { setEditingId(p.id); setPartnerForm({ name: p.name, standard: p.standard, isaId: p.isaId, partnerId: p.partnerId, unbSenderId: p.unbSenderId, unbReceiverId: p.unbReceiverId, txSets: p.txSets, notes: p.notes }); setShowPartnerForm(true); }}
                    style={{ padding: "5px 10px", background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, cursor: "pointer" }}>
                    Edit
                  </button>
                  <button onClick={() => deletePartner(p.id)}
                    style={{ padding: "5px 8px", background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}`, borderRadius: 7, cursor: "pointer" }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </>
      )}

      {/* ── INBOUND tab ───────────────────────────────────────────────────── */}
      {tab === "inbound" && (
        <Card>
          <SectionTitle>Receive Inbound EDI</SectionTitle>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
            Paste an X12 or EDIFACT message below. The system will auto-detect the format, parse it, log the transaction, and create the corresponding record (PO or Invoice) automatically.
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 4 }}>Trading Partner</div>
            <select value={inboundPartnerId} onChange={e => setInboundPartnerId(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, background: C.bg, color: C.text }}>
              <option value="">— Select partner —</option>
              {partners.map(p => <option key={p.id} value={p.id}>{p.name} ({p.standard})</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 4 }}>EDI Payload</div>
            <textarea value={inboundPayload} onChange={e => setInboundPayload(e.target.value)}
              placeholder="Paste X12 or EDIFACT message here…"
              style={{ width: "100%", height: 200, padding: "10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontFamily: "monospace", background: C.bg, color: C.text, resize: "vertical", boxSizing: "border-box" }} />
          </div>

          <button onClick={submitInbound} disabled={inboundLoading}
            style={{ padding: "9px 20px", background: inboundLoading ? C.blueBg : C.blue, color: inboundLoading ? C.blue : "#fff", border: `1px solid ${C.blueBorder}`, borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: inboundLoading ? "not-allowed" : "pointer" }}>
            {inboundLoading ? "Processing…" : "Process EDI Message"}
          </button>

          {inboundResult && (
            <div style={{ marginTop: 14, padding: "12px 14px", background: inboundResult.error ? C.redBg : C.greenBg, border: `1px solid ${inboundResult.error ? C.redBorder : C.greenBorder}`, borderRadius: 10 }}>
              {inboundResult.error ? (
                <div style={{ fontSize: 13, color: C.red }}>{inboundResult.error}</div>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: C.green, fontWeight: 700, marginBottom: 6 }}>
                    ✓ {inboundResult.standard} {inboundResult.txSet} processed
                    {inboundResult.autoAction && ` · ${inboundResult.autoAction}`}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>Transaction ID: {inboundResult.transactionId}</div>
                </>
              )}
            </div>
          )}
        </Card>
      )}

      {/* ── OUTBOUND tab ─────────────────────────────────────────────────── */}
      {tab === "outbound" && (
        <Card>
          <SectionTitle>Generate Outbound EDI</SectionTitle>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
            Generate an EDI file from an existing record in your system. The format used (X12 or EDIFACT) is determined by the trading partner's configuration.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 4 }}>Trading Partner</div>
              <select value={outPartnerId} onChange={e => setOutPartnerId(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, background: C.bg, color: C.text }}>
                <option value="">— Select partner —</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.name} ({p.standard})</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 4 }}>Document Type</div>
              <select value={outDocType} onChange={e => setOutDocType(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, background: C.bg, color: C.text }}>
                {outPartnerId && partners.find(p => p.id === outPartnerId)?.standard === "EDIFACT" ? (
                  <>
                    <option value="INVOIC">INVOIC — Invoice</option>
                    <option value="ORDRSP">ORDRSP — PO Acknowledgment</option>
                    <option value="DESADV">DESADV — Dispatch Advice (ASN)</option>
                  </>
                ) : (
                  <>
                    <option value="810">810 — Invoice</option>
                    <option value="855">855 — PO Acknowledgment</option>
                    <option value="856">856 — Advance Ship Notice</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 4 }}>
              Source Record ID <span style={{ fontWeight: 400 }}>(Invoice ID, PO ID, or Shipment ID from your database)</span>
            </div>
            <input value={outSourceId} onChange={e => setOutSourceId(e.target.value)}
              placeholder="e.g. clx8y2z3k0000q1mk..."
              style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, background: C.bg, color: C.text, boxSizing: "border-box" }} />
          </div>

          <button onClick={generateOutbound} disabled={outLoading}
            style={{ padding: "9px 20px", background: outLoading ? C.blueBg : C.blue, color: outLoading ? C.blue : "#fff", border: `1px solid ${C.blueBorder}`, borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: outLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Send size={13} /> {outLoading ? "Generating…" : "Generate EDI"}
          </button>

          {outResult && !outResult.error && (
            <div style={{ marginTop: 14 }}>
              <div style={{ padding: "10px 14px", background: C.greenBg, border: `1px solid ${C.greenBorder}`, borderRadius: 10, fontSize: 13, color: C.green, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>✓ {outResult.standard} {outResult.txSet} generated</span>
                <button onClick={() => downloadEdi(outResult.rawPayload, `${outResult.txSet}_${Date.now()}.edi`)}
                  style={{ padding: "4px 12px", background: C.green, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <Download size={11} /> Download .edi
                </button>
              </div>
              <pre style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, fontSize: 11, fontFamily: "monospace", overflowX: "auto", maxHeight: 300, color: C.text }}>
                {outResult.rawPayload}
              </pre>
            </div>
          )}
          {outResult?.error && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 10, fontSize: 13, color: C.red }}>
              {outResult.error}
            </div>
          )}
        </Card>
      )}

      {/* ── LOG tab ───────────────────────────────────────────────────────── */}
      {tab === "log" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 13, color: C.muted }}>{transactions.length} transaction{transactions.length !== 1 ? "s" : ""}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Search size={13} style={{ position: "absolute", left: 9, color: C.muted, pointerEvents: "none" }} />
                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search transactions…" style={{ padding: "7px 10px 7px 28px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 12, outline: "none", width: 190 }} />
              </div>
              <button onClick={load} style={{ padding: "7px 14px", background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
          </div>

          {transactions.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: C.muted, fontSize: 13 }}>
              No EDI transactions yet. Use the <strong>Receive EDI</strong> or <strong>Generate EDI</strong> tabs to create transactions.
            </div>
          )}

          {transactions.filter(tx => !searchTerm || tx.txSet?.toLowerCase().includes(searchTerm.toLowerCase()) || tx.controlNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || tx.partner?.name?.toLowerCase().includes(searchTerm.toLowerCase())).map(tx => {
            const sc = statusColor(tx.status);
            const expanded = expandedTx === tx.id;
            return (
              <Card key={tx.id}>
                <div onClick={() => setExpandedTx(expanded ? null : tx.id)}
                  style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                  {expanded ? <ChevronDown size={14} color={C.muted} /> : <ChevronRight size={14} color={C.muted} />}
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: tx.direction === "inbound" ? C.blueBg : C.greenBg, border: `1px solid ${tx.direction === "inbound" ? C.blueBorder : C.greenBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: tx.direction === "inbound" ? C.blue : C.green }}>
                    {tx.direction === "inbound" ? "IN" : "OUT"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>
                      {TX_SET_LABELS[tx.txSet] ?? tx.txSet}
                      <span style={{ fontWeight: 400, color: C.muted, marginLeft: 6 }}>· {tx.partner?.name ?? tx.partnerId}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.subtle }}>
                      {new Date(tx.createdAt).toLocaleString()}
                      {tx.controlNumber && ` · #${tx.controlNumber}`}
                    </div>
                  </div>
                  <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, display: "flex", alignItems: "center", gap: 4 }}>
                    {statusIcon(tx.status)} {tx.status}
                  </span>
                </div>

                {expanded && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                    {tx.errorMsg && (
                      <div style={{ padding: "8px 12px", background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 8, fontSize: 12, color: C.red, marginBottom: 10 }}>
                        {tx.errorMsg}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 6 }}>Raw EDI Payload</div>
                    <pre style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, fontSize: 10, fontFamily: "monospace", maxHeight: 250, overflowY: "auto", color: C.text }}>
                      {tx.rawPayload}
                    </pre>
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button onClick={() => downloadEdi(tx.rawPayload, `${tx.txSet}_${tx.id.slice(0, 8)}.edi`)}
                        style={{ padding: "5px 12px", background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                        <Download size={11} /> Download .edi
                      </button>
                      {tx.status === "received" && (
                        <button onClick={async () => {
                          await fetch("/api/edi/transactions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: tx.id, status: "acked" }) });
                          load();
                        }}
                          style={{ padding: "5px 12px", background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}`, borderRadius: 7, fontSize: 12, cursor: "pointer" }}>
                          Mark Acknowledged
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
