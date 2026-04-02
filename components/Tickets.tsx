"use client";
// components/Tickets.tsx

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Plus, X, ChevronLeft, MessageSquare, Tag, AlertCircle } from "lucide-react";
import { C } from "@/lib/utils";

type TicketType     = "issue" | "request" | "alert" | "other";
type TicketPriority = "low" | "medium" | "high" | "urgent";
type TicketStatus   = "open" | "in_progress" | "resolved" | "closed";

interface Comment {
  id: string; ticketId: string; authorId: string; authorName: string;
  body: string; createdAt: string;
}
interface Ticket {
  id: string; ticketNumber: string; title: string; description: string;
  type: TicketType; priority: TicketPriority; status: TicketStatus;
  assignedTo: string; assignedName: string; raisedBy: string; raisedName: string;
  linkedType: string; linkedId: string; linkedLabel: string;
  workspaceId: string; createdAt: string; updatedAt: string;
  comments: Comment[];
}

const PRIORITY_CFG: Record<TicketPriority, { label: string; color: string; bg: string; border: string }> = {
  urgent: { label: "Urgent", color: C.red,    bg: C.redBg,    border: C.redBorder    },
  high:   { label: "High",   color: C.amber,  bg: C.amberBg,  border: C.amberBorder  },
  medium: { label: "Medium", color: C.blue,   bg: C.blueBg,   border: C.blueBorder   },
  low:    { label: "Low",    color: C.muted,  bg: C.bg,       border: C.border       },
};

const STATUS_CFG: Record<TicketStatus, { label: string; color: string; bg: string; border: string }> = {
  open:        { label: "Open",        color: C.blue,   bg: C.blueBg,   border: C.blueBorder   },
  in_progress: { label: "In Progress", color: C.amber,  bg: C.amberBg,  border: C.amberBorder  },
  resolved:    { label: "Resolved",    color: C.green,  bg: C.greenBg,  border: C.greenBorder  },
  closed:      { label: "Closed",      color: C.muted,  bg: C.bg,       border: C.border       },
};

const TYPE_LABELS: Record<TicketType, string> = {
  issue:   "Issue",
  request: "Request",
  alert:   "Alert",
  other:   "Other",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Badge({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) {
  return (
    <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, color, background: bg, border: `1px solid ${border}` }}>
      {label}
    </span>
  );
}

function getWorkspaceId() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("workspaceDbId") ?? "";
}

