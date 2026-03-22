"use client";
import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { fmt, C } from "@/lib/utils";
import {
  Plus, Sparkles, ChevronLeft, FileText,
  Clock, CheckCircle, XCircle, Send, Trash2,
  Edit3, Package, User, Calendar, Hash,
  AlertCircle, Loader,
} from "lucide-react";

interface LineItem {
  id:        string;
  sku:       string;
  desc:      string;
  qty:       number;
  unitPrice: number;
  discount:  number;
  total:     number;
}

interface Quote {
  id:           string;
  quoteNumber:  string;
  customer:     string;
  items:        LineItem[];
  subtotal:     number;
  discountAmt:  number;
  tax:          number;
  total:        number;
  validUntil:   string;
  paymentTerms: string;
  notes:        string;
  status:       "draft" | "sent" | "accepted" | "declined" | "expired";
  createdAt:    string;
  prompt:       string;
}

const STATUS: Record<Quote["status"], { label: string; color: string; bg: string; border: string; icon: any }> = {
  draft:    { label:"Draft",    color:C.muted, bg:"#f0f0f0", border:C.border,       icon:Edit3       },
  sent:     { label:"Sent",     color:C.blue,  bg:C.blueBg,  border:C.blueBorder,   icon:Send        },
  accepted: { label:"Accepted", color:C.green, bg:C.greenBg, border:C.greenBorder,  icon:CheckCircle },
  declined: { label:"Declined", color:C.red,   bg:C.redBg,   border:C.redBorder,    icon:XCircle     },
  expired:  { label:"Expired",  color:C.muted, bg:"#f0f0f0", border:C.border,       icon:AlertCircle },
};

const makeId    = () => Math.random().toString(36).slice(2, 9);
const makeQNum  = () => `QT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
const fmtDate   = (d: string) => new Date(d).toLocaleDateString("en-US", { year:"numeric", month:"short", day:"numeric" });
const fmtMoney  = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
const STORAGE_KEY = "industrialos_quotes";

function loadQuotes(): Quote[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveQuotes(qs: Quote[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(qs));
}

function getQuoteWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("workspaceDbId");
}

async function fetchQuotesFromDb(): Promise<Quote[]> {
  const wid = getQuoteWorkspaceId();
  if (!wid) return [];
  try {
    const res = await fetch(`/api/quotes?workspaceId=${wid}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((d: any) => ({
      id:           d.id,
      quoteNumber:  d.quoteNumber,
      customer:     d.customer,
      items:        Array.isArray(d.items) ? d.items : JSON.parse(d.items || "[]"),
      subtotal:     d.subtotal,
      discountAmt:  d.discountAmt,
      tax:          d.tax,
      total:        d.total,
      validUntil:   d.validUntil,
      paymentTerms: d.paymentTerms,
      notes:        d.notes,
      status:       d.status as Quote["status"],
      prompt:       d.prompt,
      createdAt:    typeof d.createdAt === "string" ? d.createdAt : new Date(d.createdAt).toISOString(),
    }));
  } catch { return []; }
}

async function createQuoteInDb(q: Quote): Promise<void> {
  const wid = getQuoteWorkspaceId();
  if (!wid) return;
  try {
    await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...q, workspaceId: wid }),
    });
  } catch {}
}

async function updateQuoteInDb(id: string, patch: Partial<Quote>): Promise<void> {
  try {
    await fetch("/api/quotes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
  } catch {}
}

async function deleteQuoteFromDb(id: string): Promise<void> {
  try { await fetch(`/api/quotes?id=${id}`, { method: "DELETE" }); } catch {}
}

const Card = ({ children, style = {} }: any) => (
  <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"20px 22px", ...style }}>
    {children}
  </div>
);

const Badge = ({ status }: { status: Quote["status"] }) => {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:999, fontSize:11, fontWeight:700, color:s.color, background:s.bg, border:`1px solid ${s.border}` }}>
      <Icon size={10}/>{s.label}
    </span>
  );
};

