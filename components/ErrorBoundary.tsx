"use client";
import React from "react";
import { C } from "@/lib/utils";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
  message:  string;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || "Something went wrong." };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "60px 24px", textAlign: "center",
          background: C.surface, border: `1px solid ${C.redBorder}`,
          borderRadius: 14,
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 8 }}>
            {this.props.label || "Something went wrong"}
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 20, maxWidth: 360 }}>
            {this.state.message}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, message: "" })}
            style={{
              padding: "9px 22px", borderRadius: 9, background: C.blue,
              border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
