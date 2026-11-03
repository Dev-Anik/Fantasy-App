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

type Stage = "checking" | "welcome" | "login" | "squad";
type Mode = "lineup" | "transfers";
type BottomTabId = Mode | "leagues";
type Pending = { pos: number; inn: Player };
type PlayableChip = "wildcard" | "freehit" | "bboost" | "3xc";

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
        height: 40,
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.1)",
        borderColor: "rgba(255,255,255,0.12)",
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 9,
        marginHorizontal: 3,
      }}
    >
      <Text style={{ color: "#cdb9d1", fontSize: 9, lineHeight: 11 }}>
        {label}
      </Text>
      <Text
        style={{
          color: "#fff",
          fontSize: 14,
          lineHeight: 16,
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
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        setPressed(true);
        onPressIn();
      }}
      onPressOut={() => setPressed(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      android_ripple={{ color: "rgba(55,0,60,0.16)" }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={{
        flex: 1,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 20,
        paddingVertical: 6,
        backgroundColor: pressed
          ? selected
            ? "#6b2072"
            : "#ddc6e8"
          : hovered
            ? selected
              ? "#5a1261"
              : "#eadcf0"
            : selected
              ? PURPLE
              : "transparent",
        borderWidth: hovered || pressed ? 1 : 0,
        borderColor:
          hovered || pressed ? "rgba(55,0,60,0.32)" : "transparent",
        transform: [{ scale: pressed ? 0.96 : hovered ? 1.04 : 1 }],
      }}
    >
      <AppSymbol name={icon} color={selected ? "#fff" : PURPLE} size={15} />
      <Text
        style={{
          color: selected ? "#fff" : PURPLE,
          fontSize: 10,
          fontWeight: selected ? "800" : "600",
          marginTop: 1,
        }}
      >
        {label}
      </Text>
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

export default function Index() {
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
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
  const [showGameweekMenu, setShowGameweekMenu] = useState(false);
  const [selectedFixtureGw, setSelectedFixtureGw] = useState<number | null>(
    null,
  );
  const [selectedLeague, setSelectedLeague] = useState<FplLeague | null>(null);
  const [leagueStandings, setLeagueStandings] =
    useState<LeagueStandings | null>(null);
  const [leagueLoading, setLeagueLoading] = useState(false);
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

  const viewMemberSquad = (entry: number, event: number) => {
    loadManagerGameweek(entry, event);
  };

  const openOwnHistory = (event: number) => {
    if (!squad) return;
    setShowLeagues(false);
    setShowHistory(true);
    setHistoryEvent(event);
    loadManagerGameweek(squad.entry, event);
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

  const createLeague = (name: string, leagueType: LeagueType) => {
    if (!squad) return;

    showDialog(
      "Create this FPL league?",
      `${name} · ${leagueType === "classic" ? "Classic" : "Head-to-Head"}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Create",
          onPress: () =>
            runLeagueAction({
              action: "create",
              name,
              leagueType,
              startEvent: squad.gw,
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
    if (stage === "squad") return;
    const id = setInterval(check, 2500);
    return () => clearInterval(id);
  }, [stage]);

  useEffect(() => {
    if (stage !== "checking") return;
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
    if (msg.saved) {
      setSaving(false);
      const appliedChip = pendingChip;
      setPendingChip(null);
      showDialog(
        appliedChip ? "Chip activated" : "Saved",
        appliedChip
          ? `${CHIP_OPTIONS.find((chip) => chip.id === appliedChip)?.label} has been played on FPL.`
          : "Your changes are now on FPL.",
      );
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
    } else if (msg.notLoggedIn) {
      if (stageRef.current === "checking") setStage("welcome");
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

  const swap = (a: Row, b: Row) => {
    const aStarter = a.pos <= 11;
    const bStarter = b.pos <= 11;
    if (aStarter && bStarter) {
      warn("Pick a bench player to substitute this player with.");
      return;
    }
    if (!aStarter && !bStarter) {
      if (a.pos === 12 || b.pos === 12) {
        warn("The goalkeeper's bench spot is fixed.");
        return;
      }
      setDraft(
        draft.map((p) =>
          p.id === a.id
            ? { ...p, pos: b.pos }
            : p.id === b.id
              ? { ...p, pos: a.pos }
              : p,
        ),
      );
      setSelectedPos(null);
      setPlayerSheetOpen(false);
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
    setDraft(next);
    setSelectedPos(null);
    setPlayerSheetOpen(false);
  };

  const setRole = (kind: "cap" | "vice") => {
    const target = draft.find((p) => p.pos === selectedPos);
    if (!target) return;
    if (target.pos > 11) {
      warn("Only players in your starting XI can be captain or vice-captain.");
      return;
    }
    const oldCap = draft.find((p) => p.cap);
    const oldVice = draft.find((p) => p.vice);
    setDraft(
      draft.map((p) => {
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
      }),
    );
    setSelectedPos(null);
    setPlayerSheetOpen(false);
  };

  const confirmSave = () => {
    if (!squad) return;
    const cap = draft.find((p) => p.cap)?.name;
    const vice = draft.find((p) => p.vice)?.name;
    const before = new Set(
      squad.picks.filter((p) => p.pos <= 11).map((p) => p.id),
    );
    const after = new Set(draft.filter((p) => p.pos <= 11).map((p) => p.id));
    const inn = draft
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
    if (pendingChip) {
      lines.push(
        `Chip: ${selectedChipOption?.label ?? pendingChip}`,
        "Chips cannot be undone once confirmed.",
      );
    }
    showDialog(
      pendingChip
        ? `Activate ${selectedChipOption?.label ?? "chip"}?`
        : "Save lineup to FPL?",
      lines.join("\n"),
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          onPress: () => {
            setSaving(true);
            webRef.current?.injectJavaScript(
              buildSaveJs(squad.entry, draft, pendingChip),
            );
          },
        },
      ],
    );
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

  const undoSlot = () => {
    setPending((prev) => prev.filter((x) => x.pos !== selectedPos));
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
            ),
          );
        },
      },
    ]);
  };

  const onPlayerPress = (r: Row) => {
    if (locked) {
      setSelectedPos(r.pos);
      setPlayerSheetOpen(true);
      return;
    }
    if (mode === "transfers") {
      if (selectedPos === r.pos) {
        setSelectedPos(null);
        setPlayerSheetOpen(false);
      } else {
        setSelectedPos(r.pos);
        setPlayerSheetOpen(true);
      }
      return;
    }
    if (selectedPos === null) {
      setSelectedPos(r.pos);
      setPlayerSheetOpen(true);
      return;
    }
    if (selectedPos === r.pos) {
      setPlayerSheetOpen(true);
      return;
    }
    const a = draft.find((p) => p.pos === selectedPos);
    if (a) swap(a, r);
  };

  const switchMode = (m: Mode) => {
    if (m === mode || modeTransitioning.current) return;

    modeTransitioning.current = true;
    setTransferStatsVisible(m === "transfers");
    const transitionContent = () => {
      const exitX = m === "transfers" ? -22 : 22;
      Animated.parallel([
        Animated.timing(modeTransitionOpacity, {
          toValue: 0,
          duration: 110,
          useNativeDriver: true,
        }),
        Animated.timing(modeTransitionX, {
          toValue: exitX,
          duration: 110,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) {
          modeTransitioning.current = false;
          return;
        }

        setMode(m);
        setPendingChip(null);
        setSelectedPos(null);
        setPlayerSheetOpen(false);
        modeTransitionOpacity.setValue(0);
        modeTransitionX.setValue(-exitX);

        Animated.parallel([
          Animated.timing(modeTransitionOpacity, {
            toValue: 1,
            duration: 190,
            useNativeDriver: true,
          }),
          Animated.timing(modeTransitionX, {
            toValue: 0,
            duration: 190,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => {
          modeTransitioning.current = false;
        });
      });
    };

    if (mode === "transfers") {
      setTransferStatsVisible(false);
      requestAnimationFrame(transitionContent);
    } else {
      transitionContent();
    }
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

  return (
    <View style={{ flex: 1, backgroundColor: "#073b25" }}>
      <StatusBar barStyle="light-content" backgroundColor={PURPLE} />

      {stage === "checking" && (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: "#fff", fontSize: 32, fontWeight: "800" }}>
            Pro<Text style={{ color: GREEN }}>FPL 1.1</Text>
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
              Pro<Text style={{ color: GREEN }}>FPL 1.1</Text>
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

      {stage === "login" ? (
        <View
          style={{
            paddingTop: insets.top + 8,
            paddingBottom: 12,
            paddingHorizontal: 16,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: PURPLE,
          }}
        >
          <Pressable onPress={() => setStage("welcome")} hitSlop={12}>
            <Text style={{ color: "#fff", fontSize: 16 }}>‹ Back</Text>
          </Pressable>
          <Text
            style={{
              color: "#fff",
              fontSize: 17,
              fontWeight: "700",
              marginLeft: 16,
            }}
          >
            Sign in to FPL
          </Text>
        </View>
      ) : null}

      <View
        style={
          stage === "login"
            ? { flex: 1, backgroundColor: "#fff" }
            : { position: "absolute", width: 1, height: 1, opacity: 0 }
        }
      >
        <WebView
          ref={webRef}
          source={{ uri: "https://fantasy.premierleague.com/" }}
          onMessage={onMessage}
          onLoadEnd={check}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
        />
      </View>

      {stage === "login" ? (
        <View
          style={{
            backgroundColor: PURPLE,
            paddingTop: 10,
            paddingBottom: insets.bottom + 10,
            alignItems: "center",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
            }}
          >
            <View style={{ marginRight: 8 }}>
              <AppSymbol
                name={{ ios: "lock.fill", android: "lock", web: "lock" }}
                color="#cdb9d1"
                size={14}
              />
            </View>
            <Text
              style={{
                flex: 1,
                color: "#cdb9d1",
                fontSize: 12,
                textAlign: "center",
              }}
            >
              Your password goes straight to FPL. Your squad opens automatically
              after sign-in.
            </Text>
          </View>
        </View>
      ) : null}

      {stage === "squad" && squad && (
        <View style={{ flex: 1, backgroundColor: "#073b25" }}>
          <View>
            <View
              style={{
                backgroundColor: PURPLE,
                paddingTop: insets.top + 8,
                paddingHorizontal: 12,
                paddingBottom: 8,
                borderBottomLeftRadius: 30,
                borderBottomRightRadius: 30,
                elevation: 5,
                zIndex: 2,
                overflow: "hidden",
              }}
            >
              <Image
                source={require("../../assets/images/header-bg.png")}
                contentFit="cover"
                accessible={false}
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                }}
              />
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 4,
                  marginBottom: showLeagues ? 0 : 6,
                }}
              >
                <View>
                  <Text
                    style={{ color: "#fff", fontSize: 21, fontWeight: "800" }}
                  >
                    Pro<Text style={{ color: GREEN }}>FPL</Text>
                    {!showLeagues && (
                      <Text style={{ color: "#fff" }}> 1.1</Text>
                    )}
                  </Text>
                </View>
                {!showLeagues && (
                  <>
                    <Pressable
                      onPress={refresh}
                      disabled={refreshing}
                      accessibilityRole="button"
                      accessibilityLabel={
                        refreshing ? "Refreshing squad" : "Refresh squad"
                      }
                      hitSlop={8}
                      style={({ pressed }) => ({
                        width: 32,
                        height: 32,
                        marginLeft: 10,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.5)",
                        backgroundColor: "rgba(255,255,255,0.18)",
                        opacity: pressed || refreshing ? 0.7 : 1,
                      })}
                    >
                      <AppSymbol
                        name={{
                          ios: "arrow.clockwise",
                          android: "refresh",
                          web: "refresh",
                        }}
                        color="#fff"
                        size={17}
                      />
                    </Pressable>
                    <View style={{ flex: 1 }} />
                    <Pressable
                      onPress={() => setShowGameweekMenu(true)}
                      accessibilityRole="button"
                      accessibilityLabel={`Select gameweek. Default gameweek ${squad.gw}. Selected gameweek ${selectedFixtureGw ?? squad.gw}`}
                      style={({ pressed }) => ({
                        borderRadius: 24,
                        paddingHorizontal: 14,
                        paddingVertical: 7,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        overflow: "hidden",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.72)",
                        backgroundColor: "rgba(255,255,255,0.2)",
                        opacity: pressed ? 0.78 : 1,
                        elevation: 8,
                        shadowColor: "#100018",
                        shadowOpacity: 0.28,
                        shadowRadius: 12,
                        shadowOffset: { width: 0, height: 5 },
                      })}
                    >
                      <GlassView
                        pointerEvents="none"
                        glassEffectStyle="regular"
                        tintColor="rgba(255,255,255,0.22)"
                        style={{
                          position: "absolute",
                          top: 0,
                          right: 0,
                          bottom: 0,
                          left: 0,
                          borderRadius: 24,
                        }}
                      />
                      <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900" }}>
                        GW {selectedFixtureGw ?? squad.gw}
                        {squad.chip ? ` · ${squad.chip}` : ""}
                      </Text>
                      <AppSymbol
                        name={{ ios: "chevron.down", android: "expand_more", web: "expand_more" }}
                        color="#fff"
                        size={15}
                      />
                    </Pressable>
                  </>
                )}
              </View>
              {!showLeagues && <View
                style={{
                  marginHorizontal: 4,
                  marginBottom: 0,
                  flexDirection: "row",
                  alignItems: "center",
                  minHeight: 42,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: "800",
                    paddingRight: 12,
                  }}
                >
                  {squad.teamName || "Your team"}
                </Text>
                <View
                  style={{
                    alignItems: "flex-end",
                    paddingLeft: 14,
                    borderLeftWidth: 1,
                    borderLeftColor: "rgba(255,255,255,0.4)",
                  }}
                >
                  <Pressable
                    onPress={() => openOwnHistory(squad.currentGw)}
                    accessibilityRole="button"
                    accessibilityLabel="Points. Open current gameweek points"
                    style={{
                      paddingHorizontal: 15,
                      paddingVertical: 9,
                      borderRadius: 18,
                      backgroundColor: "rgba(255,255,255,0.18)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.45)",
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900" }}>
                      Points
                    </Text>
                  </Pressable>
                </View>
              </View>}
            </View>
          </View>

          {!showLeagues && transferStatsVisible && (
            <View
              style={{
                flexDirection: "row",
                paddingHorizontal: 6,
                paddingTop: 6,
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
            style={{
              flex: 1,
              opacity: modeTransitionOpacity,
              transform: [{ translateX: modeTransitionX }],
            }}
            scrollEnabled={false}
            contentContainerStyle={{
              width: "100%",
              paddingBottom: insets.bottom + 200,
            }}
          >
            <Pitch
              picks={shownPicks}
              selectedGw={selectedFixtureGw ?? squad.gw}
              selectedPos={selectedPos}
              showPrice={mode === "transfers"}
              onPress={onPlayerPress}
              overlay={
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
              }
            />

            <View style={{ margin: 20, alignItems: "center" }}>
              {error ? (
                <Text style={{ color: "red", marginTop: 10 }}>{error}</Text>
              ) : null}
            </View>
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

          {/* Save bar: lineup mode */}
          {mode === "lineup" &&
            (dirty || pendingChip === "bboost" || pendingChip === "3xc") &&
            selectedPos === null && (
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: insets.bottom + 112,
                  backgroundColor: PURPLE,
                  paddingTop: 12,
                  paddingBottom: 12,
                  paddingHorizontal: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                {dirty ? (
                  <Pressable onPress={() => setDraft(squad.picks)}>
                    <Text style={{ color: "#fff" }}>Undo</Text>
                  </Pressable>
                ) : (
                  <View />
                )}
                <Pressable
                  onPress={confirmSave}
                  disabled={saving}
                  style={{
                    backgroundColor: GREEN,
                    paddingVertical: 10,
                    paddingHorizontal: 28,
                    borderRadius: 24,
                  }}
                >
                  <Text style={{ color: PURPLE, fontWeight: "800" }}>
                    {saving
                      ? "Saving..."
                      : pendingChip
                        ? `Play ${selectedChipOption?.label ?? "chip"}`
                        : "Save changes"}
                  </Text>
                </Pressable>
              </View>
          )}

          {/* Summary bar: transfers mode */}
          {mode === "transfers" &&
            (pending.length > 0 ||
              pendingChip === "wildcard" ||
              pendingChip === "freehit") &&
            selectedPos === null && (
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: insets.bottom + 112,
                  backgroundColor: PURPLE,
                  paddingTop: 12,
                  paddingBottom: 12,
                  paddingHorizontal: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Pressable
                  onPress={() => {
                    setPending([]);
                    setPendingChip(null);
                  }}
                >
                  <Text style={{ color: "#fff" }}>Reset</Text>
                </Pressable>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: "#fff", fontWeight: "700" }}>
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

      {stage === "squad" && squad && !showHistory && (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 8,
            right: 8,
            bottom: insets.bottom + 2,
            height: 56,
            zIndex: 4,
            overflow: "visible",
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: -8,
              height: 26,
              borderRadius: 30,
              backgroundColor: "rgba(132,45,255,0.42)",
              shadowColor: "#8c24ff",
              shadowOpacity: 0.8,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 1 },
              elevation: 16,
            }}
          />
          <View
            style={{
              flex: 1,
              borderRadius: 30,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.92)",
              backgroundColor:
                Platform.OS === "ios"
                  ? "rgba(255,255,255,0.34)"
                  : "rgba(255,255,255,0.96)",
              elevation: 10,
              shadowColor: "#37003c",
              shadowOpacity: 0.15,
              shadowRadius: 15,
              shadowOffset: { width: 0, height: 5 },
            }}
          >
            <GlassView
              pointerEvents="none"
              glassEffectStyle="regular"
              tintColor="rgba(255,255,255,0.62)"
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                borderRadius: 30,
              }}
            />
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 5,
                gap: 3,
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
                  setShowLeagues(false);
                  switchMode("transfers");
                }}
              />
              <View
                pointerEvents="none"
                style={{
                  width: 1,
                  height: 28,
                  backgroundColor: "rgba(103,68,135,0.28)",
                }}
              />
              <BottomTab
                icon={{
                  ios: "trophy.fill",
                  android: "trophy",
                  web: "trophy",
                }}
                label="Leagues"
                selected={activeBottomTab === "leagues"}
                onPressIn={() => setActiveBottomTab("leagues")}
                onPress={() => {
                  setShowLeagues((visible) => {
                    if (visible) {
                      setActiveBottomTab(mode);
                      return false;
                    }
                    setShowHistory(false);
                    return true;
                  });
                }}
              />
            </View>
          </View>
        </View>
      )}

      {stage === "squad" && squad && showLeagues && (
        <View
          style={{
            position: "absolute",
            top: insets.top + 48,
            bottom: insets.bottom + 66,
            left: 0,
            right: 0,
            zIndex: 10,
            elevation: 10,
            backgroundColor: "#073b25",
          }}
        >
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
          />
        </View>
      )}
      {stage === "squad" && squad && showHistory && (
        <View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 11,
            elevation: 11,
            paddingTop: insets.top,
          }}
        >
          <ManagerHistory
            title={squad.teamName || "Your team"}
            managerName={squad.managerName}
            entry={squad.entry}
            gameweeks={squad.gameweeks.filter(
              (gameweek) => gameweek.finished || gameweek.isCurrent,
            )}
            selectedEvent={historyEvent ?? squad.currentGw ?? squad.gw}
            data={memberSquad}
            loading={managerLoading}
            error={managerError}
            showBlankSquadOnError
            onBack={() => {
              setShowHistory(false);
              setHistoryEvent(null);
            }}
            onSelectEvent={selectOwnHistoryEvent}
          />
        </View>
      )}
      <Modal
        visible={showGameweekMenu}
        transparent
        animationType="fade"
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
          <View
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
            <ScrollView>
              {[...(squad?.gameweeks ?? [])].reverse().map((gameweek) => {
                const activeEvent = squad?.currentGw ?? squad?.gw;
                const selected = gameweek.id === selectedFixtureGw;
                return (
                  <Pressable
                    key={gameweek.id}
                    onPress={() => {
                      setSelectedFixtureGw(gameweek.id);
                      setShowGameweekMenu(false);
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
          </View>
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
