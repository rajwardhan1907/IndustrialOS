"use client";
// components/Shipping.tsx
// Phase 4: Loads from DB on mount, writes to DB in background.
// localStorage used as fast cache — falls back silently if DB unavailable.

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
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
  fetchShipmentsFromDb, createShipmentInDb, updateShipmentInDb,
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
  <div style={{ fontWeight:700, fontSize:13, color:C.muted, textTransform:"uppercase" as const, letterSpacing:"0.06em", marginBottom:14 }}>
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
  const [destination,   setDestination]   = useState("");
  const [weight,        setWeight]        = useState("");
  const [dimensions,    setDimensions]    = useState("");
  const [estimatedDate, setEstimatedDate] = useState("");
  const [notes,         setNotes]         = useState("");
  const [error,         setError]         = useState("");

  const submit = () => {
    if (!orderId)            { setError("Select an order."); return; }
    if (!origin.trim())      { setError("Origin is required."); return; }
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
      weight:         weight.trim()     || "—",
      dimensions:     dimensions.trim() || "—",
      estimatedDate:  estimatedDate || new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0],
      deliveredDate:  "",
      events: [{ timestamp: now, location: origin.trim(), message: "Label created — awaiting pickup" }],
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
          <div style={{ marginBottom:14, gridColumn:"1/-1" }}>
            <label style={labelStyle}>Linked Order *</label>
            <select value={orderId} onChange={e=>setOrderId(e.target.value)} style={inputStyle}>
              {orders.length === 0
                ? <option value="">No orders found</option>
                : orders.map(o => <option key={o.id} value={o.id}>{o.id} — {o.customer}</option>)
              }
            </select>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Carrier</label>
            <select value={carrier} onChange={e=>setCarrier(e.target.value as Carrier)} style={inputStyle}>
              {(["FedEx","UPS","DHL","USPS","Other"] as Carrier[]).map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Tracking Number</label>
            <input value={trackingNum} onChange={e=>setTrackingNum(e.target.value)} placeholder="Auto-generated if blank" style={inputStyle}/>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Origin *</label>
            <input value={origin} onChange={e=>setOrigin(e.target.value)} placeholder="e.g. Chicago, IL" style={inputStyle}/>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Destination *</label>
            <input value={destination} onChange={e=>setDestination(e.target.value)} placeholder="e.g. New York, NY" style={inputStyle}/>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Weight</label>
            <input value={weight} onChange={e=>setWeight(e.target.value)} placeholder="e.g. 12.5 kg" style={inputStyle}/>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Dimensions</label>
            <input value={dimensions} onChange={e=>setDimensions(e.target.value)} placeholder="e.g. 40x30x20 cm" style={inputStyle}/>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Estimated Delivery</label>
            <input type="date" value={estimatedDate} onChange={e=>setEstimatedDate(e.target.value)} style={inputStyle}/>
          </div>
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
          <button onClick={submit} style={{ flex:1, padding:"12px", borderRadius:10, background:C.blue, border:"none", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>
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
  const { data: session } = useSession();
  const isViewer = session?.user?.role === "viewer";
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selected,  setSelected]  = useState<Shipment | null>(null);
  const [showNew,   setShowNew]   = useState(false);
  const [filter,    setFilter]    = useState<ShipmentStatus | "all">("all");

  // Load from localStorage immediately, then refresh from DB
  useEffect(() => {
    setShipments(loadShipments());
    fetchShipmentsFromDb().then(data => {
      if (data.length > 0) setShipments(data);
    });
  }, []);

  // ── Add shipment ──────────────────────────────────────────────────────────
  const handleNew = (s: Shipment) => {
    const updated = [s, ...shipments];
    setShipments(updated);
    saveShipments(updated);
    createShipmentInDb(s); // DB write in background
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
        location:  s.destination,
        message:   next === "picked_up"       ? "Package picked up by carrier"
                 : next === "in_transit"       ? "In transit to destination"
                 : next === "out_for_delivery" ? "Out for delivery"
                 : next === "delivered"        ? `Delivered to ${s.destination}`
                 : STATUS_LABEL[next],
      };
      const newFields = {
        status:        next,
        deliveredDate: next === "delivered" ? now.split("T")[0] : s.deliveredDate,
        events:        [...s.events, newEvent],
      };
      updateShipmentInDb(id, newFields); // DB update in background
      return { ...s, ...newFields };
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
      const newFields = {
        status: "exception" as ShipmentStatus,
        events: [...s.events, { timestamp:now, location:s.destination, message:"Delivery exception — action required" }],
      };
      updateShipmentInDb(id, newFields); // DB update in background
      return { ...s, ...newFields };
    });
    setShipments(updated);
    saveShipments(updated);
    if (selected?.id === id) setSelected(updated.find(s => s.id === id)!);
  };

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = filter === "all" ? shipments : shipments.filter(s => s.status === filter);

  // ── Carrier summary ───────────────────────────────────────────────────────
  const carrierMap = shipments.reduce((acc, s) => {
    acc[s.carrier] = (acc[s.carrier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusCounts = STATUS_STEPS.reduce((acc, st) => {
    acc[st] = shipments.filter(s => s.status === st).length;
    return acc;
  }, {} as Record<string, number>);
  const exceptionCount = shipments.filter(s => s.status === "exception").length;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>

      {showNew && <NewShipmentModal onSave={handleNew} onClose={()=>setShowNew(false)}/>}

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:C.text, marginBottom:4 }}>Shipping & Logistics</h1>
          <p style={{ color:C.muted, fontSize:13 }}>Track shipments, manage carriers and delivery events.</p>
        </div>
        {!isViewer && (
        <button onClick={()=>setShowNew(true)} style={{ display:"flex", alignItems:"center", gap:7, padding:"10px 20px", borderRadius:10, background:C.blue, border:"none", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
          <Plus size={14}/> New Shipment
        </button>
        )}
      </div>

      {/* ── Summary cards ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
        {[
          { label:"Total Shipments", value:shipments.length,                                            color:C.blue,   bg:C.blueBg,   border:C.blueBorder   },
          { label:"In Transit",      value:(statusCounts["in_transit"]||0)+(statusCounts["picked_up"]||0), color:C.purple, bg:C.purpleBg, border:C.purpleBorder },
          { label:"Out for Delivery",value:statusCounts["out_for_delivery"]||0,                         color:C.amber,  bg:C.amberBg,  border:C.amberBorder  },
          { label:"Exceptions",      value:exceptionCount,                                              color:C.red,    bg:C.redBg,    border:C.redBorder    },
        ].map((s,i)=>(
          <div key={i} style={{ background:s.bg, border:`1px solid ${s.border}`, borderRadius:12, padding:"14px 18px" }}>
            <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Carrier breakdown ── */}
      <Card>
        <SectionTitle>Carriers</SectionTitle>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap" as const }}>
          {(Object.entries(carrierMap) as [Carrier, number][]).map(([carrier, count]) => (
            <div key={carrier} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 14px", borderRadius:10, background:CARRIER_BG[carrier], border:`1px solid ${CARRIER_COLOR[carrier]}33` }}>
              <Truck size={13} color={CARRIER_COLOR[carrier]}/>
              <span style={{ fontWeight:800, fontSize:13, color:CARRIER_COLOR[carrier] }}>{carrier}</span>
              <span style={{ fontSize:12, color:C.muted }}>{count} shipment{count!==1?"s":""}</span>
            </div>
          ))}
          {Object.keys(carrierMap).length === 0 && (
            <span style={{ color:C.muted, fontSize:13 }}>No shipments yet.</span>
          )}
        </div>
      </Card>

      {/* ── Filter tabs ── */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" as const }}>
        {([["all","All"],["pending","Pending"],["in_transit","In Transit"],["out_for_delivery","Out for Delivery"],["delivered","Delivered"],["exception","Exception"]] as const).map(([val, label])=>(
          <button key={val} onClick={()=>setFilter(val)} style={{
            padding:"7px 14px", borderRadius:9, fontSize:12, fontWeight:600, cursor:"pointer",
            background: filter===val ? C.blue : C.surface,
            color:      filter===val ? "#fff" : C.muted,
            border:     filter===val ? "none" : `1px solid ${C.border}`,
          }}>{label}</button>
        ))}
      </div>

      {/* ── Shipments table ── */}
      {filtered.length === 0 ? (
        <Card style={{ textAlign:"center", padding:"60px 24px" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🚚</div>
          <h3 style={{ fontSize:18, fontWeight:800, color:C.text, marginBottom:8 }}>No shipments found</h3>
          <p style={{ color:C.muted, fontSize:14, marginBottom:24 }}>
            {filter === "all" ? "Create your first shipment to get started." : `No shipments with status "${filter}".`}
          </p>
          {filter === "all" && (
            <button onClick={()=>setShowNew(true)} style={{ padding:"11px 24px", borderRadius:10, background:C.blue, border:"none", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              Create First Shipment
            </button>
          )}
        </Card>
      ) : (
        <Card style={{ padding:0, overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:C.bg, borderBottom:`1px solid ${C.border}` }}>
                {["Shipment","Customer","Carrier","Tracking","Route","ETA / Delivered","Status"].map((h,i)=>(
                  <th key={i} style={{ padding:"10px 16px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase" as const, letterSpacing:"0.05em", whiteSpace:"nowrap" as const }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s,i)=>(
                <tr key={s.id} onClick={()=>setSelected(s)} style={{ borderBottom:i<filtered.length-1?`1px solid ${C.border}`:"none", cursor:"pointer" }}>
                  <td style={{ padding:"13px 16px", fontWeight:700, color:C.blue, fontFamily:"monospace" }}>{s.shipmentNumber}</td>
                  <td style={{ padding:"13px 16px", fontWeight:600, color:C.text }}>{s.customer}</td>
                  <td style={{ padding:"13px 16px" }}><CarrierBadge carrier={s.carrier}/></td>
                  <td style={{ padding:"13px 16px", fontFamily:"monospace", fontSize:11, color:C.muted }}>{s.trackingNumber}</td>
                  <td style={{ padding:"13px 16px", fontSize:12, color:C.muted }}>
                    <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                      <MapPin size={10}/>{s.origin}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:2, color:C.subtle }}>
                      → {s.destination}
                    </div>
                  </td>
                  <td style={{ padding:"13px 16px", fontSize:12, color:s.status==="delivered"?C.green:C.muted }}>
                    {s.status==="delivered" ? `✓ ${fmtDate(s.deliveredDate)}` : fmtDate(s.estimatedDate)}
                  </td>
                  <td style={{ padding:"13px 16px" }}><StatusBadge status={s.status}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── Shipment Detail Panel ── */}
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

              {/* Progress bar */}
              {selected.status !== "exception" && (
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                    {STATUS_STEPS.map(st => {
                      const idx     = STATUS_STEPS.indexOf(selected.status);
                      const stIdx   = STATUS_STEPS.indexOf(st);
                      const isDone  = stIdx <= idx;
                      const isCurr  = st === selected.status;
                      return (
                        <div key={st} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, flex:1 }}>
                          <div style={{
                            width:28, height:28, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                            background: isDone ? C.green : C.bg,
                            border: `2px solid ${isDone ? C.green : C.border}`,
                            fontSize:12,
                          }}>
                            {isDone ? "✓" : ""}
                          </div>
                          <div style={{ fontSize:9, color:isCurr?C.green:C.muted, fontWeight:isCurr?700:400, textAlign:"center" as const }}>
                            {STATUS_LABEL[st].split(" ")[0]}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selected.status === "exception" && (
                <div style={{ padding:"12px 16px", background:C.redBg, border:`1px solid ${C.redBorder}`, borderRadius:10, fontSize:13, color:C.red, display:"flex", alignItems:"center", gap:8 }}>
                  <AlertTriangle size={15}/> Delivery exception — requires attention
                </div>
              )}

              {/* Shipment info */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {[
                  { label:"Customer",  val:selected.customer        },
                  { label:"Order",     val:selected.orderId         },
                  { label:"Origin",    val:selected.origin          },
                  { label:"Destination",val:selected.destination    },
                  { label:"Weight",    val:selected.weight          },
                  { label:"Dimensions",val:selected.dimensions      },
                  { label:"Est. Date", val:fmtDate(selected.estimatedDate) },
                  { label:"Delivered", val:fmtDate(selected.deliveredDate) },
                ].map((r,i)=>(
                  <div key={i} style={{ padding:"10px 12px", background:C.bg, borderRadius:9, border:`1px solid ${C.border}` }}>
                    <div style={{ fontSize:10, color:C.subtle, textTransform:"uppercase" as const, letterSpacing:"0.05em", marginBottom:2 }}>{r.label}</div>
                    <div style={{ fontSize:13, color:C.text, fontWeight:600 }}>{r.val || "—"}</div>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div style={{ display:"flex", gap:8 }}>
                {selected.status !== "delivered" && selected.status !== "exception" && !isViewer && (
                  <button onClick={()=>advanceStatus(selected.id)} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"10px 0", borderRadius:10, background:C.blue, border:"none", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                    Advance Status <ChevronRight size={14}/>
                  </button>
                )}
                {selected.status !== "delivered" && selected.status !== "exception" && !isViewer && (
                  <button onClick={()=>markException(selected.id)} style={{ padding:"10px 16px", borderRadius:10, background:C.redBg, border:`1px solid ${C.redBorder}`, color:C.red, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                    Exception
                  </button>
                )}
                {selected.status === "delivered" && (
                  <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"10px 0", borderRadius:10, background:C.greenBg, border:`1px solid ${C.greenBorder}`, color:C.green, fontSize:13, fontWeight:700 }}>
                    <CheckCircle size={14}/> Delivered
                  </div>
                )}
              </div>

              {/* Tracking timeline */}
              <div>
                <SectionTitle>Tracking Events</SectionTitle>
                <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                  {[...selected.events].reverse().map((ev, i) => (
                    <div key={i} style={{ display:"flex", gap:12, paddingBottom:14, position:"relative" as const }}>
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0 }}>
                        <div style={{ width:10, height:10, borderRadius:"50%", background:i===0?C.green:C.border, border:`2px solid ${i===0?C.green:C.border}`, marginTop:3 }}/>
                        {i < selected.events.length - 1 && (
                          <div style={{ width:2, flex:1, background:C.border, marginTop:4 }}/>
                        )}
                      </div>
                      <div style={{ flex:1, paddingBottom:4 }}>
                        <div style={{ fontSize:13, color:C.text, fontWeight:600 }}>{ev.message}</div>
                        <div style={{ fontSize:11, color:C.muted, marginTop:2, display:"flex", gap:10 }}>
                          <span style={{ display:"flex", alignItems:"center", gap:3 }}><MapPin size={9}/>{ev.location}</span>
                          <span style={{ display:"flex", alignItems:"center", gap:3 }}><Clock size={9}/>{fmtTime(ev.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selected.notes && (
                <div style={{ padding:"12px 14px", background:C.bg, borderRadius:10, border:`1px solid ${C.border}`, fontSize:13, color:C.muted }}>
                  📝 {selected.notes}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
