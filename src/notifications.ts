// Deadline reminders and squad news alerts.
//
// Everything here works on the phone alone, with no server:
// - Deadline reminders are scheduled locally for the next few gameweeks
//   (24 hours and 1 hour before each deadline), and rescheduled whenever FPL's
//   deadlines are read again.
// - News alerts compare FPL's injury/suspension data for your squad with what
//   was seen last time, and notify about changes. This runs when the app opens
//   or returns to the foreground, and in a periodic background task (see
//   backgroundTasks.ts), which the OS runs roughly every hour or more.
import AsyncStorage from "@react-native-async-storage/async-storage";
// The enums used below (AndroidImportance, IosAuthorizationStatus) are exported
// through `export *`, which eslint-plugin-import cannot follow here.
/* eslint-disable import/namespace */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { availability } from "./availability";

// Shared with the app screen, which caches the last loaded squad here.
export const STORAGE_SQUAD = "profpl_cached_squad";
const STORAGE_SETTINGS = "profpl_notification_settings";
const STORAGE_NEWS_SNAPSHOT = "profpl_news_snapshot";

const CHANNEL_DEADLINES = "deadlines";
const CHANNEL_NEWS = "news";
const CHANNEL_LIVE = "live";
const DEADLINE_PREFIX = "deadline-";
// Deadlines scheduled ahead; iOS allows 64 pending notifications in total.
const DEADLINES_AHEAD = 4;

export type NotificationSettings = {
  deadline24h: boolean;
  deadline1h: boolean;
  news: boolean;
  // Live match alerts, sent by the Skippr server (see liveAlerts.ts and
  // supabase/): a player starts; goals and assists; cards; full time; and
  // whether bench players count too.
  liveStarted: boolean;
  liveGoals: boolean;
  liveCards: boolean;
  liveFulltime: boolean;
  liveBench: boolean;
};

export const DEFAULT_SETTINGS: NotificationSettings = {
  deadline24h: true,
  deadline1h: true,
  news: true,
  liveStarted: true,
  liveGoals: true,
  liveCards: true,
  liveFulltime: true,
  liveBench: false,
};

// Any live alert on (the bench switch alone doesn't count: it only widens
// the others).
export const anyLiveEnabled = (settings: NotificationSettings) =>
  settings.liveStarted || settings.liveGoals || settings.liveCards || settings.liveFulltime;

// Any alert the phone produces itself (deadlines, squad news): decides
// whether the background check runs. Live alerts come from the server and
// don't need it.
export const anyEnabled = (settings: NotificationSettings) =>
  settings.deadline24h || settings.deadline1h || settings.news;

// Notifications that arrive while the app is open still show as a banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function loadSettings(): Promise<NotificationSettings> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_SETTINGS);
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {}
  return DEFAULT_SETTINGS;
}

export async function saveSettings(settings: NotificationSettings) {
  await AsyncStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings)).catch(() => {});
}

// Android needs its channels before it will even ask for permission.
async function ensureChannels() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_DEADLINES, {
    name: "Deadline reminders",
    description: "Reminders before each gameweek deadline",
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: "#00d982",
  });
  await Notifications.setNotificationChannelAsync(CHANNEL_NEWS, {
    name: "Squad news",
    description: "Injury, suspension and availability news about your players",
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: "#00d982",
  });
  // The server sends live alerts on this channel (channelId "live").
  await Notifications.setNotificationChannelAsync(CHANNEL_LIVE, {
    name: "Live match alerts",
    description: "Your players starting, scoring, getting booked, and full-time scores",
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: "#00d982",
  });
}

export type PermissionState = "granted" | "denied" | "undetermined";

function readPermission(result: Notifications.NotificationPermissionsStatus): PermissionState {
  if (Platform.OS === "ios") {
    const status = result.ios?.status;
    if (
      status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
      status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
      status === Notifications.IosAuthorizationStatus.EPHEMERAL
    ) {
      return "granted";
    }
    return status === Notifications.IosAuthorizationStatus.NOT_DETERMINED ? "undetermined" : "denied";
  }
  if (result.granted) return "granted";
  return result.canAskAgain ? "undetermined" : "denied";
}

export async function getPermission(): Promise<PermissionState> {
  try {
    return readPermission(await Notifications.getPermissionsAsync());
  } catch {
    return "denied";
  }
}

// Asks for permission if it hasn't been decided yet.
export async function requestPermission(): Promise<PermissionState> {
  try {
    await ensureChannels();
    const current = readPermission(await Notifications.getPermissionsAsync());
    if (current !== "undetermined") return current;
    return readPermission(await Notifications.requestPermissionsAsync());
  } catch {
    return "denied";
  }
}

// --- Deadline reminders -------------------------------------------------------

type FplEvent = { id: number; name?: string; deadline_time?: string | null; finished?: boolean };

type CachedSquad = {
  picks?: { id: number; name: string; pos: number }[];
};

async function readSquad(): Promise<CachedSquad | null> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_SQUAD);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export async function cancelDeadlineReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(
    scheduled
      .filter((request) => request.identifier.startsWith(DEADLINE_PREFIX))
      .map((request) =>
        Notifications.cancelScheduledNotificationAsync(request.identifier).catch(() => {}),
      ),
  );
}

