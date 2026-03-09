"use client";
import { CheckCircle, XCircle, AlertTriangle, Server, RefreshCw } from "lucide-react";
import { C } from "@/lib/utils";
import { Card, SectionTitle } from "./Dashboard";

export default function SystemHealth({ health, met }: any) {
  const si: any  = {ok:<CheckCircle size={13} color={C.green}/>,warn:<AlertTriangle size={13} color={C.amber}/>,error:<XCircle size={13} color={C.red}/>};
  const sb: any  = {ok:C.greenBg, warn:C.amberBg, error:C.redBg};
  const sbdr: any= {ok:C.greenBorder, warn:C.amberBorder, error:C.redBorder};
  const logs = [
    {ts:"14:22:01.334",lvl:"INFO", svc:"sync-engine", msg:"Inventory sync completed — 0 deltas"},
    {ts:"14:21:58.012",lvl:"WARN", svc:"crm-adapter",  msg:"Zoho webhook timeout — retry 1/3"},
    {ts:"14:21:45.880",lvl:"ERROR",svc:"order-mgr",    msg:"SKU-2210 oversell — order auto-cancelled"},
    {ts:"14:21:30.001",lvl:"INFO", svc:"pipeline",     msg:"Batch #1024 complete — 1000 rows ingested"},
    {ts:"14:21:00.000",lvl:"INFO", svc:"health-check", msg:"All services nominal"},
  ];
  const lc: any  = {INFO:{bg:C.blueBg,c:C.blue},WARN:{bg:C.amberBg,c:C.amber},ERROR:{bg:C.redBg,c:C.red}};
  const healing  = [
    {msg:"CRM sync failed 3× → switched to local retry queue",    sev:"warn", time:"1m ago",  act:"Auto-recovered"},
    {msg:"SKU-2210 inventory negative → last order auto-cancelled",sev:"error",time:"12m ago", act:"Auto-cancelled"},
    {msg:"Redis eviction spike → cache TTL extended",              sev:"warn", time:"28m ago", act:"Auto-tuned"},
    {msg:"All systems nominal — full health check passed",         sev:"ok",   time:"30s ago", act:""},
  ];
  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        {[["API Latency",`${met.latency}ms`,C.blue,C.blueBg,C.blueBorder],["Queue Depth",met.queue,C.purple,C.purpleBg,C.purpleBorder],["Error Rate","0.08%",C.green,C.greenBg,C.greenBorder],["Uptime","99.97%",C.green,C.greenBg,C.greenBorder]].map(([l,v,col,bg,bdr]:any,i)=>(
          <div key={i} style={{background:bg,border:`1px solid ${bdr}`,borderRadius:12,padding:"14px 16px"}}>
            <div style={{fontSize:11,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>{l}</div>
            <div style={{fontSize:26,fontWeight:800,color:col,marginTop:6}}>{v}</div>
          </div>
        ))}
      </div>
      <Card>
        <SectionTitle icon={Server}>Service Health Checks</SectionTitle>
        {health.map((h:any,i:number)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:10,marginBottom:8,background:sb[h.status],border:`1px solid ${sbdr[h.status]}`}}>
            {si[h.status]}
            <span style={{fontSize:13,color:C.text,width:140,fontWeight:500}}>{h.name}</span>
            <div style={{flex:1,height:7,background:"rgba(0,0,0,0.07)",borderRadius:999,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${h.up}%`,background:h.status==="ok"?C.green:h.status==="warn"?C.amber:C.red,borderRadius:999,opacity:0.8}}/>
            </div>
            <span style={{fontSize:12,color:C.muted,width:48,textAlign:"right",fontWeight:600}}>{h.up}%</span>
            {h.lat>0&&<span style={{fontSize:11,color:C.subtle,width:44,textAlign:"right"}}>{h.lat}ms</span>}
          </div>
        ))}
      </Card>
      <Card>
        <SectionTitle icon={RefreshCw}>Self-Healing Events</SectionTitle>
        {healing.map((e,i)=>(
          <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 0",borderBottom:`1px solid ${C.border}`,fontSize:13}}>
            {e.sev==="error"?<XCircle size={13} color={C.red} style={{marginTop:1,flexShrink:0}}/>:e.sev==="warn"?<AlertTriangle size={13} color={C.amber} style={{marginTop:1,flexShrink:0}}/>:<CheckCircle size={13} color={C.green} style={{marginTop:1,flexShrink:0}}/>}
            <span style={{color:C.muted,flex:1}}>{e.msg}</span>
            {e.act&&<span style={{fontSize:11,background:C.blueBg,color:C.blue,border:`1px solid ${C.blueBorder}`,borderRadius:6,padding:"2px 9px",flexShrink:0,fontWeight:600}}>{e.act}</span>}
            <span style={{fontSize:11,color:C.subtle,flexShrink:0,marginLeft:6}}>{e.time}</span>
          </div>
        ))}
      </Card>
      <Card>
        <SectionTitle>Structured Log (DB)</SectionTitle>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr style={{borderBottom:`2px solid ${C.border}`}}>
                {["Timestamp","Level","Service","Message"].map(h=><th key={h} style={{textAlign:"left",color:C.muted,fontWeight:700,paddingBottom:8,paddingRight:16,fontSize:11,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {logs.map((r,i)=>{
                const l = lc[r.lvl]||lc.INFO;
                return (
                  <tr key={i} style={{borderBottom:`1px solid ${C.border}`}}>
                    <td style={{padding:"9px 16px 9px 0",fontFamily:"monospace",color:C.subtle,fontSize:11}}>{r.ts}</td>
                    <td style={{padding:"9px 16px 9px 0"}}><span style={{padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:700,background:l.bg,color:l.c}}>{r.lvl}</span></td>
                    <td style={{padding:"9px 16px 9px 0",fontFamily:"monospace",color:C.blue,fontSize:11}}>{r.svc}</td>
                    <td style={{padding:"9px 0",color:C.muted}}>{r.msg}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
