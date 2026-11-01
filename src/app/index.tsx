import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import {
  buildSaveJs,
  buildTransferJs,
  FETCH_JS,
  Player,
  Row,
  Squad,
} from "../fpl";
import { Pitch } from "../Pitch";
import { PlayerPicker } from "../PlayerPicker";

type Stage = "checking" | "welcome" | "login" | "squad";
type Mode = "lineup" | "transfers";
type Pending = { pos: number; inn: Player };

const PURPLE = "#37003c";
const GREEN = "#00ff87";
// Test build safety: refuse transfers that would cost points.
// Set to true later if you want to allow point hits.
const ALLOW_HITS = false;

function Feature({ icon, text }: { icon: string; text: string }) {
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
        <Text style={{ fontSize: 16 }}>{icon}</Text>
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
        backgroundColor: "rgba(255,255,255,0.12)",
        borderRadius: 12,
        padding: 12,
        marginHorizontal: 4,
      }}
    >
      <Text style={{ color: "#cdb9d1", fontSize: 12 }}>{label}</Text>
      <Text
        style={{
          color: "#fff",
          fontSize: 18,
          fontWeight: "bold",
          marginTop: 2,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function formationOk(picks: Row[]) {
  const xi = picks.filter((p) => p.pos <= 11);
  const n = (t: number) => xi.filter((p) => p.type === t).length;
  return xi.length === 11 && n(1) === 1 && n(2) >= 3 && n(3) >= 2 && n(4) >= 1;
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
  const [mode, setMode] = useState<Mode>("lineup");
  const [pending, setPending] = useState<Pending[]>([]);
  const [pickPos, setPickPos] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const check = () => webRef.current?.injectJavaScript(FETCH_JS);

  // Whenever fresh squad data arrives, reset all editable state
  useEffect(() => {
    if (squad) {
      setDraft(squad.picks);
      setSelectedPos(null);
      setPending([]);
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
      Alert.alert("Saved", "Your changes are now on FPL.");
      check();
      return;
    }
    if (msg.saveError) {
      setSaving(false);
      Alert.alert("Could not save", msg.saveError);
      return;
    }
    if (msg.transferred) {
      setSending(false);
      Alert.alert(
        "Transfers sent",
        "Your transfers were accepted. Reloading your squad.",
      );
      check();
      return;
    }
    if (msg.transferError) {
      setSending(false);
      Alert.alert(
        "Transfer failed",
        msg.transferError +
          "\n\nNothing was retried. Please check the FPL site or app to see your real team.",
      );
      check();
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
  const warn = (msg: string) => Alert.alert("Can't do that", msg);

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
      return;
    }
    const s = aStarter ? a : b;
    const bn = aStarter ? b : a;
    if (s.cap || s.vice) {
      warn("Move the captain / vice-captain armband to another player first.");
      return;
    }
    const next = draft.map((p) =>
      p.id === s.id
        ? { ...p, pos: bn.pos }
        : p.id === bn.id
          ? { ...p, pos: s.pos }
          : p,
    );
    if (!formationOk(next)) {
      warn(
        "That swap would make an invalid formation (1 GK, 3+ DEF, 2+ MID, 1+ FWD).",
      );
      return;
    }
    setDraft(next);
    setSelectedPos(null);
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
    Alert.alert("Save lineup to FPL?", lines.join("\n"), [
      { text: "Cancel", style: "cancel" },
      {
        text: "Save",
        onPress: () => {
          setSaving(true);
          webRef.current?.injectJavaScript(buildSaveJs(squad.entry, draft));
        },
      },
    ]);
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
      Alert.alert(
        "Not enough budget",
        `${inn.name} costs ${money(inn.cost)}, but you only have ${money(
          pickInfo.maxCost,
        )} available for this spot (short by ${money(inn.cost - pickInfo.maxCost)}).`,
      );
      return;
    }
    if (pickInfo.fullClubs.includes(inn.teamId)) {
      Alert.alert(
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
  };

  const undoSlot = () => {
    setPending((prev) => prev.filter((x) => x.pos !== selectedPos));
    setSelectedPos(null);
  };

  const reviewTransfers = () => {
    if (!squad || sending) return;

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
    if (hit > 0 && !ALLOW_HITS) {
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
    lines.push(hit > 0 ? `Points cost: -${hit}` : "Points cost: 0");
    lines.push("");
    lines.push("This changes your real FPL team.");

    Alert.alert("Send transfers to FPL?", lines.join("\n"), [
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
            ),
          );
        },
      },
    ]);
  };

  const onPlayerPress = (r: Row) => {
    if (locked) {
      warn("A chip is active this gameweek. Editing is disabled for now.");
      return;
    }
    if (mode === "transfers") {
      setSelectedPos(selectedPos === r.pos ? null : r.pos);
      return;
    }
    if (selectedPos === null) {
      setSelectedPos(r.pos);
      return;
    }
    if (selectedPos === r.pos) {
      setSelectedPos(null);
      return;
    }
    const a = draft.find((p) => p.pos === selectedPos);
    if (a) swap(a, r);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setSelectedPos(null);
  };

  const ModeTab = ({ id, label }: { id: Mode; label: string }) => (
    <Pressable
      onPress={() => switchMode(id)}
      style={{
        flex: 1,
        paddingVertical: 10,
        alignItems: "center",
        borderRadius: 20,
        backgroundColor: mode === id ? PURPLE : "transparent",
      }}
    >
      <Text style={{ color: mode === id ? "#fff" : PURPLE, fontWeight: "800" }}>
        {label}
      </Text>
    </Pressable>
  );

  const pickSlot =
    pickPos !== null ? tdraft.find((p) => p.pos === pickPos) : null;
  const selectedIsReplaced =
    selectedPos !== null && pending.some((x) => x.pos === selectedPos);
  const shownPicks = mode === "transfers" ? tdraft : draft;

  return (
    <View style={{ flex: 1, backgroundColor: PURPLE }}>
      <StatusBar barStyle="light-content" backgroundColor={PURPLE} />

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
              <Feature icon="⚽" text="See your squad on the pitch" />
              <Feature icon="🔁" text="Substitutes and captain changes" />
              <Feature icon="🏆" text="Leagues (coming soon)" />
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
          <Text style={{ color: "#cdb9d1", fontSize: 12 }}>
            🔒 Your password goes straight to FPL. Your squad opens
            automatically after sign-in.
          </Text>
        </View>
      ) : null}

      {stage === "squad" && squad && (
        <View style={{ flex: 1, backgroundColor: "#f4f1f7" }}>
          <ScrollView
            contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}
          >
            <View
              style={{
                backgroundColor: PURPLE,
                paddingTop: insets.top + 16,
                paddingHorizontal: 12,
                paddingBottom: 20,
                borderBottomLeftRadius: 24,
                borderBottomRightRadius: 24,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingHorizontal: 4,
                  marginBottom: 14,
                }}
              >
                <Text
                  style={{ color: "#fff", fontSize: 24, fontWeight: "800" }}
                >
                  Pro<Text style={{ color: GREEN }}>FPL</Text>
                </Text>
                <View
                  style={{
                    backgroundColor: GREEN,
                    borderRadius: 12,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ color: PURPLE, fontWeight: "800" }}>
                    GW {squad.gw}
                    {squad.chip ? ` · ${squad.chip}` : ""}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row" }}>
                <Stat
                  label="Free transfers"
                  value={
                    squad.freeTransfers == null
                      ? "∞"
                      : String(squad.freeTransfers)
                  }
                />
                <Stat
                  label="Bank"
                  value={money(mode === "transfers" ? bankAfter : squad.bank)}
                />
                <Stat label="Squad value" value={money(squad.value)} />
              </View>
            </View>

            {/* Mode tabs */}
            <View
              style={{
                flexDirection: "row",
                backgroundColor: "#e6dfeb",
                borderRadius: 24,
                marginHorizontal: 16,
                marginTop: 14,
                padding: 4,
              }}
            >
              <ModeTab id="lineup" label="Lineup" />
              <ModeTab id="transfers" label="Transfers" />
            </View>

            <Text
              style={{
                textAlign: "center",
                color: "#666",
                fontSize: 12,
                marginTop: 10,
              }}
            >
              {locked
                ? "A chip is active, so editing is disabled."
                : mode === "lineup"
                  ? "Tap a player, then tap a bench player to substitute."
                  : "Tap a player, then choose Transfer out."}
            </Text>

            <Pitch
              picks={shownPicks}
              selectedPos={selectedPos}
              onPress={onPlayerPress}
            />

            <View style={{ margin: 20, alignItems: "center" }}>
              <Pressable
                onPress={refresh}
                disabled={refreshing}
                style={{
                  borderWidth: 2,
                  borderColor: PURPLE,
                  borderRadius: 24,
                  paddingVertical: 10,
                  paddingHorizontal: 28,
                }}
              >
                <Text style={{ color: PURPLE, fontWeight: "700" }}>
                  {refreshing ? "Refreshing..." : "Refresh"}
                </Text>
              </Pressable>
              {error ? (
                <Text style={{ color: "red", marginTop: 10 }}>{error}</Text>
              ) : null}
            </View>
          </ScrollView>

          {/* Action bar: lineup mode */}
          {selectedPos !== null && mode === "lineup" && (
            <View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "#fff",
                paddingTop: 12,
                paddingBottom: insets.bottom + 12,
                paddingHorizontal: 16,
                flexDirection: "row",
                justifyContent: "space-around",
                borderTopWidth: 1,
                borderColor: "#ddd",
              }}
            >
              <Pressable onPress={() => setRole("cap")}>
                <Text
                  style={{ color: PURPLE, fontWeight: "800", fontSize: 16 }}
                >
                  Captain
                </Text>
              </Pressable>
              <Pressable onPress={() => setRole("vice")}>
                <Text
                  style={{ color: PURPLE, fontWeight: "800", fontSize: 16 }}
                >
                  Vice
                </Text>
              </Pressable>
              <Pressable onPress={() => setSelectedPos(null)}>
                <Text
                  style={{ color: "#999", fontWeight: "700", fontSize: 16 }}
                >
                  Cancel
                </Text>
              </Pressable>
            </View>
          )}

          {/* Action bar: transfers mode */}
          {selectedPos !== null && mode === "transfers" && (
            <View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "#fff",
                paddingTop: 12,
                paddingBottom: insets.bottom + 12,
                paddingHorizontal: 16,
                flexDirection: "row",
                justifyContent: "space-around",
                borderTopWidth: 1,
                borderColor: "#ddd",
              }}
            >
              <Pressable onPress={() => setPickPos(selectedPos)}>
                <Text
                  style={{ color: PURPLE, fontWeight: "800", fontSize: 16 }}
                >
                  {selectedIsReplaced ? "Change" : "Transfer out"}
                </Text>
              </Pressable>
              {selectedIsReplaced && (
                <Pressable onPress={undoSlot}>
                  <Text
                    style={{
                      color: "#c0392b",
                      fontWeight: "800",
                      fontSize: 16,
                    }}
                  >
                    Undo
                  </Text>
                </Pressable>
              )}
              <Pressable onPress={() => setSelectedPos(null)}>
                <Text
                  style={{ color: "#999", fontWeight: "700", fontSize: 16 }}
                >
                  Cancel
                </Text>
              </Pressable>
            </View>
          )}

          {/* Save bar: lineup mode */}
          {mode === "lineup" && dirty && selectedPos === null && (
            <View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: PURPLE,
                paddingTop: 12,
                paddingBottom: insets.bottom + 12,
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Pressable onPress={() => setDraft(squad.picks)}>
                <Text style={{ color: "#fff" }}>Undo</Text>
              </Pressable>
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
                  {saving ? "Saving..." : "Save changes"}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Summary bar: transfers mode */}
          {mode === "transfers" &&
            pending.length > 0 &&
            selectedPos === null && (
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: PURPLE,
                  paddingTop: 12,
                  paddingBottom: insets.bottom + 12,
                  paddingHorizontal: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Pressable onPress={() => setPending([])}>
                  <Text style={{ color: "#fff" }}>Reset</Text>
                </Pressable>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: "#fff", fontWeight: "700" }}>
                    {pending.length} transfer{pending.length > 1 ? "s" : ""} ·{" "}
                    {money(bankAfter)} left
                  </Text>
                  <Text
                    style={{ color: hit > 0 ? "#ff9aa2" : GREEN, fontSize: 12 }}
                  >
                    {hit > 0 ? `-${hit} points` : "No points cost"}
                  </Text>
                </View>
                <Pressable
                  onPress={reviewTransfers}
                  style={{
                    backgroundColor: GREEN,
                    paddingVertical: 10,
                    paddingHorizontal: 22,
                    borderRadius: 24,
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
    </View>
  );
}
