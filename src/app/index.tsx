import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  BackHandler,
  Easing,
  Linking,
  Modal,
  Pressable,
  StatusBar,
  Text,
  View,
} from "react-native";
import { useAnimatedValue } from "../useAnimatedValue";
import { Image } from "expo-image";
import type { SymbolViewProps } from "expo-symbols";
import { AppDialog, SubstitutionRow } from "../AppDialog";
import type { ReactNode } from "react";
import type { DialogButton, DialogKind } from "../AppDialog";
import { AppSymbol } from "../AppSymbol";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import {
  beginSignIn,
  completeSignIn,
  getAccessToken,
  hasSession,
  isSignInRedirect,
  PendingSignIn,
  SessionExpiredError,
  signOut,
  withAuth,
} from "../auth";
import {
  buildFetchJs,
  buildLeagueActionJs,
  buildSaveJs,
  buildTransferJs,
  FplLeague,
  H2hMatch,
  LeagueAction,
  LeagueStanding,
  LeagueStandings,
  LeagueType,
  MemberSquad,
  Player,
  Row,
  seasonLabel,
  Squad,
} from "../fpl";
import { computeLive } from "../live";
import { LeagueHub } from "../LeagueHub";
import { ManagerHistory } from "../ManagerHistory";
import { loadEntryName } from "../fplPublic";
import { MorePage } from "../MorePage";
import { PrivacyPolicy, TermsAndConditions } from "../LegalPage";
import { FixturePlanner } from "../FixturePlanner";
import { MatchCentre } from "../MatchCentre";
import { GameweekHelper } from "../GameweekHelper";
import { CardInfoSheet } from "../CardInfoSheet";
import { loadCardStats, saveCardStats } from "../cardStats";
import type { CardStatKey } from "../cardStats";
import { APP_VERSION } from "../appInfo";
import { FOOTER_HEIGHT, ScreenBackground, THEME } from "../theme";
import { isTemporary, MESSAGES, userMessage } from "../errors";
import { EmailSignIn } from "../EmailSignIn";
import { loadRememberedLogin, pauseAutoSignIn } from "../rememberedLogin";
import { AnimatedScreen, LoadingVeil } from "../AnimatedScreen";
import { Pitch, preloadAvatars } from "../Pitch";
import { PlayerDetailsSheet } from "../PlayerDetailsSheet";
import { PlayerPicker } from "../PlayerPicker";
import { SeasonInsights } from "../SeasonInsights";
import {
  checkSquadNews,
  clearNotifications,
  DEFAULT_SETTINGS,
  getPermission,
  loadSettings,
  requestPermission,
  saveSettings,
  STORAGE_SQUAD,
} from "../notifications";
import type { NotificationSettings, PermissionState } from "../notifications";
import { stopBackgroundTask, syncBackgroundTask } from "../backgroundTasks";
import type { FplElement } from "../PlayerProfile";
import { SquadSummaryBar } from "../SquadSummaryBar";
import { TransferSummaryBar } from "../TransferSummaryBar";

if ((Text as any).defaultProps == null) (Text as any).defaultProps = {};
(Text as any).defaultProps.style = { fontFamily: "Roboto" };

type Stage = "checking" | "welcome" | "login" | "squad";
type Mode = "lineup" | "transfers" | "leagues" | "more";
type BottomTabId = Mode;
type Pending = { pos: number; inn: Player };
type PlayableChip = "wildcard" | "freehit" | "bboost" | "3xc";

// Left-to-right order of the tabs in the bottom bar.
const TAB_ORDER: Mode[] = ["lineup", "transfers", "leagues", "more"];

// How often league ranks are re-read from FPL while the leagues tab is open.
const LEAGUE_REFRESH_MS = 60_000;
// Least time between two reads of FPL's injury news.
const AVAILABILITY_REFRESH_MS = 5 * 60_000;
// How often live points are re-read while a gameweek is in play.
const LIVE_REFRESH_MS = 60_000;
const STORAGE_LOGGED_IN = "profpl_is_logged_in";
// Set once the app has asked for notification permission, so it asks only once.
const STORAGE_NOTIF_PROMPTED = "profpl_notifications_prompted";
const STORAGE_CREDS = "profpl_user_credentials";

// Earlier versions stored the FPL password; this removes any that is left.
async function clearCredentials() {
  await SecureStore.deleteItemAsync(STORAGE_CREDS).catch(() => {});
  await AsyncStorage.removeItem(STORAGE_CREDS).catch(() => {});
}

const CHIP_OPTIONS: { id: PlayableChip; label: string; mode: Mode }[] = [
  { id: "wildcard", label: "Wildcard", mode: "transfers" },
  { id: "freehit", label: "Free Hit", mode: "transfers" },
  { id: "bboost", label: "Bench Boost", mode: "lineup" },
  { id: "3xc", label: "Triple Captain", mode: "lineup" },
];

const CHIP_SYMBOLS: Record<PlayableChip, SymbolViewProps["name"]> = {
  wildcard: { ios: "sparkles", android: "auto_awesome", web: "auto_awesome" },
  freehit: { ios: "bolt.fill", android: "offline_bolt", web: "offline_bolt" },
  bboost: { ios: "person.3.fill", android: "groups", web: "groups" },
  "3xc": {
    ios: "crown.fill",
    android: "workspace_premium",
    web: "workspace_premium",
  },
};

// The accent colour (green); see theme.tsx.
const GREEN = THEME.accent;
// Transfers beyond the free ones cost points (a "hit"), as on FPL. The
// confirmation shows the cost before anything is sent.
const ALLOW_HITS = true;

function Feature({
  icon,
  text,
  detail,
}: {
  icon: SymbolViewProps["name"];
  text: string;
  detail?: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 16 }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: "rgba(255, 255, 255, 0.06)",
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.08)",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 14,
        }}
      >
        <AppSymbol name={icon} color={GREEN} size={19} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "800" }}>{text}</Text>
        {!!detail && (
          <Text style={{ color: "#8fa198", fontSize: 12.5, marginTop: 1, lineHeight: 17 }}>
            {detail}
          </Text>
        )}
      </View>
    </View>
  );
}

