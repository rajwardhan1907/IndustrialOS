import { Platform } from "react-native";
import { BASE_URL } from "./api";

let Notifications: any = null, Device: any = null, Constants: any = null;

async function loadNativeModules(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (Notifications) return true;
  try {
    Notifications = await import("expo-notifications");
    Device = await import("expo-device");
    Constants = (await import("expo-constants")).default;
    Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }) });
    return true;
  } catch { return false; }
}
