"use client";
// components/Shipping.tsx
// Shipping & Logistics module.
// - Shipment list with carrier, status, tracking number
// - Create new shipment linked to an order
// - Tracking view — event timeline + progress bar
// - Advance shipment through stages
// - Carrier summary cards
// - All saved to localStorage via lib/shipping.ts

import { useState, useEffect } from "react";
import {
  Plus, X, ChevronLeft, ChevronRight,
  Truck, Package, MapPin, AlertTriangle,
  CheckCircle, Clock,
} from "lucide-react";
import { C } from "@/lib/utils";
import {
  Shipment, ShipmentStatus, Carrier,
  loadShipments, saveShipments,
  makeShipmentId, makeShipmentNum, makeTracking,
  STATUS_STEPS, STATUS_LABEL, STATUS_EMOJI,
  CARRIER_COLOR, CARRIER_BG,
} from "@/lib/shipping";
import { loadOrders } from "@/lib/orders";

// ── Status style map ──────────────────────────────────────────────────────────
const STATUS_STYLE: Record<ShipmentStatus, { color: string; bg: string; border: string }> = {
  pending:          { color: C.muted,   bg: "#f0f0f0",  border: C.border       },
  picked_up:        { color: C.blue,    bg: C.blueBg,   border: C.blueBorder   },
  in_transit:       { color: C.purple,  bg: C.purpleBg, border: C.purpleBorder },
  out_for_delivery: { color: C.amber,   bg: C.amberBg,  border: C.amberBorder  },
  delivered:        { color: C.green,   bg: C.greenBg,  border: C.greenBorder  },
  exception:        { color: C.red,     bg: C.redBg,    border: C.redBorder    },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d: string) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year:"numeric", month:"short", day:"numeric" });
};
const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month:"short", day:"numeric" }) + " · " +
         d.toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" });
};

// ── Sub-components ────────────────────────────────────────────────────────────
const Card = ({ children, style = {} }: any) => (
  <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"20px 22px", ...style }}>
    {children}
  </div>
);
const SectionTitle = ({ children }: any) => (
  <div style={{ fontWeight:700, fontSize:13, color:C.muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:14 }}>
    {children}
  </div>
);
const StatusBadge = ({ status }: { status: ShipmentStatus }) => {
  const s = STATUS_STYLE[status];
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:999, fontSize:11, fontWeight:700, color:s.color, background:s.bg, border:`1px solid ${s.border}` }}>
      {STATUS_EMOJI[status]} {STATUS_LABEL[status]}
    </span>
  );
};
const CarrierBadge = ({ carrier }: { carrier: Carrier }) => (
  <span style={{ display:"inline-block", padding:"3px 10px", borderRadius:999, fontSize:11, fontWeight:800, color:CARRIER_COLOR[carrier], background:CARRIER_BG[carrier], border:`1px solid ${CARRIER_COLOR[carrier]}33` }}>
    {carrier}
  </span>
);

const inputStyle: any = {
  width:"100%", padding:"10px 12px",
  background:C.bg, border:`1px solid ${C.border}`,
  borderRadius:9, color:C.text, fontSize:13,
  outline:"none", boxSizing:"border-box", fontFamily:"inherit",
};
const labelStyle: any = {
  display:"block", fontSize:11, fontWeight:700, color:C.muted,
  marginBottom:5, textTransform:"uppercase", letterSpacing:"0.05em",
};

