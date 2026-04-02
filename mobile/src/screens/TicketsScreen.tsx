// mobile/src/screens/TicketsScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput, Platform,
} from "react-native";
import { theme, s } from "../lib/theme";
import { fetchTickets, createTicket, postTicketComment, getSession } from "../lib/api";

interface Comment { id: string; authorName: string; body: string; createdAt: string; }
interface Ticket {
  id: string; ticketNumber: string; title: string; description: string;
  type: string; priority: string; status: string;
  assignedName: string; raisedName: string; comments: Comment[];
  createdAt: string;
}

function priorityColor(p: string) {
  if (p === "urgent") return { color: theme.red,   bg: theme.redBg,   border: theme.redBorder   };
  if (p === "high")   return { color: theme.amber, bg: theme.amberBg, border: theme.amberBorder };
  if (p === "low")    return { color: theme.muted, bg: theme.bg,      border: theme.border      };
  return                     { color: theme.blue,  bg: theme.blueBg,  border: theme.blueBorder  };
}
function statusColor(s: string) {
  if (s === "open")        return { color: theme.blue,  bg: theme.blueBg,   border: theme.blueBorder  };
  if (s === "in_progress") return { color: theme.amber, bg: theme.amberBg,  border: theme.amberBorder };
  if (s === "resolved")    return { color: theme.green, bg: theme.greenBg,  border: theme.greenBorder };
  return                          { color: theme.muted, bg: theme.bg,       border: theme.border      };
}

