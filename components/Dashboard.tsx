"use client";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Bell, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { C, fmt } from "@/lib/utils";
import { useIsMobile } from "@/lib/useIsMobile";
import { useEffect, useState } from "react";
import { loadConflicts } from "@/lib/inventory";

export function Card({ children, style={} }: any) {
  return <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:18,boxShadow:"0 1px 4px rgba(0,0,0,0.05)",...style}}>{children}</div>;
}
export function SectionTitle({ icon: Icon, children, sub }: any) {
  return (
    <div style={{marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:7,fontSize:14,fontWeight:700,color:C.text}}>
        {Icon && <Icon size={14} color={C.blue}/>}{children}
      </div>
      {sub && <div style={{fontSize:12,color:C.subtle,marginTop:3}}>{sub}</div>}
    </div>
  );
}

export default function Dashboard({ met, chart, alerts }: any) {
  const isMobile = useIsMobile();
  const [openConflicts, setOpenConflicts] = useState(0);

  useEffect(() => {
    const count = loadConflicts().filter((c: any) => c.status === "alert").length;
    setOpenConflicts(count);
  }, []);

  const stats = [
    {l:"Orders / min",  v:met.opm,                  col:C.blue,   bg:C.blueBg,   bdr:C.blueBorder,   ico:"📦"},
    {l:"Total SKUs",    v:fmt(met.skus),             col:C.purple, bg:C.purpleBg, bdr:C.purpleBorder, ico:"🗂️"},
    {l:"Sync Health",   v:`${met.sync.toFixed(1)}%`, col:C.green,  bg:C.greenBg,  bdr:C.greenBorder,  ico:"✅"},
    {l:"Active Orders", v:fmt(met.activeOrders),     col:C.amber,  bg:C.amberBg,  bdr:C.amberBorder,  ico:"🛒"},
    {l:"Revenue MTD",   v:`$${fmt(met.rev)}`,        col:C.green,  bg:C.greenBg,  bdr:C.greenBorder,  ico:"💰"},
    {l:"Queue Depth",   v:met.queue,                 col:C.blue,   bg:C.blueBg,   bdr:C.blueBorder,   ico:"🔄"},
    {l:"Inv. Conflicts",v:openConflicts,             col:C.red,    bg:C.redBg,    bdr:C.redBorder,    ico:"⚠️"},
  ];

  const tt = { contentStyle:{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,fontSize:11,color:C.text} };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>

      {/* Stats grid — 4 cols desktop, 2 cols mobile */}
      <div className="stats-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:12}}>
        {stats.map((s,i) => (
          <div key={i} style={{background:s.bg,border:`1px solid ${s.bdr}`,borderRadius:12,padding:"14px 16px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontSize:11,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>{s.l}</span>
              <span style={{fontSize:16}}>{s.ico}</span>
            </div>
            <div style={{fontSize:isMobile?20:26,fontWeight:800,color:s.col}}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Charts — stack on mobile */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16}}>
        <Card>
          <SectionTitle>Orders / min (live)</SectionTitle>
          <ResponsiveContainer width="100%" height={isMobile?120:145}>
            <AreaChart data={chart}>
              <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.blue} stopOpacity={0.15}/><stop offset="95%" stopColor={C.blue} stopOpacity={0}/></linearGradient></defs>
              <XAxis dataKey="t" tick={{fontSize:9,fill:C.subtle}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:9,fill:C.subtle}} axisLine={false} tickLine={false}/>
              <Tooltip {...tt}/>
              <Area type="monotone" dataKey="orders" stroke={C.blue} fill="url(#ga)" strokeWidth={2} dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SectionTitle>Revenue / 5-min bucket (live)</SectionTitle>
          <ResponsiveContainer width="100%" height={isMobile?120:145}>
            <BarChart data={chart}>
              <XAxis dataKey="t" tick={{fontSize:9,fill:C.subtle}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:9,fill:C.subtle}} axisLine={false} tickLine={false}/>
              <Tooltip {...tt}/>
              <Bar dataKey="revenue" fill={C.green} radius={[3,3,0,0]} fillOpacity={0.75}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Alerts */}
      <Card>
        <SectionTitle icon={Bell}>System Alerts</SectionTitle>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {alerts && alerts.length > 0 ? alerts.map((a: any) => {
            const col = a.sev==="error"?{bg:C.redBg,b:C.redBorder}:a.sev==="warn"?{bg:C.amberBg,b:C.amberBorder}:{bg:C.blueBg,b:C.blueBorder};
            return (
              <div key={a.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 14px",borderRadius:10,background:col.bg,border:`1px solid ${col.b}`}}>
                {a.sev==="error"?<XCircle size={14} color={C.red} style={{marginTop:1,flexShrink:0}}/>:a.sev==="warn"?<AlertTriangle size={14} color={C.amber} style={{marginTop:1,flexShrink:0}}/>:<CheckCircle size={14} color={C.blue} style={{marginTop:1,flexShrink:0}}/>}
                <span style={{fontSize:13,color:C.text,flex:1}}>{a.msg}</span>
                <span style={{fontSize:11,color:C.subtle,flexShrink:0}}>{a.time}</span>
              </div>
            );
          }) : (
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,background:C.greenBg,border:`1px solid ${C.greenBorder}`}}>
              <CheckCircle size={14} color={C.green} style={{flexShrink:0}}/>
              <span style={{fontSize:13,color:C.green}}>All systems running normally.</span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
