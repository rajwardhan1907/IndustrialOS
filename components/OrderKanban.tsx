"use client";
import { CheckCircle } from "lucide-react";
import { C, fmt, STAGES } from "@/lib/utils";
import { Card, SectionTitle } from "./Dashboard";

export default function OrderKanban({ orders, advanceOrder }: any) {
  const ss: any = {
    Placed:    {bg:"#f0f0f0", bdr:"#d0ccc5", txt:"#5a5550"},
    Confirmed: {bg:C.blueBg,  bdr:C.blueBorder,  txt:C.blue},
    Picked:    {bg:C.amberBg, bdr:C.amberBorder, txt:C.amber},
    Shipped:   {bg:C.purpleBg,bdr:C.purpleBorder,txt:C.purple},
    Delivered: {bg:C.greenBg, bdr:C.greenBorder, txt:C.green},
  };
  const ps: any = {
    HIGH:{bg:C.redBg,  c:C.red,  bdr:C.redBorder},
    MED: {bg:C.amberBg,c:C.amber,bdr:C.amberBorder},
    LOW: {bg:"#f0f0f0",c:C.muted,bdr:C.border},
  };
  const cols = STAGES.map(s=>({stage:s,items:orders.filter((o:any)=>o.stage===s)}));
  const log = [
    {e:"Inventory reserved",    o:"ORD-10234",ico:"📦",t:"just now"},
    {e:"CRM order pushed",      o:"ORD-10233",ico:"🔌",t:"12s ago"},
    {e:"Packing slip generated",o:"ORD-10232",ico:"📄",t:"28s ago"},
    {e:"Warehouse notified",    o:"ORD-10231",ico:"📧",t:"44s ago"},
    {e:"Confirmation sent",     o:"ORD-10230",ico:"✉️",t:"1m ago"},
  ];
  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontWeight:800,fontSize:18,color:C.text}}>Order Pipeline</div>
          <div style={{color:C.muted,fontSize:13,marginTop:2}}>{orders.length} active orders</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:C.muted,background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:999,padding:"5px 12px"}}>
          <span style={{width:7,height:7,background:C.green,borderRadius:"50%",display:"inline-block"}}/>Auto-advancing
        </div>
      </div>
      <div style={{display:"flex",gap:14,overflowX:"auto",paddingBottom:12}}>
        {cols.map(col=>(
          <div key={col.stage} style={{minWidth:200,width:200,flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,padding:"6px 12px",borderRadius:8,background:ss[col.stage].bg,border:`1px solid ${ss[col.stage].bdr}`}}>
              <span style={{fontSize:11,fontWeight:700,color:ss[col.stage].txt,textTransform:"uppercase",letterSpacing:"0.05em"}}>{col.stage}</span>
              <span style={{fontSize:12,fontWeight:700,color:ss[col.stage].txt}}>{col.items.length}</span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {col.items.map((o:any)=>(
                <div key={o.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderLeft:`3px solid ${ss[o.stage].txt}`,borderRadius:10,padding:"10px 12px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{fontFamily:"monospace",fontSize:11,color:C.blue}}>{o.id}</span>
                    <span style={{padding:"2px 7px",borderRadius:999,fontSize:10,fontWeight:700,background:ps[o.priority].bg,color:ps[o.priority].c,border:`1px solid ${ps[o.priority].bdr}`}}>{o.priority}</span>
                  </div>
                  <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.customer}</div>
                  <div style={{fontSize:11,color:C.subtle,marginBottom:4}}>{o.items} items · {o.sku}</div>
                  <div style={{fontSize:14,fontWeight:800,color:C.green,marginBottom:8}}>${fmt(o.value)}</div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span style={{fontSize:10,color:C.subtle}}>{o.time}</span>
                    {o.stage!=="Delivered"
                      ?<button onClick={()=>advanceOrder(o.id)} style={{fontSize:11,background:C.bg,color:C.muted,border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 8px",cursor:"pointer",fontWeight:600}}>→ Next</button>
                      :<CheckCircle size={12} color={C.green}/>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Card>
        <SectionTitle>Automation Events</SectionTitle>
        {log.map((e,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:`1px solid ${C.border}`,fontSize:13}}>
            <span style={{fontSize:16}}>{e.ico}</span>
            <span style={{color:C.muted}}>{e.e}</span>
            <span style={{fontFamily:"monospace",color:C.blue,fontSize:11}}>{e.o}</span>
            <span style={{marginLeft:"auto",color:C.subtle,fontSize:11}}>{e.t}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