export default function TicketsScreen() {
  const [tickets,    setTickets]    = useState<Ticket[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected,   setSelected]   = useState<Ticket | null>(null);
  const [showNew,    setShowNew]    = useState(false);
  const [newTitle,   setNewTitle]   = useState("");
  const [newDesc,    setNewDesc]    = useState("");
  const [newType,    setNewType]    = useState("issue");
  const [newPri,     setNewPri]     = useState("medium");
  const [creating,   setCreating]   = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [posting,    setPosting]    = useState(false);
  const [session,    setSession]    = useState<any>({});

  useEffect(() => { getSession().then(setSession); }, []);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) return;
      const data = await fetchTickets(workspaceId);
      setTickets(Array.isArray(data) ? data : []);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submitNew = async () => {
    if (!newTitle.trim()) { Alert.alert("Required", "Title is required."); return; }
    setCreating(true);
    try {
      const { workspaceId, userId, name } = await getSession();
      if (!workspaceId) return;
      const t = await createTicket({
        workspaceId, title: newTitle.trim(), description: newDesc,
        type: newType, priority: newPri,
        raisedBy: userId ?? "", raisedName: name ?? "",
      });
      setTickets(prev => [t, ...prev]);
      setShowNew(false); setNewTitle(""); setNewDesc(""); setNewType("issue"); setNewPri("medium");
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setCreating(false); }
  };

  const submitComment = async () => {
    if (!commentBody.trim() || !selected) return;
    setPosting(true);
    try {
      const { userId, name } = await getSession();
      const c = await postTicketComment(selected.id, userId ?? "", name ?? "Anonymous", commentBody.trim());
      setSelected(prev => prev ? { ...prev, comments: [...(prev.comments ?? []), c] } : prev);
      setCommentBody("");
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setPosting(false); }
  };

  if (loading) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg }}><ActivityIndicator size="large" color={theme.blue} /></View>;

  // ── Detail view ──
  if (selected) {
    const p = priorityColor(selected.priority);
    const st = statusColor(selected.status);
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 16, paddingBottom: 0 }}>
          <Text style={{ color: theme.blue, fontWeight: "700", fontSize: 14 }}>← All Tickets</Text>
        </TouchableOpacity>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={s.card}>
            <Text style={{ fontSize: 11, color: theme.muted, fontWeight: "700", marginBottom: 4 }}>{selected.ticketNumber}</Text>
            <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text, marginBottom: 10 }}>{selected.title}</Text>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              <View style={s.badge(p.bg, p.color, p.border)}><Text style={s.badgeText(p.color)}>{selected.priority.toUpperCase()}</Text></View>
              <View style={s.badge(st.bg, st.color, st.border)}><Text style={s.badgeText(st.color)}>{selected.status.replace("_"," ").toUpperCase()}</Text></View>
            </View>
            {selected.description ? <Text style={{ fontSize: 13, color: theme.text, lineHeight: 20, marginBottom: 10 }}>{selected.description}</Text> : null}
            <Text style={{ fontSize: 12, color: theme.muted }}>
              {selected.assignedName ? `Assigned to: ${selected.assignedName}` : "Unassigned"} · {new Date(selected.createdAt).toLocaleDateString()}
            </Text>
          </View>

          <Text style={[s.heading, { marginBottom: 10 }]}>Comments ({(selected.comments ?? []).length})</Text>
          {(selected.comments ?? []).map(c => (
            <View key={c.id} style={[s.card, { marginBottom: 8 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: theme.text }}>{c.authorName}</Text>
                <Text style={{ fontSize: 11, color: theme.subtle }}>{new Date(c.createdAt).toLocaleDateString()}</Text>
              </View>
              <Text style={{ fontSize: 13, color: theme.text, lineHeight: 20 }}>{c.body}</Text>
            </View>
          ))}

          <View style={[s.card, { marginTop: 8 }]}>
            <Text style={[s.label, { marginBottom: 8 }]}>ADD COMMENT</Text>
            <TextInput
              value={commentBody} onChangeText={setCommentBody}
              placeholder="Write a comment…" placeholderTextColor={theme.subtle}
              multiline numberOfLines={3}
              style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 10, color: theme.text, fontSize: 13, minHeight: 80, marginBottom: 10 }}
            />
            <TouchableOpacity onPress={submitComment} disabled={posting || !commentBody.trim()}
              style={{ backgroundColor: theme.blue, borderRadius: 8, padding: 12, alignItems: "center", opacity: posting ? 0.6 : 1 }}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>{posting ? "Posting…" : "Post Comment"}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── List view ──
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.blue} />}
      >
        <Text style={[s.heading, { marginBottom: 16 }]}>Tickets</Text>
        {tickets.length === 0 ? (
          <View style={[s.card, { alignItems: "center", padding: 32 }]}>
            <Text style={{ color: theme.muted, fontSize: 13 }}>No tickets yet. Tap + to create one.</Text>
          </View>
        ) : tickets.map(t => {
          const p = priorityColor(t.priority);
          const st = statusColor(t.status);
          return (
            <TouchableOpacity key={t.id} style={[s.card, { borderLeftWidth: 3, borderLeftColor: p.color }]} onPress={() => setSelected(t)} activeOpacity={0.85}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <Text style={{ fontSize: 11, color: theme.muted, fontWeight: "700" }}>{t.ticketNumber}</Text>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <View style={s.badge(p.bg, p.color, p.border)}><Text style={s.badgeText(p.color)}>{t.priority.toUpperCase()}</Text></View>
                  <View style={s.badge(st.bg, st.color, st.border)}><Text style={s.badgeText(st.color)}>{t.status.replace("_"," ").toUpperCase()}</Text></View>
                </View>
              </View>
              <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text, marginBottom: 4 }}>{t.title}</Text>
              <Text style={{ fontSize: 12, color: theme.muted }}>{t.assignedName ? `→ ${t.assignedName}` : "Unassigned"} · {t.comments?.length ?? 0} comments</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity onPress={() => setShowNew(true)} style={styles.fab}>
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "300" }}>+</Text>
      </TouchableOpacity>

      {/* New Ticket Modal */}
      <Modal visible={showNew} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text, marginBottom: 20 }}>New Ticket</Text>
            <Text style={s.label}>TITLE *</Text>
            <TextInput value={newTitle} onChangeText={setNewTitle} placeholder="Describe the issue" placeholderTextColor={theme.subtle}
              style={styles.input} />
            <Text style={[s.label, { marginTop: 12 }]}>DESCRIPTION</Text>
            <TextInput value={newDesc} onChangeText={setNewDesc} placeholder="More details…" placeholderTextColor={theme.subtle}
              multiline numberOfLines={3} style={[styles.input, { minHeight: 70 }]} />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>TYPE</Text>
                <View style={styles.picker}>
                  {["issue","request","alert","other"].map(t => (
                    <TouchableOpacity key={t} onPress={() => setNewType(t)}
                      style={[styles.chip, newType === t && styles.chipActive]}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: newType === t ? "#fff" : theme.muted }}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>PRIORITY</Text>
                <View style={styles.picker}>
                  {["low","medium","high","urgent"].map(p => (
                    <TouchableOpacity key={p} onPress={() => setNewPri(p)}
                      style={[styles.chip, newPri === p && styles.chipActive]}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: newPri === p ? "#fff" : theme.muted }}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
              <TouchableOpacity onPress={() => setShowNew(false)} style={[styles.btn, { flex: 1, backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.border }]}>
                <Text style={{ color: theme.muted, fontWeight: "700" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={submitNew} disabled={creating} style={[styles.btn, { flex: 2, backgroundColor: theme.blue, opacity: creating ? 0.6 : 1 }]}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>{creating ? "Creating…" : "Create Ticket"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fab:       { position: "absolute", bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.blue, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 6 },
  input:     { borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 10, color: theme.text, fontSize: 13, backgroundColor: theme.surface, marginBottom: 4 },
  picker:    { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  chip:      { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.border },
  chipActive:{ backgroundColor: theme.blue, borderColor: theme.blue },
  btn:       { padding: 14, borderRadius: 10, alignItems: "center" },
});