// ── New Shipment Modal ────────────────────────────────────────────────────────
function NewShipmentModal({ onSave, onClose }: {
  onSave: (s: Shipment) => void;
  onClose: () => void;
}) {
  const orders = loadOrders();

  const [orderId,       setOrderId]       = useState(orders[0]?.id || "");
  const [carrier,       setCarrier]       = useState<Carrier>("FedEx");
  const [trackingNum,   setTrackingNum]   = useState("");
  const [origin,        setOrigin]        = useState("");
  const [destination,   setDestination]  = useState("");
  const [weight,        setWeight]        = useState("");
  const [dimensions,    setDimensions]    = useState("");
  const [estimatedDate, setEstimatedDate] = useState("");
  const [notes,         setNotes]         = useState("");
  const [error,         setError]         = useState("");

  // Auto-fill tracking number when carrier changes
  const autoTrack = () => setTrackingNum(makeTracking(carrier));

  const submit = () => {
    if (!orderId)         { setError("Select an order."); return; }
    if (!origin.trim())   { setError("Origin is required."); return; }
    if (!destination.trim()) { setError("Destination is required."); return; }

    const order    = orders.find(o => o.id === orderId);
    const tracking = trackingNum.trim() || makeTracking(carrier);
    const now      = new Date().toISOString();

    const shipment: Shipment = {
      id:             makeShipmentId(),
      shipmentNumber: makeShipmentNum(),
      orderId,
      customer:       order?.customer || "Unknown",
      carrier,
      trackingNumber: tracking,
      status:         "pending",
      origin:         origin.trim(),
      destination:    destination.trim(),
      weight:         weight.trim() || "—",
      dimensions:     dimensions.trim() || "—",
      estimatedDate:  estimatedDate || new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0],
      deliveredDate:  "",
      events: [{
        timestamp: now,
        location:  origin.trim(),
        message:   "Label created — awaiting pickup",
      }],
      notes:     notes.trim(),
      createdAt: now,
    };
    onSave(shipment);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:24 }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"28px", width:"100%", maxWidth:520, boxShadow:"0 20px 60px rgba(0,0,0,0.15)", maxHeight:"90vh", overflowY:"auto" }}>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
          <h2 style={{ fontSize:17, fontWeight:800, color:C.text }}>New Shipment</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted }}><X size={18}/></button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>

          {/* Order */}
          <div style={{ marginBottom:14, gridColumn:"1/-1" }}>
            <label style={labelStyle}>Linked Order *</label>
            <select value={orderId} onChange={e=>setOrderId(e.target.value)} style={inputStyle}>
              {orders.length === 0
                ? <option value="">No orders available</option>
                : orders.map(o=>(
                    <option key={o.id} value={o.id}>{o.id} — {o.customer} ({o.sku})</option>
                  ))
              }
            </select>
          </div>

          {/* Carrier */}
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Carrier</label>
            <select value={carrier} onChange={e=>setCarrier(e.target.value as Carrier)} style={inputStyle}>
              {(["FedEx","UPS","DHL","USPS","Other"] as Carrier[]).map(c=>(
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Tracking number */}
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Tracking Number</label>
            <div style={{ display:"flex", gap:8 }}>
              <input value={trackingNum} onChange={e=>setTrackingNum(e.target.value)} placeholder="Auto-generate or enter" style={{ ...inputStyle, flex:1 }}/>
              <button onClick={autoTrack} title="Auto-generate" style={{ padding:"0 12px", background:C.blueBg, border:`1px solid ${C.blueBorder}`, borderRadius:9, color:C.blue, fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
                Auto
              </button>
            </div>
          </div>

          {/* Origin / Destination */}
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Origin *</label>
            <input value={origin} onChange={e=>setOrigin(e.target.value)} placeholder="e.g. Chicago, IL" style={inputStyle}/>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Destination *</label>
            <input value={destination} onChange={e=>setDestination(e.target.value)} placeholder="e.g. New York, NY" style={inputStyle}/>
          </div>

          {/* Weight / Dimensions */}
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Weight</label>
            <input value={weight} onChange={e=>setWeight(e.target.value)} placeholder="e.g. 12.5 kg" style={inputStyle}/>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Dimensions</label>
            <input value={dimensions} onChange={e=>setDimensions(e.target.value)} placeholder="e.g. 40x30x20 cm" style={inputStyle}/>
          </div>

          {/* ETA */}
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Estimated Delivery</label>
            <input type="date" value={estimatedDate} onChange={e=>setEstimatedDate(e.target.value)} style={inputStyle}/>
          </div>

          {/* Notes */}
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Notes</label>
            <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. Fragile, signature required" style={inputStyle}/>
          </div>

        </div>

        {error && (
          <div style={{ marginBottom:14, padding:"9px 13px", background:C.redBg, border:`1px solid ${C.redBorder}`, borderRadius:8, fontSize:13, color:C.red }}>
            {error}
          </div>
        )}

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={submit} style={{ flex:1, padding:"12px", borderRadius:10, background:`linear-gradient(135deg,${C.blue},${C.purple})`, border:"none", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>
            Create Shipment
          </button>
          <button onClick={onClose} style={{ padding:"12px 18px", borderRadius:10, background:C.bg, border:`1px solid ${C.border}`, color:C.muted, fontSize:13, fontWeight:600, cursor:"pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Shipping() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selected,  setSelected]  = useState<Shipment | null>(null);
  const [showNew,   setShowNew]   = useState(false);
  const [filter,    setFilter]    = useState<ShipmentStatus | "all">("all");

  useEffect(() => { setShipments(loadShipments()); }, []);

  // ── Add shipment ──────────────────────────────────────────────────────────
  const handleNew = (s: Shipment) => {
    const updated = [s, ...shipments];
    setShipments(updated);
    saveShipments(updated);
    setShowNew(false);
    setSelected(s);
  };

  // ── Advance status ────────────────────────────────────────────────────────
  const advanceStatus = (id: string) => {
    const now = new Date().toISOString();
    const updated = shipments.map(s => {
      if (s.id !== id) return s;
      const idx = STATUS_STEPS.indexOf(s.status);
      if (idx < 0 || idx >= STATUS_STEPS.length - 1) return s;
      const next = STATUS_STEPS[idx + 1];
      const newEvent = {
        timestamp: now,
        location:  next === "delivered" ? s.destination : s.destination,
        message:   next === "picked_up"        ? "Package picked up by carrier"
                 : next === "in_transit"        ? "In transit to destination"
                 : next === "out_for_delivery"  ? "Out for delivery"
                 : next === "delivered"         ? `Delivered to ${s.destination}`
                 : STATUS_LABEL[next],
      };
      return {
        ...s,
        status:        next,
        deliveredDate: next === "delivered" ? now.split("T")[0] : s.deliveredDate,
        events:        [...s.events, newEvent],
      };
    });
    setShipments(updated);
    saveShipments(updated);
    if (selected?.id === id) setSelected(updated.find(s => s.id === id)!);
  };

  // ── Mark exception ────────────────────────────────────────────────────────
  const markException = (id: string) => {
    const now = new Date().toISOString();
    const updated = shipments.map(s => {
      if (s.id !== id) return s;
      return {
        ...s,
        status: "exception" as ShipmentStatus,
        events: [...s.events, { timestamp:now, location:s.destination, message:"Delivery exception — action required" }],
      };
    });
    setShipments(updated);
    saveShipments(updated);
    if (selected?.id === id) setSelected(updated.find(s => s.id === id)!);
  };

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = filter === "all"
    ? shipments
    : shipments.filter(s => s.status === filter);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const inTransit   = shipments.filter(s => ["picked_up","in_transit","out_for_delivery"].includes(s.status)).length;
  const delivered   = shipments.filter(s => s.status === "delivered").length;
  const exceptions  = shipments.filter(s => s.status === "exception").length;
  const pending     = shipments.filter(s => s.status === "pending").length;

  // ── Carrier breakdown ─────────────────────────────────────────────────────
  const carriers: Carrier[] = ["FedEx","UPS","DHL","USPS","Other"];
  const carrierCounts = carriers.map(c => ({
    carrier: c,
    count:   shipments.filter(s => s.carrier === c && s.status !== "delivered").length,
  })).filter(c => c.count > 0);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {showNew && <NewShipmentModal onSave={handleNew} onClose={()=>setShowNew(false)}/>}

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:C.text, marginBottom:4 }}>Shipping & Logistics</h1>
          <p style={{ color:C.muted, fontSize:13 }}>Track shipments, manage carriers and delivery status.</p>
        </div>
        <button onClick={()=>setShowNew(true)} style={{ display:"flex", alignItems:"center", gap:7, padding:"10px 20px", borderRadius:10, background:`linear-gradient(135deg,${C.blue},${C.purple})`, border:"none", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
          <Plus size={14}/> New Shipment
        </button>
      </div>

      {/* ── Summary cards ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
        {[
          { label:"Pending Pickup",  value:pending,    color:C.muted,  bg:"#f0f0f0",  border:C.border        },
          { label:"In Transit",      value:inTransit,  color:C.purple, bg:C.purpleBg, border:C.purpleBorder  },
          { label:"Delivered",       value:delivered,  color:C.green,  bg:C.greenBg,  border:C.greenBorder   },
          { label:"Exceptions",      value:exceptions, color:C.red,    bg:C.redBg,    border:C.redBorder     },
        ].map((s,i)=>(
          <div key={i} style={{ background:s.bg, border:`1px solid ${s.border}`, borderRadius:12, padding:"14px 18px" }}>
            <div style={{ fontSize:24, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Exception alert ── */}
      {exceptions > 0 && (
        <div style={{ padding:"12px 16px", background:C.redBg, border:`1px solid ${C.redBorder}`, borderRadius:10, fontSize:13, color:C.red, display:"flex", alignItems:"center", gap:10 }}>
          <AlertTriangle size={15}/>
          <strong>{exceptions} shipment{exceptions!==1?"s":""} with exceptions</strong> — requires immediate attention.
        </div>
      )}

      {/* ── Carrier breakdown ── */}
      {carrierCounts.length > 0 && (
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {carrierCounts.map(({carrier,count})=>(
            <div key={carrier} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 14px", background:CARRIER_BG[carrier], border:`1px solid ${CARRIER_COLOR[carrier]}33`, borderRadius:10 }}>
              <Truck size={13} color={CARRIER_COLOR[carrier]}/>
              <span style={{ fontWeight:700, fontSize:13, color:CARRIER_COLOR[carrier] }}>{carrier}</span>
              <span style={{ fontSize:12, color:C.muted }}>{count} active</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Filter tabs ── */}
      <div style={{ display:"flex", gap:2, borderBottom:`1px solid ${C.border}` }}>
        {([
          { id:"all",             label:`All (${shipments.length})`    },
          { id:"pending",         label:"Pending"                       },
          { id:"in_transit",      label:"In Transit"                    },
          { id:"out_for_delivery",label:"Out for Delivery"              },
          { id:"delivered",       label:"Delivered"                     },
          { id:"exception",       label:"Exceptions"                    },
        ] as { id: ShipmentStatus|"all"; label: string }[]).map(t=>(
          <button key={t.id} onClick={()=>setFilter(t.id)} style={{ padding:"9px 14px", fontSize:12, fontWeight:600, border:"none", borderBottom:filter===t.id?`2px solid ${C.blue}`:"2px solid transparent", color:filter===t.id?C.blue:C.muted, background:"none", cursor:"pointer", marginBottom:-1, whiteSpace:"nowrap" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Shipment list ── */}
      {filtered.length === 0 ? (
        <Card style={{ textAlign:"center", padding:"60px 24px" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>📦</div>
          <h3 style={{ fontSize:18, fontWeight:800, color:C.text, marginBottom:8 }}>No shipments found</h3>
          <p style={{ color:C.muted, fontSize:14, marginBottom:24 }}>
            {filter === "all" ? "Create your first shipment to start tracking deliveries." : `No shipments with status "${STATUS_LABEL[filter as ShipmentStatus]}".`}
          </p>
          {filter === "all" && (
            <button onClick={()=>setShowNew(true)} style={{ padding:"11px 24px", borderRadius:10, background:`linear-gradient(135deg,${C.blue},${C.purple})`, border:"none", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              Create First Shipment
            </button>
          )}
        </Card>
      ) : (
        <Card style={{ padding:0, overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:C.bg, borderBottom:`1px solid ${C.border}` }}>
                {["Shipment","Customer","Carrier","Route","Est. Delivery","Status",""].map((h,i)=>(
                  <th key={i} style={{ padding:"10px 16px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s,i)=>(
                <tr key={s.id} onClick={()=>setSelected(s)}
                  style={{ borderBottom:i<filtered.length-1?`1px solid ${C.border}`:"none", cursor:"pointer" }}
                  onMouseEnter={e=>(e.currentTarget.style.background=C.bg)}
                  onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                  <td style={{ padding:"13px 16px" }}>
                    <div style={{ fontWeight:700, color:C.blue, fontFamily:"monospace", fontSize:12 }}>{s.shipmentNumber}</div>
                    <div style={{ fontSize:11, color:C.subtle, marginTop:2 }}>Order: {s.orderId}</div>
                  </td>
                  <td style={{ padding:"13px 16px", fontWeight:600, color:C.text }}>{s.customer}</td>
                  <td style={{ padding:"13px 16px" }}><CarrierBadge carrier={s.carrier}/></td>
                  <td style={{ padding:"13px 16px" }}>
                    <div style={{ fontSize:12, color:C.text }}>{s.origin}</div>
                    <div style={{ fontSize:11, color:C.subtle }}>→ {s.destination}</div>
                  </td>
                  <td style={{ padding:"13px 16px", color:s.status==="exception"?C.red:C.muted }}>
                    {s.status==="delivered" ? `✓ ${fmtDate(s.deliveredDate)}` : fmtDate(s.estimatedDate)}
                  </td>
                  <td style={{ padding:"13px 16px" }}><StatusBadge status={s.status}/></td>
                  <td style={{ padding:"13px 16px", color:C.muted }}><ChevronRight size={16}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ══════════════════════════════════════════════
          SHIPMENT DETAIL PANEL (slide-in)
      ══════════════════════════════════════════════ */}
      {selected && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"flex-end", justifyContent:"flex-end", zIndex:100 }}>
          <div style={{ background:C.surface, borderLeft:`1px solid ${C.border}`, width:"100%", maxWidth:500, height:"100vh", overflowY:"auto", display:"flex", flexDirection:"column" }}>

            {/* Panel header */}
            <div style={{ padding:"20px 24px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, background:C.surface, zIndex:10 }}>
              <div>
                <div style={{ fontWeight:800, fontSize:16, color:C.text }}>{selected.shipmentNumber}</div>
                <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
                  <CarrierBadge carrier={selected.carrier}/> &nbsp;· {selected.trackingNumber}
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <StatusBadge status={selected.status}/>
                <button onClick={()=>setSelected(null)} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted }}><X size={18}/></button>
              </div>
            </div>

            <div style={{ padding:"24px", display:"flex", flexDirection:"column", gap:18, flex:1 }}>

              {/* ── Progress bar ── */}
              {selected.status !== "exception" && (
                <Card>
                  <SectionTitle>Tracking Progress</SectionTitle>
                  <div style={{ display:"flex", alignItems:"flex-start" }}>
                    {STATUS_STEPS.map((step,i) => {
                      const done    = STATUS_STEPS.indexOf(selected.status) >= i;
                      const current = selected.status === step;
                      return (
                        <div key={step} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center" }}>
                          <div style={{ display:"flex", alignItems:"center", width:"100%" }}>
                            {i > 0 && <div style={{ flex:1, height:3, background:done?C.blue:C.border, transition:"background 0.3s" }}/>}
                            <div style={{ width:26, height:26, borderRadius:"50%", flexShrink:0, background:done?C.blue:C.surface, border:`2px solid ${done?C.blue:C.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:done?"#fff":C.subtle, boxShadow:current?`0 0 0 4px ${C.blueBg}`:"none", transition:"all 0.3s", zIndex:1 }}>
                              {done && !current ? "✓" : i+1}
                            </div>
                            {i < STATUS_STEPS.length-1 && <div style={{ flex:1, height:3, background:STATUS_STEPS.indexOf(selected.status)>i?C.blue:C.border, transition:"background 0.3s" }}/>}
                          </div>
                          <div style={{ fontSize:9, marginTop:6, fontWeight:current?700:400, color:current?C.blue:done?C.muted:C.subtle, textAlign:"center", lineHeight:1.3 }}>
                            {STATUS_LABEL[step].replace(" ","<br/>")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* Exception banner */}
              {selected.status === "exception" && (
                <div style={{ padding:"14px 16px", background:C.redBg, border:`1px solid ${C.redBorder}`, borderRadius:12, fontSize:13, color:C.red, display:"flex", alignItems:"center", gap:10 }}>
                  <AlertTriangle size={16}/>
                  <div><strong>Delivery Exception</strong> — contact the carrier with tracking number <code>{selected.trackingNumber}</code>.</div>
                </div>
              )}

              {/* ── Shipment info ── */}
              <Card>
                <SectionTitle>Shipment Details</SectionTitle>
                {[
                  { label:"Order",       value:selected.orderId           },
                  { label:"Customer",    value:selected.customer          },
                  { label:"Tracking #",  value:selected.trackingNumber    },
                  { label:"Origin",      value:selected.origin            },
                  { label:"Destination", value:selected.destination       },
                  { label:"Weight",      value:selected.weight            },
                  { label:"Dimensions",  value:selected.dimensions        },
                  { label:"Est. Delivery",value:fmtDate(selected.estimatedDate) },
                  ...(selected.deliveredDate ? [{ label:"Delivered", value:fmtDate(selected.deliveredDate) }] : []),
                ].map(({label,value})=>(
                  <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}`, fontSize:13 }}>
                    <span style={{ color:C.muted }}>{label}</span>
                    <span style={{ fontWeight:600, color:C.text, textAlign:"right", maxWidth:220 }}>{value}</span>
                  </div>
                ))}
              </Card>

              {/* ── Actions ── */}
              {!["delivered","exception"].includes(selected.status) && (
                <div style={{ display:"flex", gap:10 }}>
                  <button onClick={()=>advanceStatus(selected.id)} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:7, padding:"11px", borderRadius:10, background:`linear-gradient(135deg,${C.blue},${C.purple})`, border:"none", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                    Advance Status <ChevronRight size={13}/>
                  </button>
                  <button onClick={()=>markException(selected.id)} style={{ padding:"11px 16px", borderRadius:10, background:C.redBg, border:`1px solid ${C.redBorder}`, color:C.red, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                    Flag Exception
                  </button>
                </div>
              )}

              {selected.status === "delivered" && (
                <div style={{ padding:"14px 16px", background:C.greenBg, border:`1px solid ${C.greenBorder}`, borderRadius:12, fontSize:14, color:C.green, display:"flex", alignItems:"center", gap:10 }}>
                  <CheckCircle size={18}/> Delivered on {fmtDate(selected.deliveredDate)}.
                </div>
              )}

              {/* ── Tracking events ── */}
              <Card>
                <SectionTitle>Tracking Events</SectionTitle>
                <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                  {[...selected.events].reverse().map((ev,i)=>(
                    <div key={i} style={{ display:"flex", gap:14, padding:"10px 0", borderBottom:i<selected.events.length-1?`1px solid ${C.border}`:"none" }}>
                      <div style={{ width:8, height:8, borderRadius:"50%", background:i===0?C.blue:C.border, marginTop:5, flexShrink:0 }}/>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{ev.message}</div>
                        <div style={{ fontSize:11, color:C.muted, marginTop:3, display:"flex", alignItems:"center", gap:6 }}>
                          <MapPin size={10}/> {ev.location} &nbsp;·&nbsp; <Clock size={10}/> {fmtTime(ev.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {selected.notes && (
                <Card>
                  <SectionTitle>Notes</SectionTitle>
                  <p style={{ fontSize:13, color:C.muted, lineHeight:1.6 }}>{selected.notes}</p>
                </Card>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
