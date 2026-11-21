// Live match alerts: signs this phone up with the Skippr server, which then
// sends push notifications while matches are played (see supabase/).
//
// The server gets only the phone's Expo push token, the FPL team ID and the
// on/off choices. Never the password or the FPL sign-in.
//
// Everything here is best effort and silent: with no connection, no
// permission, no push support (no Firebase setup yet) or no server key, live
// alerts just stay off and nothing else is affected.
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { LIVE_ALERTS_KEY, LIVE_ALERTS_URL } from "./appInfo";
import { anyLiveEnabled } from "./notifications";
import type { NotificationSettings, PermissionState } from "./notifications";

// The token this phone last registered, so it can be removed on log out.
const STORAGE_TOKEN = "profpl_live_alerts_token";

// Live alerts can work in this build (the server key is filled in).
export const liveAlertsAvailable = LIVE_ALERTS_KEY.length > 0;

async function post(body: Record<string, unknown>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(LIVE_ALERTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: LIVE_ALERTS_KEY },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return response.ok;
  } finally {
    clearTimeout(timer);
  }
}

async function pushToken() {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const result = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  return result.data;
}

// Brings the server in line with this phone: signed up with the current team
// and choices when live alerts are on and allowed, removed otherwise.
export async function syncLiveAlerts(
  entry: number,
  settings: NotificationSettings,
  permission: PermissionState,
) {
  if (!liveAlertsAvailable) return;
  try {
    if (permission !== "granted" || !anyLiveEnabled(settings)) {
      await stopLiveAlerts();
      return;
    }
    const token = await pushToken();
    const ok = await post({
      token,
      entry,
      platform: Platform.OS === "ios" ? "ios" : "android",
      settings: {
        started: settings.liveStarted,
        goals: settings.liveGoals,
        cards: settings.liveCards,
        fulltime: settings.liveFulltime,
        bench: settings.liveBench,
      },
    });
    if (ok) await AsyncStorage.setItem(STORAGE_TOKEN, token);
  } catch {
    // Offline, or push not set up in this build: try again next time.
  }
}

// Stops live alerts for this phone (log out, or every live switch turned off).
export async function stopLiveAlerts() {
  if (!liveAlertsAvailable) return;
  try {
    const token = await AsyncStorage.getItem(STORAGE_TOKEN);
    if (!token) return;
    if (await post({ token, remove: true })) await AsyncStorage.removeItem(STORAGE_TOKEN);
  } catch {
    // Kept, and tried again on the next sign-in or log out.
  }
}
