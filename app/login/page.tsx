"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Wrong email or password. Please try again.");
    } else {
      router.push("/");
      router.refresh();
    }
  }

  const fill = (e: string, p: string) => { setEmail(e); setPassword(p); setError(""); };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f1117 0%, #1a1d2e 50%, #0f1117 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px", fontFamily: "Inter, system-ui, sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
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
          <p style={{ color: "#7a7d8a", fontSize: 14, margin: 0 }}>Sign in to your workspace</p>
        </div>

        {/* Card */}
        <div style={{
          background: "#141722", border: "1px solid #2a2d3e",
          borderRadius: 16, padding: "32px 28px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}>

          {error && (
            <div style={{
              background: "#2d0e0e", border: "1px solid #7f1d1d",
              borderRadius: 10, padding: "12px 16px", marginBottom: 20,
              color: "#fca5a5", fontSize: 13,
            }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#9da3b4", marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email" value={email} required
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "#1e2235", border: "1px solid #2e3350",
                  borderRadius: 10, padding: "12px 14px",
                  color: "#e8e6e1", fontSize: 14, outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#9da3b4", marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password" value={password} required
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "#1e2235", border: "1px solid #2e3350",
                  borderRadius: 10, padding: "12px 14px",
                  color: "#e8e6e1", fontSize: 14, outline: "none",
                }}
              />
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
              }}
            >
              {loading ? "Signing in…" : "Sign In →"}
            </button>
          </form>

          {/* Demo accounts */}
          <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid #2a2d3e" }}>
            <p style={{ fontSize: 12, color: "#4a4f65", textAlign: "center", marginBottom: 12 }}>
              DEMO ACCOUNTS — click to fill
            </p>
            {[
              { label: "Admin",    email: "admin@demo.com",    pass: "admin123",    color: "#5b8de8" },
              { label: "Operator", email: "operator@demo.com", pass: "operator123", color: "#9c6fdd" },
              { label: "Viewer",   email: "viewer@demo.com",   pass: "viewer123",   color: "#34d399" },
            ].map(d => (
              <button key={d.label} onClick={() => fill(d.email, d.pass)} style={{
                width: "100%", marginBottom: 8,
                background: "transparent", border: "1px solid #2a2d3e",
                borderRadius: 8, padding: "10px 14px", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: d.color }}>{d.label}</span>
                <span style={{ fontSize: 11, color: "#4a4f65", fontFamily: "monospace" }}>{d.email}</span>
              </button>
            ))}
          </div>

          {/* Register link */}
          <div style={{ marginTop: 20, textAlign: "center" }}>
            <span style={{ fontSize: 13, color: "#4a4f65" }}>New company? </span>
            <Link href="/register" style={{ fontSize: 13, color: "#5b8de8", fontWeight: 600, textDecoration: "none" }}>
              Create a workspace
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