export default function Quotes() {
  const { data: session } = useSession();
  const isViewer = session?.user?.role === "viewer";
  const [view,      setView]     = useState<"list"|"new"|"detail">("list");
  const [quotes,    setQuotes]   = useState<Quote[]>(() => loadQuotes());
  const [prompt,    setPrompt]   = useState("");
  const [thinking,  setThinking] = useState(false);
  const [aiError,   setAiError]  = useState("");
  const [draft,     setDraft]    = useState<Quote | null>(null);
  const [selected,  setSelected] = useState<Quote | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (view === "new" && textRef.current) textRef.current.focus();
  }, [view]);

  useEffect(() => {
    fetchQuotesFromDb().then(dbQuotes => {
      if (dbQuotes.length > 0) {
        setQuotes(dbQuotes);
        saveQuotes(dbQuotes);
      }
    });
  }, []);

  const generate = async () => {
    if (!prompt.trim()) return;
    setThinking(true);
    setAiError("");
    try {
      const res  = await fetch("/api/generate-quote", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setAiError(data.error || "Something went wrong. Please try again.");
        setThinking(false);
        return;
      }
      const q = data.quote;
      const items: LineItem[] = (q.items || []).map((it: any, i: number) => ({
        id:        it.id || `item-${i}`,
        sku:       it.sku       || "SKU-TBD",
        desc:      it.desc      || "Product",
        qty:       Number(it.qty)       || 1,
        unitPrice: Number(it.unitPrice) || 0,
        discount:  Number(it.discount)  || 0,
        total:     Number(it.total)     || 0,
      }));
      const newQuote: Quote = {
        id:           makeId(),
        quoteNumber:  makeQNum(),
        customer:     q.customer     || "Customer",
        items,
        subtotal:     Number(q.subtotal)    || 0,
        discountAmt:  Number(q.discountAmt) || 0,
        tax:          Number(q.tax)         || 0,
        total:        Number(q.total)       || 0,
        validUntil:   q.validUntil    || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
        paymentTerms: q.paymentTerms  || "Net 30",
        notes:        q.notes         || "",
        status:       "draft",
        createdAt:    new Date().toISOString(),
        prompt:       prompt.trim(),
      };
      setDraft(newQuote);
    } catch {
      setAiError("Network error. Check your connection and try again.");
    } finally {
      setThinking(false);
    }
  };

  const saveQuote = () => {
    if (!draft) return;
    const updated = [draft, ...quotes];
    setQuotes(updated);
    saveQuotes(updated);
    createQuoteInDb(draft);
    setSelected(draft);
    setDraft(null);
    setPrompt("");
    setView("detail");
  };

  const deleteQuote = (id: string) => {
    const updated = quotes.filter(q => q.id !== id);
    setQuotes(updated);
    saveQuotes(updated);
    deleteQuoteFromDb(id);
    setSelected(null);
    setView("list");
  };

  const resetNew = () => {
    setPrompt(""); setDraft(null); setThinking(false); setAiError("");
  };

  const downloadPDF = async (inv: any) => {
    try {
      const res = await fetch("/api/pdf", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type: "invoice", data: inv }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert("PDF error: " + (err.detail || err.error || "unknown"));
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${inv.invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert("PDF error: " + e.message);
    }
  };
  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  if (view === "list") return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:C.text, marginBottom:4 }}>Quotes &amp; RFQ</h1>
          <p style={{ color:C.muted, fontSize:13 }}>Generate professional quotes in seconds using plain English.</p>
        </div>
        {!isViewer && (
          <button onClick={() => { resetNew(); setView("new"); }} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 20px", borderRadius:10, background:`linear-gradient(135deg,${C.blue},#7c5cbf)`, border:"none", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", boxShadow:`0 4px 16px ${C.blue}44` }}>
            <Sparkles size={14}/> New AI Quote
          </button>
        )}
      </div>

      {quotes.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
          {[
            { label:"Total Quotes", value:quotes.length,                                                    color:C.blue,   bg:C.blueBg,   bdr:C.blueBorder   },
            { label:"Accepted",     value:quotes.filter(q=>q.status==="accepted").length,                   color:C.green,  bg:C.greenBg,  bdr:C.greenBorder  },
            { label:"Pending",      value:quotes.filter(q=>q.status==="sent"||q.status==="draft").length,   color:C.amber,  bg:C.amberBg,  bdr:C.amberBorder  },
            { label:"Total Value",  value:fmtMoney(quotes.reduce((s,q)=>s+q.total,0)),                     color:C.purple, bg:C.purpleBg, bdr:C.purpleBorder },
          ].map((s,i) => (
            <div key={i} style={{ background:s.bg, border:`1px solid ${s.bdr}`, borderRadius:12, padding:"14px 16px" }}>
              <div style={{ fontSize:11, color:C.muted, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>{s.label}</div>
              <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {quotes.length === 0 ? (
        <Card>
          <div style={{ textAlign:"center", padding:"48px 24px" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>&#10024;</div>
            <h3 style={{ fontSize:18, fontWeight:800, color:C.text, marginBottom:8 }}>No quotes yet</h3>
            <p style={{ color:C.muted, fontSize:14, marginBottom:24, maxWidth:360, margin:"0 auto 24px" }}>
              Click <strong>New AI Quote</strong> and describe what you need.
            </p>
            <button onClick={() => { resetNew(); setView("new"); }} style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"12px 24px", borderRadius:10, background:`linear-gradient(135deg,${C.blue},#7c5cbf)`, border:"none", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>
              <Sparkles size={15}/> Create Your First Quote
            </button>
          </div>
        </Card>
      ) : (
        <Card style={{ padding:0, overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:C.bg, borderBottom:`1px solid ${C.border}` }}>
                {["Quote #","Customer","Items","Total","Valid Until","Status",""].map((h,i) => (
                  <th key={i} style={{ padding:"10px 16px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotes.map((q,i) => (
                <tr key={q.id} onClick={() => { setSelected(q); setView("detail"); }}
                  style={{ borderBottom:i<quotes.length-1?`1px solid ${C.border}`:"none", cursor:"pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.background=C.bg)}
                  onMouseLeave={e => (e.currentTarget.style.background="transparent")}>
                  <td style={{ padding:"12px 16px", fontWeight:700, color:C.blue, fontFamily:"monospace" }}>{q.quoteNumber}</td>
                  <td style={{ padding:"12px 16px", color:C.text, fontWeight:600 }}>{q.customer}</td>
                  <td style={{ padding:"12px 16px", color:C.muted }}>{q.items.length} item{q.items.length!==1?"s":""}</td>
                  <td style={{ padding:"12px 16px", fontWeight:700, color:C.text }}>{fmtMoney(q.total)}</td>
                  <td style={{ padding:"12px 16px", color:C.muted }}>{fmtDate(q.validUntil)}</td>
                  <td style={{ padding:"12px 16px" }}><Badge status={q.status}/></td>
                  <td style={{ padding:"12px 16px", color:C.muted, fontSize:11 }}>{new Date(q.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );

  // ── NEW QUOTE VIEW ─────────────────────────────────────────────────────────
  if (view === "new") return (
    <div style={{ display:"flex", flexDirection:"column", gap:20, maxWidth:780 }}>
      <button onClick={() => { resetNew(); setView("list"); }} style={{ display:"inline-flex", alignItems:"center", gap:6, background:"none", border:"none", color:C.muted, fontSize:13, cursor:"pointer", fontWeight:600, padding:0 }}>
        &#8592; Back to Quotes
      </button>

      <div>
        <h1 style={{ fontSize:22, fontWeight:800, color:C.text, marginBottom:4 }}>New AI Quote</h1>
        <p style={{ color:C.muted, fontSize:13 }}>Just describe what you need in plain English. Claude handles the rest.</p>
      </div>

      <Card style={{ position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${C.blue},#7c5cbf,${C.blue})` }}/>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
          <Sparkles size={16} color={C.blue}/>
          <span style={{ fontWeight:700, fontSize:14, color:C.text }}>Describe your quote</span>
          <span style={{ marginLeft:"auto", fontSize:11, color:C.blue, fontWeight:600, background:C.blueBg, padding:"2px 8px", borderRadius:999, border:`1px solid ${C.blueBorder}` }}>
            Powered by Claude AI
          </span>
        </div>
        <textarea
          ref={textRef}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => { if (e.key==="Enter"&&(e.metaKey||e.ctrlKey)) generate(); }}
          placeholder={"Try something like:\n\"500 units of SKU-4821 for Acme Corp, deliver by end of month\"\n\"200 pieces of SKU-7753 for TechWave Ltd, Net 60\""}
          disabled={thinking || !!draft}
          style={{ width:"100%", minHeight:100, padding:"12px 14px", background:"#f8f6f2", border:`1px solid ${C.border}`, borderRadius:10, color:C.text, fontSize:14, lineHeight:1.6, resize:"vertical", outline:"none", fontFamily:"inherit", boxSizing:"border-box", opacity:thinking||draft?0.5:1 }}
        />
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:12 }}>
          <span style={{ fontSize:11, color:C.muted }}>Press Cmd+Enter to generate.</span>
          <button onClick={generate} disabled={!prompt.trim()||thinking||!!draft}
            style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 22px", borderRadius:10, background:!prompt.trim()||thinking||draft?C.border:`linear-gradient(135deg,${C.blue},#7c5cbf)`, border:"none", color:!prompt.trim()||thinking||draft?C.muted:"#fff", fontSize:13, fontWeight:700, cursor:!prompt.trim()||thinking||draft?"not-allowed":"pointer" }}>
            {thinking ? <Loader size={14} style={{ animation:"spin 1s linear infinite" }}/> : <Sparkles size={14}/>}
            {thinking ? "Claude is thinking…" : "Generate Quote"}
          </button>
        </div>
      </Card>

      {thinking && (
        <Card style={{ background:C.blueBg, border:`1px solid ${C.blueBorder}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <Loader size={18} color={C.blue} style={{ animation:"spin 1s linear infinite", flexShrink:0 }}/>
            <div>
              <div style={{ fontWeight:700, fontSize:14, color:C.blue }}>Claude is generating your quote…</div>
              <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>Extracting details, pricing items, calculating totals.</div>
            </div>
          </div>
        </Card>
      )}

      {aiError && !thinking && (
        <Card style={{ background:C.redBg, border:`1px solid ${C.redBorder}` }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
            <AlertCircle size={16} color={C.red} style={{ flexShrink:0, marginTop:1 }}/>
            <div>
              <div style={{ fontWeight:700, fontSize:13, color:C.red, marginBottom:4 }}>Generation failed</div>
              <div style={{ fontSize:13, color:C.red }}>{aiError}</div>
            </div>
          </div>
        </Card>
      )}

      {draft && !thinking && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <CheckCircle size={18} color={C.green}/>
            <span style={{ fontWeight:700, fontSize:15, color:C.green }}>Quote generated! Review and save.</span>
          </div>

          <Card>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              {[
                { icon:Hash,     label:"Quote Number",  value:draft.quoteNumber         },
                { icon:User,     label:"Customer",      value:draft.customer            },
                { icon:Calendar, label:"Valid Until",   value:fmtDate(draft.validUntil) },
                { icon:Clock,    label:"Payment Terms", value:draft.paymentTerms        },
              ].map(({ icon:Icon, label, value }) => (
                <div key={label} style={{ padding:"12px 14px", background:C.bg, borderRadius:10, border:`1px solid ${C.border}` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                    <Icon size={12} color={C.muted}/>
                    <span style={{ fontSize:11, color:C.muted, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>{label}</span>
                  </div>
                  <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{value}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card style={{ padding:0, overflow:"hidden" }}>
            <div style={{ padding:"13px 18px 11px", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontWeight:700, fontSize:13, color:C.text }}>Line Items</span>
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:C.bg }}>
                  {["SKU","Description","Qty","Unit Price","Discount","Total"].map(h => (
                    <th key={h} style={{ padding:"8px 16px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {draft.items.map(item => (
                  <tr key={item.id} style={{ borderTop:`1px solid ${C.border}` }}>
                    <td style={{ padding:"11px 16px", fontFamily:"monospace", fontWeight:700, color:C.blue }}>{item.sku}</td>
                    <td style={{ padding:"11px 16px", color:C.text }}>{item.desc}</td>
                    <td style={{ padding:"11px 16px", fontWeight:600 }}>{item.qty.toLocaleString()}</td>
                    <td style={{ padding:"11px 16px" }}>{fmtMoney(item.unitPrice)}</td>
                    <td style={{ padding:"11px 16px" }}>
                      {item.discount > 0
                        ? <span style={{ color:C.green, fontWeight:600 }}>{item.discount}% off</span>
                        : <span style={{ color:C.subtle }}>—</span>}
                    </td>
                    <td style={{ padding:"11px 16px", fontWeight:700 }}>{fmtMoney(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding:"12px 18px", borderTop:`1px solid ${C.border}`, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5 }}>
              {[
                ["Subtotal",  fmtMoney(draft.subtotal),   false],
                ["Discount",  draft.discountAmt>0?`-${fmtMoney(draft.discountAmt)}`:"—", false],
                ["Tax (8%)",  fmtMoney(draft.tax),        false],
                ["Total",     fmtMoney(draft.total),      true ],
              ].map(([l,v,b]) => (
                <div key={l as string} style={{ display:"flex", gap:40 }}>
                  <span style={{ fontSize:13, color:C.muted, minWidth:80 }}>{l}</span>
                  <span style={{ fontSize:b?16:13, fontWeight:b?800:600, color:b?C.text:C.muted, minWidth:90, textAlign:"right" }}>{v}</span>
                </div>
              ))}
            </div>
          </Card>

          {draft.notes && (
            <Card>
              <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>Professional Note</div>
              <p style={{ fontSize:13, color:C.text, lineHeight:1.7, margin:0 }}>{draft.notes}</p>
            </Card>
          )}

          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button onClick={() => { setDraft(null); setAiError(""); }} style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 18px", borderRadius:10, background:"none", border:`1px solid ${C.border}`, color:C.muted, fontSize:13, fontWeight:600, cursor:"pointer" }}>
              <Sparkles size={13}/> Regenerate
            </button>
            <button onClick={saveQuote} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 24px", borderRadius:10, background:`linear-gradient(135deg,${C.green},#3aaa72)`, border:"none", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              <CheckCircle size={14}/> Save Quote
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ── DETAIL VIEW ────────────────────────────────────────────────────────────
  if (view === "detail" && selected) return (
    <div style={{ display:"flex", flexDirection:"column", gap:20, maxWidth:780 }}>
      <button onClick={() => { setSelected(null); setView("list"); }} style={{ display:"inline-flex", alignItems:"center", gap:6, background:"none", border:"none", color:C.muted, fontSize:13, cursor:"pointer", fontWeight:600, padding:0 }}>
        &#8592; Back to Quotes
      </button>

      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:4 }}>
            <h1 style={{ fontSize:22, fontWeight:800, color:C.text }}>{selected.quoteNumber}</h1>
            <Badge status={selected.status}/>
          </div>
          <p style={{ color:C.muted, fontSize:13 }}>
            Created {fmtDate(selected.createdAt)} · Customer: <strong style={{ color:C.text }}>{selected.customer}</strong>
          </p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => downloadPDF(selected)} style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:8, background:C.blueBg, border:`1px solid ${C.blueBorder}`, color:C.blue, fontSize:12, fontWeight:600, cursor:"pointer" }}>
            &#8595; PDF
          </button>
          {!isViewer && (
            <button onClick={() => deleteQuote(selected.id)} style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:8, background:C.redBg, border:`1px solid ${C.redBorder}`, color:C.red, fontSize:12, fontWeight:600, cursor:"pointer" }}>
              <Trash2 size={13}/> Delete
            </button>
          )}
        </div>
      </div>

      <Card>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          {[
            { icon:User,     label:"Customer",      value:selected.customer            },
            { icon:Hash,     label:"Quote Number",  value:selected.quoteNumber         },
            { icon:Calendar, label:"Valid Until",   value:fmtDate(selected.validUntil) },
            { icon:Clock,    label:"Payment Terms", value:selected.paymentTerms        },
          ].map(({ icon:Icon, label, value }) => (
            <div key={label} style={{ padding:"10px 12px", background:C.bg, borderRadius:10, border:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                <Icon size={11} color={C.muted}/>
                <span style={{ fontSize:10, color:C.muted, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</span>
              </div>
              <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{value}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ padding:0, overflow:"hidden" }}>
        <div style={{ padding:"13px 18px 11px", borderBottom:`1px solid ${C.border}` }}>
          <span style={{ fontWeight:700, fontSize:13 }}>Line Items</span>
        </div>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead>
            <tr style={{ background:C.bg }}>
              {["SKU","Description","Qty","Unit Price","Discount","Total"].map(h => (
                <th key={h} style={{ padding:"8px 16px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {selected.items.map(item => (
              <tr key={item.id} style={{ borderTop:`1px solid ${C.border}` }}>
                <td style={{ padding:"11px 16px", fontFamily:"monospace", fontWeight:700, color:C.blue }}>{item.sku}</td>
                <td style={{ padding:"11px 16px", color:C.text }}>{item.desc}</td>
                <td style={{ padding:"11px 16px", fontWeight:600 }}>{item.qty.toLocaleString()}</td>
                <td style={{ padding:"11px 16px" }}>{fmtMoney(item.unitPrice)}</td>
                <td style={{ padding:"11px 16px" }}>
                  {item.discount > 0
                    ? <span style={{ color:C.green, fontWeight:600 }}>{item.discount}% off</span>
                    : <span style={{ color:C.subtle }}>—</span>}
                </td>
                <td style={{ padding:"11px 16px", fontWeight:700 }}>{fmtMoney(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding:"12px 18px", borderTop:`1px solid ${C.border}`, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5 }}>
          {[
            ["Subtotal", fmtMoney(selected.subtotal), false],
            ["Discount", selected.discountAmt>0?`-${fmtMoney(selected.discountAmt)}`:"—", false],
            ["Tax (8%)", fmtMoney(selected.tax),      false],
            ["Total",    fmtMoney(selected.total),    true ],
          ].map(([l,v,b]) => (
            <div key={l as string} style={{ display:"flex", gap:40 }}>
              <span style={{ fontSize:13, color:C.muted, minWidth:80 }}>{l}</span>
              <span style={{ fontSize:b?16:13, fontWeight:b?800:600, color:b?C.text:C.muted, minWidth:90, textAlign:"right" }}>{v}</span>
            </div>
          ))}
        </div>
      </Card>

      {!isViewer && (
        <Card>
          <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 }}>Update Status</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {(["draft","sent","accepted","declined","expired"] as Quote["status"][]).map(s => (
              <button key={s} onClick={() => {
                const updated = quotes.map(q => q.id===selected.id?{...q,status:s}:q);
                setQuotes(updated); saveQuotes(updated);
                updateQuoteInDb(selected.id, { status: s });
                setSelected({...selected,status:s});
              }} style={{ padding:"7px 14px", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", background:selected.status===s?STATUS[s].bg:C.bg, color:selected.status===s?STATUS[s].color:C.muted, border:`1px solid ${selected.status===s?STATUS[s].border:C.border}` }}>
                {STATUS[s].label}
              </button>
            ))}
          </div>
        </Card>
      )}

      {selected.notes && (
        <Card>
          <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>Professional Note</div>
          <p style={{ fontSize:13, color:C.text, lineHeight:1.7, margin:0 }}>{selected.notes}</p>
        </Card>
      )}

      {selected.prompt && (
        <Card>
          <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>Original Prompt</div>
          <p style={{ fontSize:13, color:C.muted, lineHeight:1.6, margin:0, fontStyle:"italic" }}>"{selected.prompt}"</p>
        </Card>
      )}
    </div>
  );

  return null;
}
