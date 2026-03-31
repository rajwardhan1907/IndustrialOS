"use client";
// Phase 19 (roadmap): Barcode Scanner
// Uses the native BarcodeDetector API (Chrome 88+ / Edge 88+).
// Falls back gracefully on unsupported browsers.
// Caller receives scanned barcodes via onDetected callback.

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Camera, CameraOff, X, ScanLine, AlertTriangle } from "lucide-react";
import { C } from "@/lib/utils";

interface BarcodeScannerProps {
  onDetected: (value: string, format: string) => void;
  onClose:    () => void;
}

declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats: string[] }) => {
      detect(image: ImageBitmapSource): Promise<{ rawValue: string; format: string }[]>;
    };
  }
}

export default function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const rafRef      = useRef<number>(0);
  const detectorRef = useRef<InstanceType<NonNullable<typeof window.BarcodeDetector>> | null>(null);

  const [supported,   setSupported]   = useState<boolean | null>(null); // null = checking
  const [cameraError, setCameraError] = useState<string>("");
  const [scanning,    setScanning]    = useState(false);
  const [lastValue,   setLastValue]   = useState<string>("");
  const [flash,       setFlash]       = useState(false);

  // ── Check support ─────────────────────────────────────────────────────────
  useEffect(() => {
    setSupported(typeof window !== "undefined" && "BarcodeDetector" in window);
  }, []);

  // ── Start camera ──────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      detectorRef.current = new window.BarcodeDetector!({
        formats: ["qr_code", "ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "itf", "data_matrix"],
      });
      setScanning(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Camera access denied";
      setCameraError(msg);
      setScanning(false);
    }
  }, []);

  // ── Stop camera ───────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  // ── Scan loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!scanning || !detectorRef.current) return;

    const tick = async () => {
      if (!videoRef.current || !canvasRef.current || !detectorRef.current) return;
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (video.readyState !== video.HAVE_ENOUGH_DATA) { rafRef.current = requestAnimationFrame(tick); return; }

      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);

      try {
        const barcodes = await detectorRef.current.detect(canvas);
        if (barcodes.length > 0) {
          const { rawValue, format } = barcodes[0];
          if (rawValue && rawValue !== lastValue) {
            setLastValue(rawValue);
            setFlash(true);
            setTimeout(() => setFlash(false), 600);
            onDetected(rawValue, format);
          }
        }
      } catch {}

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [scanning, lastValue, onDetected]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => { stopCamera(); };
  }, [stopCamera]);

  // ── Not supported ─────────────────────────────────────────────────────────
  if (supported === false) {
    return (
      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9000,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
          padding: 32, maxWidth: 380, width: "90%", textAlign: "center",
        }}>
          <AlertTriangle size={40} color={C.amber} style={{ marginBottom: 16 }} />
          <div style={{ fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 8 }}>
            Barcode Scanner Not Supported
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 24, lineHeight: 1.6 }}>
            The BarcodeDetector API is only available in Chrome 88+ or Edge 88+.
            Please open IndustrialOS in a supported browser to use the barcode scanner.
          </div>
          <button onClick={onClose} style={{
            padding: "10px 24px", background: C.blue, color: "#fff",
            border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14,
          }}>Close</button>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (supported === null) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9000,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    }}>
      {/* Header */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px", background: "rgba(0,0,0,0.6)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ScanLine size={18} color="#fff" />
          <span style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>Barcode Scanner</span>
        </div>
        <button onClick={() => { stopCamera(); onClose(); }} style={{
          background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "#fff", display: "flex",
        }}>
          <X size={16} />
        </button>
      </div>

      {/* Video feed */}
      <div style={{
        position: "relative", width: "min(480px, 95vw)", aspectRatio: "4/3",
        border: `3px solid ${flash ? "#22c55e" : "rgba(255,255,255,0.3)"}`,
        borderRadius: 12, overflow: "hidden",
        transition: "border-color 0.15s",
        boxShadow: flash ? "0 0 24px rgba(34,197,94,0.5)" : undefined,
      }}>
        <video ref={videoRef} muted playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover", background: "#000" }} />
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {/* Crosshair overlay */}
        {scanning && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            <div style={{ width: "60%", height: "40%", border: "2px solid rgba(255,255,255,0.6)", borderRadius: 8,
              boxShadow: "0 0 0 2000px rgba(0,0,0,0.25)" }} />
          </div>
        )}

        {/* Camera error */}
        {cameraError && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.8)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: 24, gap: 12,
          }}>
            <CameraOff size={32} color={C.red} />
            <div style={{ color: "#fff", fontSize: 13, textAlign: "center" }}>{cameraError}</div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
        {!scanning ? (
          <button onClick={startCamera} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "12px 28px", background: C.blue, color: "#fff",
            border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer",
          }}>
            <Camera size={16} /> Start Camera
          </button>
        ) : (
          <button onClick={stopCamera} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "12px 28px", background: "rgba(255,255,255,0.15)", color: "#fff",
            border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer",
          }}>
            <CameraOff size={16} /> Stop
          </button>
        )}
      </div>

      {/* Last scanned */}
      {lastValue && (
        <div style={{
          marginTop: 16, padding: "10px 20px",
          background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)",
          borderRadius: 8, color: "#22c55e", fontSize: 13, fontWeight: 700,
        }}>
          ✓ Scanned: {lastValue}
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
        Point camera at a barcode. Supported: QR, EAN-13, EAN-8, Code-128, UPC, ITF, Data Matrix
      </div>
    </div>
  );
}
