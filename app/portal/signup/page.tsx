"use client";
// app/portal/signup/page.tsx
// Phase 9 — Customer Self-Signup Widget
// Public page — no login needed.
// URL: /portal/signup?workspace=WORKSPACE_ID
// The workspace owner shares this link with their customers.

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const P = {
  bg: "#f7f8fc", surface: "#ffffff", border: "#e4e8f0",
  text: "#1a1d2e", muted: "#6b7280", subtle: "#9ca3af",
  blue: "#3b6fd4", blueBg: "#eff4ff", blueBorder: "#bfcfef",
  green: "#1a7f5a", greenBg: "#edfaf3", greenBorder: "#9ee0c4",
  amber: "#b45309", amberBg: "#fffbeb", amberBorder: "#fcd34d",
  red: "#b91c1c", redBg: "#fff1f2", redBorder: "#fecdd3",
};

const INDUSTRIES = [
  "Manufacturing", "Distribution", "Technology", "Construction",
  "Pharma", "Food & Beverage", "Import/Export", "Services", "Other",
];

export default function PortalSignupPage() {
  const searchParams = useSearchParams();
  const workspaceId  = searchParams.get("workspace") || "";

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email,       setEmail]       = useState("");
  const [phone,       setPhone]       = useState("");
  const [industry,    setIndustry]    = useState("Manufacturing");

  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState<{
    portalCode: string;
    customerName: string;
    contactName: string;
    supplierName: string;
  } | null>(null);

  // ── No workspace ID in URL ─────────────────────────────────────────────────
  if (!workspaceId) {
    return (
      <div style={{ minHeight: "100vh", background: P.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif" }}>
        <div style={{ maxWidth: 440, width: "100%", background: P.surface, border: `1px solid ${P.border}`, borderRadius: 16, padding: "32px 28px", textAlign: "center", boxShadow: "0 8px 40px rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: P.text, marginBottom: 8 }}>Invalid Signup Link</h2>
          <p style={{ fontSize: 14, color: P.muted, lineHeight: 1.6 }}>
            This link is missing a workspace ID. Please contact your supplier and ask them for the correct signup link.
          </p>
        </div>
      </div>
    );
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (success) {
    return (
      <div style={{ minHeight: "100vh", background: P.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif" }}>
        <div style={{ maxWidth: 480, width: "100%", background: P.surface, border: `1px solid ${P.border}`, borderRadius: 18, padding: "36px 32px", boxShadow: "0 8px 40px rgba(0,0,0,0.08)" }}>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#3b6fd4,#6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>⚡</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: P.text }}>Customer Portal</div>
              <div style={{ fontSize: 12, color: P.muted }}>{success.supplierName}</div>
            </div>
          </div>

          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🎉</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: P.text, marginBottom: 8 }}>
              You're all set, {success.contactName.split(" ")[0]}!
            </h2>
            <p style={{ fontSize: 14, color: P.muted, lineHeight: 1.6 }}>
              Your portal account for <strong style={{ color: P.text }}>{success.customerName}</strong> has been created.
              Use your access code below to log in.
            </p>
          </div>

          <div style={{ background: P.blueBg, border: `1px solid ${P.blueBorder}`, borderRadius: 14, padding: "20px 24px", marginBottom: 24, textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: P.blue, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              Your Portal Access Code
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: P.blue, letterSpacing: "0.15em", fontFamily: "monospace" }}>
              {success.portalCode}
            </div>
            <div style={{ fontSize: 12, color: P.muted, marginTop: 10 }}>
              Save this code — you'll need it every time you log in along with your email address.
            </div>
          </div>

          <div style={{ background: "#f8faff", border: `1px solid ${P.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 24, fontSize: 13, color: P.muted, lineHeight: 1.6 }}>
            <strong style={{ color: P.text }}>To log in:</strong>
            <ol style={{ marginTop: 6, marginLeft: 16 }}>
              <li>Go to the <strong>Customer Portal</strong> login page</li>
              <li>Enter your email: <strong style={{ color: P.text }}>{email}</strong></li>
              <li>Enter your access code: <strong style={{ color: P.blue, fontFamily: "monospace" }}>{success.portalCode}</strong></li>
            </ol>
          </div>

          <Link
            href="/portal"
            style={{ display: "block", width: "100%", padding: "13px", textAlign: "center", background: "linear-gradient(135deg,#3b6fd4,#6d28d9)", border: "none", borderRadius: 10, color: "#fff", fontSize: 15, fontWeight: 700, textDecoration: "none", boxSizing: "border-box" }}
          >
            Go to Customer Portal →
          </Link>
        </div>
      </div>
    );
  }

  // ── Signup form ────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!companyName.trim()) { setError("Company name is required."); return; }
    if (!contactName.trim()) { setError("Your name is required."); return; }
    if (!email.trim())       { setError("Email address is required."); return; }
    setLoading(true);
    try {
      const res  = await fetch("/api/portal/signup", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, companyName, contactName, email, phone, industry }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong. Please try again."); return; }
      setSuccess(data);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "11px 13px",
    background: P.bg, border: `1px solid ${P.border}`,
    borderRadius: 9, color: P.text, fontSize: 14,
    outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 700,
    color: P.muted, marginBottom: 6,
    textTransform: "uppercase", letterSpacing: "0.05em",
  };

  return (
    <div style={{ minHeight: "100vh", background: P.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif" }}>
      <div style={{ maxWidth: 480, width: "100%" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: "linear-gradient(135deg,#3b6fd4,#6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>⚡</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: P.text }}>Customer Portal</div>
            <div style={{ fontSize: 12, color: P.muted }}>Create your account</div>
          </div>
        </div>

        <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 18, padding: "32px 28px", boxShadow: "0 8px 40px rgba(0,0,0,0.08)" }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: P.text, marginBottom: 6 }}>Get Portal Access</h1>
          <p style={{ fontSize: 13, color: P.muted, marginBottom: 26, lineHeight: 1.6 }}>
            Fill in your details below. Once submitted, you'll receive a personal access code to log into the customer portal.
          </p>

          {error && (
            <div style={{ marginBottom: 20, padding: "11px 14px", background: P.redBg, border: `1px solid ${P.redBorder}`, borderRadius: 9, fontSize: 13, color: P.red }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Company Name *</label>
              <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Acme Industries Ltd" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Industry</label>
              <select value={industry} onChange={e => setIndustry(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Your Full Name *</label>
              <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="e.g. James Hartley" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Work Email *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@yourcompany.com" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Phone (optional)</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555 000 0000" style={inputStyle} />
            </div>
            <button type="submit" disabled={loading} style={{
              width: "100%", padding: "13px",
              background: loading ? P.border : "linear-gradient(135deg,#3b6fd4,#6d28d9)",
              border: "none", borderRadius: 10,
              color: loading ? P.muted : "#fff",
              fontSize: 15, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
            }}>
              {loading ? "Creating your account…" : "Create Portal Account →"}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: "center" }}>
            <span style={{ fontSize: 13, color: P.muted }}>Already have an access code? </span>
            <Link href="/portal" style={{ fontSize: 13, color: P.blue, fontWeight: 600, textDecoration: "none" }}>
              Sign in here
            </Link>
          </div>
        </div>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: P.subtle }}>
          Your information is only shared with your supplier. Powered by IndustrialOS.
        </p>
      </div>
    </div>
  );
}
