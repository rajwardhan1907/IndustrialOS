"use client";
// app/portal/returns/page.tsx
// PUBLIC page — no login required.
// Customers visit: /portal/returns?wid={workspaceId}
// They fill in the form and their return is created with status "requested".
// The staff then sees it in the Returns & RMA tab and can approve or reject.

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const REASON_LABELS: Record<string, string> = {
  damaged:    "Item Arrived Damaged",
  wrong_item: "Wrong Item Sent",
  not_needed: "No Longer Needed",
  defective:  "Defective / Not Working",
  other:      "Other",
};

// ── Inner form component (uses useSearchParams — must be inside Suspense) ─────
function ReturnForm() {
  const params      = useSearchParams();
  const workspaceId = params.get("wid") ?? "";

  const [companyName,  setCompanyName]  = useState("");
  const [wsError,      setWsError]      = useState("");

  // Form fields
  const [name,        setName]        = useState("");
  const [email,       setEmail]       = useState("");
  const [orderId,     setOrderId]     = useState("");
  const [sku,         setSku]         = useState("");
  const [qty,         setQty]         = useState("1");
  const [reason,      setReason]      = useState("damaged");
  const [description, setDescription] = useState("");

  // UI state
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState<string | null>(null); // RMA number on success

  // Load workspace name for branding
  useEffect(() => {
    if (!workspaceId) { setWsError("No workspace ID found in URL."); return; }
    fetch(`/api/portal/returns?wid=${workspaceId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setWsError("Invalid or expired portal link."); return; }
        setCompanyName(d.name ?? "");
      })
      .catch(() => setWsError("Could not load portal. Please try again later."));
  }, [workspaceId]);

  const submit = async () => {
    setError("");
    if (!name.trim())  { setError("Please enter your name.");  return; }
    if (!email.trim() || !email.includes("@")) { setError("Please enter a valid email address."); return; }
    if (!sku.trim())   { setError("Please enter the product SKU or code."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/portal/returns", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          customer:      name.trim(),
          customerEmail: email.trim(),
          orderId:       orderId.trim(),
          sku:           sku.trim(),
          qty:           parseInt(qty) || 1,
          reason,
          description:   description.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Submission failed. Please try again."); return; }
      setSuccess(data.rmaNumber);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width: "100%", padding: "11px 14px", fontSize: 14,
    border: "1px solid #e2e8f0", borderRadius: 8, outline: "none",
    background: "#fff", color: "#1a202c", boxSizing: "border-box",
    fontFamily: "inherit", transition: "border-color 0.15s",
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 700, color: "#64748b",
    marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em",
  };
  const fieldWrap: React.CSSProperties = { marginBottom: 18 };

  // ── Success screen ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div style={{ textAlign: "center", padding: "40px 24px" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1a202c", marginBottom: 10 }}>
          Return Request Submitted
        </h2>
        <p style={{ color: "#64748b", fontSize: 15, marginBottom: 20, lineHeight: 1.6 }}>
          Your return request has been received. Please keep your RMA number for reference.
        </p>
        <div style={{
          display: "inline-block", padding: "14px 28px", borderRadius: 10,
          background: "#eff6ff", border: "1.5px solid #bfdbfe",
          fontSize: 22, fontWeight: 800, color: "#2563eb", fontFamily: "monospace",
          letterSpacing: "0.05em", marginBottom: 20,
        }}>
          {success}
        </div>
        <p style={{ color: "#94a3b8", fontSize: 13 }}>
          A representative from {companyName || "the team"} will review your request and be in touch shortly.
        </p>
        <button
          onClick={() => {
            setSuccess(null);
            setName(""); setEmail(""); setOrderId(""); setSku(""); setQty("1");
            setReason("damaged"); setDescription("");
          }}
          style={{
            marginTop: 24, padding: "10px 22px", borderRadius: 8, fontSize: 13,
            fontWeight: 700, cursor: "pointer", border: "1px solid #e2e8f0",
            background: "#fff", color: "#64748b",
          }}
        >
          Submit Another Return
        </button>
      </div>
    );
  }

  // ── Error / invalid link ──────────────────────────────────────────────────
  if (wsError) {
    return (
      <div style={{ textAlign: "center", padding: "40px 24px" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a202c", marginBottom: 8 }}>Portal Unavailable</h2>
        <p style={{ color: "#64748b", fontSize: 14 }}>{wsError}</p>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Header */}
      <div style={{ marginBottom: 28, paddingBottom: 20, borderBottom: "1px solid #e2e8f0" }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#1a202c", marginBottom: 4 }}>
          {companyName ? `${companyName} — Return Request` : "Return Request"}
        </h1>
        <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.5 }}>
          Fill in the form below to request a return or RMA. You'll receive a confirmation with your RMA number once submitted.
        </p>
      </div>

      {/* Your details */}
      <h3 style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14 }}>Your Details</h3>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <div style={fieldWrap}>
          <label style={lbl}>Full Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Jane Smith" style={inp} />
        </div>
        <div style={fieldWrap}>
          <label style={lbl}>Email Address *</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. jane@company.com" style={inp} />
        </div>
      </div>

      {/* Order / product details */}
      <h3 style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14, marginTop: 6 }}>Order / Product Details</h3>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <div style={fieldWrap}>
          <label style={lbl}>Order Number (optional)</label>
          <input value={orderId} onChange={e => setOrderId(e.target.value)} placeholder="e.g. ORD-2026-0042" style={inp} />
        </div>
        <div style={fieldWrap}>
          <label style={lbl}>Product SKU / Code *</label>
          <input value={sku} onChange={e => setSku(e.target.value)} placeholder="e.g. STL-3MM-HR" style={inp} />
        </div>
        <div style={{ ...fieldWrap, gridColumn: "1/-1" }}>
          <label style={lbl}>Quantity to Return *</label>
          <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} style={{ ...inp, width: 120 }} />
        </div>
      </div>

      {/* Return reason */}
      <h3 style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14, marginTop: 6 }}>Return Reason</h3>

      <div style={fieldWrap}>
        <label style={lbl}>Reason *</label>
        <select value={reason} onChange={e => setReason(e.target.value)} style={inp}>
          {Object.entries(REASON_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <div style={fieldWrap}>
        <label style={lbl}>Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Please describe the issue in detail — include any relevant photos or notes if needed…"
          rows={4}
          style={{ ...inp, resize: "vertical" }}
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, color: "#dc2626" }}>
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={submit}
        disabled={loading || !workspaceId}
        style={{
          width: "100%", padding: "13px", borderRadius: 10, fontSize: 15,
          fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
          background: loading ? "#e2e8f0" : "#2563eb",
          border: "none", color: loading ? "#94a3b8" : "#fff",
          transition: "background 0.15s",
        }}
      >
        {loading ? "Submitting…" : "Submit Return Request"}
      </button>

      <p style={{ marginTop: 14, fontSize: 12, color: "#94a3b8", textAlign: "center", lineHeight: 1.5 }}>
        By submitting this form you agree that {companyName || "the company"} may use your email to follow up on this return request.
      </p>
    </>
  );
}

// ── Page shell ─────────────────────────────────────────────────────────────────
export default function ReturnsPortalPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px 60px" }}>
      <div style={{ width: "100%", maxWidth: 560, background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "32px 36px", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
        <Suspense fallback={
          <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8", fontSize: 14 }}>Loading portal…</div>
        }>
          <ReturnForm />
        </Suspense>
      </div>
    </div>
  );
}
