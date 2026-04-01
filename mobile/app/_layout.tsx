// mobile/app/_layout.tsx
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, Platform } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { theme } from "../src/lib/theme";

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Set up push notification tap handler — native only
    let cleanup: (() => void) | undefined;
    if (Platform.OS !== "web") {
      import("expo-notifications").then(Notifications => {
        const sub = Notifications.addNotificationResponseReceivedListener(response => {
          console.log("Notification tapped:", response.notification.request.content);
        });
        cleanup = () => sub.remove();
      }).catch(() => {});
    }
    setReady(true);
    return () => { if (cleanup) cleanup(); };
  }, []);

  if (!ready) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg }}>
      <ActivityIndicator size="large" color={theme.blue} />
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
