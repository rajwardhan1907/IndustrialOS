"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const INDUSTRIES = [
  "Manufacturing", "Distribution", "Technology", "Construction",
  "Pharma", "Food & Beverage", "Import/Export", "Services", "Other",
];

export default function RegisterPage() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState("");
  const [industry,    setIndustry]    = useState("Manufacturing");
  const [name,        setName]        = useState("");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // ── Client-side validation ──────────────────────────────────────────
    if (!companyName.trim()) { setError("Company name is required."); return; }
    if (!name.trim())        { setError("Your name is required."); return; }
    if (!email.trim())       { setError("Email address is required."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setLoading(true);

    try {
      // ── Step 1: Create workspace + user in DB ─────────────────────────
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, industry, name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed. Please try again.");
        setLoading(false);
        return;
      }

      // ── Step 2: Store workspaceId in localStorage ─────────────────────
      // This is the same key all components read from — keeps things working
      // until Step 4 moves this to the session properly
      localStorage.setItem("workspaceDbId", data.workspaceId);

      // ── Step 3: Sign them in automatically ───────────────────────────
      const signInResult = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        // Registration worked but auto-login failed — send to login page
        router.push("/login?registered=1");
        return;
      }

      // ── Step 4: Go to onboarding (or main app) ────────────────────────
      router.push("/onboarding");
      router.refresh();

    } catch (err) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  // ── Shared styles ───────────────────────────────────────────────────────
  const inputStyle = {
    width: "100%", boxSizing: "border-box" as const,
    background: "#1e2235", border: "1px solid #2e3350",
    borderRadius: 10, padding: "12px 14px",
    color: "#e8e6e1", fontSize: 14, outline: "none",
  };

  const labelStyle = {
    display: "block", fontSize: 13, fontWeight: 600,
    color: "#9da3b4", marginBottom: 6,
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f1117 0%, #1a1d2e 50%, #0f1117 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px", fontFamily: "Inter, system-ui, sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 460 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64,
            background: "linear-gradient(135deg, #5b8de8, #9c6fdd)",
            borderRadius: 18, display: "flex", alignItems: "center",
            justifyContent: "center", margin: "0 auto 16px",
            boxShadow: "0 0 40px rgba(91,141,232,0.4)", fontSize: 32,
          }}>⚡</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#e8e6e1", margin: "0 0 8px" }}>
            IndustrialOS
          </h1>
          <p style={{ color: "#7a7d8a", fontSize: 14, margin: 0 }}>
            Create your workspace — it only takes a minute
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "#141722", border: "1px solid #2a2d3e",
          borderRadius: 16, padding: "32px 28px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}>

          {/* Error */}
          {error && (
            <div style={{
              background: "#2d0e0e", border: "1px solid #7f1d1d",
              borderRadius: 10, padding: "12px 16px", marginBottom: 20,
              color: "#fca5a5", fontSize: 13,
            }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleRegister}>

            {/* Section: Company */}
            <div style={{ marginBottom: 6 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#4a4f65", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
                Company Info
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
              <div style={{ gridColumn: "1 / -1", marginBottom: 16 }}>
                <label style={labelStyle}>Company Name *</label>
                <input
                  type="text" value={companyName} required
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Industries Ltd"
                  style={inputStyle}
                />
              </div>

              <div style={{ gridColumn: "1 / -1", marginBottom: 20 }}>
                <label style={labelStyle}>Industry</label>
                <select
                  value={industry}
                  onChange={e => setIndustry(e.target.value)}
                  style={{ ...inputStyle, cursor: "pointer" }}
                >
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
            </div>

            {/* Divider */}
            <div style={{ borderTop: "1px solid #2a2d3e", marginBottom: 20 }} />

            {/* Section: Your account */}
            <p style={{ fontSize: 11, fontWeight: 700, color: "#4a4f65", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
              Your Account
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Full Name *</label>
              <input
                type="text" value={name} required
                onChange={e => setName(e.target.value)}
                placeholder="e.g. James Hartley"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Work Email *</label>
              <input
                type="email" value={email} required
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                style={inputStyle}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px", marginBottom: 28 }}>
              <div>
                <label style={labelStyle}>Password *</label>
                <input
                  type="password" value={password} required
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Confirm Password *</label>
                <input
                  type="password" value={confirm} required
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Same password again"
                  style={inputStyle}
                />
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              style={{
                width: "100%", padding: "13px",
                background: loading ? "#2a2d3e" : "linear-gradient(135deg, #5b8de8, #9c6fdd)",
                border: "none", borderRadius: 10,
                color: loading ? "#7a7d8a" : "#fff",
                fontSize: 15, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "opacity 0.15s",
              }}
            >
              {loading ? "Creating workspace…" : "Create Workspace →"}
            </button>

          </form>

          {/* Already have account */}
          <div style={{ marginTop: 24, textAlign: "center" }}>
            <span style={{ fontSize: 13, color: "#4a4f65" }}>Already have an account? </span>
            <Link href="/login" style={{ fontSize: 13, color: "#5b8de8", fontWeight: 600, textDecoration: "none" }}>
              Sign in
            </Link>
          </div>

        </div>

        {/* Fine print */}
        <p style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "#4a4f65" }}>
          You'll be set as the <strong style={{ color: "#9c6fdd" }}>admin</strong> of your workspace.
          You can invite teammates after setup.
        </p>

      </div>
    </div>
  );
}
