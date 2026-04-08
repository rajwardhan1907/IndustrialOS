// mobile/src/lib/sessionGuard.tsx
// Shared session-expired UI component for all screens.
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { clearSession } from "./api";
import { theme } from "./theme";

export function SessionExpiredView() {
  const router = useRouter();
  const handleReLogin = async () => {
    await clearSession();
    router.replace("/");
  };
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg, padding: 32 }}>
      <Text style={{ fontSize: 36, marginBottom: 16 }}>🔒</Text>
      <Text style={{ fontSize: 17, fontWeight: "800", color: theme.text, marginBottom: 8, textAlign: "center" }}>
        Session expired
      </Text>
      <Text style={{ fontSize: 13, color: theme.muted, textAlign: "center", marginBottom: 24, lineHeight: 1.5 }}>
        Please log in again to continue.
      </Text>
      <TouchableOpacity
        onPress={handleReLogin}
        style={{ backgroundColor: theme.blue, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 28 }}
      >
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Log In Again</Text>
      </TouchableOpacity>
    </View>
  );
}
