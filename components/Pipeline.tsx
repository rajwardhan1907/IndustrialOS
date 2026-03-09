"use client";
import { Upload, CheckCircle } from "lucide-react";
import { C, fmt } from "@/lib/utils";
import { Card, SectionTitle } from "./Dashboard";

export default function Pipeline({ pipe, setPipe }: any) {
  const start = () => setPipe({progress:0,rows:0,total:1000000,errors:0,conflicts:0,batches:0,status:"running",t0:Date.now()});
  const reset = () => setPipe(null);
  const p = pipe;
  const batchLog = p ? Array.from({length:Math.min(10,p.batches)},(_,i)=>({id:p.batches-i})) : [];
  const dests = [{label:"PostgreSQL",ico:"🗄️"},{label:"Storefront API",ico:"🛍️"},{label:"CRM Webhook",ico:"🔌"}];
  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{background:C.surface,border:`2px dashed ${C.border2}`,borderRadius:14,padding:44,display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
        <div style={{width:64,height:64,background:C.blueBg,border:`1px solid ${C.blueBorder}`,borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center"}}><Upload size={26} color={C.blue}/></div>
        <div style={{textAlign:"center"}}>
          <div style={{fontWeight:800,fontSize:18,color:C.text}}>Bulk SKU Upload</div>
          <div style={{color:C.muted,fontSize:13,marginTop:4}}>CSV · Excel · JSON — up to 1M rows</div>
          <div style={{color:C.subtle,fontSize:12,marginTop:2}}>BullMQ parallel batches of 1,000 · 12 workers</div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={start} disabled={p?.status==="running"} style={{padding:"10px 22px",background:p?.status==="running"?C.blueBg:C.blue,color:p?.status==="running"?C.blue:"#fff",border:`1px solid ${C.blueBorder}`,borderRadius:8,fontWeight:700,fontSize:13,cursor:p?.status==="running"?"not-allowed":"pointer"}}>
            {p?.status==="running"?"⚡ Processing…":"▶  Simulate 1M SKU Upload"}
          </button>
          {p?.status==="done"&&<button onClick={reset} style={{padding:"10px 18px",background:C.bg,color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,fontWeight:600,fontSize:13,cursor:"pointer"}}>Reset</button>}
        </div>
      </div>
      {p&&(<>
        <Card>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <SectionTitle>Pipeline Progress</SectionTitle>
            <span style={{padding:"3px 12px",borderRadius:999,fontSize:11,fontWeight:700,background:p.status==="done"?C.greenBg:C.blueBg,color:p.status==="done"?C.green:C.blue,border:`1px solid ${p.status==="done"?C.greenBorder:C.blueBorder}`}}>
              {p.status==="done"?"✓ COMPLETE":"⚡ RUNNING"}
            </span>
          </div>
          <div style={{marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.muted,marginBottom:6}}>
              <span>{fmt(p.rows)} / {fmt(p.total)} rows</span>
              <span style={{fontWeight:700}}>{p.progress.toFixed(2)}%</span>
            </div>
            <div style={{height:12,background:C.bg,borderRadius:999,overflow:"hidden",border:`1px solid ${C.border}`}}>
              <div style={{height:"100%",width:`${p.progress}%`,background:p.status==="done"?`linear-gradient(90deg,${C.green},#52c89a)`:`linear-gradient(90deg,${C.blue},${C.purple})`,borderRadius:999,transition:"width .3s"}}/>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {[["Batches",fmt(p.batches),C.blueBg,C.blue,C.blueBorder],["Rows",fmt(p.rows),C.greenBg,C.green,C.greenBorder],["Errors",p.errors,C.redBg,C.red,C.redBorder],["Conflicts",p.conflicts,C.amberBg,C.amber,C.amberBorder]].map(([l,v,bg,col,bdr]:any,i)=>(
              <div key={i} style={{background:bg,border:`1px solid ${bdr}`,borderRadius:10,padding:"10px 12px"}}>
                <div style={{fontSize:11,color:C.muted}}>{l}</div>
                <div style={{fontSize:22,fontWeight:800,color:col,marginTop:4}}>{v}</div>
              </div>
            ))}
          </div>
          {p.status==="done"&&<div style={{marginTop:14,padding:"10px 14px",background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:10,fontSize:13,color:C.green,display:"flex",alignItems:"center",gap:8}}><CheckCircle size={13}/>Complete — {fmt(p.total)} SKUs synced in {p.elapsed}s</div>}
        </Card>
        {batchLog.length>0&&(
          <Card>
            <SectionTitle>Live Batch Log</SectionTitle>
            {batchLog.map((b:any)=>(
              <div key={b.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.border}`,fontSize:13}}>
                <CheckCircle size={12} color={C.green}/>
                <span style={{fontFamily:"monospace",color:C.muted}}>Batch #{b.id}</span>
                <span style={{color:C.subtle}}>1,000 rows</span>
                <span style={{marginLeft:"auto",color:C.subtle,fontSize:11}}>{(Math.random()*.8+.3).toFixed(2)}s</span>
                <span style={{padding:"2px 9px",background:C.greenBg,color:C.green,border:`1px solid ${C.greenBorder}`,borderRadius:999,fontSize:11,fontWeight:700}}>OK</span>
              </div>
            ))}
          </Card>
        )}
      </>)}
      <Card>
        <SectionTitle>Sync Destinations</SectionTitle>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
          {dests.map((d,i)=>(
            <div key={i} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:22}}>{d.ico}</span>
              <span style={{fontSize:13,fontWeight:600,color:C.text}}>{d.label}</span>
              <span style={{marginLeft:"auto",padding:"2px 9px",background:p?.status==="running"?C.blueBg:C.greenBg,color:p?.status==="running"?C.blue:C.green,border:`1px solid ${p?.status==="running"?C.blueBorder:C.greenBorder}`,borderRadius:999,fontSize:10,fontWeight:700}}>{p?.status==="running"?"SYNCING":"READY"}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
