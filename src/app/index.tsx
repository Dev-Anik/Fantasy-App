import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { GlassView } from "expo-glass-effect";
import type { SymbolViewProps } from "expo-symbols";
import { AppDialog } from "../AppDialog";
import type { DialogButton } from "../AppDialog";
import { AppSymbol } from "../AppSymbol";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  buildLeagueActionJs,
  buildSaveJs,
  buildTransferJs,
  FETCH_JS,
  FplLeague,
  LeagueStandings,
  LeagueType,
  MemberSquad,
  Player,
  Row,
  Squad,
} from "../fpl";
import { LeagueHub } from "../LeagueHub";
import { ManagerHistory } from "../ManagerHistory";
import { Pitch } from "../Pitch";
import { PlayerDetailsSheet } from "../PlayerDetailsSheet";
import { PlayerPicker } from "../PlayerPicker";

if ((Text as any).defaultProps == null) (Text as any).defaultProps = {};
(Text as any).defaultProps.style = { fontFamily: "Roboto" };

type Stage = "checking" | "welcome" | "login" | "squad";
type Mode = "lineup" | "transfers" | "leagues" | "more";
type BottomTabId = Mode;
type Pending = { pos: number; inn: Player };
type PlayableChip = "wildcard" | "freehit" | "bboost" | "3xc";

const STORAGE_SQUAD = "profpl_cached_squad";
const STORAGE_LOGGED_IN = "profpl_is_logged_in";
const STORAGE_CREDS = "profpl_user_credentials";

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

const PURPLE = "#37003c";
const GREEN = "#00d982";
const APP_VERSION = "1.1.1";
// Test build safety: refuse transfers that would cost points.
// Set to true later if you want to allow point hits.
const ALLOW_HITS = false;

