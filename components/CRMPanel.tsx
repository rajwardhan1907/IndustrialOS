"use client";
import { CheckCircle, XCircle } from "lucide-react";
import { C, fmt, rnd } from "@/lib/utils";
import { Card } from "./Dashboard";

export default function CRMPanel({ crm, setCrm }: any) {
  const adapters = [
    {key:"salesforce",name:"Salesforce",ico:"☁️",desc:"Sales Cloud"},
    {key:"hubspot",   name:"HubSpot",   ico:"🧲",desc:"Marketing + CRM"},
    {key:"zoho",      name:"Zoho CRM",  ico:"🔧",desc:"Operations CRM"},
  ];
  const sc: any = {
    connected:    {bg:C.greenBg, c:C.green, b:C.greenBorder},
    syncing:      {bg:C.blueBg,  c:C.blue,  b:C.blueBorder},
    disconnected: {bg:"#f0f0f0", c:C.muted, b:C.border},
    error:        {bg:C.redBg,   c:C.red,   b:C.redBorder},
  };
  const syncNow = (k:string) => { setCrm((s:any)=>({...s,[k]:"syncing"})); setTimeout(()=>setCrm((s:any)=>({...s,[k]:"connected"})),2000); };
  const toggle  = (k:string) => setCrm((s:any)=>({...s,[k]:s[k]==="connected"?"disconnected":"connected"}));
  const btn = {fontSize:12,background:C.bg,color:C.muted,border:`1px solid ${C.border}`,borderRadius:6,padding:"5px 12px",cursor:"pointer",fontWeight:600};
  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div>
        <div style={{fontWeight:800,fontSize:18,color:C.text}}>CRM Integration Layer</div>
        <div style={{color:C.muted,fontSize:13,marginTop:4}}>Plug-and-play adapters — switch via ENV var, zero code changes</div>
      </div>
      {adapters.map(a=>{
        const st = crm[a.key]||"disconnected"; const s = sc[st]||sc.disconnected;
        return (
          <Card key={a.key}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:44,height:44,background:C.bg,border:`1px solid ${C.border}`,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{a.ico}</div>
                <div><div style={{fontWeight:700,fontSize:15,color:C.text}}>{a.name}</div><div style={{fontSize:12,color:C.muted}}>{a.desc}</div></div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{padding:"3px 12px",borderRadius:999,fontSize:11,fontWeight:700,background:s.bg,color:s.c,border:`1px solid ${s.b}`}}>{st.toUpperCase()}</span>
                <button onClick={()=>syncNow(a.key)} style={btn}>Sync Now</button>
                <button onClick={()=>toggle(a.key)}  style={btn}>{st==="connected"?"Disconnect":"Connect"}</button>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
              {["syncProduct()","syncOrder()","syncInventory()","syncCustomer()"].map(m=>(
                <div key={m} style={{background:st==="connected"?C.greenBg:C.bg,border:`1px solid ${st==="connected"?C.greenBorder:C.border}`,borderRadius:8,padding:"8px 10px",fontSize:11,fontFamily:"monospace",display:"flex",alignItems:"center",gap:6,color:st==="connected"?C.green:C.subtle}}>
                  {st==="connected"?<CheckCircle size={10}/>:<XCircle size={10}/>}{m}
                </div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
              {[["Last Sync",st==="connected"?"18s ago":"N/A"],["Products Synced",st==="connected"?fmt(rnd(50000,200000)):"—"],["Webhook Latency",st==="connected"?`${rnd(30,120)}ms`:"—"]].map(([l,v],i)=>(
                <div key={i} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px"}}>
                  <div style={{fontSize:11,color:C.muted}}>{l}</div>
                  <div style={{fontSize:14,fontWeight:700,color:C.text,marginTop:2}}>{v}</div>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
      <div style={{background:"#f8f5f0",border:`1px dashed ${C.border2}`,borderRadius:12,padding:18}}>
        <div style={{fontSize:11,color:C.subtle,fontFamily:"monospace",marginBottom:10,fontWeight:600}}>// .env</div>
        {[["CRM_PROVIDER",'"salesforce"',C.green],["CRM_WEBHOOK_URL",'"https://hooks.salesforce.com/..."',C.blue],["CRM_API_KEY",'"sk_live_..."',C.amber]].map(([k,v,c],i)=>(
          <div key={i} style={{fontFamily:"monospace",fontSize:13,marginBottom:4}}>
            <span style={{color:C.muted}}>{k}=</span><span style={{color:c as string}}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
