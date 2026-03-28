"use client";
// app/portal/signup/page.tsx
// Phase 9 — Customer Self-Signup Widget
// Public page. Customers fill this in and land as "pending" in the admin's Customers tab.
// Admin approves them → welcome email with portal access code is sent automatically.
//
// FIX: useSearchParams() must be inside a component wrapped with Suspense.
// The outer default export is the Suspense shell — the inner component does the real work.

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

// ── Colour palette (matches portal page) ────────────────────────────────────
const P = {
  bg: "#f7f8fc", surface: "#ffffff", border: "#e4e8f0", border2: "#cdd3e0",
  text: "#1a1d2e", muted: "#6b7280", subtle: "#9ca3af",
  blue: "#3b6fd4", blueBg: "#eff4ff", blueBorder: "#bfcfef",
  green: "#1a7f5a", greenBg: "#edfaf3", greenBorder: "#9ee0c4",
  amber: "#b45309", amberBg: "#fffbeb", amberBorder: "#fcd34d",
  red: "#b91c1c", redBg: "#fff1f2", redBorder: "#fecdd3",
  purple: "#6d28d9", purpleBg: "#f5f3ff", purpleBorder: "#c4b5fd",
};

const INDUSTRIES = [
  "Manufacturing", "Distribution", "Technology", "Construction",
  "Pharma", "Food & Beverage", "Import/Export", "Services", "Other",
];

// ── Inner component that uses useSearchParams ────────────────────────────────
function SignupForm() {
  // workspaceId can be passed as a query param so the widget knows which
  // supplier to sign up under. e.g. /portal/signup?w=abc123
  const searchParams = useSearchParams();
  const workspaceId  = searchParams.get("w") || "";

  const [companyName,  setCompanyName]  = useState("");
  const [contactName,  setContactName]  = useState("");
  const [email,        setEmail]        = useState("");
  const [phone,        setPhone]        = useState("");
  const [industry,     setIndustry]     = useState("Manufacturing");
  const [address,      setAddress]      = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [done,         setDone]         = useState(false);
  const [error,        setError]        = useState("");

  const submit = async () => {
    setError("");
    if (!companyName.trim()) { setError("Company name is required."); return; }
    if (!contactName.trim()) { setError("Contact name is required."); return; }
    if (!email.trim())       { setError("Email address is required."); return; }
    if (!address.trim())     { setError("Address is required."); return; }
    if (!workspaceId)        { setError("Invalid signup link — please contact your supplier."); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/portal/signup", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName:  companyName.trim(),
          contactName:  contactName.trim(),
          email:        email.trim().toLowerCase(),
          phone:        phone.trim(),
          industry,
          address:      address.trim(),
          workspaceId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  const inp = (
    val: string,
    set: (v: string) => void,
    placeholder: string,
    type = "text"
  ) => (
    <input
      type={type}
      value={val}
      onChange={e => set(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%", padding: "11px 13px",
        background: P.bg, border: `1px solid ${error && !val.trim() ? P.red : P.border}`,
        borderRadius: 9, color: P.text, fontSize: 14, outline: "none",
        boxSizing: "border-box" as const, fontFamily: "inherit",
      }}
    />
  );

  // ── Success screen ──────────────────────────────────────────────────────
  if (done) return (
    <div style={{ textAlign: "center", padding: "48px 24px" }}>
      <div style={{ fontSize: 52, marginBottom: 20 }}>🎉</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: P.text, marginBottom: 10 }}>
        Request submitted!
      </h2>
      <p style={{ fontSize: 14, color: P.muted, lineHeight: 1.7, maxWidth: 360, margin: "0 auto" }}>
        Your supplier will review your details and send you a portal access code by email.
        This usually takes less than one business day.
      </p>
    </div>
  );

  // ── Form ────────────────────────────────────────────────────────────────
  return (
    <>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: P.text, marginBottom: 6 }}>
        Request portal access
      </h2>
      <p style={{ fontSize: 13, color: P.muted, marginBottom: 28, lineHeight: 1.6 }}>
        Fill in your details below. Your supplier will review and send you an access code.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>

        {/* Company name — full width */}
        <div style={{ gridColumn: "1 / -1", marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: P.muted, marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
            Company Name *
          </label>
          {inp(companyName, setCompanyName, "e.g. Acme Industries Ltd")}
        </div>

        {/* Contact name */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: P.muted, marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
            Your Name *
          </label>
          {inp(contactName, setContactName, "e.g. Sarah Chen")}
        </div>

        {/* Industry */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: P.muted, marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
            Industry
          </label>
          <select
            value={industry}
            onChange={e => setIndustry(e.target.value)}
            style={{ width: "100%", padding: "11px 13px", background: P.bg, border: `1px solid ${P.border}`, borderRadius: 9, color: P.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}
          >
            {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
          </select>
        </div>

        {/* Email — full width */}
        <div style={{ gridColumn: "1 / -1", marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: P.muted, marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
            Work Email *
          </label>
          {inp(email, setEmail, "you@yourcompany.com", "email")}
        </div>

        {/* Phone */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: P.muted, marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
            Phone (optional)
          </label>
          {inp(phone, setPhone, "+1 555 000 0000", "tel")}
        </div>

        {/* Address */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: P.muted, marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
            Address *
          </label>
          {inp(address, setAddress, "Street, City, Country")}
        </div>

      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: P.redBg, border: `1px solid ${P.redBorder}`, borderRadius: 9, fontSize: 13, color: P.red, marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={submitting}
        style={{
          width: "100%", padding: "13px",
          background: submitting ? P.border : `linear-gradient(135deg, ${P.blue}, ${P.purple})`,
          border: "none", borderRadius: 10,
          color: submitting ? P.muted : "#fff",
          fontSize: 15, fontWeight: 700,
          cursor: submitting ? "not-allowed" : "pointer",
        }}
      >
        {submitting ? "Submitting…" : "Request Access →"}
      </button>

      <p style={{ fontSize: 12, color: P.subtle, textAlign: "center", marginTop: 16 }}>
        Your details are only shared with your supplier — never sold.
      </p>
    </>
  );
}

// ── Loading fallback shown while JS hydrates ─────────────────────────────────
function SignupLoading() {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", color: "#6b7280", fontSize: 14 }}>
      Loading…
    </div>
  );
}

// ── Page shell — Suspense wraps the inner component ──────────────────────────
// This is what Next.js needs. The outer component never calls useSearchParams.
export default function PortalSignupPage() {
  return (
    <div style={{
      minHeight: "100vh", background: P.bg,
      fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "24px 16px",
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 36 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: "linear-gradient(135deg,#3b6fd4,#6d28d9)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
        }}>⚡</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: P.text }}>Customer Portal</div>
          <div style={{ fontSize: 12, color: P.muted }}>Powered by IndustrialOS</div>
        </div>
      </div>

      {/* Card */}
      <div style={{
        width: "100%", maxWidth: 520,
        background: P.surface, border: `1px solid ${P.border}`,
        borderRadius: 18, padding: "32px 28px",
        boxShadow: "0 8px 40px rgba(0,0,0,0.08)",
      }}>
        {/* Suspense boundary — required for useSearchParams in App Router */}
        <Suspense fallback={<SignupLoading />}>
          <SignupForm />
        </Suspense>
      </div>
    </div>
  );
}