// Replaces the scheduled reminders with ones for the next few deadlines.
// `flagged` lists starters with an injury or doubt, mentioned in the reminder.
export async function scheduleDeadlineReminders(
  events: FplEvent[],
  settings: NotificationSettings,
  flagged: string[] = [],
) {
  await cancelDeadlineReminders();
  if (!settings.deadline24h && !settings.deadline1h) return;
  if ((await getPermission()) !== "granted") return;
  await ensureChannels();

  const now = Date.now();
  const upcoming = events
    .filter((event) => event.deadline_time && Date.parse(event.deadline_time) > now)
    .sort((a, b) => Date.parse(a.deadline_time!) - Date.parse(b.deadline_time!))
    .slice(0, DEADLINES_AHEAD);

  const squadNote =
    flagged.length === 0
      ? "Check your team and captain before it locks."
      : flagged.length === 1
        ? `${flagged[0]} is flagged in your starting eleven.`
        : `${flagged.length} of your starters are flagged: ${flagged.slice(0, 3).join(", ")}${
            flagged.length > 3 ? "…" : ""
          }.`;

  for (const event of upcoming) {
    const deadline = Date.parse(event.deadline_time!);
    const name = event.name || `Gameweek ${event.id}`;
    const reminders = [
      settings.deadline24h && {
        key: "24h",
        at: deadline - 24 * 60 * 60_000,
        title: `${name} deadline in 24 hours`,
      },
      settings.deadline1h && {
        key: "1h",
        at: deadline - 60 * 60_000,
        title: `${name} deadline in 1 hour`,
      },
    ].filter((reminder): reminder is { key: string; at: number; title: string } => !!reminder);

    for (const reminder of reminders) {
      // Too late for this one (e.g. the app opened 30 minutes before).
      if (reminder.at <= now + 60_000) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: `${DEADLINE_PREFIX}${event.id}-${reminder.key}`,
        content: {
          title: reminder.title,
          // Squad news can change by then; it is refreshed on every reschedule.
          body: event === upcoming[0] ? squadNote : "Check your team and captain before it locks.",
          data: { kind: "deadline", event: event.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminder.at,
          channelId: CHANNEL_DEADLINES,
        },
      }).catch(() => {});
    }
  }
}

// --- Squad news -----------------------------------------------------------------

type ElementNews = {
  id: number;
  web_name: string;
  status: string;
  chance_of_playing_next_round: number | null;
  news: string;
};

type Snapshot = Record<number, { status: string; chance: number | null; news: string }>;

export type NewsChange = { name: string; text: string; recovered: boolean };

// Compares FPL's current data for the squad with the last snapshot. A player
// seen for the first time (new signing, first run) is recorded silently.
export function diffNews(
  squadIds: number[],
  elements: Map<number, ElementNews>,
  previous: Snapshot,
): { changes: NewsChange[]; next: Snapshot } {
  const next: Snapshot = {};
  const changes: NewsChange[] = [];
  squadIds.forEach((id) => {
    const element = elements.get(id);
    if (!element) return;
    const current = {
      status: element.status,
      chance: element.chance_of_playing_next_round ?? null,
      news: element.news || "",
    };
    next[id] = current;
    const before = previous[id];
    if (!before) return;
    const changed =
      before.status !== current.status ||
      before.chance !== current.chance ||
      before.news !== current.news;
    if (!changed) return;

    const flag = availability(current.status, current.chance);
    const wasFlagged = !!availability(before.status, before.chance);
    if (!flag && wasFlagged) {
      changes.push({ name: element.web_name, text: "is available again", recovered: true });
    } else if (flag) {
      changes.push({
        name: element.web_name,
        text: current.news ? current.news : flag.label.toLowerCase(),
        recovered: false,
      });
    }
    // An available player whose news text merely changed is not worth a ping.
  });
  return { changes, next };
}

// Reads FPL's player data and notifies about squad news since the last check.
// Also refreshes the deadline reminders while it has the data. Safe to call
// often: it only notifies about changes.
export async function checkSquadNews(options: { notify?: boolean } = {}) {
  const settings = await loadSettings();
  const squad = await readSquad();
  const picks = squad?.picks ?? [];
  if (picks.length === 0) return;

  const response = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/");
  if (!response.ok) throw new Error(`FPL returned ${response.status}`);
  const json = await response.json();
  const elements = new Map<number, ElementNews>(
    (json.elements ?? []).map((element: ElementNews) => [element.id, element]),
  );

  // Starters with a flag, for the deadline reminder text.
  const flagged = picks
    .filter((pick) => pick.pos <= 11)
    .filter((pick) => {
      const element = elements.get(pick.id);
      return element && availability(element.status, element.chance_of_playing_next_round);
    })
    .map((pick) => elements.get(pick.id)!.web_name);
  await scheduleDeadlineReminders(json.events ?? [], settings, flagged);

  let previous: Snapshot = {};
  try {
    const stored = await AsyncStorage.getItem(STORAGE_NEWS_SNAPSHOT);
    if (stored) previous = JSON.parse(stored);
  } catch {}
  const { changes, next } = diffNews(
    picks.map((pick) => pick.id),
    elements,
    previous,
  );
  await AsyncStorage.setItem(STORAGE_NEWS_SNAPSHOT, JSON.stringify(next)).catch(() => {});

  if (options.notify === false || !settings.news || changes.length === 0) return;
  if ((await getPermission()) !== "granted") return;
  await ensureChannels();

  const title =
    changes.length === 1
      ? changes[0].recovered
        ? `${changes[0].name} is available again`
        : `Squad news: ${changes[0].name}`
      : `Squad news: ${changes.length} of your players`;
  const body =
    changes.length === 1
      ? changes[0].recovered
        ? "Back in contention for the next gameweek."
        : changes[0].text
      : changes.map((change) => `${change.name}: ${change.text}`).join("\n");
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { kind: "news" } },
    trigger: Platform.OS === "android" ? { channelId: CHANNEL_NEWS } : null,
  }).catch(() => {});
}

// Logging out: nothing more should arrive for this account.
export async function clearNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
  await AsyncStorage.removeItem(STORAGE_NEWS_SNAPSHOT).catch(() => {});
}