function Feature({
  icon,
  text,
}: {
  icon: SymbolViewProps["name"];
  text: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 14 }}>
      <View
          style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: "rgba(255,255,255,0.12)",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <AppSymbol name={icon} color="#fff" size={18} />
      </View>
      <Text style={{ color: "#fff", fontSize: 15 }}>{text}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flex: 1,
        height: 30,
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.08)",
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 6,
        marginHorizontal: 3,
      }}
    >
      <Text style={{ color: "#cdb9d1", fontSize: 8, lineHeight: 9 }}>
        {label}
      </Text>
      <Text
        style={{
          color: "#fff",
          fontSize: 11,
          lineHeight: 13,
          fontWeight: "bold",
        }}
      >
        {value}
      </Text>
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
        color: "rgba(0, 217, 130, 0.25)",
        borderless: false,
        radius: 24,
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flex: 1,
        height: 48,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 24,
        overflow: "hidden",
        paddingVertical: 4,
        backgroundColor: selected
          ? pressed
            ? "#02351b"
            : "#044222"
          : pressed
            ? "rgba(0, 217, 130, 0.22)"
            : hovered
              ? "rgba(0, 217, 130, 0.12)"
              : "transparent",
        borderWidth: selected ? 1.5 : pressed || hovered ? 1 : 0,
        borderColor: selected
          ? "#00d982"
          : pressed
            ? "rgba(0, 217, 130, 0.5)"
            : hovered
              ? "rgba(0, 217, 130, 0.3)"
              : "transparent",
        shadowColor: "#00d982",
        shadowOpacity: selected ? 0.35 : pressed ? 0.25 : 0,
        shadowRadius: selected ? 8 : pressed ? 6 : 0,
        shadowOffset: { width: 0, height: 0 },
        transform: [{ scale: pressed ? 0.93 : hovered ? 1.02 : 1 }],
      })}
    >
      {({ pressed }) => (
        <>
          <AppSymbol
            name={icon}
            color={selected || pressed ? "#00d982" : "#c4d8ce"}
            size={19}
          />
          <Text
            style={{
              color: selected ? "#ffffff" : pressed ? "#00d982" : "#c4d8ce",
              fontSize: 11,
              fontWeight: selected || pressed ? "800" : "500",
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

const formatRemainingTime = (isoString?: string | null, nowMs: number = Date.now()) => {
  if (!isoString) return "—";
  const deadlineMs = new Date(isoString).getTime();
  if (isNaN(deadlineMs)) return "—";
  const diff = deadlineMs - nowMs;
  if (diff <= 0) return "Deadline Passed";

  const totalSecs = Math.floor(diff / 1000);
  const days = Math.floor(totalSecs / (3600 * 24));
  const hours = Math.floor((totalSecs % (3600 * 24)) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${mins}m`;
  }
  return `${hours}h ${mins}m ${secs}s`;
};

export default function Index() {
  const insets = useSafeAreaInsets();
  const webRef = useRef<any>(null);
  const [stage, setStage] = useState<Stage>("checking");
  const stageRef = useRef<Stage>(stage);
  stageRef.current = stage;

  const [squad, setSquad] = useState<Squad | null>(null);
  const [draft, setDraft] = useState<Row[]>([]);
  const [selectedPos, setSelectedPos] = useState<number | null>(null);
  const [playerSheetOpen, setPlayerSheetOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("lineup");
  const [activeBottomTab, setActiveBottomTab] =
    useState<BottomTabId>("lineup");
  const modeTransitionOpacity = useRef(new Animated.Value(1)).current;
  const modeTransitionX = useRef(new Animated.Value(0)).current;
  const modeTransitioning = useRef(false);
  const leaguesAnim = useRef(new Animated.Value(0)).current;
  const historyAnim = useRef(new Animated.Value(0)).current;

  const [transferStatsVisible, setTransferStatsVisible] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [pendingChip, setPendingChip] = useState<PlayableChip | null>(null);
  const [showChipMenu, setShowChipMenu] = useState(false);
  const [dialog, setDialog] = useState<{
    title: string;
    message: string;
    buttons: DialogButton[];
  } | null>(null);
  const [pickPos, setPickPos] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [showLeagues, setShowLeagues] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeMember, setActiveMember] = useState<{
    entry: number;
    teamName: string;
    managerName: string;
    isOwnPoints?: boolean;
  } | null>(null);
  const [activeMemberEvent, setActiveMemberEvent] = useState<number>(1);

  const [nowMs, setNowMs] = useState(Date.now());
  const [fplEvents, setFplEvents] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/");
        if (res.ok) {
          const json = await res.json();
          if (json && json.events) {
            setFplEvents(json.events);
          }
        }
      } catch (e) {}
    })();
  }, []);

  useEffect(() => {
    if (mode !== "transfers") return;
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [mode]);

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
      remainingText: deadlineTimeIso ? formatRemainingTime(deadlineTimeIso, nowMs) : "Active",
    };
  }, [squad, fplEvents, nowMs]);

  const modalWebRef = useRef<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleModalKey, setGoogleModalKey] = useState(0);

  const lastAttemptedEmail = useRef("");
  const lastAttemptedPassword = useRef("");

  useEffect(() => {
    (async () => {
      try {
        const savedCreds = await AsyncStorage.getItem(STORAGE_CREDS);
        if (savedCreds) {
          const { email: savedEmail, password: savedPassword } = JSON.parse(savedCreds);
          if (savedEmail) {
            setEmail(savedEmail);
            lastAttemptedEmail.current = savedEmail;
          }
          if (savedPassword) {
            setPassword(savedPassword);
            lastAttemptedPassword.current = savedPassword;
          }
        }

        const loggedInFlag = await AsyncStorage.getItem(STORAGE_LOGGED_IN);
        const cachedSquadStr = await AsyncStorage.getItem(STORAGE_SQUAD);
        if (loggedInFlag === "true" && cachedSquadStr) {
          const cachedSquad = JSON.parse(cachedSquadStr);
          if (cachedSquad && cachedSquad.entry) {
            setSquad(cachedSquad);
            setStage("squad");
          }
        }
      } catch (e) {}
    })();
  }, []);

  const closeGoogleModal = () => {
    setShowGoogleModal(false);
    modalWebRef.current?.injectJavaScript('window.location.href = "https://fantasy.premierleague.com/";');
  };

  const handleLogin = () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password.trim()) {
      setLoginError("Please enter both your email address and password.");
      return;
    }
    lastAttemptedEmail.current = trimmedEmail;
    lastAttemptedPassword.current = password;
    setLoginLoading(true);
    setLoginError("");

    const loginScript = `
      (function() {
        const send = (o) => window.ReactNativeWebView.postMessage(JSON.stringify(o));
        try {
          let form = document.getElementById("profpl_login_form");
          if (form) form.remove();

          form = document.createElement("form");
          form.id = "profpl_login_form";
          form.method = "POST";
          form.action = "https://fantasy.premierleague.com/accounts/login/";

          const inputLogin = document.createElement("input");
          inputLogin.name = "login";
          inputLogin.value = ${JSON.stringify(trimmedEmail)};
          form.appendChild(inputLogin);

          const inputPass = document.createElement("input");
          inputPass.name = "password";
          inputPass.value = ${JSON.stringify(password)};
          form.appendChild(inputPass);

          const inputApp = document.createElement("input");
          inputApp.name = "app";
          inputApp.value = "fpl-web";
          form.appendChild(inputApp);

          const inputRedir = document.createElement("input");
          inputRedir.name = "redirect_uri";
          inputRedir.value = "https://fantasy.premierleague.com/";
          form.appendChild(inputRedir);

          document.body.appendChild(form);

          let attempts = 0;
          const checkTimer = setInterval(async () => {
            attempts++;
            try {
              const meRes = await fetch("https://fantasy.premierleague.com/api/me/", { credentials: "include" });
              if (meRes.ok) {
                const me = await meRes.json().catch(() => null);
                if (me && me.player && me.player.entry) {
                  clearInterval(checkTimer);
                  send({ loginSuccess: true });
                  return;
                }
              }
            } catch(e) {}

            if (attempts >= 15) {
              clearInterval(checkTimer);
              send({ loginError: "Invalid email or password. Please check your credentials and try again." });
            }
          }, 600);

          form.submit();
        } catch (err) {
          send({ loginError: "Login submission failed. Please try again or sign via PL web." });
        }
      })();
      true;
    `;

    webRef.current?.injectJavaScript(loginScript);

    setTimeout(() => {
      setLoginLoading((loading) => {
        if (loading) {
          setLoginError("Sign in timed out. Please check your network and try again.");
          return false;
        }
        return false;
      });
    }, 15000);
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
            AsyncStorage.removeItem(STORAGE_SQUAD).catch(() => {});
            AsyncStorage.setItem(STORAGE_LOGGED_IN, "false").catch(() => {});
            webRef.current?.injectJavaScript(`
              (() => {
                try {
                  localStorage.clear();
                  sessionStorage.clear();
                } catch(e) {}
                document.cookie.split(";").forEach(c => {
                  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=.premierleague.com");
                  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=.fantasy.premierleague.com");
                  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/");
                });
                window.location.href = "https://fantasy.premierleague.com/";
              })();
            `);
            setSquad(null);
            setDraft([]);
            setPending([]);
            setPendingChip(null);
            setSelectedPos(null);
            setPickPos(null);
            setStage("welcome");
            setActiveBottomTab("lineup");
            setMode("lineup");
          },
        },
      ],
    );
  };

  useEffect(() => {
    Animated.timing(leaguesAnim, {
      toValue: showLeagues ? 1 : 0,
      duration: showLeagues ? 260 : 180,
      easing: showLeagues ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [showLeagues]);

  useEffect(() => {
    Animated.timing(historyAnim, {
      toValue: showHistory ? 1 : 0,
      duration: showHistory ? 260 : 180,
      easing: showHistory ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [showHistory]);
  const gwScrollRef = useRef<any>(null);
  const mainScrollRef = useRef<any>(null);
  const [showGameweekMenu, setShowGameweekMenu] = useState(false);
  const gwMenuAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showGameweekMenu) {
      gwMenuAnim.setValue(0);
      Animated.timing(gwMenuAnim, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [showGameweekMenu]);
  const activeEvent = squad?.currentGw ?? squad?.gw ?? 1;
  const gameweeks = squad?.gameweeks ?? [];
  const reversedGameweeks = useMemo(() => [...gameweeks].reverse(), [gameweeks]);
  const activeIndex = reversedGameweeks.findIndex(
    (gw) => gw.id === (selectedFixtureGw ?? activeEvent),
  );

  useEffect(() => {
    if (showGameweekMenu && activeIndex >= 0) {
      setTimeout(() => {
        gwScrollRef.current?.scrollTo({
          y: Math.max(0, activeIndex * 44 - 40),
          animated: false,
        });
      }, 40);
    }
  }, [showGameweekMenu, activeIndex]);
  const [selectedFixtureGw, setSelectedFixtureGw] = useState<number | null>(
    null,
  );
  const [selectedLeague, setSelectedLeague] = useState<FplLeague | null>(null);
  const [leagueStandings, setLeagueStandings] =
    useState<LeagueStandings | null>(null);
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
  const [historyEvent, setHistoryEvent] = useState<number | null>(null);
  const managerRequest = useRef<{ entry: number; event: number } | null>(null);

  const showDialog = (
    title: string,
    message: string,
    buttons: DialogButton[] = [{ text: "OK" }],
  ) => setDialog({ title, message, buttons });

  const check = () => webRef.current?.injectJavaScript(FETCH_JS);
  const runLeagueAction = (
    action:
      | { action: "standings"; league: FplLeague; page: number }
      | { action: "join"; code: string }
      | {
          action: "create";
          name: string;
          leagueType: LeagueType;
          startEvent: number;
          knockoutRounds?: number;
        }
      | { action: "invite-code"; leagueId: number }
      | { action: "manager-gameweek"; entry: number; event: number },
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
    webRef.current.injectJavaScript(buildLeagueActionJs(action));
  };

  const loadLeague = (league: FplLeague, page = 1) => {
    if (page === 1) {
      setSelectedLeague(league);
      setLeagueStandings(null);
      setMemberSquad(null);
    }
    runLeagueAction({ action: "standings", league, page });
  };

  const getInviteCode = (league: FplLeague) => {
    runLeagueAction({ action: "invite-code", leagueId: league.id });
  };

  const loadManagerGameweek = (entry: number, event: number) => {
    managerRequest.current = { entry, event };
    setMemberSquad(null);
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

  const openOwnHistory = (event?: number) => {
    if (!squad) return;
    setShowLeagues(false);
    const finishedGws = squad.gameweeks.filter((gw) => gw.finished);
    const defaultGw = finishedGws.length > 0
      ? finishedGws[finishedGws.length - 1].id
      : Math.max(1, squad.gw - 1);
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

  const selectOwnHistoryEvent = (event: number) => {
    if (!squad) return;
    setHistoryEvent(event);
    loadManagerGameweek(squad.entry, event);
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
              knockoutRounds: knockoutRounds ?? 1,
            }),
        },
      ],
    );
  };
  // Whenever fresh squad data arrives, reset all editable state
  useEffect(() => {
    if (squad) {
      setDraft(squad.picks);
      setSelectedFixtureGw(squad.gw);
      setSelectedPos(null);
      setPlayerSheetOpen(false);
      setPending([]);
      setPendingChip(null);
      setPickPos(null);
    }
  }, [squad]);

  useEffect(() => {
    if (stage !== "checking") return;
    check();
    const t = setTimeout(
      () => setStage((s) => (s === "checking" ? "welcome" : s)),
      8000,
    );
    return () => clearTimeout(t);
  }, [stage]);

  const onMessage = (e: any) => {
    let msg: any;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.googleLoginSuccess) {
      closeGoogleModal();
      check();
      return;
    }
    if (msg.loginSuccess) {
      setLoginLoading(false);
      setLoginError("");
      if (lastAttemptedEmail.current && lastAttemptedPassword.current) {
        AsyncStorage.setItem(
          STORAGE_CREDS,
          JSON.stringify({ email: lastAttemptedEmail.current, password: lastAttemptedPassword.current })
        ).catch(() => {});
      }
      check();
      return;
    }
    if (msg.loginError) {
      setLoginLoading(false);
      setLoginError(msg.loginError);
      return;
    }
    if (msg.saved) {
      setSaving(false);
      setPendingChip(null);
      check();
      return;
    }
    if (msg.saveError) {
      setSaving(false);
      showDialog("Could not save", msg.saveError);
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
      );
      check();
      return;
    }
    if (msg.transferError) {
      setSending(false);
      showDialog(
        "Transfer failed",
        msg.transferError +
          "\n\nNothing was retried. Please check the FPL site or app to see your real team.",
      );
      check();
      return;
    }
    if (msg.leagueAction) {
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
          setManagerError(msg.error || "The gameweek could not be loaded.");
        }
        return;
      }
      setLeagueLoading(false);

      if (msg.leagueAction === "standings") {
        setLeagueStandings(msg.data);
        setLeagueError("");
      } else if (msg.leagueAction === "created") {
        setLeagueError("");
        if (msg.leagueId && msg.inviteCode) {
          setInviteCodes((current) => ({
            ...current,
            [msg.leagueId]: msg.inviteCode,
          }));
        }
        const inviteText = msg.inviteCode
          ? ` Invite code: ${msg.inviteCode}`
          : ` The invite code could not be loaded${
              msg.inviteCodeError ? ` (${msg.inviteCodeError})` : ""
            }. Select the league and try "Show invite code".`;
        showDialog("League created", "Your league was created." + inviteText);
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
        showDialog("League joined", "Refreshing your FPL leagues.");
        check();
      } else if (msg.leagueAction === "error") {
        setLeagueError(msg.error || "The league request failed.");
      }
      return;
    }
    setRefreshing(false);
    if (msg.ok) {
      setSquad(msg.squad);
      setError("");
      setStage("squad");
      AsyncStorage.setItem(STORAGE_SQUAD, JSON.stringify(msg.squad)).catch(() => {});
      AsyncStorage.setItem(STORAGE_LOGGED_IN, "true").catch(() => {});
    } else if (msg.notLoggedIn) {
      if (stageRef.current === "checking" && !squad) {
        setStage("welcome");
        AsyncStorage.setItem(STORAGE_LOGGED_IN, "false").catch(() => {});
      }
    } else if (stageRef.current === "squad") {
      setError(msg.error || "Something went wrong");
    }
  };

  const refresh = () => {
    setError("");
    setRefreshing(true);
    check();
  };

  const locked = !!squad?.chip;
  const warn = (msg: string) => showDialog("Can't do that", msg);
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
  const dirty =
    !!squad &&
    JSON.stringify(draft.map((p) => [p.id, p.pos, p.cap, p.vice])) !==
      JSON.stringify(squad.picks.map((p) => [p.id, p.pos, p.cap, p.vice]));

  const confirmLineupChange = (nextDraft: Row[], chipToPlay: PlayableChip | null = pendingChip) => {
    if (!squad) return;
    const cap = nextDraft.find((p) => p.cap)?.name;
    const vice = nextDraft.find((p) => p.vice)?.name;
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
    const lines = [
      inn.length ? `In: ${inn.join(", ")}` : "",
      out.length ? `Out: ${out.join(", ")}` : "",
      `Captain: ${cap}`,
      `Vice-captain: ${vice}`,
    ].filter(Boolean);
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
        : "Save lineup to FPL?",
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
            webRef.current?.injectJavaScript(
              buildSaveJs(squad.entry, nextDraft, chipToPlay, lastAttemptedEmail.current || email, lastAttemptedPassword.current || password),
            );
          },
        },
      ],
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

  const confirmSave = () => {
    confirmLineupChange(draft);
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
            fixtures: squad.fixturesByTeam[t.inn.teamId] ?? [],
          }
        : p;
    });
  }, [squad, pending]);

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
    return squad.pool.filter(
      (pl) =>
        pl.type === pickInfo.slot.type && !tdraft.some((p) => p.id === pl.id),
    );
  }, [squad, pickInfo, tdraft]);

  const pickPlayer = (inn: Player) => {
    if (!squad || pickPos === null || !pickInfo) return;
    if (inn.cost > pickInfo.maxCost) {
      showDialog(
        "Not enough budget",
        `${inn.name} costs ${money(inn.cost)}, but you only have ${money(
          pickInfo.maxCost,
        )} available for this spot (short by ${money(inn.cost - pickInfo.maxCost)}).`,
      );
      return;
    }
    if (pickInfo.fullClubs.includes(inn.teamId)) {
      showDialog(
        "Club limit reached",
        `You already have 3 players from ${inn.team}. You can't have more than 3 from one club.`,
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
        }). Point hits are switched off in this test build. Reduce to ${freeLeft} transfer${
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
          webRef.current?.injectJavaScript(
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
              email,
              password,
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

  const switchMode = (m: Mode) => {
    if (m === mode) return;

    // Stop any in-flight animations and reset transition lock to prevent getting stuck on rapid taps
    modeTransitionX.stopAnimation();
    modeTransitionOpacity.stopAnimation();
    modeTransitioning.current = false;

    // Preload mode and transfer data instantly
    setMode(m);
    setTransferStatsVisible(m === "transfers");
    setPendingChip(null);
    setSelectedPos(null);
    setPlayerSheetOpen(false);

    // Lineup slides in from left (-320 -> 0), Transfers and Leagues slide in from right (320 -> 0)
    const startX = m === "lineup" ? -320 : 320;
    modeTransitionX.setValue(startX);
    modeTransitionOpacity.setValue(0);

    modeTransitioning.current = true;
    Animated.parallel([
      Animated.timing(modeTransitionOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(modeTransitionX, {
        toValue: 0,
        damping: 24,
        stiffness: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      modeTransitioning.current = false;
    });
  };

  const pickSlot =
    pickPos !== null ? tdraft.find((p) => p.pos === pickPos) : null;
  const selectedIsReplaced =
    selectedPos !== null && pending.some((x) => x.pos === selectedPos);
  const shownPicks = mode === "transfers" ? tdraft : draft;
  const selectedPlayer =
    selectedPos === null
      ? null
      : shownPicks.find((player) => player.pos === selectedPos) ?? null;

  const currentSelectedGw = selectedFixtureGw ?? squad?.gw ?? 1;
  const isPastGwSelected = squad ? currentSelectedGw < squad.gw : false;
  const currentPastData =
    isPastGwSelected && squad && memberSquad?.entry === squad.entry && memberSquad?.event === currentSelectedGw
      ? memberSquad
      : null;

  const pastPicks: Row[] =
    currentPastData?.picks.map((pick) => {
      const mult =
        typeof pick.multiplier === "number" && pick.multiplier > 0
          ? pick.multiplier
          : pick.captain
            ? currentPastData.chip === "3xc"
              ? 3
              : 2
            : 1;
      const rawPoints = pick.points ?? 0;
      const finalPoints = rawPoints * mult;

      return {
        id: pick.id,
        pos: pick.position,
        name: pick.name,
        team: pick.team,
        teamId: 0,
        type: pick.elementType,
        cap: pick.captain,
        vice: pick.viceCaptain,
        multiplier: mult,
        sell: 0,
        buy: 0,
        displayPoints: finalPoints,
        formMood: pick.formMood,
      };
    }) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: "#071818" }}>
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
            <Text style={{ color: "#fff", fontSize: 48, fontWeight: "800" }}>
              Pro<Text style={{ color: GREEN }}>FPL</Text>
            </Text>
            <Text style={{ color: "#e6d9ea", fontSize: 18, marginTop: 8 }}>
              Your Fantasy Premier League team, all in one place.
            </Text>
            <View style={{ marginTop: 32 }}>
              <Feature
                icon={{
                  ios: "soccerball",
                  android: "sports_soccer",
                  web: "sports_soccer",
                }}
                text="See your squad on the pitch"
              />
              <Feature
                icon={{
                  ios: "arrow.left.arrow.right",
                  android: "swap_horiz",
                  web: "swap_horiz",
                }}
                text="Substitutes and captain changes"
              />
              <Feature
                icon={{
                  ios: "trophy.fill",
                  android: "trophy",
                  web: "trophy",
                }}
                text="Leagues (coming soon)"
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
              <Text style={{ color: PURPLE, fontSize: 17, fontWeight: "800" }}>
                Sign in with FPL
              </Text>
            </Pressable>
            <Text
              style={{
                color: "#cdb9d1",
                fontSize: 12,
                textAlign: "center",
                marginTop: 12,
              }}
            >
              You sign in on the official FPL page. ProFPL never sees your
              password.
            </Text>
            <Text
              style={{
                color: "#cdb9d1",
                fontSize: 12,
                textAlign: "center",
                marginTop: 8,
              }}
            >
              App version {APP_VERSION}
            </Text>
          </View>
        </View>
      )}

      {stage === "login" && (
        <View style={{ flex: 1, backgroundColor: "#071818" }}>
          <Image
            source={require("../../assets/images/background-texture.png")}
            contentFit="cover"
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              opacity: 0.6,
            }}
          />

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingTop: insets.top + 24,
              paddingBottom: insets.bottom + 24,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {/* App Branding */}
            <View style={{ alignItems: "center", marginBottom: 28, marginTop: 8 }}>
              <Text style={{ color: "#fff", fontSize: 36, fontWeight: "900" }}>
                Pro<Text style={{ color: GREEN }}>FPL</Text>
              </Text>
              <Text style={{ color: "#d2c4d6", fontSize: 14, marginTop: 4, textAlign: "center" }}>
                Enter your Fantasy Premier League details
              </Text>
            </View>

            {/* Login Form Card */}
            <View
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                borderRadius: 18,
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.15)",
                padding: 16,
                elevation: 6,
              }}
            >
              {/* Email Address */}
              <Text style={{ color: "#e8dee9", fontSize: 12, fontWeight: "700", marginBottom: 4 }}>
                Email address
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "rgba(0, 0, 0, 0.4)",
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.18)",
                  paddingHorizontal: 12,
                  height: 42,
                  marginBottom: 12,
                }}
              >
                <AppSymbol
                  name={{ ios: "envelope.fill", android: "mail", web: "mail" }}
                  color="#a893ae"
                  size={16}
                />
                <TextInput
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (loginError) setLoginError("");
                  }}
                  placeholder="e.g. name@example.com"
                  placeholderTextColor="#8a7490"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loginLoading}
                  style={{
                    flex: 1,
                    color: "#fff",
                    fontSize: 14,
                    marginLeft: 8,
                    paddingVertical: 0,
                  }}
                />
              </View>

              {/* Password */}
              <Text style={{ color: "#e8dee9", fontSize: 12, fontWeight: "700", marginBottom: 4 }}>
                Password
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "rgba(0, 0, 0, 0.4)",
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.18)",
                  paddingHorizontal: 12,
                  height: 42,
                  marginBottom: 16,
                }}
              >
                <AppSymbol
                  name={{ ios: "lock.fill", android: "lock", web: "lock" }}
                  color="#a893ae"
                  size={16}
                />
                <TextInput
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (loginError) setLoginError("");
                  }}
                  placeholder="Your FPL password"
                  placeholderTextColor="#8a7490"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loginLoading}
                  style={{
                    flex: 1,
                    color: "#fff",
                    fontSize: 14,
                    marginLeft: 8,
                    paddingVertical: 0,
                  }}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={8}
                  style={{ padding: 4 }}
                >
                  <AppSymbol
                    name={{
                      ios: showPassword ? "eye.slash.fill" : "eye.fill",
                      android: showPassword ? "visibility_off" : "visibility",
                      web: showPassword ? "visibility_off" : "visibility",
                    }}
                    color="#a893ae"
                    size={16}
                  />
                </Pressable>
              </View>

              {/* Error Alert */}
              {!!loginError && (
                <View
                  style={{
                    backgroundColor: "rgba(239, 68, 68, 0.18)",
                    borderWidth: 1,
                    borderColor: "rgba(239, 68, 68, 0.4)",
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    marginBottom: 12,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <AppSymbol
                    name={{ ios: "exclamationmark.triangle.fill", android: "warning", web: "warning" }}
                    color="#ef4444"
                    size={15}
                  />
                  <Text style={{ color: "#ff8080", fontSize: 12, fontWeight: "600", marginLeft: 6, flex: 1 }}>
                    {loginError}
                  </Text>
                </View>
              )}

              {/* Submit Button */}
              <Pressable
                onPress={handleLogin}
                disabled={loginLoading || !email.trim() || !password.trim()}
                style={({ pressed }) => ({
                  backgroundColor: GREEN,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed || loginLoading || !email.trim() || !password.trim() ? 0.7 : 1,
                  marginTop: 2,
                })}
              >
                {loginLoading ? (
                  <ActivityIndicator color="#051a0f" size="small" />
                ) : (
                  <Text style={{ color: "#051a0f", fontSize: 14, fontWeight: "900" }}>
                    Login
                  </Text>
                )}
              </Pressable>

              {/* OR Divider */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginVertical: 10,
                }}
              >
                <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255, 255, 255, 0.15)" }} />
                <Text style={{ color: "#a893ae", fontSize: 11, fontWeight: "700", marginHorizontal: 10 }}>
                  OR
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255, 255, 255, 0.15)" }} />
              </View>

              {/* Sign in via Premier League Web Button */}
              <Pressable
                onPress={() => {
                  setGoogleModalKey((k) => k + 1);
                  setShowGoogleModal(true);
                }}
                disabled={loginLoading}
                style={({ pressed }) => ({
                  backgroundColor: "#ffffff",
                  height: 36,
                  borderRadius: 18,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.85 : 1,
                  paddingHorizontal: 12,
                })}
              >
                <View style={{ marginRight: 6 }}>
                  <AppSymbol
                    name={{ ios: "globe", android: "language", web: "language" }}
                    color="#37003c"
                    size={16}
                  />
                </View>
                <Text style={{ color: "#1f1f1f", fontSize: 13, fontWeight: "700" }}>
                  Sign via pl web
                </Text>
              </Pressable>
            </View>

            {/* Privacy notice */}
            <View
              style={{
                marginTop: 24,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 12,
              }}
            >
              <AppSymbol
                name={{ ios: "lock.fill", android: "verified_user", web: "verified_user" }}
                color="#a893ae"
                size={16}
              />
              <Text
                style={{
                  color: "#bda8c2",
                  fontSize: 12,
                  textAlign: "center",
                  marginLeft: 8,
                  lineHeight: 16,
                }}
              >
                Your credentials are sent directly to FPL servers to authenticate. ProFPL never stores your password.
              </Text>
            </View>
          </ScrollView>
        </View>
      )}

      <View style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}>
        <WebView
          ref={webRef}
          source={{ uri: "https://fantasy.premierleague.com/" }}
          userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
          javaScriptEnabled
          domStorageEnabled
          onMessage={onMessage}
          onLoadEnd={check}
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
        <View style={{ flex: 1, backgroundColor: "#071818", paddingTop: insets.top }}>
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
              source={{ uri: "https://fantasy.premierleague.com/" }}
              userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              injectedJavaScript={`
                (function() {
                  if (window.__googleAuthCheckStarted) return;
                  window.__googleAuthCheckStarted = true;
                  setInterval(async () => {
                    try {
                      const meRes = await fetch("https://fantasy.premierleague.com/api/me/", { credentials: "include" });
                      if (meRes.ok) {
                        const me = await meRes.json().catch(() => null);
                        if (me && me.player && me.player.entry) {
                          window.ReactNativeWebView.postMessage(JSON.stringify({ googleLoginSuccess: true }));
                        }
                      }
                    } catch(e) {}
                  }, 2000);
                })();
              `}
              onMessage={onMessage}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </Modal>

      {stage === "squad" && squad && (
        <View style={{ flex: 1, backgroundColor: "#071818" }}>
          <Image
            source={require("../../assets/images/background-texture.png")}
            contentFit="cover"
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
            }}
          />
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
                    <Pressable
                      onPress={() => setShowGameweekMenu(true)}
                      accessibilityRole="button"
                      accessibilityLabel={`Select gameweek. Default gameweek ${squad.gw}. Selected gameweek ${selectedFixtureGw ?? squad.gw}`}
                      style={({ pressed }) => ({
                        borderRadius: 16,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        minWidth: 84,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.18)",
                        backgroundColor: "rgba(14, 38, 26, 0.9)",
                        opacity: pressed ? 0.68 : 1,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                        elevation: 4,
                      })}
                    >
                      <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>
                        GW {selectedFixtureGw ?? squad.gw}
                        {squad.chip ? ` · ${squad.chip}` : ""}
                      </Text>
                      <AppSymbol
                        name={{ ios: "chevron.down", android: "expand_more", web: "expand_more" }}
                        color="#fff"
                        size={12}
                      />
                    </Pressable>
                  )
                )}
              </View>

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

                  <Pressable
                    onPress={() => openOwnHistory()}
                    accessibilityRole="button"
                    accessibilityLabel="Points. Open current gameweek points"
                    style={({ pressed }) => ({
                      borderRadius: 16,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      minWidth: 84,
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.18)",
                      backgroundColor: "rgba(14, 38, 26, 0.9)",
                      opacity: pressed ? 0.68 : 1,
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                      elevation: 4,
                    })}
                  >
                    <AppSymbol
                      name={{ ios: "chart.bar.fill", android: "bar_chart", web: "bar_chart" }}
                      color={GREEN}
                      size={13}
                    />
                    <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>
                      Points
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>

          {!showLeagues && transferStatsVisible && (
            <View
              style={{
                flexDirection: "row",
                paddingHorizontal: 6,
                paddingTop: 2,
                marginBottom: 4,
              }}
            >
              <Stat
                label="Free transfers"
                value={
                  squad.freeTransfers == null
                    ? "∞"
                    : String(squad.freeTransfers)
                }
              />
              <Stat label="Bank" value={money(bankAfter)} />
              <Stat label="Squad value" value={money(squad.value)} />
            </View>
          )}

          <Animated.ScrollView
            ref={mainScrollRef}
            style={{
              flex: 1,
              opacity: modeTransitionOpacity,
              transform: [{ translateX: modeTransitionX }],
              marginBottom: 64,
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
                loading={leagueLoading}
                error={leagueError}
                gameweeks={squad.gameweeks.filter(
                  (gameweek) => gameweek.finished || gameweek.isCurrent,
                )}
                inviteCode={
                  selectedLeague ? inviteCodes[selectedLeague.id] ?? null : null
                }
                memberSquad={memberSquad}
                managerLoading={managerLoading}
                managerError={managerError}
                onSelectLeague={loadLeague}
                onJoin={joinLeague}
                onCreate={createLeague}
                onGetInviteCode={getInviteCode}
                onViewMember={viewMemberSquad}
                userEntryId={squad?.entry}
              />
            ) : mode === "more" ? (
              <ScrollView
                style={{ flex: 1, width: "100%" }}
                contentContainerStyle={{
                  paddingHorizontal: 18,
                  paddingTop: 16,
                  paddingBottom: 100,
                }}
                showsVerticalScrollIndicator={false}
              >
                {/* Manager Profile Card */}
                <View
                  style={{
                    backgroundColor: "rgba(14, 38, 26, 0.95)",
                    borderRadius: 20,
                    padding: 18,
                    borderWidth: 1.5,
                    borderColor: "rgba(0, 217, 130, 0.25)",
                    marginBottom: 24,
                    elevation: 4,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: 25,
                        backgroundColor: "rgba(0, 217, 130, 0.15)",
                        borderWidth: 1.5,
                        borderColor: GREEN,
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 14,
                      }}
                    >
                      <AppSymbol
                        name={{ ios: "person.fill", android: "person", web: "person" }}
                        color={GREEN}
                        size={24}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "900" }}>
                        {squad.teamName || "Your Team"}
                      </Text>
                      <Text style={{ color: "#9db3a6", fontSize: 13, fontWeight: "600", marginTop: 2 }}>
                        {squad.managerName || "Manager"} · ID: {squad.entry}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Section: Account */}
                <Text
                  style={{
                    color: "#9db3a6",
                    fontSize: 12,
                    fontWeight: "800",
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                    marginBottom: 8,
                    marginLeft: 4,
                  }}
                >
                  Account
                </Text>

                <View
                  style={{
                    backgroundColor: "rgba(14, 38, 26, 0.95)",
                    borderRadius: 18,
                    borderWidth: 1.5,
                    borderColor: "rgba(0, 217, 130, 0.25)",
                    overflow: "hidden",
                    marginBottom: 24,
                    elevation: 4,
                  }}
                >
                  <Pressable
                    onPress={handleLogout}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 16,
                      paddingVertical: 16,
                      backgroundColor: pressed ? "rgba(255, 59, 48, 0.15)" : "transparent",
                    })}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: "rgba(255, 59, 48, 0.15)",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                      }}
                    >
                      <AppSymbol
                        name={{
                          ios: "rectangle.portrait.and.arrow.right",
                          android: "logout",
                          web: "logout",
                        }}
                        color="#ff453a"
                        size={18}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#ff453a", fontSize: 15, fontWeight: "800" }}>
                        Log Out
                      </Text>
                      <Text style={{ color: "#9db3a6", fontSize: 12, marginTop: 1 }}>
                        Sign out of your FPL account
                      </Text>
                    </View>
                    <AppSymbol
                      name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
                      color="#9db3a6"
                      size={14}
                    />
                  </Pressable>
                </View>

                {/* Section: About */}
                <Text
                  style={{
                    color: "#9db3a6",
                    fontSize: 12,
                    fontWeight: "800",
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                    marginBottom: 8,
                    marginLeft: 4,
                  }}
                >
                  About
                </Text>

                <View
                  style={{
                    backgroundColor: "rgba(14, 38, 26, 0.95)",
                    borderRadius: 18,
                    borderWidth: 1.5,
                    borderColor: "rgba(0, 217, 130, 0.25)",
                    padding: 16,
                    elevation: 4,
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
                    <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "700" }}>
                      App Version
                    </Text>
                    <Text style={{ color: GREEN, fontSize: 14, fontWeight: "800" }}>
                      v{APP_VERSION}
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "700" }}>
                      Data Source
                    </Text>
                    <Text style={{ color: "#9db3a6", fontSize: 13, fontWeight: "600" }}>
                      Official FPL API
                    </Text>
                  </View>
                </View>
              </ScrollView>
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
                {isPastGwSelected ? (
                  managerLoading ? (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 320 }}>
                      <ActivityIndicator color={GREEN} size="large" />
                    </View>
                  ) : currentPastData && pastPicks.length > 0 ? (
                    <Pitch
                      picks={pastPicks}
                      selectedGw={currentSelectedGw}
                      selectedPos={null}
                      compactAvatar={true}
                      overlay={
                        <View
                          pointerEvents="box-none"
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            zIndex: 10,
                          }}
                        >
                          <View
                            style={{
                              borderRadius: 14,
                              paddingHorizontal: 9,
                              paddingVertical: 5,
                              borderWidth: 1,
                              borderColor: "rgba(255, 255, 255, 0.18)",
                              backgroundColor: "rgba(14, 38, 26, 0.95)",
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 5,
                              elevation: 6,
                              shadowColor: "#000000",
                              shadowOpacity: 0.25,
                              shadowRadius: 6,
                              shadowOffset: { width: 0, height: 2 },
                            }}
                          >
                            <Text style={{ color: "#9db3a6", fontSize: 10, fontWeight: "800", textTransform: "uppercase" }}>
                              GW {currentSelectedGw} Points
                            </Text>
                            <Text style={{ color: "#ffd400", fontSize: 14, fontWeight: "900" }}>
                              {currentPastData.history.points ?? "—"}
                            </Text>
                          </View>
                        </View>
                      }
                    />
                  ) : (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, minHeight: 320 }}>
                      <Text
                        style={{
                          color: "#9db3a6",
                          fontSize: 14,
                          fontWeight: "600",
                          textAlign: "center",
                          lineHeight: 20,
                        }}
                      >
                        No past gameweek history available.
                      </Text>
                    </View>
                  )
                ) : (
                  <Pitch
                    picks={shownPicks}
                    selectedGw={currentSelectedGw}
                    selectedPos={selectedPos}
                    showPrice={mode === "transfers"}
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
                              borderRadius: 20,
                              alignItems: "center",
                              justifyContent: "center",
                              borderWidth: 1,
                              borderColor: "rgba(255,255,255,0.8)",
                              backgroundColor: "rgba(55,0,60,0.82)",
                              opacity: pressed ? 0.75 : 1,
                              elevation: 5,
                            })}
                          >
                            <AppSymbol
                              name={{
                                ios: "trophy.fill",
                                android: "trophy",
                                web: "trophy",
                              }}
                              color="#fff"
                              size={19}
                            />
                            {(pendingChip || squad.chip) && (
                              <View
                                style={{
                                  position: "absolute",
                                  top: 1,
                                  right: 1,
                                  width: 9,
                                  height: 9,
                                  borderRadius: 5,
                                  backgroundColor: GREEN,
                                  borderWidth: 1,
                                  borderColor: "#fff",
                                }}
                              />
                            )}
                          </Pressable>
                          {showChipMenu && (
                            <View
                              style={{
                                position: "absolute",
                                top: 44,
                                left: 0,
                                width: 220,
                                maxWidth: 260,
                                padding: 9,
                                borderRadius: 18,
                                borderWidth: 1,
                                borderColor: "rgba(255,255,255,0.9)",
                                backgroundColor: "rgba(250,247,255,0.97)",
                                elevation: 14,
                                shadowColor: "#210027",
                                shadowOpacity: 0.28,
                                shadowRadius: 14,
                                shadowOffset: { width: 0, height: 6 },
                              }}
                            >
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  marginBottom: 7,
                                }}
                              >
                                <Text
                                  style={{
                                    color: PURPLE,
                                    fontSize: 12,
                                    fontWeight: "900",
                                  }}
                                >
                                  CHIPS
                                </Text>
                                <Pressable
                                  onPress={() => setShowChipMenu(false)}
                                  hitSlop={8}
                                  accessibilityRole="button"
                                  accessibilityLabel="Close chips"
                                >
                                  <AppSymbol
                                    name={{
                                      ios: "xmark",
                                      android: "close",
                                      web: "close",
                                    }}
                                    color={PURPLE}
                                    size={17}
                                  />
                                </Pressable>
                              </View>
                              <View
                                style={{
                                  flexDirection: "row",
                                  flexWrap: "wrap",
                                  gap: 6,
                                }}
                              >
                                {CHIP_OPTIONS.map((chip) => {
                                  const available = squad.availableChips.includes(
                                    chip.id,
                                  );
                                  const selected = pendingChip === chip.id;
                                  const active = squad.chip === chip.id;
                                  const chipStatus = squad.chipStatuses[chip.id];
                                  return (
                                    <Pressable
                                      key={chip.id}
                                      onPress={() => selectChip(chip)}
                                      disabled={!available || locked}
                                      style={({ pressed }) => ({
                                        width: 97,
                                        minHeight: 44,
                                        paddingHorizontal: 6,
                                        borderRadius: 12,
                                        borderWidth: 1,
                                        borderColor: selected
                                          ? "#7800b8"
                                          : available
                                            ? "#c7a6df"
                                            : "#e0dceb",
                                        backgroundColor: selected
                                          ? PURPLE
                                          : "#fff",
                                        flexDirection: "row",
                                        alignItems: "center",
                                        opacity:
                                          available && !locked
                                            ? pressed
                                              ? 0.76
                                              : 1
                                            : 0.58,
                                      })}
                                    >
                                      <AppSymbol
                                        name={CHIP_SYMBOLS[chip.id]}
                                        color={
                                          selected
                                            ? GREEN
                                            : available
                                              ? "#7800b8"
                                              : "#767184"
                                        }
                                        size={17}
                                      />
                                      <View
                                        style={{
                                          flex: 1,
                                          marginLeft: 5,
                                        }}
                                      >
                                        <Text
                                          numberOfLines={1}
                                          style={{
                                            color: selected
                                              ? "#fff"
                                              : available
                                                ? PURPLE
                                                : "#696476",
                                            fontSize: 9,
                                            fontWeight: "900",
                                          }}
                                        >
                                          {chip.label}
                                        </Text>
                                        <Text
                                          style={{
                                            color: selected
                                              ? "#e7d5f4"
                                              : available
                                                ? "#7a35a8"
                                                : "#777386",
                                            fontSize: 8,
                                            marginTop: 1,
                                          }}
                                        >
                                          {selected
                                            ? "Selected"
                                            : active
                                              ? "Active"
                                              : available
                                                ? "Available"
                                                : chipStatus === "played"
                                                  ? "Used"
                                                  : "Unavailable"}
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
                                  style={{
                                    alignSelf: "flex-end",
                                    marginTop: 7,
                                    paddingHorizontal: 9,
                                    paddingVertical: 5,
                                    borderRadius: 12,
                                    backgroundColor: "#f0e5f5",
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: "#8d1b3d",
                                      fontSize: 10,
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

                        {/* Top Right Total Points Card (Lineup mode on homepage only) */}
                        {mode === "lineup" && (
                          <View
                            pointerEvents="box-none"
                            style={{
                              position: "absolute",
                              top: 8,
                              right: 8,
                              zIndex: 10,
                            }}
                          >
                            <View
                              style={{
                                borderRadius: 14,
                                paddingHorizontal: 9,
                                paddingVertical: 5,
                                borderWidth: 1,
                                borderColor: "rgba(255, 255, 255, 0.18)",
                                backgroundColor: "rgba(14, 38, 26, 0.95)",
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 5,
                                elevation: 6,
                                shadowColor: "#000000",
                                shadowOpacity: 0.25,
                                shadowRadius: 6,
                                shadowOffset: { width: 0, height: 2 },
                              }}
                            >
                              <Text style={{ color: "#9db3a6", fontSize: 10, fontWeight: "800", textTransform: "uppercase" }}>
                                Total Points
                              </Text>
                              <Text style={{ color: "#ffd400", fontSize: 14, fontWeight: "900" }}>
                                {squad.totalPoints ?? "—"}
                              </Text>
                            </View>
                          </View>
                        )}

                        {/* Top Right Transfer Deadline Badge (Transfers mode only - 3-line card) */}
                        {mode === "transfers" && nextGwDeadlineInfo && (
                          <View
                            pointerEvents="box-none"
                            style={{
                              position: "absolute",
                              top: 8,
                              right: 8,
                              zIndex: 10,
                            }}
                          >
                            <View
                              style={{
                                borderRadius: 14,
                                paddingHorizontal: 9,
                                paddingVertical: 5,
                                borderWidth: 1,
                                borderColor: "rgba(255, 255, 255, 0.18)",
                                backgroundColor: "rgba(14, 38, 26, 0.95)",
                                alignItems: "flex-end",
                                elevation: 6,
                                shadowColor: "#000000",
                                shadowOpacity: 0.25,
                                shadowRadius: 6,
                                shadowOffset: { width: 0, height: 2 },
                              }}
                            >
                              <Text style={{ color: "#9db3a6", fontSize: 8.5, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" }}>
                                Deadline
                              </Text>
                              <Text style={{ color: "#ffffff", fontSize: 10.5, fontWeight: "700", marginTop: 1 }}>
                                {nextGwDeadlineInfo.formattedDate}
                              </Text>
                              <Text style={{ color: "#ffd400", fontSize: 11.5, fontWeight: "900", marginTop: 1.5 }}>
                                {nextGwDeadlineInfo.remainingText}
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    }
                  />
                )}
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
                  backgroundColor: "rgba(13, 36, 23, 0.95)",
                  borderRadius: 20,
                  paddingVertical: 12,
                  paddingHorizontal: 18,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderWidth: 1.5,
                  borderColor: "rgba(0, 217, 130, 0.3)",
                  shadowColor: "#000",
                  shadowOpacity: 0.4,
                  shadowRadius: 16,
                  elevation: 10,
                }}
              >
                <Pressable
                  onPress={() => {
                    setPending([]);
                    setPendingChip(null);
                  }}
                  style={{ paddingVertical: 8, paddingHorizontal: 12 }}
                >
                  <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 14 }}>Reset</Text>
                </Pressable>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 13 }}>
                    {pending.length} transfer
                    {pending.length === 1 ? "" : "s"} · {money(bankAfter)} left
                  </Text>
                  <Text
                    style={{
                      color: hit > 0 && !pendingChip ? "#ff9aa2" : GREEN,
                      fontSize: 12,
                    }}
                  >
                    {pendingChip
                      ? `${selectedChipOption?.label ?? "Chip"} · no points cost`
                      : hit > 0
                        ? `-${hit} points`
                        : "No points cost"}
                  </Text>
                </View>
                <Pressable
                  onPress={reviewTransfers}
                  disabled={sending || pending.length === 0}
                  style={{
                    backgroundColor: GREEN,
                    paddingVertical: 10,
                    paddingHorizontal: 22,
                    borderRadius: 24,
                    opacity: sending || pending.length === 0 ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: PURPLE, fontWeight: "800" }}>
                    {sending ? "Sending..." : "Review"}
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
            onPick={pickPlayer}
            onClose={() => setPickPos(null)}
          />
        </View>
      )}

      {stage === "squad" && squad && (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 8,
            right: 8,
            bottom: insets.bottom + 2,
            height: 56,
            zIndex: 20,
            overflow: "visible",
          }}
        >
          <View
            style={{
              flex: 1,
              borderRadius: 28,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "rgba(0, 217, 130, 0.22)",
              backgroundColor:
                Platform.OS === "ios"
                  ? "rgba(5, 20, 16, 0.88)"
                  : "rgba(5, 20, 16, 0.96)",
              elevation: 10,
              shadowColor: "#00d982",
              shadowOpacity: 0.18,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            <GlassView
              pointerEvents="none"
              glassEffectStyle="regular"
              tintColor="rgba(5, 20, 16, 0.88)"
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                borderRadius: 28,
              }}
            />
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 4,
                gap: 2,
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
                  setActiveBottomTab("more");
                  switchMode("more");
                }}
              />
            </View>
          </View>
        </View>
      )}

      {stage === "squad" && squad && activeMember && (
        <View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 15,
            elevation: 15,
          }}
        >
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
            showGameweekSelector={!activeMember.isOwnPoints}
            onBack={() => setActiveMember(null)}
            onSelectEvent={(event) => {
              setActiveMemberEvent(event);
              loadManagerGameweek(activeMember.entry, event);
            }}
          />
        </View>
      )}
      <Modal
        visible={showGameweekMenu}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setShowGameweekMenu(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-start",
            alignItems: "flex-end",
            paddingTop: insets.top + 52,
            paddingHorizontal: 14,
            backgroundColor: "rgba(19, 12, 24, 0.45)",
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close gameweek selector"
            onPress={() => setShowGameweekMenu(false)}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
            }}
          />
          <Animated.View
            style={{
              width: 220,
              maxHeight: "70%",
              backgroundColor: "#fff",
              borderRadius: 18,
              padding: 14,
              elevation: 16,
              shadowColor: "#150b19",
              shadowOpacity: 0.2,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              opacity: gwMenuAnim,
              transform: [
                {
                  scale: gwMenuAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.92, 1],
                  }),
                },
              ],
            }}
          >
            <Text
              style={{
                color: PURPLE,
                fontSize: 16,
                fontWeight: "800",
                paddingHorizontal: 4,
                paddingBottom: 8,
              }}
            >
              Select gameweek
            </Text>
            <ScrollView ref={gwScrollRef}>
              {reversedGameweeks.map((gameweek) => {
                const activeEvent = squad?.currentGw ?? squad?.gw;
                const selected = gameweek.id === selectedFixtureGw;
                return (
                  <Pressable
                    key={gameweek.id}
                    onPress={() => {
                      setSelectedFixtureGw(gameweek.id);
                      setShowGameweekMenu(false);
                      if (squad && gameweek.id < squad.gw) {
                        loadManagerGameweek(squad.entry, gameweek.id);
                      }
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingHorizontal: 10,
                      paddingVertical: 11,
                      marginTop: 3,
                      borderRadius: 12,
                      backgroundColor: selected ? "#f0eaf3" : "#fff",
                    }}
                  >
                    <Text
                      style={{
                        color: PURPLE,
                        fontWeight: selected ? "800" : "600",
                      }}
                    >
                      GW {gameweek.id}
                    </Text>
                    <Text style={{ color: "#777", fontSize: 12 }}>
                      {gameweek.id === activeEvent
                        ? "Current"
                        : selected
                          ? "Selected"
                          : gameweek.finished
                            ? "Finished"
                            : gameweek.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
      <AppDialog
        visible={dialog !== null}
        title={dialog?.title ?? ""}
        message={dialog?.message ?? ""}
        buttons={dialog?.buttons ?? []}
        onDismiss={() => setDialog(null)}
      />
    </View>
  );
}