// ── New Ticket Modal ──────────────────────────────────────────────────────────
function NewTicketModal({ users, session, onSave, onClose }: {
  users: any[]; session: any;
  onSave: (t: Ticket) => void;
  onClose: () => void;
}) {
  const [title,        setTitle]        = useState("");
  const [description,  setDescription]  = useState("");
  const [type,         setType]         = useState<TicketType>("issue");
  const [priority,     setPriority]     = useState<TicketPriority>("medium");
  const [assignedTo,   setAssignedTo]   = useState("");
  const [assignedName, setAssignedName] = useState("");
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");

  const inp: React.CSSProperties = {
    width: "100%", padding: "9px 11px", background: C.bg,
    border: `1px solid ${C.border}`, borderRadius: 8, color: C.text,
    fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 700, color: C.muted,
    marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em",
  };

  const save = async () => {
    if (!title.trim()) { setError("Title is required"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: getWorkspaceId(),
          title: title.trim(), description, type, priority,
          assignedTo, assignedName,
          raisedBy:   session?.user?.id    ?? "",
          raisedName: session?.user?.name  ?? "",
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed"); return; }
      const t = await res.json();
      onSave(t); onClose();
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16, overflowY: "auto" }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, boxShadow: "0 24px 80px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: C.text }}>New Ticket</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }}><X size={18} /></button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Describe the issue in one line" style={inp} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="More details..." style={{ ...inp, resize: "vertical" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={lbl}>Type</label>
            <select value={type} onChange={e => setType(e.target.value as TicketType)} style={{ ...inp, cursor: "pointer" }}>
              <option value="issue">Issue</option>
              <option value="request">Request</option>
              <option value="alert">Alert</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Priority</label>
            <select value={priority} onChange={e => setPriority(e.target.value as TicketPriority)} style={{ ...inp, cursor: "pointer" }}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Assign To (optional)</label>
          <select value={assignedTo} onChange={e => {
            const u = users.find(u => u.id === e.target.value);
            setAssignedTo(e.target.value);
            setAssignedName(u?.name ?? "");
          }} style={{ ...inp, cursor: "pointer" }}>
            <option value="">Unassigned</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
          </select>
        </div>
        {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", background: "none", border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button onClick={save} disabled={loading || !title.trim()}
            style={{ padding: "9px 20px", background: title.trim() && !loading ? C.blue : C.border, border: "none", borderRadius: 8, color: title.trim() && !loading ? "#fff" : C.muted, fontSize: 13, fontWeight: 700, cursor: title.trim() ? "pointer" : "not-allowed" }}>
            {loading ? "Creating…" : "Create Ticket"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Ticket Detail Panel ───────────────────────────────────────────────────────
function TicketDetail({ ticket, users, session, onUpdate, onBack }: {
  ticket: Ticket; users: any[]; session: any;
  onUpdate: (t: Ticket) => void;
  onBack: () => void;
}) {
  const [commentBody, setCommentBody]   = useState("");
  const [submitting,  setSubmitting]    = useState(false);
  const [comments,    setComments]      = useState<Comment[]>(ticket.comments ?? []);
  const [updating,    setUpdating]      = useState(false);

  const postComment = async () => {
    if (!commentBody.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/tickets/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId:   ticket.id,
          authorId:   session?.user?.id   ?? "",
          authorName: session?.user?.name ?? "Unknown",
          body:       commentBody.trim(),
        }),
      });
      if (res.ok) {
        const c = await res.json();
        setComments(prev => [...prev, c]);
        setCommentBody("");
      }
    } finally { setSubmitting(false); }
  };

  const updateField = async (fields: Partial<Ticket>) => {
    setUpdating(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticket.id, ...fields }),
      });
      if (res.ok) { const t = await res.json(); onUpdate(t); }
    } finally { setUpdating(false); }
  };

  const p = PRIORITY_CFG[ticket.priority] ?? PRIORITY_CFG.medium;
  const st = STATUS_CFG[ticket.status]    ?? STATUS_CFG.open;
  const inp: React.CSSProperties = {
    padding: "7px 10px", background: C.bg,
    border: `1px solid ${C.border}`, borderRadius: 7,
    color: C.text, fontSize: 12, outline: "none", cursor: "pointer",
  };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "0 4px" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.blue, fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 16, padding: 0 }}>
        <ChevronLeft size={14} /> Back to list
      </button>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.05em", marginBottom: 4 }}>{ticket.ticketNumber} · {TYPE_LABELS[ticket.type]}</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: 0 }}>{ticket.title}</h2>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Badge label={p.label}  color={p.color}  bg={p.bg}  border={p.border} />
            <Badge label={st.label} color={st.color} bg={st.bg} border={st.border} />
          </div>
        </div>

        {ticket.description && (
          <p style={{ fontSize: 13, color: C.text, lineHeight: 1.6, margin: "0 0 16px", whiteSpace: "pre-wrap" }}>{ticket.description}</p>
        )}

        {ticket.linkedLabel && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: C.bg, borderRadius: 8, marginBottom: 14, width: "fit-content" }}>
            <Tag size={12} color={C.blue} />
            <span style={{ fontSize: 12, color: C.blue, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }} onClick={() => { if (ticket.linkedType === "inventory") onNavigate?.("inventory"); else if (ticket.linkedType === "customer") onNavigate?.("customers"); else if (ticket.linkedType === "order") onNavigate?.("orders"); }}>{ticket.linkedLabel}</span>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5, textTransform: "uppercase" }}>Status</div>
            <select value={ticket.status} onChange={e => updateField({ status: e.target.value as TicketStatus })} style={inp} disabled={updating}>
              {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5, textTransform: "uppercase" }}>Priority</div>
            <select value={ticket.priority} onChange={e => updateField({ priority: e.target.value as TicketPriority })} style={inp} disabled={updating}>
              {Object.entries(PRIORITY_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5, textTransform: "uppercase" }}>Assigned To</div>
            <select value={ticket.assignedTo} onChange={e => {
              const u = users.find(u => u.id === e.target.value);
              updateField({ assignedTo: e.target.value, assignedName: u?.name ?? "" });
            }} style={inp} disabled={updating}>
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5, textTransform: "uppercase" }}>Raised By</div>
            <div style={{ fontSize: 13, color: C.text, padding: "7px 0" }}>{ticket.raisedName || "—"}</div>
          </div>
        </div>

        <div style={{ fontSize: 11, color: C.subtle, marginTop: 8 }}>Created {fmtDate(ticket.createdAt)}</div>
      </div>

      {/* Comments */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <MessageSquare size={15} color={C.muted} />
          <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Comments ({comments.length})</span>
        </div>

        {comments.length === 0 && (
          <div style={{ textAlign: "center", padding: "12px 0", color: C.subtle, fontSize: 13 }}>No comments yet.</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {comments.map(c => (
            <div key={c.id} style={{ padding: "10px 14px", background: C.bg, borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{c.authorName || "Anonymous"}</span>
                <span style={{ fontSize: 11, color: C.subtle }}>{fmtDate(c.createdAt)}</span>
              </div>
              <p style={{ fontSize: 13, color: C.text, margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.body}</p>
            </div>
          ))}
        </div>

        <div>
          <textarea
            value={commentBody} onChange={e => setCommentBody(e.target.value)}
            rows={3} placeholder="Add a comment…"
            style={{ width: "100%", padding: "9px 11px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
          />
          <button onClick={postComment} disabled={submitting || !commentBody.trim()}
            style={{ marginTop: 8, padding: "8px 18px", background: commentBody.trim() && !submitting ? C.blue : C.border, border: "none", borderRadius: 8, color: commentBody.trim() && !submitting ? "#fff" : C.muted, fontSize: 13, fontWeight: 700, cursor: commentBody.trim() ? "pointer" : "not-allowed" }}>
            {submitting ? "Posting…" : "Post Comment"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Tickets Component ────────────────────────────────────────────────────
export default function Tickets({ workspaceId, session: sessionProp, onNavigate }: { workspaceId?: string; session?: any; onNavigate?: (tab: string) => void }) {
  const { data: sessionData } = useSession();
  const session = sessionProp ?? sessionData;
  const wsId = workspaceId ?? getWorkspaceId();

  const [tickets,   setTickets]   = useState<Ticket[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [users,     setUsers]     = useState<any[]>([]);
  const [selected,  setSelected]  = useState<Ticket | null>(null);
  const [showNew,   setShowNew]   = useState(false);
  const [statusFilter,   setStatusFilter]   = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const load = useCallback(async () => {
    if (!wsId) return;
    setLoading(true); setError("");
    try {
      const [tRes, uRes] = await Promise.all([
        fetch(`/api/tickets?workspaceId=${wsId}`),
        fetch(`/api/users?workspaceId=${wsId}`),
      ]);
      if (tRes.ok) setTickets(await tRes.json());
      if (uRes.ok) setUsers(await uRes.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [wsId]);

  useEffect(() => { load(); }, [load]);

  const filtered = tickets.filter(t => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    return true;
  });

  const addTicket  = (t: Ticket) => setTickets(prev => [t, ...prev]);
  const updateTicket = (t: Ticket) => {
    setTickets(prev => prev.map(x => x.id === t.id ? t : x));
    setSelected(t);
  };

  const filterBtn = (label: string, val: string, current: string, set: (v: string) => void) => (
    <button key={val} onClick={() => set(val)}
      style={{ padding: "5px 12px", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
        background: current === val ? C.blue : C.bg, color: current === val ? "#fff" : C.muted }}>
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", gap: 0, height: "100%", minHeight: 600 }}>
      {/* ── Left: ticket list ── */}
      <div style={{ width: selected ? 380 : "100%", flexShrink: 0, display: "flex", flexDirection: "column", borderRight: selected ? `1px solid ${C.border}` : "none", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, background: C.surface }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: C.text }}>🎫 Tickets</div>
            <button onClick={() => setShowNew(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: C.blue, border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              <Plus size={13} /> New Ticket
            </button>
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
            {[["All","all"],["Open","open"],["In Progress","in_progress"],["Resolved","resolved"]].map(([l,v]) =>
              filterBtn(l, v, statusFilter, setStatusFilter)
            )}
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {[["All Priority","all"],["Urgent","urgent"],["High","high"],["Medium","medium"],["Low","low"]].map(([l,v]) =>
              filterBtn(l, v, priorityFilter, setPriorityFilter)
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 24, color: C.muted, fontSize: 13 }}>Loading tickets…</div>
          ) : error ? (
            <div style={{ color: C.red, fontSize: 13, padding: 16 }}>{error}</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 24px", color: C.subtle, fontSize: 13 }}>
              No tickets found. {tickets.length > 0 ? "Try adjusting filters." : "Create your first ticket above."}
            </div>
          ) : (
            filtered.map(t => {
              const p  = PRIORITY_CFG[t.priority] ?? PRIORITY_CFG.medium;
              const st = STATUS_CFG[t.status]     ?? STATUS_CFG.open;
              const active = selected?.id === t.id;
              return (
                <div key={t.id} onClick={() => setSelected(t)}
                  style={{ padding: "12px 14px", borderRadius: 12, border: `1px solid ${active ? C.blueBorder : C.border}`,
                    background: active ? C.blueBg : C.surface, marginBottom: 8, cursor: "pointer",
                    borderLeft: `3px solid ${p.color}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>{t.ticketNumber}</div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Badge label={p.label}  color={p.color}  bg={p.bg}  border={p.border} />
                      <Badge label={st.label} color={st.color} bg={st.bg} border={st.border} />
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>{t.title}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted }}>
                    <span>{t.assignedName ? `→ ${t.assignedName}` : "Unassigned"}</span>
                    <span>{fmtDate(t.createdAt)}</span>
                  </div>
                  {t.linkedLabel && (
                    <div style={{ fontSize: 11, color: C.blue, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                      <Tag size={10} /> <span style={{ color: C.blue, cursor: "pointer", textDecoration: "underline" }} onClick={() => { if (t.linkedType === "inventory") onNavigate?.("inventory"); else if (t.linkedType === "customer") onNavigate?.("customers"); else if (t.linkedType === "order") onNavigate?.("orders"); }}>{t.linkedLabel}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right: ticket detail ── */}
      {selected && (
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", background: C.bg }}>
          <TicketDetail
            ticket={selected} users={users} session={session}
            onUpdate={updateTicket}
            onBack={() => setSelected(null)}
          />
        </div>
      )}

      {showNew && (
        <NewTicketModal users={users} session={session} onSave={addTicket} onClose={() => setShowNew(false)} />
      )}
    </div>
  );
}
