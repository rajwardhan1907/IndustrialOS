"use client";
import { useState, useEffect, useRef } from "react";
import { Zap, Bell } from "lucide-react";
import Dashboard  from "@/components/Dashboard";
import Pipeline   from "@/components/Pipeline";
import OrderKanban  from "@/components/OrderKanban";
import InventorySync from "@/components/InventorySync";
import CRMPanel   from "@/components/CRMPanel";
import SystemHealth from "@/components/SystemHealth";
import { rnd, fmt, C, genChart, genOrders, TABS, STAGES } from "@/lib/utils";

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [met, setMet] = useState({
    opm:47, skus:1024381, sync:99.2,
    activeOrders:1847, rev:4821340,
    latency:28, queue:142, conflicts:3,
  });
  const [chart,  setChart]  = useState(genChart());
  const [orders, setOrders] = useState(genOrders());
  const [pipe,   setPipe]   = useState<any>(null);
  const [conflicts, setConflicts] = useState([
    {id:1,sku:"SKU-4821",field:"stock",before:450,     after:523,      src:"CRM→DB",      status:"resolved",time:"2m ago"},
    {id:2,sku:"SKU-9034",field:"price",before:"$142.00",after:"$138.50",src:"Supply Chain",status:"resolved",time:"8m ago"},
    {id:3,sku:"SKU-2210",field:"stock",before:12,      after:0,        src:"Oversell",    status:"alert",   time:"12m ago"},
    {id:4,sku:"SKU-7753",field:"price",before:"$890.00",after:"$979.00",src:"Bulk Rule",   status:"resolved",time:"18m ago"},
    {id:5,sku:"SKU-3318",field:"stock",before:200,     after:198,      src:"CRM→DB",      status:"resolved",time:"25m ago"},
  ]);
  const [crm, setCrm] = useState({ salesforce:"connected", hubspot:"connected", zoho:"syncing" });
  const [health, setHealth] = useState([
    {name:"PostgreSQL",     status:"ok",   lat:12,  up:99.98},
    {name:"Redis Cache",    status:"ok",   lat:3,   up:99.99},
    {name:"BullMQ Workers", status:"ok",   lat:0,   up:99.95},
    {name:"CRM Webhook",    status:"warn", lat:450, up:97.2 },
    {name:"Search Index",   status:"ok",   lat:18,  up:99.9 },
    {name:"File Storage",   status:"ok",   lat:22,  up:100  },
  ]);
  const alerts = [
    {id:1,msg:"Zoho CRM sync delay detected — fallback queue active",   sev:"warn", time:"1m ago" },
    {id:2,msg:"SKU-2210 oversell detected — last order auto-cancelled",  sev:"error",time:"12m ago"},
    {id:3,msg:"1M SKU pipeline completed in 24m 38s — 0 conflicts",      sev:"info", time:"34m ago"},
  ];
  const tick = useRef(0);

  useEffect(() => {
    const iv = setInterval(() => {
      tick.current++;
      setMet(m => ({
        ...m,
        opm:          Math.max(20,   m.opm   + rnd(-5,5)),
        sync:         Math.min(100,  Math.max(94, m.sync + (Math.random()-.5)*.3)),
        activeOrders: Math.max(1000, m.activeOrders + rnd(-10,15)),
        latency:      Math.max(10,   m.latency + rnd(-3,3)),
        queue:        Math.max(0,    m.queue + rnd(-20,25)),
        conflicts:    Math.max(0,    m.conflicts + (Math.random()>.92 ? 1 : 0)),
      }));
      setChart(d => [...d.slice(1), {
        t:`${tick.current}m`, orders:rnd(40,130),
        latency:rnd(12,55), errors:rnd(0,9), sync:rnd(82,100),
      }]);
      if (tick.current % 6 === 0)
        setHealth(h => h.map(s => ({
          ...s, lat: Math.max(2, s.lat + rnd(-5,5)),
          status: s.name==="CRM Webhook" ? (Math.random()>.3?"warn":"ok") : "ok",
        })));
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!pipe || pipe.status !== "running") return;
    const iv = setInterval(() => {
      setPipe((p: any) => {
        if (!p || p.status !== "running") return p;
        const nr   = Math.min(p.total, p.rows + rnd(9000,19000));
        const done = nr >= p.total;
        return {
          ...p, rows:nr, progress:(nr/p.total)*100, batches:Math.floor(nr/1000),
          errors:p.errors+(Math.random()>.97?1:0),
          conflicts:p.conflicts+(Math.random()>.985?1:0),
          elapsed:((Date.now()-p.t0)/1000).toFixed(0),
          status: done ? "done" : "running",
        };
      });
    }, 280);
    return () => clearInterval(iv);
  }, [pipe?.status]);

  const advanceOrder = (id: string) =>
    setOrders(os => os.map(o => {
      if (o.id !== id) return o;
      const i = STAGES.indexOf(o.stage);
      return i < 4 ? { ...o, stage: STAGES[i+1] } : o;
    }));

  const resolveConflict = (id: number) =>
    setConflicts(cs => cs.map(c => c.id===id ? {...c,status:"resolved"} : c));

  return (
    <div style={{fontFamily:"'Inter',system-ui,sans-serif",minHeight:"100vh",background:C.bg,color:C.text}}>
      {/* Header */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"10px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50,boxShadow:"0 1px 6px rgba(0,0,0,0.04)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:36,height:36,background:"linear-gradient(135deg,#5b8de8,#9c6fdd)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(91,141,232,0.3)"}}>
            <Zap size={16} color="#fff"/>
          </div>
          <div>
            <div style={{fontWeight:800,fontSize:15,color:C.text,letterSpacing:"-0.4px"}}>IndustrialOS</div>
            <div style={{fontSize:11,color:C.subtle}}>Enterprise B2B Automation Platform</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{display:"flex",alignItems:"center",gap:6,background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:999,padding:"4px 12px"}}>
            <span style={{width:7,height:7,background:C.green,borderRadius:"50%"}}/>
            <span style={{fontSize:11,color:C.green,fontWeight:700}}>LIVE</span>
          </div>
          <div style={{position:"relative",cursor:"pointer"}}>
            <Bell size={17} color={C.muted}/>
            <span style={{position:"absolute",top:-4,right:-4,width:16,height:16,background:C.red,borderRadius:"50%",fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"#fff"}}>
              {alerts.filter(a=>a.sev!=="info").length}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 24px",display:"flex",gap:2,overflowX:"auto"}}>
        {TABS.map(t => {
          const Icon = t.icon; const active = tab===t.id;
          return (
            <button key={t.id} onClick={()=>setTab(t.id)} style={{display:"flex",alignItems:"center",gap:6,padding:"12px 14px",fontSize:12,fontWeight:600,border:"none",borderBottom:active?`2px solid ${C.blue}`:"2px solid transparent",color:active?C.blue:C.muted,background:"none",cursor:"pointer",whiteSpace:"nowrap",transition:"color .15s",marginBottom:-1}}>
              <Icon size={13}/>{t.label}
            </button>
          );
        })}
      </div>

      <div style={{padding:"24px",maxWidth:1200,margin:"0 auto"}}>
        {tab==="dashboard" && <Dashboard   met={met} chart={chart} alerts={alerts}/>}
        {tab==="pipeline"  && <Pipeline    pipe={pipe} setPipe={setPipe}/>}
        {tab==="orders"    && <OrderKanban orders={orders} advanceOrder={advanceOrder}/>}
        {tab==="inventory" && <InventorySync conflicts={conflicts} resolveConflict={resolveConflict}/>}
        {tab==="crm"       && <CRMPanel    crm={crm} setCrm={setCrm}/>}
        {tab==="health"    && <SystemHealth health={health} met={met} alerts={alerts}/>}
      </div>
    </div>
  );
}
