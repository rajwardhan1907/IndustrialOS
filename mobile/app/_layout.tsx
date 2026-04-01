// mobile/app/_layout.tsx — Root layout with auth gate
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { getSession } from "../src/lib/api";
import { theme } from "../src/lib/theme";
import * as Notifications from "expo-notifications";

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Set up notification response handler (tapped while app closed)
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      console.log("Notification tapped:", response.notification.request.content);
    });
    setReady(true);
    return () => sub.remove();
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
