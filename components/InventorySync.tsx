"use client";
import { useState } from "react";
import { AlertTriangle, CheckCircle, XCircle, Zap } from "lucide-react";
import { C } from "@/lib/utils";
import { Card, SectionTitle } from "./Dashboard";

export default function InventorySync({ conflicts, resolveConflict }: any) {
  const [rule, setRule] = useState({cat:"Fasteners",change:"+10",type:"price"});
  const [applied, setApplied] = useState(false);
  const cats = ["Fasteners","Bearings","Hydraulics","Pneumatics","Tools","Safety Gear"];
  const sel = {background:C.surface,border:`1px solid ${C.border2}`,borderRadius:8,padding:"8px 12px",fontSize:13,color:C.text,outline:"none"};
  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
        {[
          {l:"Last Full Sync",v:"48s ago", sub:"Next in 12s",    ico:"🔄",ok:true},
          {l:"DB ↔ CRM Delta",v:"0 items", sub:"Reconciled",      ico:"✅",ok:true},
          {l:"Supply Chain",  v:"2 pending",sub:"Auto-correcting",ico:"⚠️",ok:false},
        ].map((c,i)=>(
          <div key={i} style={{background:c.ok?C.greenBg:C.amberBg,border:`1px solid ${c.ok?C.greenBorder:C.amberBorder}`,borderRadius:12,padding:"16px",display:"flex",alignItems:"center",gap:14}}>
            <span style={{fontSize:26}}>{c.ico}</span>
            <div>
              <div style={{fontSize:11,color:C.muted,fontWeight:600}}>{c.l}</div>
              <div style={{fontSize:18,fontWeight:800,color:c.ok?C.green:C.amber,marginTop:2}}>{c.v}</div>
              <div style={{fontSize:11,color:C.subtle}}>{c.sub}</div>
            </div>
          </div>
        ))}
      </div>
      <Card>
        <SectionTitle icon={AlertTriangle}>Inventory Conflict Log</SectionTitle>
        {conflicts.map((c:any)=>(
          <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,marginBottom:8,background:c.status==="alert"?C.redBg:C.bg,border:`1px solid ${c.status==="alert"?C.redBorder:C.border}`}}>
            {c.status==="alert"?<XCircle size={13} color={C.red}/>:<CheckCircle size={13} color={C.green}/>}
            <span style={{fontFamily:"monospace",color:C.blue,fontSize:12,width:80}}>{c.sku}</span>
            <span style={{color:C.muted,fontSize:12,width:44}}>{c.field}</span>
            <span style={{fontSize:12}}><span style={{color:C.red}}>{c.before}</span><span style={{color:C.subtle}}> → </span><span style={{color:C.green}}>{c.after}</span></span>
            <span style={{fontSize:11,color:C.subtle}}>[{c.src}]</span>
            <span style={{marginLeft:"auto",fontSize:11,color:C.subtle}}>{c.time}</span>
            {c.status==="alert"
              ?<button onClick={()=>resolveConflict(c.id)} style={{fontSize:11,background:C.redBg,color:C.red,border:`1px solid ${C.redBorder}`,borderRadius:6,padding:"4px 10px",cursor:"pointer",fontWeight:600}}>Resolve</button>
              :<span style={{fontSize:11,background:C.greenBg,color:C.green,border:`1px solid ${C.greenBorder}`,borderRadius:6,padding:"4px 10px",fontWeight:600}}>Auto-fixed</span>
            }
          </div>
        ))}
      </Card>
      <Card>
        <SectionTitle icon={Zap}>Bulk Pricing Rule Engine</SectionTitle>
        <div style={{display:"flex",flexWrap:"wrap",gap:12,alignItems:"flex-end"}}>
          <div><div style={{fontSize:11,color:C.muted,marginBottom:5,fontWeight:600}}>Category</div><select value={rule.cat} onChange={e=>{setRule(r=>({...r,cat:e.target.value}));setApplied(false);}} style={sel}>{cats.map(c=><option key={c}>{c}</option>)}</select></div>
          <div><div style={{fontSize:11,color:C.muted,marginBottom:5,fontWeight:600}}>Type</div><select value={rule.type} onChange={e=>{setRule(r=>({...r,type:e.target.value}));setApplied(false);}} style={sel}><option value="price">Price %</option><option value="stock">Stock adj</option></select></div>
          <div><div style={{fontSize:11,color:C.muted,marginBottom:5,fontWeight:600}}>Change</div><input value={rule.change} onChange={e=>{setRule(r=>({...r,change:e.target.value}));setApplied(false);}} style={{...sel,width:80}}/></div>
          <button onClick={()=>setApplied(true)} style={{padding:"9px 20px",background:C.amber,color:"#fff",border:"none",borderRadius:8,fontWeight:700,fontSize:13,cursor:"pointer"}}>Apply Rule</button>
        </div>
        {applied&&<div style={{marginTop:14,padding:"10px 14px",background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:10,fontSize:13,color:C.green,display:"flex",alignItems:"center",gap:8}}><CheckCircle size={13}/>Rule applied: <strong style={{margin:"0 4px"}}>{rule.cat}</strong> updated by <strong style={{margin:"0 4px"}}>{rule.change}</strong></div>}
      </Card>
    </div>
  );
}
