"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Zap, Mail, Lock, AlertCircle, Loader } from "lucide-react";

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
      email:    email.trim().toLowerCase(),
      password: password,
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

  return (
    <div style={{
      minHeight:      "100vh",
      background:     "linear-gradient(135deg, #0f1117 0%, #1a1d2e 50%, #0f1117 100%)",
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      padding:        "24px",
      fontFamily:     "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Logo + Title */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64,
            background:     "linear-gradient(135deg, #5b8de8, #9c6fdd)",
            borderRadius:   18,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            margin:         "0 auto 16px",
            boxShadow:      "0 0 40px rgba(91,141,232,0.4)",
          }}>
            <Zap size={30} color="#fff" />
          </div>
          <h1 style={{
            fontSize: 28, fontWeight: 800,
            color: "#e8e6e1", margin: "0 0 8px", letterSpacing: "-0.5px",
          }}>
            IndustrialOS
          </h1>
          <p style={{ color: "#7a7d8a", fontSize: 14, margin: 0 }}>
            Sign in to your workspace
          </p>
        </div>

        {/* Login Card */}
        <div style={{
          background: "#141722", border: "1px solid #2a2d3e",
          borderRadius: 16, padding: "32px 28px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}>

          {error && (
            <div style={{
              background: "#2d0e0e", border: "1px solid #5c2020",
              borderRadius: 10, padding: "12px 14px", marginBottom: 20,
              display: "flex", alignItems: "center", gap: 10,
              color: "#fc8181", fontSize: 13,
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>

            {/* Email */}
            <div style={{ marginBottom: 18 }}>
              <label style={{
                display: "block", fontSize: 12, fontWeight: 600,
                color: "#9a9da8", marginBottom: 6,
                letterSpacing: "0.05em", textTransform: "uppercase",
              }}>Work Email</label>
              <div style={{ position: "relative" }}>
                <Mail size={15} style={{
                  position: "absolute", left: 14, top: "50%",
                  transform: "translateY(-50%)", color: "#5a5d6a",
                }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  style={{
                    width: "100%", padding: "12px 14px 12px 40px",
                    background: "#1a1d2e", border: "1px solid #2a2d3e",
                    borderRadius: 10, color: "#e8e6e1", fontSize: 14,
                    outline: "none", boxSizing: "border-box", transition: "border-color 0.15s",
                  }}
                  onFocus={e => (e.target.style.borderColor = "#5b8de8")}
                  onBlur={e  => (e.target.style.borderColor = "#2a2d3e")}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 24 }}>
              <label style={{
                display: "block", fontSize: 12, fontWeight: 600,
                color: "#9a9da8", marginBottom: 6,
                letterSpacing: "0.05em", textTransform: "uppercase",
              }}>Password</label>
              <div style={{ position: "relative" }}>
                <Lock size={15} style={{
                  position: "absolute", left: 14, top: "50%",
                  transform: "translateY(-50%)", color: "#5a5d6a",
                }} />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: "100%", padding: "12px 14px 12px 40px",
                    background: "#1a1d2e", border: "1px solid #2a2d3e",
                    borderRadius: 10, color: "#e8e6e1", fontSize: 14,
                    outline: "none", boxSizing: "border-box", transition: "border-color 0.15s",
                  }}
                  onFocus={e => (e.target.style.borderColor = "#5b8de8")}
                  onBlur={e  => (e.target.style.borderColor = "#2a2d3e")}
                />
              </div>
            </div>

            {/* Sign In button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "13px",
                background: loading
                  ? "#3a3d4e"
                  : "linear-gradient(135deg, #5b8de8, #9c6fdd)",
                border: "none", borderRadius: 10, color: "#fff",
                fontSize: 15, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 8, transition: "opacity 0.15s", opacity: loading ? 0.7 : 1,
              }}
            >
              {loading
                ? <><Loader size={16} style={{ animation: "spin 1s linear infinite" }} /> Signing in...</>
                : "Sign In →"
              }
            </button>

          </form>
        </div>

        {/* Demo credentials */}
        <div style={{
          marginTop: 20, background: "#141722",
          border: "1px solid #2a2d3e", borderRadius: 12, padding: "16px 20px",
        }}>
          <p style={{
            fontSize: 11, fontWeight: 700, color: "#5a5d6a",
            textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px",
          }}>Demo Accounts</p>
          {[
            ["admin@demo.com",    "admin123",    "Admin — full access"],
            ["operator@demo.com", "operator123", "Operator — orders + inventory"],
            ["viewer@demo.com",   "viewer123",   "Viewer — read only"],
          ].map(([em, pass, label]) => (
            <button
              key={em}
              onClick={() => { setEmail(em); setPassword(pass); }}
              style={{
                display: "flex", width: "100%", alignItems: "center",
                gap: 10, padding: "7px 0", background: "none", border: "none",
                cursor: "pointer", textAlign: "left", borderBottom: "1px solid #1e2130",
              }}
            >
              <span style={{
                fontSize: 11, background: "#1e2a45", color: "#5b8de8",
                padding: "2px 7px", borderRadius: 4, fontFamily: "monospace", flexShrink: 0,
              }}>{em}</span>
              <span style={{ fontSize: 11, color: "#5a5d6a" }}>{label}</span>
            </button>
          ))}
          <p style={{ fontSize: 11, color: "#3a3d4e", margin: "10px 0 0", fontStyle: "italic" }}>
            Click any row to fill the form automatically
          </p>
        </div>

      </div>
    </div>
  );
}
