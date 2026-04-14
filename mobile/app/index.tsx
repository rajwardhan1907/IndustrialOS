// mobile/app/index.tsx — Auth gate: shows login or main tabs
// Re-checks session every time this screen is focused, so logout properly
// returns the user to the login screen.
import React, { useCallback, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { getSession } from "../src/lib/api";
import { theme } from "../src/lib/theme";
import LoginScreen from "../src/screens/LoginScreen";

export default function Index() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setChecking(true);
      getSession().then(({ token, workspaceId }) => {
        if (cancelled) return;
        if (token && workspaceId) {
          setAuthed(true);
          setChecking(false);
          router.replace("/(tabs)");
        } else {
          setAuthed(false);
          setChecking(false);
        }
      });
      return () => { cancelled = true; };
    }, [])
  );

  if (checking) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg }}>
      <ActivityIndicator size="large" color={theme.blue} />
    </View>
  );

  if (!authed) return (
    <LoginScreen onLogin={() => { setAuthed(true); router.replace("/(tabs)"); }} />
  );

  return null;
}
