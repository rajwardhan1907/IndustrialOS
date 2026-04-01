// mobile/app/index.tsx — Auth gate: shows login or main tabs
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { getSession } from "../src/lib/api";
import { theme } from "../src/lib/theme";
import LoginScreen from "../src/screens/LoginScreen";

export default function Index() {
  const router   = useRouter();
  const [checking, setChecking] = useState(true);
  const [authed,   setAuthed]   = useState(false);

  useEffect(() => {
    getSession().then(({ token, workspaceId }) => {
      if (token && workspaceId) {
        setAuthed(true);
        router.replace("/(tabs)");
      } else {
        setAuthed(false);
      }
      setChecking(false);
    });
  }, []);

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
