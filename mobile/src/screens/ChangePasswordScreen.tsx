// mobile/src/screens/ChangePasswordScreen.tsx
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import { theme } from "../lib/theme";
import { changePassword, getSession } from "../lib/api";

interface Props { onBack: () => void }

export default function ChangePasswordScreen({ onBack }: Props) {
  const [current, setCurrent]   = useState("");
  const [next,    setNext]      = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState("");
  const [success, setSuccess]   = useState(false);

  const submit = async () => {
    setError(""); setSuccess(false);
    if (!current || !next || !confirm) { setError("All fields are required."); return; }
    if (next !== confirm) { setError("New passwords do not match."); return; }
    if (next.length < 6)  { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const { userId } = await getSession();
      if (!userId) { setError("Could not identify your account. Please log in again."); return; }
      await changePassword(userId, current, next);
      setSuccess(true);
      setCurrent(""); setNext(""); setConfirm("");
      Alert.alert("Success", "Your password has been updated.", [{ text: "OK", onPress: onBack }]);
    } catch (e: any) {
      setError(e.message ?? "Failed to update password.");
    } finally { setLoading(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 20 }}>
      <TouchableOpacity onPress={onBack} style={{ marginBottom: 20 }}>
        <Text style={{ color: theme.blue, fontWeight: "700", fontSize: 14 }}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Change Password</Text>
      {["Current Password", "New Password", "Confirm New Password"].map((label, i) => (
        <View key={i} style={{ marginBottom: 14 }}>
          <Text style={styles.label}>{label.toUpperCase()}</Text>
          <TextInput
            secureTextEntry
            value={[current, next, confirm][i]}
            onChangeText={[setCurrent, setNext, setConfirm][i]}
            placeholder={label}
            placeholderTextColor={theme.subtle}
            style={styles.input}
          />
        </View>
      ))}
      {error   ? <Text style={{ color: theme.red,   fontSize: 13, marginBottom: 12 }}>{error}</Text>   : null}
      {success ? <Text style={{ color: theme.green, fontSize: 13, marginBottom: 12 }}>✓ Password updated!</Text> : null}
      <TouchableOpacity onPress={submit} disabled={loading}
        style={[styles.btn, loading && { opacity: 0.6 }]}>
        <Text style={styles.btnText}>{loading ? "Updating…" : "Update Password"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title:   { fontSize: 22, fontWeight: "800", color: theme.text, marginBottom: 24 },
  label:   { fontSize: 11, fontWeight: "600", color: theme.muted, marginBottom: 6, letterSpacing: 0.5 },
  input:   { borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 12, fontSize: 14, color: theme.text, backgroundColor: theme.surface },
  btn:     { backgroundColor: theme.blue, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 8 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
