import { useRouter } from "expo-router";
import ProfileScreen from "../../src/screens/ProfileScreen";

export default function ProfileTab() {
  const router = useRouter();
  return <ProfileScreen onLogout={() => router.replace("/")} />;
}
