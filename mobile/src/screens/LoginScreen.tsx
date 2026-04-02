// mobile/src/screens/LoginScreen.tsx
import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import { theme } from "../lib/theme";
import { login, storeSession } from "../lib/api";
import { registerForPushNotifications, syncPushToken } from "../lib/notifications";

interface Props {
  onLogin: () => void;
}

export default function LoginScreen({ onLogin }: Props) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await login(email.trim().toLowerCase(), password);
      // res: { token, workspaceId, role, userId, email, name }
      await storeSession(res.token, res.workspaceId, res.role, res.userId ?? "", res.email, res.name);

      // Register for push notifications
      const pushToken = await registerForPushNotifications();
      if (pushToken) await syncPushToken(pushToken, res.workspaceId, res.token);

      onLogin();
    } catch (e: any) {
      Alert.alert("Login failed", e.message ?? "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.card}>
        <Text style={styles.logo}>⚡ IndustrialOS</Text>
        <Text style={styles.subtitle}>Warehouse & B2B Operations</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          placeholder="you@company.com"
          placeholderTextColor={theme.subtle}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor={theme.subtle}
        />

        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Sign In</Text>
          }
        </TouchableOpacity>

        <Text style={styles.hint}>Use the same email and password you set up on the web dashboard.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: theme.bg, justifyContent: "center", padding: 24 },
  card:     { backgroundColor: theme.surface, borderRadius: 18, padding: 28, shadowColor: "#000", shadowOpacity: 0.1, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 4 },
  logo:     { fontSize: 26, fontWeight: "800", color: theme.blue, textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 13, color: theme.muted, textAlign: "center", marginBottom: 28 },
  label:    { fontSize: 11, fontWeight: "600", color: theme.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  input:    { borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 12, fontSize: 14, color: theme.text, backgroundColor: theme.bg, marginBottom: 16 },
  btn:      { backgroundColor: theme.blue, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 8 },
  btnText:  { color: "#fff", fontWeight: "700", fontSize: 15 },
  hint:     { fontSize: 11, color: theme.subtle, textAlign: "center", marginTop: 20, lineHeight: 16 },
});
