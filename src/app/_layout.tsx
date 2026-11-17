// Defines the background news task before anything renders (required for
// background launches).
import "../backgroundTasks";
import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
