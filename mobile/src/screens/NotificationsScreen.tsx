// mobile/src/screens/NotificationsScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from "react-native";
import { theme, s } from "../lib/theme";
import { fetchNotifications, markNotificationRead, getSession } from "../lib/api";
import { SessionExpiredView } from "../lib/sessionGuard";

interface Notification {
  id: string; title: string; body: string; type: string; severity?: string;
  read: boolean; createdAt: string;
}

function notifColor(n: Notification) {
  const level = n.severity ?? n.type;
  if (level === "critical" || level === "error") return { color: theme.red,   bg: theme.redBg,   border: theme.redBorder };
  if (level === "warning"  || level === "warn")  return { color: theme.amber, bg: theme.amberBg, border: theme.amberBorder };
  return                                                { color: theme.blue,  bg: theme.blueBg,  border: theme.blueBorder };
}

export default function NotificationsScreen() {
  const [notifs,     setNotifs]     = useState<Notification[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const { workspaceId } = await getSession();
      if (!workspaceId) { setSessionExpired(true); return; }
      const data = await fetchNotifications(workspaceId);
      setNotifs(Array.isArray(data) ? data : (data.notifications ?? []));
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (sessionExpired) return <SessionExpiredView />;

  const markRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (e: any) {
      Alert.alert("Error", `Failed to mark notification as read: ${e.message}`);
    }
  };

  const unreadCount = notifs.filter(n => !n.read).length;

  if (loading) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg }}>
      <ActivityIndicator size="large" color={theme.blue} />
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.blue} />}
    >
      <Text style={styles.heading}>Notifications</Text>
      {unreadCount > 0 && (
        <Text style={styles.unread}>{unreadCount} unread</Text>
      )}

      {notifs.length === 0 && (
        <View style={[s.card, { backgroundColor: theme.greenBg, borderWidth: 1, borderColor: theme.greenBorder, marginTop: 20 }]}>
          <Text style={{ color: theme.green, fontWeight: "700", fontSize: 13 }}>✓ No notifications — you're all caught up!</Text>
        </View>
      )}

      {notifs.map(n => {
        const c = notifColor(n);
        return (
          <TouchableOpacity
            key={n.id}
            style={[s.card, !n.read && { borderLeftWidth: 3, borderLeftColor: c.color }]}
            onPress={() => !n.read && markRead(n.id)}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <Text style={{ fontWeight: n.read ? "600" : "800", fontSize: 14, color: theme.text, flex: 1 }}>{n.title}</Text>
              {!n.read && (
                <View style={[s.badge(c.bg, c.color, c.border), { marginLeft: 8 }]}>
                  <Text style={s.badgeText(c.color)}>New</Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 13, color: theme.muted, marginTop: 4, lineHeight: 18 }}>{n.body}</Text>
            <Text style={{ fontSize: 11, color: theme.subtle, marginTop: 6 }}>
              {new Date(n.createdAt).toLocaleString()}
              {!n.read && "  · Tap to mark read"}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 22, fontWeight: "800", color: theme.text, marginBottom: 2 },
  unread:  { fontSize: 13, color: theme.blue, fontWeight: "600", marginBottom: 16 },
});