function BottomTab({
  icon,
  label,
  selected,
  onPressIn,
  onPress,
}: {
  icon: SymbolViewProps["name"];
  label: string;
  selected: boolean;
  onPressIn: () => void;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      android_ripple={{
        color: "rgba(255, 255, 255, 0.1)",
        borderless: false,
        radius: 24,
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flex: 1,
        height: 52,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed || hovered ? 0.7 : 1,
      })}
    >
      {() => (
        <>
          <AppSymbol name={icon} color={selected ? THEME.ink : THEME.muted} size={21} />
          <View
            style={{
              width: 16,
              height: 2,
              borderRadius: 1,
              marginTop: 3,
              backgroundColor: selected ? THEME.accent : "transparent",
            }}
          />
          <Text
            style={{
              color: selected ? THEME.ink : THEME.muted,
              fontSize: 10.5,
              fontWeight: selected ? "600" : "400",
              letterSpacing: 0.3,
              marginTop: 2,
            }}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function formationOk(picks: Row[]) {
  const xi = picks.filter((p) => p.pos <= 11);
  const n = (t: number) => xi.filter((p) => p.type === t).length;
  return xi.length === 11 && n(1) === 1 && n(2) >= 3 && n(3) >= 2 && n(4) >= 1;
}

function orderStartingPicksByType(picks: Row[]) {
  const starters = picks
    .filter((p) => p.pos <= 11)
    .sort((a, b) => a.type - b.type || a.pos - b.pos)
    .map((pick, index) => ({ ...pick, pos: index + 1 }));

  return [...starters, ...picks.filter((p) => p.pos > 11)];
}

const money = (x: number) => `£${(x / 10).toFixed(1)}m`;

// FPL's reason from an error reply: the messages in its JSON (e.g.
// {"non_field_errors": ["..."]}), or the start of a plain-text reply.
function fplReason(detail: unknown): string {
  if (typeof detail !== "string" || !detail.trim()) return "";
  const collect = (value: unknown): string[] =>
    typeof value === "string"
      ? [value]
      : Array.isArray(value)
        ? value.flatMap(collect)
        : value && typeof value === "object"
          ? Object.values(value).flatMap(collect)
          : [];
  try {
    const messages = collect(JSON.parse(detail)).filter((text) => text.trim());
    if (messages.length) return userMessage(messages.slice(0, 3).join(" "), "");
  } catch {}
  // Plain text is kept only if it reads as a sentence (not server output).
  return userMessage(detail.trim(), "");
}

const formatDeadlineDate = (isoString?: string | null) => {
  if (!isoString) return "Deadline unavailable";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "Deadline unavailable";
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dayName = days[date.getDay()];
    const dayNum = date.getDate();
    const monthName = months[date.getMonth()];
    const hours = date.getHours().toString().padStart(2, "0");
    const mins = date.getMinutes().toString().padStart(2, "0");
    return `${dayName} ${dayNum} ${monthName}, ${hours}:${mins}`;
  } catch {
    return "Deadline unavailable";
  }
};


export default function Index() {
  const insets = useSafeAreaInsets();
  const webRef = useRef<any>(null);
  const [stage, setStage] = useState<Stage>("checking");
  const stageRef = useRef<Stage>(stage);
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  const [squad, setSquad] = useState<Squad | null>(null);
  const [draft, setDraft] = useState<Row[]>([]);
  const [selectedPos, setSelectedPos] = useState<number | null>(null);
  const [playerSheetOpen, setPlayerSheetOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("lineup");
  const [activeBottomTab, setActiveBottomTab] =
    useState<BottomTabId>("lineup");
  const modeTransitionOpacity = useAnimatedValue(1);
  const modeTransitionX = useAnimatedValue(0);
  // Page switches: the page being switched to while the old one fades out,
  // and the side the new one slides in from once it has been built.
  const switchTarget = useRef<Mode | null>(null);
  const pendingSlide = useRef<number | null>(null);
  const leaguesAnim = useAnimatedValue(0);

  const [transferStatsVisible, setTransferStatsVisible] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [pendingChip, setPendingChip] = useState<PlayableChip | null>(null);
  const [showChipMenu, setShowChipMenu] = useState(false);
  // The last lineup save sent, so one refused by FPL can be retried with a
  // freshly renewed sign-in.
  const lastSave = useRef<{ script: string; retried: boolean } | null>(null);
  const [dialog, setDialog] = useState<{
    title: string;
    message: string;
    buttons: DialogButton[];
    kind: DialogKind;
    content?: ReactNode;
  } | null>(null);
  const [pickPos, setPickPos] = useState<number | null>(null);
  // A problem loading the team while it is on screen (shown as a strip).
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [showLeagues, setShowLeagues] = useState(false);
  const [activeMember, setActiveMember] = useState<{
    entry: number;
    teamName: string;
    managerName: string;
    isOwnPoints?: boolean;
  } | null>(null);
  const [activeMemberEvent, setActiveMemberEvent] = useState<number>(1);
  // Notification settings shown in More.
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  // Extra figures on the home pitch's cards, chosen in "Card info" and saved.
  const [cardStats, setCardStats] = useState<CardStatKey[]>([]);
  const [showCardInfo, setShowCardInfo] = useState(false);
  useEffect(() => {
    loadCardStats().then(setCardStats);
  }, []);
  const changeCardStats = (keys: CardStatKey[]) => {
    setCardStats(keys);
    saveCardStats(keys);
  };
  const [notifPermission, setNotifPermission] = useState<PermissionState>("undetermined");
  useEffect(() => {
    loadSettings().then(setNotifSettings);
    getPermission().then(setNotifPermission);
  }, []);

  // While signed in: ask for permission once, keep the background task in
  // step, and re-check squad news whenever the app returns to the foreground.
  const signedInEntry = stage === "squad" ? (squad?.entry ?? null) : null;
  useEffect(() => {
    if (!signedInEntry) return;
    (async () => {
      const prompted = await AsyncStorage.getItem(STORAGE_NOTIF_PROMPTED);
      if (!prompted && (await getPermission()) === "undetermined") {
        await AsyncStorage.setItem(STORAGE_NOTIF_PROMPTED, "true").catch(() => {});
        setNotifPermission(await requestPermission());
      }
      await syncBackgroundTask();
      checkSquadNews().catch(() => {});
    })();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      getPermission().then(setNotifPermission);
      checkSquadNews().catch(() => {});
    });
    return () => subscription.remove();
  }, [signedInEntry]);

  const toggleNotification = async (key: keyof NotificationSettings) => {
    const next = { ...notifSettings, [key]: !notifSettings[key] };
    if (next[key]) {
      const permission = await requestPermission();
      setNotifPermission(permission);
      if (permission !== "granted") {
        showDialog(
          "Notifications are off",
          "Allow notifications for ProFPL in your phone's settings to get deadline reminders and squad news.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Open settings", onPress: () => Linking.openSettings() },
          ],
          "warning",
        );
        return;
      }
    }
    setNotifSettings(next);
    await saveSettings(next);
    await syncBackgroundTask();
    // Reschedule reminders for the new settings, without re-alerting news.
    checkSquadNews({ notify: false }).catch(() => {});
  };

  // "My season" page, opened from More.
  const [showSeason, setShowSeason] = useState(false);
  // The privacy policy, readable signed in or not.
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  // The fixture planner, opened from More.
  const [showPlanner, setShowPlanner] = useState(false);
  const [showHelper, setShowHelper] = useState(false);
  // Matches (live scores and results), opened from More.
  const [showMatches, setShowMatches] = useState(false);
  // Android back button: what it does depends on the screen; set further
  // down, once everything it needs is defined. Pop-ups (dialogs, sheets,
  // the player list) handle Back themselves.
  const onBack = useRef<() => boolean>(() => false);
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => onBack.current());
    return () => subscription.remove();
  }, []);
  // The signed-in manager's live numbers for the gameweek in play.
  const [ownLive, setOwnLive] = useState<{
    entry: number;
    event: number;
    total: number;
    seasonTotal: number | null;
    overallRank: number | null;
  } | null>(null);

  // Decode the kit avatars once, up front, so pitches render with them in place.
  useEffect(() => {
    preloadAvatars();
  }, []);

  const [fplEvents, setFplEvents] = useState<any[]>([]);

  // Latest injury / suspension news per player id. Kept apart from the squad
  // and laid over it when shown, so refreshing it never resets unsaved edits.
  const [playerStatus, setPlayerStatus] = useState<
    Record<number, { status: string; chance: number | null; news: string }>
  >({});
  // FPL's full player records and club short names, for the player profile.
  const [elements, setElements] = useState<Record<number, FplElement>>({});
  const [teamNames, setTeamNames] = useState<Record<number, string>>({});
  // The last read of FPL's player data failed (shown in the player sheet).
  const [elementsFailed, setElementsFailed] = useState(false);
  // Reads FPL's player data now; `force` skips the few-minutes throttle.
  const readFplData = useRef<(force?: boolean) => void>(() => {});

  // FPL's public player data: gameweek deadlines and availability. Read on
  // launch and again whenever the app returns to the foreground (at most
  // every few minutes), as FPL updates injury news through the day.
  useEffect(() => {
    let lastRead = 0;
    let reading = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let failures = 0;
    const read = async (force = false) => {
      if (reading) return;
      if (!force && Date.now() - lastRead < AVAILABILITY_REFRESH_MS) return;
      reading = true;
      lastRead = Date.now();
      try {
        const res = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/");
        if (!res.ok) throw new Error(`FPL returned ${res.status}`);
        const json = await res.json();
        if (json?.events) setFplEvents(json.events);
        if (Array.isArray(json?.elements)) {
          const next: Record<number, { status: string; chance: number | null; news: string }> = {};
          json.elements.forEach((element: any) => {
            next[element.id] = {
              status: element.status,
              chance: element.chance_of_playing_next_round ?? null,
              news: element.news || "",
            };
          });
          setPlayerStatus(next);
          const records: Record<number, FplElement> = {};
          json.elements.forEach((element: FplElement) => {
            records[element.id] = element;
          });
          setElements(records);
        }
        if (Array.isArray(json?.teams)) {
          const names: Record<number, string> = {};
          json.teams.forEach((team: { id: number; short_name: string }) => {
            names[team.id] = team.short_name;
          });
          setTeamNames(names);
        }
        failures = 0;
        setElementsFailed(false);
      } catch {
        // Try again soon (10s, 30s, then every 2 minutes) instead of waiting
        // for the next time the app returns to the foreground.
        lastRead = 0;
        failures += 1;
        setElementsFailed(true);
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(
          () => read(true),
          failures === 1 ? 10_000 : failures === 2 ? 30_000 : 120_000,
        );
      } finally {
        reading = false;
      }
    };
    readFplData.current = (force = false) => {
      read(force);
    };
    read();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") read();
    });
    return () => {
      subscription.remove();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  const nextGwDeadlineInfo = useMemo(() => {
    const events = fplEvents.length > 0
      ? fplEvents
      : squad?.gameweeks?.map((gw) => ({
          id: gw.id,
          name: gw.name,
          finished: gw.finished,
          is_current: gw.isCurrent,
          is_next: gw.isNext,
          deadline_time: gw.deadlineTime,
        })) || [];

    if (events.length === 0 && !squad) return null;

    const nextGwId = squad?.gw ?? events.find((e: any) => e.is_next)?.id ?? events.find((e: any) => !e.finished)?.id ?? 1;

    const targetEvent =
      events.find((e: any) => e.id === nextGwId) ||
      events.find((e: any) => e.is_next) ||
      events.find((e: any) => !e.finished) ||
      events[0];

    if (!targetEvent) return null;

    const deadlineTimeIso =
      targetEvent.deadline_time ||
      targetEvent.deadlineTime ||
      (targetEvent.deadline_time_epoch ? new Date(targetEvent.deadline_time_epoch * 1000).toISOString() : null);

    return {
      id: targetEvent.id ?? nextGwId,
      name: targetEvent.name ?? `Gameweek ${targetEvent.id ?? nextGwId}`,
      formattedDate: deadlineTimeIso ? formatDeadlineDate(deadlineTimeIso) : `GW ${targetEvent.id ?? nextGwId} Deadline`,
      // The countdown itself ticks inside the transfer bar.
      deadlineIso: deadlineTimeIso ?? null,
    };
  }, [squad, fplEvents]);

  const modalWebRef = useRef<any>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleModalKey, setGoogleModalKey] = useState(0);
  // The official login page for the sign-in in progress.
  const [signInUrl, setSignInUrl] = useState("about:blank");
  const pendingSignIn = useRef<PendingSignIn | null>(null);

  // Bumped to remount the FPL WebView if the OS kills it in the background.
  const [webKey, setWebKey] = useState(0);
  // False while the FPL page is (re)loading: scripts injected then are lost,
  // so they wait here until the page is ready.
  const webReady = useRef(false);
  const queuedScripts = useRef<string[]>([]);
  // Watchdog for the whole sign-in, from the login page to the squad arriving.
  const loginTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Signed in, now waiting for the squad to load.
  const awaitingSquad = useRef(false);
  // Nobody is signed in: ignore anything the FPL page reports.
  const signedOut = useRef(false);
  // One recheck is allowed before a rejected session shows the login.
  const sessionRetried = useRef(false);
  // Reload the squad when the FPL page next finishes loading.
  const checkOnLoad = useRef(true);
  const webLoginDone = useRef(false);

  const stopLoginTimer = () => {
    if (loginTimer.current) clearTimeout(loginTimer.current);
    loginTimer.current = null;
  };
  const finishLogin = (errorText = "") => {
    stopLoginTimer();
    awaitingSquad.current = false;
    setLoginLoading(false);
    setLoginError(errorText);
  };
  // Signed in, but loading the team failed: automatic retries so far, and
  // whether to offer loading again instead of signing in again.
  const squadRetries = useRef(0);
  const [squadLoadFailed, setSquadLoadFailed] = useState(false);
  const [squadLoadDetail, setSquadLoadDetail] = useState("");
  const retrySquadLoad = () => {
    setSquadLoadFailed(false);
    setSquadLoadDetail("");
    squadRetries.current = 0;
    awaitingSquad.current = true;
    setLoginError("");
    setLoginLoading(true);
    startLoginTimer();
    check();
  };
  const startLoginTimer = () => {
    stopLoginTimer();
    loginTimer.current = setTimeout(() => {
      loginTimer.current = null;
      awaitingSquad.current = false;
      setLoginLoading(false);
      setLoginError(
        "Sign in is taking too long. Please check your connection and try again.",
      );
    }, 45000);
  };
  useEffect(() => stopLoginTimer, []);

  // Set up further down (it needs state declared there); see clearAccountViews.
  const clearAccountViewsRef = useRef<() => void>(() => {});

  // The session can no longer be renewed: the user has to sign in again.
  const sessionLost = () => {
    if (signedOut.current) return;
    signedOut.current = true;
    sessionRetried.current = false;
    clearAccountViewsRef.current();
    signOut();
    AsyncStorage.setItem(STORAGE_LOGGED_IN, "false").catch(() => {});
    if (stageRef.current === "squad" || awaitingSquad.current) {
      finishLogin("Your FPL session has expired. Please sign in again.");
      setStage("login");
    } else if (stageRef.current === "checking") {
      loadRememberedLogin().then((remembered) =>
        setStage((s) => (s === "checking" ? (remembered?.auto ? "login" : "welcome") : s)),
      );
    }
  };

  // Runs a script in the FPL WebView with the user's access token attached,
  // renewing the token first if it is about to expire.
  // `onOffline`: for requests that need the sign-in. If the token could not
  // be renewed (no connection, FPL busy), the request is not sent at all:
  // sent without a token, FPL would answer "not signed in" and the app would
  // wrongly sign the user out.
  const runInWeb = (
    script: string,
    options: { force?: boolean; onOffline?: () => void } = {},
  ) => {
    getAccessToken({ force: options.force })
      .then(
        (token) => token,
        (error) => {
          if (error instanceof SessionExpiredError) {
            sessionLost();
            return undefined;
          }
          if (options.onOffline) {
            options.onOffline();
            return undefined;
          }
          // Public data (league tables) still loads without a token.
          return null;
        },
      )
      .then((token) => {
        if (token === undefined) return;
        const wrapped = withAuth(script, token);
        if (webReady.current) {
          webRef.current?.injectJavaScript(wrapped);
          return;
        }
        queuedScripts.current.push(wrapped);
        // Safety net: never hold a request for long if the page does not
        // report that it finished loading.
        setTimeout(() => {
          const index = queuedScripts.current.indexOf(wrapped);
          if (index < 0) return;
          queuedScripts.current.splice(index, 1);
          webRef.current?.injectJavaScript(wrapped);
        }, 6000);
      });
  };

  useEffect(() => {
    (async () => {
      // Earlier versions kept the FPL password on the device; it is no longer
      // needed, so remove it.
      clearCredentials();
      try {
        if (!(await hasSession())) {
          signedOut.current = true;
          // A login saved with Remember me: go to sign-in, which signs in
          // with it by itself.
          const remembered = await loadRememberedLogin();
          setStage(remembered?.auto ? "login" : "welcome");
          return;
        }
        const cachedSquadStr = await AsyncStorage.getItem(STORAGE_SQUAD);
        if (cachedSquadStr) {
          const cachedSquad = JSON.parse(cachedSquadStr);
          if (cachedSquad && cachedSquad.entry) {
            setSquad(cachedSquad);
            setStage("squad");
          }
        }
      } catch {}
    })();
  }, []);

  // Coming back to the app: renew the session if it is close to expiring, so
  // the next action does not have to wait for it.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || signedOut.current) return;
      getAccessToken().catch((error) => {
        if (error instanceof SessionExpiredError) sessionLost();
      });
    });
    return () => subscription.remove();
    // Subscribed once; sessionLost only uses refs and state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeGoogleModal = () => {
    setShowGoogleModal(false);
  };

  // Opens the official Premier League login page.
  const openSignIn = () => {
    const pending = beginSignIn();
    pendingSignIn.current = pending;
    webLoginDone.current = false;
    setLoginError("");
    setSignInUrl(pending.url);
    setGoogleModalKey((k) => k + 1);
    setShowGoogleModal(true);
  };

  // Email and password sign-in: starts a sign-in on the official page, which
  // the form fills in out of sight, and returns that page's address.
  const beginPasswordSignIn = () => {
    const pending = beginSignIn();
    pendingSignIn.current = pending;
    webLoginDone.current = false;
    setLoginError("");
    return pending.url;
  };

  // The login page has redirected back with a sign-in code: swap it for the
  // session tokens and load the squad.
  const finishWebSignIn = (redirectUrl: string) => {
    const pending = pendingSignIn.current;
    if (webLoginDone.current || !pending) return;
    webLoginDone.current = true;
    pendingSignIn.current = null;
    closeGoogleModal();
    awaitingSquad.current = true;
    setLoginError("");
    setLoginLoading(true);
    startLoginTimer();
    completeSignIn(redirectUrl, pending).then(
      () => {
        signedOut.current = false;
        sessionRetried.current = false;
        authRetried.current = false;
        squadRetries.current = 0;
        setSquadLoadFailed(false);
        setSquadLoadDetail("");
        check();
      },
      (error) => finishLogin(userMessage(error, "Sign in failed. Please try again.")),
    );
  };

  const onWebLoadEnd = () => {
    webReady.current = true;
    const queued = queuedScripts.current;
    queuedScripts.current = [];
    queued.forEach((script) => webRef.current?.injectJavaScript(script));
    if (signedOut.current) return;
    // Once the squad is on screen a page reload must not refetch it, as that
    // would discard unsaved edits.
    if (stageRef.current === "squad" && !checkOnLoad.current) return;
    checkOnLoad.current = false;
    // A queued script may already be the squad load.
    if (queued.length === 0) check();
  };

  // The OS can kill a background WebView; a dead one silently ignores every
  // request, so start a fresh one.
  const restartWeb = () => {
    webReady.current = false;
    setWebKey((k) => k + 1);
  };

  const handleLogout = () => {
    showDialog(
      "Log Out",
      "Are you sure you want to log out of ProFPL?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: () => {
            // Forget the session at once, so the screen changes immediately;
            // revoking it at FPL carries on in the background.
            signedOut.current = true;
            sessionRetried.current = false;
            queuedScripts.current = [];
            finishLogin();
            signOut();
            // Keep a remembered login for the form, but don't sign straight back in.
            pauseAutoSignIn();
            clearNotifications();
            stopBackgroundTask();
            AsyncStorage.removeItem(STORAGE_SQUAD).catch(() => {});
            AsyncStorage.setItem(STORAGE_LOGGED_IN, "false").catch(() => {});
            setSquad(null);
            setDraft([]);
            setPending([]);
            setPendingChip(null);
            setSelectedPos(null);
            setPickPos(null);
            clearAccountViewsRef.current();
            setStage("welcome");
            setShowSeason(false);
            setActiveBottomTab("lineup");
            setMode("lineup");
          },
        },
      ],
      "danger",
    );
  };

  useEffect(() => {
    Animated.timing(leaguesAnim, {
      toValue: showLeagues ? 1 : 0,
      duration: showLeagues ? 260 : 180,
      easing: showLeagues ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [showLeagues, leaguesAnim]);
  const mainScrollRef = useRef<any>(null);
  const [selectedLeague, setSelectedLeague] = useState<FplLeague | null>(null);
  const [leagueStandings, setLeagueStandings] =
    useState<LeagueStandings | null>(null);
  const [h2hMatches, setH2hMatches] = useState<H2hMatch[]>([]);
  const [h2hEvent, setH2hEvent] = useState<number | null>(null);
  const [h2hLoading, setH2hLoading] = useState(false);
  // The logged-in manager's own row, kept while paging through a league.
  const [userStanding, setUserStanding] = useState<LeagueStanding | null>(null);
  // What the league detail view is showing right now. Responses that don't
  // match it are stale (the user moved on) and are dropped.
  const leagueView = useRef<{
    league: FplLeague;
    page: number;
    h2hEvent: number | null;
  } | null>(null);
  const [leagueActionNonce, setLeagueActionNonce] = useState(0);
  const [leagueLoading, setLeagueLoading] = useState(false);
  const wasLeagueLoading = useRef(leagueLoading);
  useEffect(() => {
    if (wasLeagueLoading.current && !leagueLoading && leagueStandings) {
      setTimeout(() => {
        mainScrollRef.current?.scrollTo({ y: 0, animated: true });
      }, 50);
    }
    wasLeagueLoading.current = leagueLoading;
  }, [leagueLoading, leagueStandings]);
  const [leagueError, setLeagueError] = useState("");
  const [inviteCodes, setInviteCodes] = useState<Record<number, string>>({});
  const [memberSquad, setMemberSquad] = useState<MemberSquad | null>(null);
  const [managerLoading, setManagerLoading] = useState(false);
  const [managerError, setManagerError] = useState("");
  const managerRequest = useRef<{ entry: number; event: number } | null>(null);

  // Leagues, other managers' teams and live numbers belong to the account
  // that was signed in: forget them, so the next account never sees them.
  const clearAccountViews = () => {
    leagueView.current = null;
    managerRequest.current = null;
    setSelectedLeague(null);
    setLeagueStandings(null);
    setUserStanding(null);
    setH2hMatches([]);
    setH2hEvent(null);
    setLeagueError("");
    setLeagueLoading(false);
    setH2hLoading(false);
    setInviteCodes({});
    setActiveMember(null);
    setMemberSquad(null);
    setManagerLoading(false);
    setManagerError("");
    setOwnLive(null);
    setShowLeagues(false);
    setShowPlanner(false);
    setShowHelper(false);
    setShowMatches(false);
    setError("");
  };

  useEffect(() => {
    clearAccountViewsRef.current = clearAccountViews;
  });

  const showDialog = (
    title: string,
    message: string,
    buttons: DialogButton[] = [{ text: "OK" }],
    kind: DialogKind = "confirm",
    content?: ReactNode,
  ) => setDialog({ title, message, buttons, kind, content });

  // Couldn't renew the sign-in for a network reason: keep it, say so, and try
  // again shortly.
  const offlineRetry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const squadOffline = () => {
    setRefreshing(false);
    if (awaitingSquad.current) {
      setSquadLoadDetail("could not reach FPL to renew the sign-in");
      setSquadLoadFailed(true);
      finishLogin("Couldn't reach FPL. Check your connection and tap Try again.");
      return;
    }
    if (stageRef.current === "squad") {
      setError(`${MESSAGES.offline.replace(" and try again.", ".")} Showing your last saved team.`);
    }
    if (offlineRetry.current) clearTimeout(offlineRetry.current);
    offlineRetry.current = setTimeout(() => {
      offlineRetry.current = null;
      if (!signedOut.current) check();
    }, 15_000);
  };
  const check = (options: { force?: boolean } = {}) =>
    runInWeb(buildFetchJs(), { force: options.force, onOffline: squadOffline });
  // FPL refused the sign-in once already this round; a second refusal after
  // a fresh renewal is final.
  const authRetried = useRef(false);
  // Quiet retries when FPL is briefly busy while the team is on screen.
  const quietRetries = useRef(0);
  const quietRetry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runLeagueAction = (
    action: Exclude<LeagueAction, { action: "leagues" }>,
  ) => {
    if (!webRef.current) {
      if (action.action === "manager-gameweek") {
        setManagerLoading(false);
        setManagerError("The FPL connection is not ready. Try again.");
      } else {
        setLeagueError("The FPL connection is not ready. Try again.");
      }
      return;
    }

    if (action.action === "manager-gameweek") {
      setManagerError("");
      setManagerLoading(true);
    } else {
      setLeagueError("");
      setLeagueLoading(true);
    }
    runInWeb(buildLeagueActionJs(action));
  };

  // Live points while a gameweek is in play: the home summary bar shows the
  // live total, and an open points page keeps updating. Both are refreshed
  // every minute and when the app comes back to the foreground, silently.
  const squadEntry = squad?.entry;
  const liveGwId =
    squad?.gameweeks?.find((gw) => gw.isCurrent && !gw.finished)?.id ?? null;
  const viewingEntry = activeMember?.entry ?? null;
  const homeVisible = stage === "squad" && mode === "lineup" && !viewingEntry;
  useEffect(() => {
    if (!squadEntry || !liveGwId) return;
    const watchingMember = viewingEntry !== null && activeMemberEvent === liveGwId;
    if (!homeVisible && !watchingMember) return;

    const refreshLive = () => {
      if (AppState.currentState !== "active") return;
      if (watchingMember) {
        managerRequest.current = { entry: viewingEntry, event: liveGwId };
        runInWeb(
          buildLeagueActionJs({
            action: "manager-gameweek",
            entry: viewingEntry,
            event: liveGwId,
            silent: true,
          }),
        );
      } else {
        runInWeb(
          buildLeagueActionJs({
            action: "manager-gameweek",
            entry: squadEntry,
            event: liveGwId,
            silent: true,
            target: "home",
          }),
        );
      }
    };

    // An open points page has just loaded its own data; the home bar needs
    // its first reading now.
    if (!watchingMember) refreshLive();
    const interval = setInterval(refreshLive, LIVE_REFRESH_MS);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshLive();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
    // runInWeb is a plain function remade each render; listing it would
    // restart the polling on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squadEntry, liveGwId, homeVisible, viewingEntry, activeMemberEvent]);

  // Keep the ranks on the league cards current: re-read the manager's leagues
  // when the tab opens, on an interval while it stays open, and when the app
  // returns to the foreground. Runs silently (no spinner, errors ignored) so a
  // failed poll never disturbs what is already on screen.
  useEffect(() => {
    if (mode !== "leagues" || stage !== "squad" || !squadEntry) return;

    const refreshLeagues = () => {
      if (AppState.currentState !== "active") return;
      runInWeb(
        buildLeagueActionJs({ action: "leagues", entry: squadEntry }),
      );
      // Also refresh the league that is open, without spinners or scroll jumps.
      const view = leagueView.current;
      if (!view) return;
      runInWeb(
        buildLeagueActionJs({
          action: "standings",
          league: view.league,
          page: view.page,
          silent: true,
        }),
      );
      if (view.league.kind === "h2h" && view.h2hEvent) {
        runInWeb(
          buildLeagueActionJs({
            action: "h2h-matches",
            leagueId: view.league.id,
            event: view.h2hEvent,
            silent: true,
          }),
        );
      }
    };

    refreshLeagues();
    const interval = setInterval(refreshLeagues, LEAGUE_REFRESH_MS);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshLeagues();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
    // As above: runInWeb would restart this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, stage, squadEntry]);

  const loadH2hMatches = (league: FplLeague, event: number) => {
    if (!webRef.current) {
      setLeagueError("The FPL connection is not ready. Try again.");
      return;
    }
    if (leagueView.current) leagueView.current.h2hEvent = event;
    setH2hEvent(event);
    setH2hMatches([]);
    setH2hLoading(true);
    runInWeb(
      buildLeagueActionJs({ action: "h2h-matches", leagueId: league.id, event }),
    );
  };

  const loadLeague = (league: FplLeague, page = 1) => {
    const current = leagueView.current;
    const sameLeague =
      !!current && current.league.id === league.id && current.league.kind === league.kind;
    leagueView.current = { league, page, h2hEvent: sameLeague ? current.h2hEvent : null };

    if (!sameLeague) {
      setSelectedLeague(league);
      setLeagueStandings(null);
      setUserStanding(null);
      setH2hMatches([]);
      setH2hEvent(null);
      setMemberSquad(null);
    }
    runLeagueAction({ action: "standings", league, page });

    if (!sameLeague && league.kind === "h2h") {
      // Start on the latest gameweek that has kicked off, so the fixtures
      // shown have scores; later/earlier weeks are reachable from the tab.
      const started = (squad?.gameweeks ?? []).filter((gw) => gw.finished || gw.isCurrent);
      loadH2hMatches(league, started[started.length - 1]?.id ?? squad?.gw ?? 1);
    }
  };

  const closeLeague = () => {
    leagueView.current = null;
    setSelectedLeague(null);
    setLeagueStandings(null);
    setUserStanding(null);
    setLeagueError("");
    // Any response still in flight is now stale and will be dropped, so it
    // can't be relied on to clear the spinners.
    setLeagueLoading(false);
    setH2hLoading(false);
  };

  const getInviteCode = (league: FplLeague) => {
    runLeagueAction({ action: "invite-code", leagueId: league.id });
  };

  const loadManagerGameweek = (entry: number, event: number) => {
    managerRequest.current = { entry, event };
    // The previous squad stays in state: a new manager's page waits for its
    // own data before opening, and a gameweek change keeps the old pitch on
    // screen until the new one is ready.
    runLeagueAction({
      action: "manager-gameweek",
      entry,
      event,
    });
  };

  const viewMemberSquad = (
    entry: number,
    event: number,
    teamName?: string,
    managerName?: string,
  ) => {
    setActiveMember({
      entry,
      teamName: teamName || "Squad history",
      managerName: managerName || "",
    });
    setActiveMemberEvent(event);
    loadManagerGameweek(entry, event);
  };

  // Teams opened from another team's page (the gameweek's highest score):
  // Back returns to the one before.
  const memberTrail = useRef<{ member: NonNullable<typeof activeMember>; event: number }[]>([]);
  const openTopEntry = (entry: number, event: number) => {
    if (activeMember) memberTrail.current.push({ member: activeMember, event: activeMemberEvent });
    viewMemberSquad(entry, event, `Highest score · GW ${event}`, "");
    // Fill in the team and manager names once FPL sends them (if this team
    // is still the one on screen).
    loadEntryName(entry).then((names) => {
      if (!names) return;
      setActiveMember((current) =>
        current && current.entry === entry && !current.isOwnPoints
          ? { ...current, teamName: names.teamName, managerName: names.managerName }
          : current,
      );
    });
  };
  const closeActiveMember = () => {
    const previous = memberTrail.current.pop();
    if (previous) {
      setActiveMember(previous.member);
      setActiveMemberEvent(previous.event);
      loadManagerGameweek(previous.member.entry, previous.event);
      return;
    }
    setActiveMember(null);
  };
  useEffect(() => {
    if (!activeMember) memberTrail.current = [];
  }, [activeMember]);

  const openOwnHistory = (event?: number) => {
    if (!squad) return;
    memberTrail.current = [];
    setShowLeagues(false);
    const liveGw = squad.gameweeks.find((gw) => gw.isCurrent && !gw.finished);
    const finishedGws = squad.gameweeks.filter((gw) => gw.finished);
    const defaultGw = liveGw
      ? liveGw.id
      : finishedGws.length > 0
        ? finishedGws[finishedGws.length - 1].id
        : squad.currentGw;
    const targetGw = event ?? defaultGw;

    setActiveMember({
      entry: squad.entry,
      teamName: squad.teamName || "Your team",
      managerName: squad.managerName || "",
      isOwnPoints: true,
    });
    setActiveMemberEvent(targetGw);
    loadManagerGameweek(squad.entry, targetGw);
  };


  const joinLeague = (code: string) => {
    showDialog(
      "Join this FPL league?",
      "This will add the league to your FPL account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Join",
          onPress: () => runLeagueAction({ action: "join", code }),
        },
      ],
    );
  };

  const createLeague = (
    name: string,
    leagueType: LeagueType,
    startEvent?: number,
    knockoutRounds?: number,
    maxEntries?: number,
  ) => {
    if (!squad) return;

    showDialog(
      "Create this FPL league?",
      `${name} · ${leagueType === "classic" ? "Classic" : "Head-to-Head"}${
        startEvent ? ` (Starts GW ${startEvent})` : ""
      }${knockoutRounds ? ` (${knockoutRounds} Knockout Rounds)` : ""}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Create",
          onPress: () =>
            runLeagueAction({
              action: "create",
              name,
              leagueType,
              startEvent: startEvent ?? squad.gw,
              knockoutRounds,
              maxEntries,
            }),
        },
      ],
    );
  };
  // Whenever fresh squad data arrives, reset all editable state (done while
  // rendering, so the old edits are never drawn over the new squad).
  const [resetFor, setResetFor] = useState(squad);
  if (squad !== resetFor) {
    setResetFor(squad);
    if (squad) {
      setDraft(squad.picks);
      setSelectedPos(null);
      setPlayerSheetOpen(false);
      setPending([]);
      setPendingChip(null);
      setPickPos(null);
    }
  }

  useEffect(() => {
    if (stage !== "checking") return;
    check();
    const t = setTimeout(
      () => setStage((s) => (s === "checking" ? "welcome" : s)),
      8000,
    );
    return () => clearTimeout(t);
    // Runs when the stage becomes "checking"; check is remade each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const onMessage = (e: any) => {
    let msg: any;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    // Nobody is signed in: whatever the FPL page reports is stale.
    if (signedOut.current) return;
    if (msg.saved) {
      setSaving(false);
      setPendingChip(null);
      check();
      return;
    }
    if (msg.saveError) {
      setSaving(false);
      const reason = fplReason(msg.detail);
      console.warn("FPL save error", msg.status, msg.detail);
      if ((msg.status === 401 || msg.status === 403) && lastSave.current && !lastSave.current.retried) {
        // FPL refused the sign-in: renew it and send the same change again.
        lastSave.current.retried = true;
        setSaving(true);
        runInWeb(lastSave.current.script, { force: true });
        return;
      }
      if (msg.status === 401 || msg.status === 403) {
        showDialog(
          "FPL refused the change",
          reason ||
            "Your changes were not saved. If this keeps happening, log out and sign in again.",
          [{ text: "OK" }],
          "danger",
        );
      } else if (msg.status == null) {
        showDialog(
          "Could not reach FPL",
          "Your changes were not saved. Check your connection and try again.",
          [{ text: "OK" }],
          "danger",
        );
      } else {
        // FPL answered but would not accept the change: show its reason.
        showDialog(
          msg.status >= 500 ? "FPL is busy" : "FPL didn't accept the change",
          reason ||
            (msg.status >= 500
              ? "Your changes were not saved because FPL is busy at the moment. Please try again in a few minutes."
              : "Your changes were not saved. Please try again."),
          [{ text: "OK" }],
          "danger",
        );
      }
      // Show the team as FPL has it, not the unsaved edit.
      check();
      return;
    }
    if (msg.transferred) {
      setSending(false);
      const appliedChip = pendingChip;
      setPendingChip(null);
      setPending([]);
      showDialog(
        appliedChip ? "Chip activated" : "Transfers sent",
        appliedChip
          ? `${CHIP_OPTIONS.find((chip) => chip.id === appliedChip)?.label} and your transfers were accepted. Reloading your squad.`
          : "Your transfers were accepted. Reloading your squad.",
        [{ text: "OK" }],
        "success",
      );
      check();
      return;
    }
    if (msg.transferError) {
      setSending(false);
      if (msg.status === 401 || msg.status === 403) {
        console.warn("FPL transfer refused", msg.status, msg.detail);
        showDialog(
          "FPL refused the transfers",
          fplReason(msg.detail) ||
            "Your transfers were not sent. Please try again. If this keeps happening, log out and sign in again.",
          [{ text: "OK" }],
          "danger",
        );
      } else if (msg.timedOut) {
        showDialog(
          "Transfer status unknown",
          "The request timed out. Your transfer may or may not have gone through — please check the FPL site before trying again.",
          [{ text: "OK" }],
          "warning",
        );
        check();
      } else {
        console.warn("FPL transfer error", msg.status, msg.detail);
        const reason = fplReason(msg.detail);
        showDialog(
          "Transfer failed",
          reason
            ? `FPL didn't accept the transfers: ${reason}`
            : msg.status == null
              ? "Couldn't reach FPL, so the transfers were not sent. Check your connection and try again."
              : msg.status >= 500
                ? "FPL is busy at the moment, so the transfers were not sent. Please try again in a few minutes."
                : "FPL didn't accept the transfers, so nothing was changed. Please try again.",
          [{ text: "OK" }],
          "danger",
        );
        check();
      }
      return;
    }
    if (msg.leagueAction) {
      // Background league refresh: update ranks in place, never touch the
      // loading/error state owned by user-initiated league actions.
      if (msg.leagueAction === "leagues") {
        const leagues: FplLeague[] = Array.isArray(msg.leagues) ? msg.leagues : [];
        if (squad && squad.entry === msg.entry) {
          // The same response carries fresh totals, so the summary strip and
          // the manager's own league rows stay current too.
          const next = { ...squad, ...(msg.summary ?? {}), leagues };
          setSquad(next);
          AsyncStorage.setItem(STORAGE_SQUAD, JSON.stringify(next)).catch(() => {});
        }
        setSelectedLeague((current) =>
          current
            ? leagues.find(
                (league) => league.id === current.id && league.kind === current.kind,
              ) ?? current
            : current,
        );
        return;
      }
      if (msg.leagueAction === "error" && (msg.action === "leagues" || msg.silent)) return;

      if (msg.leagueAction === "standings") {
        const view = leagueView.current;
        if (
          !view ||
          view.league.id !== msg.leagueId ||
          view.league.kind !== msg.kind ||
          view.page !== msg.page
        ) {
          return;
        }
        if (!msg.silent) setLeagueLoading(false);
        setLeagueStandings(msg.data);
        setLeagueError("");
        const mine = (msg.data?.standings?.results ?? []).find(
          (row: LeagueStanding) => row.entry === squad?.entry,
        );
        if (mine) setUserStanding(mine);
        return;
      }
      if (
        msg.leagueAction === "h2h-matches" ||
        (msg.leagueAction === "error" && msg.action === "h2h-matches")
      ) {
        const view = leagueView.current;
        if (!view || view.league.id !== msg.leagueId || view.h2hEvent !== msg.event) return;
        setH2hLoading(false);
        if (msg.leagueAction === "error") {
          setLeagueError(userMessage(msg.error, "The matches couldn't be loaded. Please try again."));
        } else {
          setH2hMatches(Array.isArray(msg.results) ? msg.results : []);
          setLeagueError("");
        }
        return;
      }
      if (msg.leagueAction === "manager-gameweek" && msg.target === "home") {
        const data = msg.data as MemberSquad | undefined;
        if (!data || data.entry !== squad?.entry) return;
        const live = computeLive(data.picks, data.fixtures ?? [], data.chip);
        const history = data.history;
        setOwnLive({
          entry: data.entry,
          event: data.event,
          total: live.total,
          // FPL's season total includes the gameweek's settled points;
          // swap those for the live figure.
          seasonTotal:
            history.totalPoints != null && history.points != null
              ? history.totalPoints - history.points + live.total
              : null,
          overallRank: history.overallRank,
        });
        return;
      }
      if (msg.leagueAction === "manager-gameweek") {
        const request = managerRequest.current;
        if (
          request &&
          request.entry === msg.data?.entry &&
          request.event === msg.data?.event
        ) {
          setManagerLoading(false);
          setMemberSquad(msg.data);
          setManagerError("");
        }
        return;
      }
      if (
        msg.leagueAction === "error" &&
        msg.action === "manager-gameweek"
      ) {
        const request = managerRequest.current;
        if (
          request &&
          request.entry === msg.entry &&
          request.event === msg.event
        ) {
          setManagerLoading(false);
          setManagerError(userMessage(msg.error, "This gameweek couldn't be loaded. Please try again."));
        }
        return;
      }
      setLeagueLoading(false);

      if (msg.leagueAction === "created") {
        setLeagueError("");
        setLeagueActionNonce((n) => n + 1);
        if (msg.leagueId && msg.inviteCode) {
          setInviteCodes((current) => ({
            ...current,
            [msg.leagueId]: msg.inviteCode,
          }));
        }
        const inviteText = msg.inviteCode
          ? ` Invite code: ${msg.inviteCode}`
          : ` The invite code couldn't be loaded just now. Open the league and tap "Show invite code".`;
        showDialog(
          "League created",
          "Your league was created." + inviteText,
          [{ text: "OK" }],
          "success",
        );
        check();
      } else if (msg.leagueAction === "invite-code") {
        if (msg.leagueId && msg.inviteCode) {
          setInviteCodes((current) => ({
            ...current,
            [msg.leagueId]: msg.inviteCode,
          }));
          setLeagueError("");
        } else {
          setLeagueError("FPL did not return an invite code.");
        }
      } else if (msg.leagueAction === "joined") {
        setLeagueError("");
        setLeagueActionNonce((n) => n + 1);
        showDialog(
          "League joined",
          "Refreshing your FPL leagues.",
          [{ text: "OK" }],
          "success",
        );
        check();
      } else if (msg.leagueAction === "error") {
        setLeagueError(userMessage(msg.error, "That didn't work. Please try again."));
      }
      return;
    }
    setRefreshing(false);
    if (msg.ok) {
      sessionRetried.current = false;
      authRetried.current = false;
      squadRetries.current = 0;
      quietRetries.current = 0;
      setSquadLoadFailed(false);
      setSquadLoadDetail("");
      finishLogin();
      setSquad(msg.squad);
      setError("");
      setStage("squad");
      // The news check reads the squad from storage, so run it once saved.
      AsyncStorage.setItem(STORAGE_SQUAD, JSON.stringify(msg.squad))
        .then(() => checkSquadNews())
        .catch(() => {});
      AsyncStorage.setItem(STORAGE_LOGGED_IN, "true").catch(() => {});
    } else if (msg.notLoggedIn) {
      if (msg.noTeam) {
        // Signed in fine, but this account has never created an FPL team.
        signedOut.current = true;
        signOut();
        pauseAutoSignIn();
        finishLogin(
          "No FPL team found on this account. Please create one at fantasy.premierleague.com and try again.",
        );
        setStage("login");
      } else if (!authRetried.current) {
        // FPL did not accept the token. Renew it and ask again: only if FPL
        // refuses a freshly renewed token, or refuses to renew it at all, is
        // the user really signed out.
        authRetried.current = true;
        check({ force: true });
      } else {
        authRetried.current = false;
        sessionLost();
      }
    } else if (msg.authRejected && !authRetried.current) {
      // A call needing the sign-in was refused: renew the token and retry.
      authRetried.current = true;
      check({ force: true });
    } else if (stageRef.current === "squad") {
      if (isTemporary(msg.error) && quietRetries.current < 3) {
        quietRetries.current += 1;
        if (quietRetry.current) clearTimeout(quietRetry.current);
        quietRetry.current = setTimeout(() => {
          quietRetry.current = null;
          if (!signedOut.current) check();
        }, 10_000 * quietRetries.current);
        return;
      }
      setError(
        isTemporary(msg.error)
          ? `${userMessage(msg.error)} Showing your last saved team.`
          : "Couldn't refresh your team from FPL. Showing your last saved team.",
      );
    } else if (awaitingSquad.current) {
      // FPL often fails briefly right after a sign-in (or while the game is
      // updating): try twice more on our own before asking the user.
      if (squadRetries.current < 2) {
        squadRetries.current += 1;
        setTimeout(() => {
          if (awaitingSquad.current) check();
        }, 2000 * squadRetries.current);
        return;
      }
      setSquadLoadFailed(true);
      finishLogin(
        isTemporary(msg.error)
          ? `${userMessage(msg.error)} You're signed in; tap Try again shortly.`
          : "You're signed in, but we couldn't load your team from FPL. Tap Try again.",
      );
    }
  };

  const refresh = () => {
    setError("");
    setRefreshing(true);
    check();
  };

  const locked = !!squad?.chip;
  const warn = (msg: string) => showDialog("Can't do that", msg, [{ text: "OK" }], "warning");
  const selectedChipOption = CHIP_OPTIONS.find(
    (chip) => chip.id === pendingChip,
  );
  const selectChip = (chip: (typeof CHIP_OPTIONS)[number]) => {
    if (locked) {
      warn("A chip is already active this gameweek.");
      return;
    }
    if (!squad?.availableChips.includes(chip.id)) {
      warn(`${chip.label} is not available on your FPL team.`);
      return;
    }
    if (pendingChip === chip.id) {
      setPendingChip(null);
      setShowChipMenu(false);
      return;
    }
    setPendingChip(chip.id);
    setMode(chip.mode);
    setActiveBottomTab(chip.mode);
    setTransferStatsVisible(chip.mode === "transfers");
    setSelectedPos(null);
    setPlayerSheetOpen(false);
    setShowChipMenu(false);
  };

  // ---------- Lineup mode ----------

  const confirmLineupChange = (nextDraft: Row[], chipToPlay: PlayableChip | null = pendingChip) => {
    if (!squad) return;
    const cap = nextDraft.find((p) => p.cap);
    const vice = nextDraft.find((p) => p.vice);
    const capChanged = cap?.id !== squad.picks.find((p) => p.cap)?.id;
    const viceChanged = vice?.id !== squad.picks.find((p) => p.vice)?.id;
    const before = new Set(
      squad.picks.filter((p) => p.pos <= 11).map((p) => p.id),
    );
    const after = new Set(nextDraft.filter((p) => p.pos <= 11).map((p) => p.id));
    const inn = nextDraft
      .filter((p) => p.pos <= 11 && !before.has(p.id))
      .map((p) => p.name);
    const out = squad.picks
      .filter((p) => p.pos <= 11 && !after.has(p.id))
      .map((p) => p.name);
    // Only what changed: each substitution as its own coloured row, then the
    // armband if it moved. A reshuffle of the bench alone gets one short line.
    const swaps = Array.from({ length: Math.max(inn.length, out.length) }, (_, index) => ({
      inName: inn[index],
      outName: out[index],
    }));
    const lines = [
      capChanged && cap ? `Captain: ${cap.name}` : "",
      viceChanged && vice ? `Vice-captain: ${vice.name}` : "",
    ].filter(Boolean);
    if (lines.length === 0 && swaps.length === 0) lines.push("New bench order");
    if (chipToPlay) {
      lines.push(
        `Chip: ${selectedChipOption?.label ?? chipToPlay}`,
        "Chips cannot be undone once confirmed.",
      );
    }

    setDraft(nextDraft);
    setSelectedPos(null);
    setPlayerSheetOpen(false);

    showDialog(
      chipToPlay
        ? `Activate ${selectedChipOption?.label ?? "chip"}?`
        : "Save lineup?",
      lines.join("\n"),
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            setDraft(squad.picks);
          },
        },
        {
          text: "Save",
          onPress: () => {
            setSaving(true);
            lastSave.current = { script: buildSaveJs(squad.entry, nextDraft, chipToPlay), retried: false };
            runInWeb(lastSave.current.script);
          },
        },
      ],
      "confirm",
      swaps.length > 0 ? (
        <View>
          {swaps.map((swap, index) => (
            <SubstitutionRow key={index} inName={swap.inName} outName={swap.outName} />
          ))}
        </View>
      ) : undefined,
    );
  };

  const swap = (a: Row, b: Row) => {
    const aStarter = a.pos <= 11;
    const bStarter = b.pos <= 11;
    if (aStarter && bStarter) {
      if (a.type === b.type) {
        const next = draft.map((p) =>
          p.id === a.id
            ? { ...p, pos: b.pos }
            : p.id === b.id
              ? { ...p, pos: a.pos }
              : p,
        );
        confirmLineupChange(next);
        return;
      }
      warn("Starting XI players can only swap with players in the same position.");
      return;
    }
    if (!aStarter && !bStarter) {
      if (a.pos === 12 || b.pos === 12) {
        warn("The goalkeeper's bench spot is fixed.");
        return;
      }
      const next = draft.map((p) =>
        p.id === a.id
          ? { ...p, pos: b.pos }
          : p.id === b.id
            ? { ...p, pos: a.pos }
            : p,
      );
      confirmLineupChange(next);
      return;
    }
    const s = aStarter ? a : b;
    const bn = aStarter ? b : a;
    if (s.cap || s.vice) {
      warn("Move the captain / vice-captain armband to another player first.");
      return;
    }
    const swapped = draft.map((p) =>
      p.id === s.id
        ? { ...p, pos: bn.pos }
        : p.id === bn.id
          ? { ...p, pos: s.pos }
          : p,
    );
    const next = orderStartingPicksByType(swapped);
    if (!formationOk(next)) {
      warn(
        "That swap would make an invalid formation (1 GK, 3+ DEF, 2+ MID, 1+ FWD).",
      );
      return;
    }
    confirmLineupChange(next);
  };

  const setRole = (kind: "cap" | "vice", targetPos?: number) => {
    const target = draft.find((p) => p.pos === (targetPos ?? selectedPos));
    if (!target) return;
    if (target.pos > 11) {
      warn("Only players in your starting XI can be captain or vice-captain.");
      return;
    }
    const oldCap = draft.find((p) => p.cap);
    const oldVice = draft.find((p) => p.vice);
    const next = draft.map((p) => {
      if (kind === "cap") {
        if (p.id === target.id) return { ...p, cap: true, vice: false };
        if (p.cap)
          return {
            ...p,
            cap: false,
            vice: !!oldVice && oldVice.id === target.id,
          };
        return p;
      }
      if (p.id === target.id) return { ...p, vice: true, cap: false };
      if (p.vice)
        return {
          ...p,
          vice: false,
          cap: !!oldCap && oldCap.id === target.id,
        };
      return p;
    });
    confirmLineupChange(next);
  };

  // ---------- Transfers mode ----------
  // The squad as it would look with all pending transfers applied
  const tdraft: Row[] = useMemo(() => {
    if (!squad) return [];
    return squad.picks.map((p) => {
      const t = pending.find((x) => x.pos === p.pos);
      return t
        ? {
            ...p,
            id: t.inn.id,
            name: t.inn.name,
            team: t.inn.team,
            teamId: t.inn.teamId,
            sell: t.inn.cost,
            buy: t.inn.cost,
            price: t.inn.cost,
            form: t.inn.form,
            ownership: t.inn.ownership,
            priceChange: t.inn.priceChange,
            formMood: t.inn.formMood,
            status: t.inn.status,
            chance: t.inn.chance,
            news: t.inn.news,
            fixtures: squad.fixturesByTeam[t.inn.teamId] ?? [],
            epNext: t.inn.epNext ?? null,
            ppg: t.inn.ppg ?? null,
            xgi90: t.inn.xgi90 ?? null,
            totalPoints: t.inn.pts,
            pendingIn: true,
          }
        : p;
    });
  }, [squad, pending]);

  // Chips & captain: the lineup as edited (captain, bench order) with any
  // unsaved transfers swapped in.
  const helperRows: Row[] = useMemo(() => {
    if (!squad) return [];
    const base = draft.length ? draft : squad.picks;
    const incoming = new Map<number, Row>();
    tdraft.forEach((row) => {
      if (!row.pendingIn) return;
      const original = squad.picks.find((p) => p.pos === row.pos);
      if (original) incoming.set(original.id, row);
    });
    return base.map((row) => {
      const inn = incoming.get(row.id);
      return inn ? { ...inn, pos: row.pos, cap: row.cap, vice: row.vice } : row;
    });
  }, [squad, draft, tdraft]);

  const bankAfter = squad
    ? squad.bank +
      pending.reduce((sum, t) => {
        const out = squad.picks.find((p) => p.pos === t.pos)!;
        return sum + out.sell - t.inn.cost;
      }, 0)
    : 0;

  const freeLeft = squad?.freeTransfers ?? null;
  const extra = freeLeft == null ? 0 : Math.max(pending.length - freeLeft, 0);
  const hit = extra * (squad?.hitCost ?? 4);

  // Budget and club-limit info for the spot being replaced
  const pickInfo = useMemo(() => {
    if (!squad || pickPos === null) return null;
    const slot = tdraft.find((p) => p.pos === pickPos);
    if (!slot) return null;
    const counts: Record<number, number> = {};
    tdraft
      .filter((p) => p.pos !== pickPos)
      .forEach((p) => {
        counts[p.teamId] = (counts[p.teamId] || 0) + 1;
      });
    const fullClubs = Object.keys(counts)
      .filter((k) => counts[Number(k)] >= 3)
      .map(Number);
    return { slot, maxCost: bankAfter + slot.sell, fullClubs };
  }, [squad, pickPos, tdraft, bankAfter]);

  // Show ALL players of the same position (except ones already in the squad)
  const candidates: Player[] = useMemo(() => {
    if (!squad || !pickInfo) return [];
    // Every player in this position, your own squad included; the picker
    // marks squad players and doesn't let them be picked twice.
    return squad.pool
      .filter((pl) => pl.type === pickInfo.slot.type)
      .map((pl) => (playerStatus[pl.id] ? { ...pl, ...playerStatus[pl.id] } : pl));
  }, [squad, pickInfo, playerStatus]);

  const squadIds = useMemo(() => tdraft.map((p) => p.id), [tdraft]);

  const pickPlayer = (inn: Player) => {
    if (!squad || pickPos === null || !pickInfo) return;
    if (squadIds.includes(inn.id)) return;
    if (inn.cost > pickInfo.maxCost) {
      showDialog(
        "Not enough budget",
        `${inn.name} costs ${money(inn.cost)}, but you only have ${money(
          pickInfo.maxCost,
        )} available for this spot (short by ${money(inn.cost - pickInfo.maxCost)}).`,
        [{ text: "OK" }],
        "warning",
      );
      return;
    }
    if (pickInfo.fullClubs.includes(inn.teamId)) {
      showDialog(
        "Club limit reached",
        `You already have 3 players from ${inn.team}. You can't have more than 3 from one club.`,
        [{ text: "OK" }],
        "warning",
      );
      return;
    }
    const orig = squad.picks.find((p) => p.pos === pickPos)!;
    setPending((prev) => {
      const rest = prev.filter((x) => x.pos !== pickPos);
      // choosing the original player again simply cancels that transfer
      return inn.id === orig.id ? rest : [...rest, { pos: pickPos, inn }];
    });
    setPickPos(null);
    setSelectedPos(null);
    setPlayerSheetOpen(false);
  };

  const undoSlot = (pos?: number) => {
    const targetPos = pos ?? selectedPos;
    if (targetPos === null) return;
    setPending((prev) => prev.filter((x) => x.pos !== targetPos));
    setSelectedPos(null);
    setPlayerSheetOpen(false);
  };

  const reviewTransfers = () => {
    if (!squad || sending) return;
    if (pending.length === 0) {
      warn("Make at least one transfer before using this chip.");
      return;
    }

    const outPlayers = pending.map(
      (t) => squad.picks.find((p) => p.pos === t.pos)!,
    );
    const armband = outPlayers.find((o) => o.cap || o.vice);
    if (armband) {
      warn(
        `${armband.name} is your captain or vice-captain. Move the armband to another player in the Lineup tab and save it first.`,
      );
      return;
    }
    if (hit > 0 && !pendingChip && !ALLOW_HITS) {
      warn(
        `This would cost ${hit} points (you have ${freeLeft} free transfer${
          freeLeft === 1 ? "" : "s"
        }). Point hits are switched off. Reduce to ${freeLeft} transfer${
          freeLeft === 1 ? "" : "s"
        }.`,
      );
      return;
    }
    if (bankAfter < 0) {
      warn("You don't have enough money for these transfers.");
      return;
    }

    const lines = pending.map((t, i) => {
      const out = outPlayers[i];
      return `${out.name} (${money(out.sell)}) → ${t.inn.name} (${money(t.inn.cost)})`;
    });
    lines.push("");
    lines.push(`Bank after: ${money(bankAfter)}`);
    if (pendingChip) {
      lines.push(`Chip: ${selectedChipOption?.label ?? pendingChip}`);
      lines.push("Points cost: 0");
      lines.push("Chips cannot be undone once confirmed.");
    } else {
      lines.push(hit > 0 ? `Points cost: -${hit}` : "Points cost: 0");
    }
    lines.push("");
    lines.push("This changes your real FPL team.");

    showDialog("Send transfers to FPL?", lines.join("\n"), [
      { text: "Cancel", style: "cancel" },
      {
        text: "Send to FPL",
        style: "destructive",
        onPress: () => {
          setSending(true);
          runInWeb(
            buildTransferJs(
              squad.entry,
              squad.gw,
              pending.map((t, i) => ({
                out: outPlayers[i].id,
                inn: t.inn.id,
                purchase: t.inn.cost,
                selling: outPlayers[i].sell,
              })),
              pendingChip,
            ),
          );
        },
      },
    ]);
  };

  const onPlayerPress = (r: Row) => {
    if (locked) {
      setSelectedPos((prev) => (prev === r.pos ? null : r.pos));
      setPlayerSheetOpen(false);
      return;
    }
    if (mode === "transfers") {
      if (selectedPos === r.pos) {
        const isPending = pending.some((x) => x.pos === r.pos);
        if (isPending) {
          undoSlot(r.pos);
        } else {
          setPickPos(r.pos);
          setSelectedPos(null);
        }
        setPlayerSheetOpen(false);
      } else {
        setSelectedPos(r.pos);
        setPlayerSheetOpen(false);
      }
      return;
    }
    if (selectedPos === null) {
      setSelectedPos(r.pos);
      setPlayerSheetOpen(false);
      return;
    }
    if (selectedPos === r.pos) {
      setSelectedPos(null);
      setPlayerSheetOpen(false);
      return;
    }
    const a = draft.find((p) => p.pos === selectedPos);
    if (a) swap(a, r);
  };

  // The new page, once built, slides a short way in from its side and fades
  // up. Started from a layout effect, so it never runs on the old page.
  const slideInPage = () => {
    const from = pendingSlide.current;
    if (from == null) return;
    pendingSlide.current = null;
    modeTransitionX.setValue(from);
    Animated.parallel([
      Animated.timing(modeTransitionOpacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      }),
      Animated.timing(modeTransitionX, {
        toValue: 0,
        duration: 320,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      }),
    ]).start();
  };
  // The animated values never change; mode is what triggers it.
  useLayoutEffect(slideInPage, [mode, modeTransitionOpacity, modeTransitionX]);

  const switchMode = (m: Mode) => {
    if (m === mode && switchTarget.current === null) return;
    // Slide in from the side the new tab sits on in the bottom bar.
    const fromRight = TAB_ORDER.indexOf(m) > TAB_ORDER.indexOf(mode);
    switchTarget.current = m;
    setPendingChip(null);
    setSelectedPos(null);
    setPlayerSheetOpen(false);

    // 1. The current page fades out quickly, drifting away from the new tab.
    //    It must be gone before the new page is built: otherwise the old
    //    page would briefly slide back in while the new one renders.
    modeTransitionX.stopAnimation();
    modeTransitionOpacity.stopAnimation();
    Animated.parallel([
      Animated.timing(modeTransitionOpacity, {
        toValue: 0,
        duration: 90,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(modeTransitionX, {
        toValue: fromRight ? -24 : 24,
        duration: 90,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      // Another tab was tapped meanwhile: that switch takes over.
      if (!finished || switchTarget.current !== m) return;
      switchTarget.current = null;
      // 2. Build the new page while nothing shows; 3. it slides in after.
      pendingSlide.current = fromRight ? 36 : -36;
      if (m === mode) {
        // Back to the page already built (tapped away and back quickly).
        slideInPage();
      } else {
        setMode(m);
        setTransferStatsVisible(m === "transfers");
      }
    });
  };

  // The fixture planner's clubs (from the player list) and how many of
  // your players each has.
  const plannerTeams = useMemo(() => {
    const seen = new Map<number, string>();
    (squad?.pool ?? []).forEach((player) => {
      if (player.team && !seen.has(player.teamId)) seen.set(player.teamId, player.team);
    });
    return [...seen].map(([id, short]) => ({ id, short }));
  }, [squad]);
  const plannerMyClubs = useMemo(() => {
    const counts: Record<number, number> = {};
    (squad?.picks ?? []).forEach((pick) => {
      counts[pick.teamId] = (counts[pick.teamId] ?? 0) + 1;
    });
    return counts;
  }, [squad]);

  // Your players, highlighted in match events.
  const matchesMyPlayers = useMemo(() => (squad?.picks ?? []).map((pick) => pick.id), [squad]);

  // Android back button, from the innermost screen outwards. Returning false
  // lets Android handle it (leaving the app from the Lineup tab).
  useEffect(() => {
    onBack.current = () => {
      if (showTerms) {
        setShowTerms(false);
        return true;
      }
      if (showPrivacy) {
        setShowPrivacy(false);
        return true;
      }
      if (showSeason) {
        setShowSeason(false);
        return true;
      }
      if (showPlanner) {
        setShowPlanner(false);
        return true;
      }
      if (showHelper) {
        setShowHelper(false);
        return true;
      }
      if (showMatches) {
        setShowMatches(false);
        return true;
      }
      if (stage === "login") {
        setStage("welcome");
        return true;
      }
      if (stage !== "squad") return false;
      if (activeMember) {
        closeActiveMember();
        return true;
      }
      if (showChipMenu) {
        setShowChipMenu(false);
        return true;
      }
      if (mode === "leagues" && selectedLeague) {
        closeLeague();
        return true;
      }
      if (selectedPos !== null) {
        setSelectedPos(null);
        setPlayerSheetOpen(false);
        return true;
      }
      if (mode !== "lineup") {
        setActiveBottomTab("lineup");
        switchMode("lineup");
        return true;
      }
      return false;
    };
  });

  const pickSlot =
    pickPos !== null ? tdraft.find((p) => p.pos === pickPos) : null;
  const selectedIsReplaced =
    selectedPos !== null && pending.some((x) => x.pos === selectedPos);
  // Newest availability over the rows on screen (the squad may be older).
  const shownPicks = useMemo(() => {
    const rows = mode === "transfers" ? tdraft : draft;
    return rows.map((row) => {
      const latest = playerStatus[row.id];
      return latest ? { ...row, ...latest } : row;
    });
  }, [mode, tdraft, draft, playerStatus]);
  const selectedPlayer =
    selectedPos === null
      ? null
      : shownPicks.find((player) => player.pos === selectedPos) ?? null;

  // A team page opens once its squad has arrived (or the request has failed,
  // in which case the page shows the reason).
  const activeMemberReady =
    !!activeMember && (memberSquad?.entry === activeMember.entry || !managerLoading);

  // The home pitch always shows the team for the upcoming gameweek.
  const currentSelectedGw = squad?.gw ?? 1;

  return (
    <View style={{ flex: 1, backgroundColor: THEME.bg }}>
      <StatusBar barStyle="light-content" />

      {stage === "checking" && (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: "#fff", fontSize: 32, fontWeight: "800" }}>
            Pro<Text style={{ color: GREEN }}>FPL</Text>
          </Text>
          <ActivityIndicator color={GREEN} style={{ marginTop: 24 }} />
        </View>
      )}

      {stage === "welcome" && (
        <View
          style={{
            flex: 1,
            paddingTop: insets.top + 40,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 28,
            justifyContent: "space-between",
          }}
        >
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Image
                source={require("../../assets/images/icon-small.png")}
                accessible={false}
                style={{ width: 52, height: 52, borderRadius: 14 }}
              />
              <Text style={{ color: "#fff", fontSize: 40, fontWeight: "900", letterSpacing: -0.5 }}>
                Pro<Text style={{ color: GREEN }}>FPL</Text>
              </Text>
            </View>
            <Text style={{ color: "#c9d6cf", fontSize: 17, marginTop: 14, lineHeight: 24 }}>
              Manage your Fantasy Premier League team with live points, smart
              alerts and season insights.
            </Text>
            <View style={{ marginTop: 26 }}>
              <Feature
                icon={{ ios: "bolt.fill", android: "bolt", web: "bolt" }}
                text="Live gameweek points"
                detail="Bonus, auto-subs and captaincy as matches happen"
              />
              <Feature
                icon={{
                  ios: "arrow.left.arrow.right",
                  android: "swap_horiz",
                  web: "swap_horiz",
                }}
                text="Lineup, transfers and chips"
                detail="Pick your team and send changes straight to FPL"
              />
              <Feature
                icon={{ ios: "trophy.fill", android: "trophy", web: "trophy" }}
                text="Leagues and rivals"
                detail="Tables, rank changes and every manager's team"
              />
              <Feature
                icon={{ ios: "bell.badge.fill", android: "notifications_active", web: "notifications_active" }}
                text="Deadline and injury alerts"
                detail="Reminders before each deadline and squad news"
              />
              <Feature
                icon={{ ios: "chart.bar.fill", android: "insights", web: "insights" }}
                text="Season insights"
                detail="Your strengths, weak spots and form at a glance"
              />
            </View>
          </View>
          <View>
            <Pressable
              onPress={() => setStage("login")}
              style={({ pressed }) => ({
                backgroundColor: GREEN,
                paddingVertical: 16,
                borderRadius: 28,
                alignItems: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ color: THEME.onAccent, fontSize: 17, fontWeight: "900" }}>
                Get started
              </Text>
            </Pressable>
            <Text
              style={{
                color: "#8fa198",
                fontSize: 12,
                textAlign: "center",
                marginTop: 12,
                lineHeight: 17,
              }}
            >
              Sign in with your FPL account. Your password goes only to the
              Premier League and is never stored.
            </Text>
            <Text
              style={{
                color: "#5f7068",
                fontSize: 11,
                textAlign: "center",
                marginTop: 8,
                lineHeight: 15,
              }}
            >
              Not affiliated with the Premier League. Version {APP_VERSION}
            </Text>
          </View>
        </View>
      )}

      {stage === "login" && (
        <View style={{ flex: 1, backgroundColor: THEME.bg }}>
          <ScreenBackground />
          <EmailSignIn
            topInset={insets.top}
            bottomInset={insets.bottom}
            version={APP_VERSION}
            loading={loginLoading}
            error={loginError}
            errorDetail={squadLoadDetail}
            squadLoadFailed={squadLoadFailed}
            begin={beginPasswordSignIn}
            onRedirect={finishWebSignIn}
            onOtherMethods={openSignIn}
            onRetrySquad={retrySquadLoad}
            onDismissSquadFailure={() => {
              setSquadLoadFailed(false);
              setSquadLoadDetail("");
              setLoginError("");
            }}
            onBack={() => setStage("welcome")}
            onOpenPrivacy={() => setShowPrivacy(true)}
            onOpenTerms={() => setShowTerms(true)}
          />
        </View>
      )}

      <View style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}>
        <WebView
          key={webKey}
          ref={webRef}
          source={{ uri: "https://fantasy.premierleague.com/" }}
          userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
          javaScriptEnabled
          domStorageEnabled
          onMessage={onMessage}
          // No onLoadStart here: Android also reports it when the FPL site
          // changes its own address in place (e.g. "/" to "/en/"), with no
          // load-end after it, which would hold every request forever.
          onLoadEnd={onWebLoadEnd}
          onRenderProcessGone={restartWeb}
          onContentProcessDidTerminate={restartWeb}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
        />
      </View>

      {/* Google Sign In Modal */}
      <Modal
        visible={showGoogleModal}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeGoogleModal}
      >
        <View style={{ flex: 1, backgroundColor: THEME.bg, paddingTop: insets.top }}>
          {/* Modal Header */}
          <View
            style={{
              height: 48,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              backgroundColor: "rgba(14, 38, 26, 0.95)",
              borderBottomWidth: 1.5,
              borderBottomColor: "rgba(0, 217, 130, 0.25)",
            }}
          >
            <Pressable onPress={closeGoogleModal} hitSlop={12}>
              <Text style={{ color: GREEN, fontSize: 16, fontWeight: "700" }}>‹ Cancel</Text>
            </Pressable>
          </View>

          {/* Google OAuth WebView */}
          <View style={{ flex: 1, backgroundColor: "#ffffff" }}>
            <WebView
              key={googleModalKey}
              ref={modalWebRef}
              source={{ uri: signInUrl }}
              userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              // Signing in ends with a redirect back to the FPL site carrying
              // the sign-in code. Catch it instead of loading that page.
              onShouldStartLoadWithRequest={(request) => {
                if (!isSignInRedirect(request.url)) return true;
                finishWebSignIn(request.url);
                return false;
              }}
              // Backstop for redirects the hook above is not consulted for.
              onLoadStart={(event) => {
                const { url } = event.nativeEvent;
                if (isSignInRedirect(url)) finishWebSignIn(url);
              }}
              startInLoadingState
              renderLoading={() => (
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <ActivityIndicator color="#37003c" />
                </View>
              )}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </Modal>

      {stage === "squad" && squad && (
        <View style={{ flex: 1, backgroundColor: THEME.bg }}>
          <ScreenBackground />
          <View>
            <View
              style={{
                backgroundColor: "transparent",
                paddingTop: insets.top + 10,
                paddingHorizontal: 10,
                paddingBottom: 10,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                elevation: 0,
                shadowOpacity: 0,
                shadowRadius: 0,
                shadowOffset: { width: 0, height: 0 },
                zIndex: 2,
                overflow: "hidden",
              }}
            >
              {/* Row 1: ProFPL + Refresh (left) and GW Button (right) */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 2,
                  marginBottom: showLeagues ? 0 : 2,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text
                    style={{ color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 0.4 }}
                  >
                    Pro<Text style={{ color: GREEN }}>FPL</Text>
                  </Text>
                  {!showLeagues && (
                    <Pressable
                      onPress={refresh}
                      disabled={refreshing}
                      accessibilityRole="button"
                      accessibilityLabel={
                        refreshing ? "Refreshing squad" : "Refresh squad"
                      }
                      hitSlop={8}
                      style={({ pressed }) => ({
                        width: 26,
                        height: 26,
                        marginLeft: 6,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 13,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.5)",
                        backgroundColor: "rgba(255,255,255,0.18)",
                        opacity: pressed || refreshing ? 0.5 : 1,
                        transform: [{ scale: pressed ? 0.92 : 1 }],
                      })}
                    >
                      <AppSymbol
                        name={{
                          ios: "arrow.clockwise",
                          android: "refresh",
                          web: "refresh",
                        }}
                        color="#fff"
                        size={13}
                      />
                    </Pressable>
                  )}
                </View>

                <View style={{ flex: 1 }} />

                {!showLeagues && (
                  mode === "transfers" || mode === "more" ? (
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <View
                        style={{
                          width: 3,
                          height: 14,
                          backgroundColor: GREEN,
                          borderRadius: 2,
                          marginRight: 6,
                        }}
                      />
                      <Text
                        numberOfLines={1}
                        style={{
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: "500",
                        }}
                      >
                        {mode === "more" ? "More" : (squad.teamName || "Your team")}
                      </Text>
                    </View>
                  ) : (
                    // The lineup always edits the upcoming gameweek; past
                    // gameweeks are browsed from the points page.
                    <View
                      accessible
                      accessibilityLabel={`Picking team for gameweek ${squad.gw}`}
                      style={{
                        borderRadius: 16,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.12)",
                        backgroundColor: "rgba(14, 38, 26, 0.6)",
                      }}
                    >
                      <Text style={{ color: "#c5d8ce", fontSize: 11, fontWeight: "800" }}>
                        GW {squad.gw}
                        {squad.chip ? ` · ${squad.chip}` : ""}
                      </Text>
                    </View>
                  )
                )}
              </View>

              {/* The page's own header rows fade out and in with the page, so
                  they leave the moment a different tab is tapped. */}
              <Animated.View style={{ opacity: modeTransitionOpacity }}>
              {/* Row 2: Team Name with Green Accent Bar (left) and Points Button (right) */}
              {!showLeagues && mode !== "transfers" && mode !== "more" && (
                <View
                  style={{
                    marginHorizontal: 2,
                    marginTop: 2,
                    marginBottom: 0,
                    flexDirection: "row",
                    alignItems: "center",
                    minHeight: 30,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 8 }}>
                    <View
                      style={{
                        width: 3,
                        height: 14,
                        backgroundColor: GREEN,
                        borderRadius: 2,
                        marginRight: 6,
                      }}
                    />
                    <Text
                      numberOfLines={1}
                      style={{
                        flex: 1,
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: "400",
                      }}
                    >
                      {squad.teamName || "Your team"}
                    </Text>
                  </View>
                </View>
              )}

              {/* Row 3: Gameweek points (opens breakdown) | Season total | Overall rank */}
              {!showLeagues && mode === "lineup" && (() => {
                const eventId = squad.eventId ?? squad.currentGw;
                const eventGw = squad.gameweeks.find((gw) => gw.id === eventId);
                const liveNow =
                  ownLive && ownLive.entry === squad.entry && ownLive.event === eventId
                    ? ownLive
                    : null;
                return (
                  <View style={{ marginTop: 4, marginHorizontal: 2 }}>
                    <SquadSummaryBar
                      gameweek={eventId ?? null}
                      gameweekPoints={liveNow ? liveNow.total : (squad.eventPoints ?? null)}
                      live={Boolean(eventGw?.isCurrent && !eventGw.finished)}
                      season={seasonLabel(squad.gameweeks)}
                      totalPoints={liveNow?.seasonTotal ?? squad.totalPoints ?? null}
                      overallRank={liveNow?.overallRank ?? squad.overallRank ?? null}
                      onOpenPoints={() => openOwnHistory()}
                    />
                  </View>
                );
              })()}
              </Animated.View>
            </View>
          </View>

          {/* A problem loading the team while it's on screen: say so, quietly.
              Cleared by the next successful load. */}
          {!!error && (
            <View
              accessibilityLiveRegion="polite"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                marginHorizontal: 8,
                marginBottom: 6,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                backgroundColor: "#151c19",
                borderWidth: 1,
                borderColor: "rgba(242, 193, 78, 0.35)",
              }}
            >
              <Text style={{ flex: 1, color: "#e9dcb5", fontSize: 12.5, lineHeight: 17 }}>{error}</Text>
              <Pressable onPress={refresh} accessibilityRole="button" hitSlop={8}>
                <Text style={{ color: "#f2f5f3", fontSize: 12.5, fontWeight: "700" }}>Retry</Text>
              </Pressable>
              <Pressable
                onPress={() => setError("")}
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
                hitSlop={8}
              >
                <AppSymbol name={{ ios: "xmark", android: "close", web: "close" }} color="#7f8c86" size={16} />
              </Pressable>
            </View>
          )}

          {!showLeagues && transferStatsVisible && (
            // Fades with the page, like the header rows above.
            <Animated.View
              style={{
                paddingHorizontal: 8,
                paddingTop: 2,
                marginBottom: 6,
                opacity: modeTransitionOpacity,
              }}
            >
              <TransferSummaryBar
                gameweek={nextGwDeadlineInfo?.id ?? squad.gw}
                deadlineDate={nextGwDeadlineInfo?.formattedDate ?? null}
                deadlineIso={nextGwDeadlineInfo?.deadlineIso ?? null}
                freeTransfers={squad.freeTransfers}
                pendingCount={pending.length}
                bank={bankAfter}
                pointsCost={pendingChip ? 0 : hit}
                chipLabel={pendingChip ? selectedChipOption?.label ?? "Chip active" : null}
                squadValue={squad.value}
              />
            </Animated.View>
          )}

          <Animated.ScrollView
            ref={mainScrollRef}
            style={{
              flex: 1,
              opacity: modeTransitionOpacity,
              transform: [{ translateX: modeTransitionX }],
              // Clear the docked tab bar: 56 tall plus the phone's navigation
              // area, whose height differs between devices.
              marginBottom: insets.bottom + 56,
            }}
            scrollEnabled={mode === "leagues" || mode === "more"}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              flexGrow: 1,
              width: "100%",
            }}
          >
            {mode === "leagues" ? (
              <LeagueHub
                leagues={squad.leagues}
                selectedLeague={selectedLeague}
                standings={leagueStandings}
                h2hMatches={h2hMatches}
                h2hEvent={h2hEvent}
                h2hLoading={h2hLoading}
                userStanding={userStanding}
                liveEventId={squad.eventId ?? null}
                liveEventPoints={squad.eventPoints ?? null}
                onSelectH2hEvent={loadH2hMatches}
                onCloseLeague={closeLeague}
                loading={leagueLoading}
                error={leagueError}
                successSignal={leagueActionNonce}
                gameweeks={squad.gameweeks.filter(
                  (gameweek) => gameweek.finished || gameweek.isCurrent,
                )}
                inviteCode={
                  selectedLeague ? inviteCodes[selectedLeague.id] ?? null : null
                }
                userTotalPoints={squad.totalPoints ?? null}
                onSelectLeague={loadLeague}
                onJoin={joinLeague}
                onCreate={createLeague}
                onGetInviteCode={getInviteCode}
                onViewMember={viewMemberSquad}
                userEntryId={squad?.entry}
              />
            ) : mode === "more" ? (
              <MorePage
                teamName={squad.teamName || "Your team"}
                managerName={squad.managerName || "Manager"}
                entry={squad.entry}
                version={APP_VERSION}
                notifSettings={notifSettings}
                notifPermission={notifPermission}
                onToggleNotification={toggleNotification}
                onOpenSettings={() => Linking.openSettings()}
                onOpenSeason={() => setShowSeason(true)}
                onOpenPlanner={() => setShowPlanner(true)}
                onOpenHelper={() => setShowHelper(true)}
                onOpenMatches={() => setShowMatches(true)}
                onOpenPrivacy={() => setShowPrivacy(true)}
                onOpenTerms={() => setShowTerms(true)}
                onLogout={handleLogout}
              />
            ) : (
              <View style={{ flex: 1, width: "100%", position: "relative" }}>
                {selectedPos !== null && (
                  <Pressable
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      zIndex: 1,
                    }}
                    onPress={() => {
                      setSelectedPos(null);
                      setPlayerSheetOpen(false);
                    }}
                  />
                )}
              <View style={{ zIndex: 2, flex: 1, width: "100%" }}>
                  <Pitch
                    picks={shownPicks}
                    selectedGw={currentSelectedGw}
                    selectedPos={selectedPos}
                    showPrice={mode === "transfers"}
                    swapHint={mode !== "transfers" && !locked}
                    onPress={onPlayerPress}
                    onSetCaptain={(r) => setRole("cap", r.pos)}
                    onSetViceCaptain={(r) => setRole("vice", r.pos)}
                    onTransfer={(r) => {
                      const isPending = pending.some((x) => x.pos === r.pos);
                      if (isPending) {
                        undoSlot(r.pos);
                      } else {
                        setPickPos(r.pos);
                        setSelectedPos(null);
                      }
                    }}
                    onOpenDetails={(r) => {
                      setSelectedPos(r.pos);
                      setPlayerSheetOpen(true);
                    }}
                    onBackgroundPress={() => setSelectedPos(null)}
                    cardStats={mode === "lineup" ? cardStats : undefined}
                    overlay={
                      <View
                        pointerEvents="box-none"
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 10,
                        }}
                      >
                        {/* Top right: choose extra info for the cards */}
                        {mode === "lineup" && (
                          <Pressable
                            onPress={() => setShowCardInfo(true)}
                            accessibilityRole="button"
                            accessibilityLabel="Card info: choose extra figures to show on player cards"
                            style={({ pressed }) => ({
                              position: "absolute",
                              top: 8,
                              right: 8,
                              zIndex: 10,
                              width: 38,
                              height: 38,
                              borderRadius: 19,
                              alignItems: "center",
                              justifyContent: "center",
                              borderWidth: 1,
                              borderColor: cardStats.length ? THEME.accentLine : "rgba(255, 255, 255, 0.14)",
                              backgroundColor: pressed ? THEME.surfaceRaised : THEME.surface,
                              elevation: 5,
                              shadowColor: "#000",
                              shadowOpacity: 0.3,
                              shadowRadius: 6,
                              shadowOffset: { width: 0, height: 2 },
                            })}
                          >
                            <AppSymbol
                              name={{ ios: "slider.horizontal.3", android: "tune", web: "tune" }}
                              color={cardStats.length ? THEME.accent : THEME.ink}
                              size={18}
                            />
                          </Pressable>
                        )}
                        {/* Top Left Chip Button */}
                        <View
                          pointerEvents="box-none"
                          style={{
                            position: "absolute",
                            top: 8,
                            left: 8,
                            zIndex: 10,
                          }}
                        >
                          <Pressable
                            onPress={() => setShowChipMenu((visible) => !visible)}
                            accessibilityRole="button"
                            accessibilityLabel={
                              showChipMenu ? "Close chips" : "Open chips"
                            }
                            accessibilityState={{ expanded: showChipMenu }}
                            style={({ pressed }) => ({
                              width: 38,
                              height: 38,
                              borderRadius: 19,
                              alignItems: "center",
                              justifyContent: "center",
                              borderWidth: 1,
                              borderColor: showChipMenu
                                ? "rgba(255, 255, 255, 0.35)"
                                : "rgba(255, 255, 255, 0.14)",
                              backgroundColor: pressed ? "#2c3431" : "#212826",
                              elevation: 5,
                              shadowColor: "#000",
                              shadowOpacity: 0.3,
                              shadowRadius: 6,
                              shadowOffset: { width: 0, height: 2 },
                            })}
                          >
                            <AppSymbol
                              name={{
                                ios: "square.stack.3d.up.fill",
                                android: "layers",
                                web: "layers",
                              }}
                              color="#e6efe9"
                              size={18}
                            />
                            {(pendingChip || squad.chip) && (
                              <View
                                style={{
                                  position: "absolute",
                                  top: 2,
                                  right: 2,
                                  width: 9,
                                  height: 9,
                                  borderRadius: 5,
                                  backgroundColor: GREEN,
                                  borderWidth: 1.5,
                                  borderColor: "#212826",
                                }}
                              />
                            )}
                          </Pressable>
                          {showChipMenu && (
                            <View
                              style={{
                                position: "absolute",
                                top: 46,
                                left: 0,
                                width: 236,
                                padding: 12,
                                borderRadius: 16,
                                borderWidth: 1,
                                borderColor: "rgba(255, 255, 255, 0.08)",
                                backgroundColor: "#212826",
                                elevation: 14,
                                shadowColor: "#000",
                                shadowOpacity: 0.4,
                                shadowRadius: 16,
                                shadowOffset: { width: 0, height: 8 },
                              }}
                            >
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  marginBottom: 10,
                                }}
                              >
                                <Text
                                  accessibilityRole="header"
                                  style={{
                                    color: "#9db3a6",
                                    fontSize: 11,
                                    fontWeight: "800",
                                    letterSpacing: 0.6,
                                  }}
                                >
                                  CHIPS
                                </Text>
                                <Pressable
                                  onPress={() => setShowChipMenu(false)}
                                  hitSlop={10}
                                  accessibilityRole="button"
                                  accessibilityLabel="Close chips"
                                >
                                  <AppSymbol
                                    name={{
                                      ios: "xmark",
                                      android: "close",
                                      web: "close",
                                    }}
                                    color="#9db3a6"
                                    size={16}
                                  />
                                </Pressable>
                              </View>
                              <View
                                style={{
                                  flexDirection: "row",
                                  flexWrap: "wrap",
                                  justifyContent: "space-between",
                                  rowGap: 6,
                                }}
                              >
                                {CHIP_OPTIONS.map((chip) => {
                                  const available = squad.availableChips.includes(
                                    chip.id,
                                  );
                                  const selected = pendingChip === chip.id;
                                  const active = squad.chip === chip.id;
                                  const chipStatus = squad.chipStatuses[chip.id];
                                  const usable = available && !locked;
                                  const highlighted = selected || active;
                                  const statusText = selected
                                    ? "Selected"
                                    : active
                                      ? "Active"
                                      : available
                                        ? "Available"
                                        : chipStatus === "played"
                                          ? "Used"
                                          : "Unavailable";
                                  return (
                                    <Pressable
                                      key={chip.id}
                                      onPress={() => selectChip(chip)}
                                      disabled={!usable}
                                      accessibilityRole="button"
                                      accessibilityLabel={`${chip.label}, ${statusText}`}
                                      accessibilityState={{ disabled: !usable, selected }}
                                      style={({ pressed }) => ({
                                        width: "48.5%",
                                        minHeight: 46,
                                        paddingHorizontal: 8,
                                        paddingVertical: 6,
                                        borderRadius: 12,
                                        borderWidth: 1,
                                        borderColor: highlighted
                                          ? "rgba(0, 217, 130, 0.7)"
                                          : "rgba(255, 255, 255, 0.08)",
                                        backgroundColor: highlighted
                                          ? "rgba(0, 217, 130, 0.14)"
                                          : pressed
                                            ? "rgba(255, 255, 255, 0.1)"
                                            : "rgba(255, 255, 255, 0.05)",
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 7,
                                        opacity: usable || highlighted ? 1 : 0.45,
                                      })}
                                    >
                                      <AppSymbol
                                        name={CHIP_SYMBOLS[chip.id]}
                                        color={highlighted ? GREEN : usable ? "#e6efe9" : "#9db3a6"}
                                        size={17}
                                      />
                                      <View style={{ flex: 1 }}>
                                        <Text
                                          numberOfLines={1}
                                          adjustsFontSizeToFit
                                          minimumFontScale={0.8}
                                          style={{
                                            color: "#ffffff",
                                            fontSize: 11,
                                            fontWeight: "800",
                                          }}
                                        >
                                          {chip.label}
                                        </Text>
                                        <Text
                                          style={{
                                            color: highlighted ? GREEN : "#9db3a6",
                                            fontSize: 9.5,
                                            fontWeight: highlighted ? "800" : "600",
                                            marginTop: 1,
                                          }}
                                        >
                                          {statusText}
                                        </Text>
                                      </View>
                                    </Pressable>
                                  );
                                })}
                              </View>
                              {pendingChip && (
                                <Pressable
                                  onPress={() => {
                                    setPendingChip(null);
                                    setShowChipMenu(false);
                                  }}
                                  accessibilityRole="button"
                                  hitSlop={6}
                                  style={({ pressed }) => ({
                                    alignSelf: "flex-end",
                                    marginTop: 10,
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: 10,
                                    backgroundColor: pressed
                                      ? "rgba(255, 107, 122, 0.18)"
                                      : "transparent",
                                  })}
                                >
                                  <Text
                                    style={{
                                      color: "#ff6b7a",
                                      fontSize: 11.5,
                                      fontWeight: "800",
                                    }}
                                  >
                                    Cancel {selectedChipOption?.label ?? "chip"}
                                  </Text>
                                </Pressable>
                              )}
                            </View>
                          )}
                        </View>

                      </View>
                    }
                  />
              </View>
            </View>
          )}
          </Animated.ScrollView>

          <PlayerDetailsSheet
            visible={playerSheetOpen && selectedPlayer !== null}
            player={selectedPlayer}
            currentGw={squad.currentGw}
            bottomInset={insets.bottom}
            isTransferMode={mode === "transfers"}
            isReplaced={selectedIsReplaced}
            actionsEnabled={!locked}
            onClose={() => {
              setPlayerSheetOpen(false);
              setSelectedPos(null);
            }}
            onSetRole={setRole}
            onTransfer={() => {
              if (selectedPos === null) return;
              setPickPos(selectedPos);
              setPlayerSheetOpen(false);
            }}
            onUndoTransfer={undoSlot}
            onStartSubstitution={() => setPlayerSheetOpen(false)}
            element={selectedPlayer ? (elements[selectedPlayer.id] ?? null) : null}
            elementFailed={elementsFailed}
            onRetryElement={() => readFplData.current(true)}
            teamNames={teamNames}
          />



          {/* Summary bar: transfers mode */}
          {mode === "transfers" &&
            (pending.length > 0 ||
              pendingChip === "wildcard" ||
              pendingChip === "freehit") &&
            selectedPos === null && (
              <View
                style={{
                  position: "absolute",
                  left: 16,
                  right: 16,
                  bottom: insets.bottom + 116,
                  backgroundColor: "rgba(4, 16, 10, 0.96)",
                  borderRadius: 18,
                  padding: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  borderWidth: 1,
                  borderColor: "rgba(0, 217, 130, 0.35)",
                  shadowColor: "#000",
                  shadowOpacity: 0.4,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 10,
                }}
              >
                <Pressable
                  onPress={() => {
                    setPending([]);
                    setPendingChip(null);
                  }}
                  disabled={sending}
                  accessibilityRole="button"
                  accessibilityLabel="Reset all transfers"
                  style={({ pressed }) => ({
                    height: 44,
                    paddingHorizontal: 16,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.2)",
                    backgroundColor: pressed ? "rgba(255, 255, 255, 0.16)" : "rgba(255, 255, 255, 0.06)",
                    opacity: sending ? 0.5 : 1,
                  })}
                >
                  <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 13 }}>Reset</Text>
                </Pressable>
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Text numberOfLines={1} style={{ color: "#ffffff", fontWeight: "900", fontSize: 14 }}>
                    {pending.length} transfer{pending.length === 1 ? "" : "s"}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: hit > 0 && !pendingChip ? "#ff526f" : THEME.good,
                      fontSize: 11,
                      fontWeight: "800",
                      marginTop: 1,
                    }}
                  >
                    {pendingChip
                      ? `${selectedChipOption?.label ?? "Chip"} · free`
                      : hit > 0
                        ? `Costs ${hit} points`
                        : "No points cost"}
                  </Text>
                </View>
                <Pressable
                  onPress={reviewTransfers}
                  disabled={sending || pending.length === 0}
                  accessibilityRole="button"
                  accessibilityLabel="Review and confirm transfers"
                  style={({ pressed }) => ({
                    height: 44,
                    paddingHorizontal: 20,
                    borderRadius: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    backgroundColor: GREEN,
                    opacity: sending || pending.length === 0 ? 0.45 : pressed ? 0.8 : 1,
                  })}
                >
                  {sending && <ActivityIndicator color="#071b12" size="small" />}
                  <Text style={{ color: "#071b12", fontWeight: "900", fontSize: 14 }}>
                    {sending ? "Sending" : "Review"}
                  </Text>
                </Pressable>
              </View>
            )}

          <PlayerPicker
            visible={pickPos !== null}
            title={pickSlot ? `Replace ${pickSlot.name}` : "Replace player"}
            subtitle={
              pickSlot
                ? `Budget for this spot: up to ${money(bankAfter + pickSlot.sell)}`
                : ""
            }
            candidates={candidates}
            maxCost={pickInfo ? pickInfo.maxCost : 0}
            fullClubs={pickInfo ? pickInfo.fullClubs : []}
            squadIds={squadIds}
            outgoingId={pickSlot?.id ?? null}
            sellPrice={pickSlot?.sell}
            onPick={pickPlayer}
            onClose={() => setPickPos(null)}
          />
        </View>
      )}

      {stage === "squad" && squad && (
        <View
          pointerEvents="box-none"
          style={{
            // Docked: full width, square corners, flush with the bottom edge
            // and extending under the phone's navigation area.
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: FOOTER_HEIGHT + insets.bottom,
            zIndex: 20,
            overflow: "visible",
          }}
        >
          <View
            style={{
              flex: 1,
              overflow: "hidden",
              borderTopWidth: 1,
              borderTopColor: THEME.line,
              paddingBottom: insets.bottom,
              backgroundColor: THEME.nav,
            }}
          >
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 4,
              }}
            >
              <BottomTab
                icon={{
                  ios: "soccerball",
                  android: "sports_soccer",
                  web: "sports_soccer",
                }}
                label="Lineup"
                selected={activeBottomTab === "lineup"}
                onPressIn={() => setActiveBottomTab("lineup")}
                onPress={() => {
                  setActiveMember(null);
                  setShowSeason(false);
                  setShowPlanner(false);
                  setShowHelper(false);
                  setShowMatches(false);
                  setShowPrivacy(false);
                  setShowTerms(false);
                  setShowLeagues(false);
                  switchMode("lineup");
                }}
              />
              <BottomTab
                icon={{
                  ios: "arrow.left.arrow.right",
                  android: "swap_horiz",
                  web: "swap_horiz",
                }}
                label="Transfers"
                selected={activeBottomTab === "transfers"}
                onPressIn={() => setActiveBottomTab("transfers")}
                onPress={() => {
                  setActiveMember(null);
                  setShowSeason(false);
                  setShowPlanner(false);
                  setShowHelper(false);
                  setShowMatches(false);
                  setShowPrivacy(false);
                  setShowTerms(false);
                  setShowLeagues(false);
                  switchMode("transfers");
                }}
              />
              <BottomTab
                icon={{
                  ios: "trophy",
                  android: "trophy",
                  web: "trophy",
                }}
                label="Leagues"
                selected={mode === "leagues"}
                onPressIn={() => setActiveBottomTab("leagues")}
                onPress={() => {
                  setActiveMember(null);
                  setShowSeason(false);
                  setShowPlanner(false);
                  setShowHelper(false);
                  setShowMatches(false);
                  setShowPrivacy(false);
                  setShowTerms(false);
                  setActiveBottomTab("leagues");
                  switchMode("leagues");
                }}
              />
              <BottomTab
                icon={{
                  ios: "ellipsis.circle",
                  android: "more_horiz",
                  web: "more_horiz",
                }}
                label="More"
                selected={mode === "more"}
                onPressIn={() => setActiveBottomTab("more")}
                onPress={() => {
                  setActiveMember(null);
                  setShowSeason(false);
                  setShowPlanner(false);
                  setShowHelper(false);
                  setShowMatches(false);
                  setShowPrivacy(false);
                  setShowTerms(false);
                  setActiveBottomTab("more");
                  switchMode("more");
                }}
              />
            </View>
          </View>
        </View>
      )}

      {/* Team page is opening: hold the current screen until its data is in */}
      {stage === "squad" && squad && activeMember && !activeMemberReady && (
        <LoadingVeil label="Loading team…" zIndex={15} accent={GREEN} onCancel={() => setActiveMember(null)} />
      )}

      <AnimatedScreen visible={stage === "squad" && !!squad && showSeason} zIndex={16}>
        {stage === "squad" && squad && showSeason && (
          <SeasonInsights
            entry={squad.entry}
            teamName={squad.teamName || "Your team"}
            onBack={() => setShowSeason(false)}
          />
        )}
      </AnimatedScreen>

      <AnimatedScreen visible={stage === "squad" && !!squad && !!activeMember && activeMemberReady} zIndex={15}>
        {stage === "squad" && squad && activeMember && activeMemberReady && (
          <ManagerHistory
            title={activeMember.teamName}
            managerName={activeMember.managerName}
            entry={activeMember.entry}
            gameweeks={squad.gameweeks.filter(
              (gameweek) => gameweek.finished || gameweek.isCurrent,
            )}
            selectedEvent={activeMemberEvent}
            data={memberSquad}
            loading={managerLoading}
            error={managerError}
            fixturesByTeam={squad.fixturesByTeam}
            onBack={closeActiveMember}
            onViewEntry={openTopEntry}
            onSelectEvent={(event) => {
              setActiveMemberEvent(event);
              loadManagerGameweek(activeMember.entry, event);
            }}
          />
        )}
      </AnimatedScreen>
      <AnimatedScreen visible={stage === "squad" && !!squad && showHelper} zIndex={16}>
        {stage === "squad" && squad && showHelper && (
          <GameweekHelper
            rows={helperRows}
            event={squad.gw}
            eventName={squad.gameweeks.find((gw) => gw.id === squad.gw)?.name ?? `Gameweek ${squad.gw}`}
            chipStatuses={squad.chipStatuses ?? {}}
            activeChip={pendingChip ?? squad.chip ?? null}
            onBack={() => setShowHelper(false)}
          />
        )}
      </AnimatedScreen>
      <AnimatedScreen visible={stage === "squad" && !!squad && showPlanner} zIndex={16}>
        {stage === "squad" && squad && showPlanner && (
          <FixturePlanner
            teams={plannerTeams}
            myClubs={plannerMyClubs}
            startEvent={squad.gw}
            onBack={() => setShowPlanner(false)}
          />
        )}
      </AnimatedScreen>
      <AnimatedScreen visible={stage === "squad" && !!squad && showMatches} zIndex={16}>
        {stage === "squad" && squad && showMatches && (
          <MatchCentre
            startEvent={squad.gameweeks.find((gw) => gw.isCurrent)?.id ?? squad.gw}
            myPlayerIds={matchesMyPlayers}
            onBack={() => setShowMatches(false)}
          />
        )}
      </AnimatedScreen>
      <CardInfoSheet
        visible={showCardInfo && stage === "squad"}
        selected={cardStats}
        onChange={changeCardStats}
        onClose={() => setShowCardInfo(false)}
      />
      <AnimatedScreen visible={showPrivacy} zIndex={30}>
        {showPrivacy && <PrivacyPolicy onBack={() => setShowPrivacy(false)} />}
      </AnimatedScreen>
      <AnimatedScreen visible={showTerms} zIndex={30}>
        {showTerms && <TermsAndConditions onBack={() => setShowTerms(false)} />}
      </AnimatedScreen>
      <AppDialog
        visible={dialog !== null}
        title={dialog?.title ?? ""}
        message={dialog?.message ?? ""}
        buttons={dialog?.buttons ?? []}
        kind={dialog?.kind ?? "confirm"}
        content={dialog?.content}
        onDismiss={() => setDialog(null)}
      />
    </View>
  );
}
