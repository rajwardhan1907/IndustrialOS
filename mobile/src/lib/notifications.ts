// mobile/src/lib/notifications.ts
// Push notification setup using Expo Notifications
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { BASE_URL } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("Push notifications only work on physical devices.");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push notification permission denied.");
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("default", {
      name:          "default",
      importance:    Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:    "#2C4A8F",
    });
  }

  return token;
}

// Called after login — registers the push token with the server
export async function syncPushToken(token: string, workspaceId: string, authToken: string) {
  try {
    await fetch(`${BASE_URL}/api/notifications/push-token`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body:    JSON.stringify({ token, workspaceId }),
    });
  } catch (e) {
    console.log("Failed to sync push token:", e);
  }
}

// Listen for incoming push notifications while app is foregrounded
export function usePushNotifications(onReceive: (n: Notifications.Notification) => void) {
  Notifications.addNotificationReceivedListener(onReceive);
}
