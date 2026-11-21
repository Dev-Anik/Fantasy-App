// A player's gameweek, opened from a card on the Points page: his match (score,
// status, scorers, cards, bonus) and his own live figures (how his points were
// made, minutes, bonus points system, expected goals and assists).
// Reads FPL's public data and refreshes on its own while the match is live.
import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, AppState, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PlayerArt } from "./Pitch";
import { THEME } from "./theme";
import { LiveDot } from "./LiveDot";
import { useSwipeToClose } from "./useSwipeToClose";
import { loadFplBasics } from "./fplPublic";
import type { FplBasics } from "./fplPublic";
import { matchBonus } from "./live";
import { MatchDetails, Scorers, dayLabel, isLive, status } from "./MatchCentre";
import type { Fixture } from "./MatchCentre";

const API = "https://fantasy.premierleague.com/api/";
const LIVE_REFRESH_MS = 30_000;
const POS = ["", "GKP", "DEF", "MID", "FWD"];
const INK = THEME.ink;
const SOFT = THEME.soft;
const MUTED = THEME.muted;

// How FPL names each scoring line, in words.
const STAT_LABELS: Record<string, string> = {
  minutes: "Minutes played",
  goals_scored: "Goals",
  assists: "Assists",
  clean_sheets: "Clean sheet",
  goals_conceded: "Goals conceded",
  own_goals: "Own goals",
  penalties_saved: "Penalties saved",
  penalties_missed: "Penalties missed",
  yellow_cards: "Yellow card",
  red_cards: "Red card",
  saves: "Saves",
  bonus: "Bonus",
  defensive_contribution: "Defensive contribution",
};
const label = (id: string) =>
  STAT_LABELS[id] ?? id.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

type ExplainLine = { identifier: string; points: number; value: number };
type LiveElement = {
  id: number;
  stats: Record<string, number | string>;
  explain: { fixture: number; stats: ExplainLine[] }[];
};

export type PlayerMatchTarget = {
  id: number;
  name: string;
  team: string;
  teamId: number;
  type: number;
  // 2 for a captain, 3 with Triple Captain, 0 on the bench (not counted).
  multiplier: number;
  captain: boolean;
};

const num = (value: number | string | undefined) => {
  const n = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

// Bonus is added by FPL once a match is confirmed; until then, the bonus
// points system gives the provisional award.
function provisionalBonusFor(fixture: Fixture, live: LiveElement | null, playerId: number) {
  const lines = live?.explain.find((e) => e.fixture === fixture.id)?.stats ?? [];
  if (!fixture.started || fixture.finished || lines.some((line) => line.identifier === "bonus")) return 0;
  const bps = fixture.stats.find((s) => s.identifier === "bps");
  return bps ? (matchBonus([...bps.h, ...bps.a])[playerId] ?? 0) : 0;
}

type MatchData = { key: string; fixtures: Fixture[]; live: LiveElement | null; basics: FplBasics };

// The player's matches this gameweek and his live figures.
async function fetchMatch(player: PlayerMatchTarget, event: number): Promise<MatchData> {
  const [fixtures, live, basics] = await Promise.all([
    fetch(`${API}fixtures/?event=${event}`).then((r) => (r.ok ? r.json() : Promise.reject())),
    fetch(`${API}event/${event}/live/`).then((r) => (r.ok ? r.json() : Promise.reject())),
    loadFplBasics(),
  ]);
  const mine = (Array.isArray(fixtures) ? fixtures : []).filter(
    (f: Fixture) => f.team_h === player.teamId || f.team_a === player.teamId,
  );
  const element = (live?.elements ?? []).find((e: LiveElement) => e.id === player.id) ?? null;
  return { key: `${player.id}-${event}`, fixtures: mine, live: element, basics };
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text style={{ color: THEME.accent, fontSize: 9, fontWeight: "600", letterSpacing: 1.8, marginTop: 18, marginBottom: 8 }}>
      {children}
    </Text>
  );
}

export function PlayerMatchSheet({
  player,
  event,
  onClose,
}: {
  player: PlayerMatchTarget | null;
  event: number;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<MatchData | null>(null);
  const [failedKey, setFailedKey] = useState("");
  // Bumped by "Try again" and by the live refresh, to load again.
  const [attempt, setAttempt] = useState(0);
  const key = player ? `${player.id}-${event}` : "";
  const failed = !!key && failedKey === key;

  useEffect(() => {
    if (!player) return;
    let active = true;
    fetchMatch(player, event).then(
      (result) => {
        if (!active) return;
        setData(result);
        setFailedKey("");
      },
      () => {
        if (active) setFailedKey(`${player.id}-${event}`);
      },
    );
    return () => {
      active = false;
    };
  }, [player, event, attempt]);

  const shown = data && data.key === key ? data : null;
  const anyLive = !!shown?.fixtures.some(isLive);
  // While one of his matches is live, load again every 30 seconds.
  useEffect(() => {
    if (!player || !anyLive) return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active") setAttempt((n) => n + 1);
    }, LIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [player, anyLive]);
  const load = () => setAttempt((n) => n + 1);

  const close = () => onClose();
  const swipe = useSwipeToClose(close, !!player);

  // FPL's own figure, as the official app shows it: provisional bonus is
  // listed below but only counts once FPL confirms it.
  const basePoints = num(shown?.live?.stats.total_points);
  const multiplier = player?.multiplier ?? 1;

  return (
    <Modal visible={!!player} transparent animationType="slide" statusBarTranslucent onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={close}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(3, 5, 12, 0.55)" }}
        />
        {!!player && (
          <Animated.View
            accessibilityViewIsModal
            {...swipe.panHandlers}
            style={{
              transform: swipe.transform,
              maxHeight: "86%",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              backgroundColor: THEME.surfaceRaised,
              borderWidth: 1,
              borderBottomWidth: 0,
              borderColor: "rgba(255, 255, 255, 0.08)",
              paddingTop: 10,
            }}
          >
            <View style={{ alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: "rgba(255, 255, 255, 0.18)" }} />

            {/* Player and his points */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, marginTop: 14 }}>
              <PlayerArt team={player.team} size={48} goalkeeper={player.type === 1} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text numberOfLines={1} style={{ flexShrink: 1, color: INK, fontSize: 15.5, fontWeight: "700" }}>
                    {player.name}
                  </Text>
                  {player.captain && (
                    <View style={{ width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#f2c14e" }}>
                      <Text style={{ color: THEME.onAccent, fontSize: 8.5, fontWeight: "800" }}>C</Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>{`${POS[player.type] ?? ""} · ${player.team} · GW ${event}`}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                {/* The player's points in gold, as on the cards. */}
                <Text style={{ color: "#ffd400", fontSize: 22.5, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                  {shown ? basePoints * Math.max(1, multiplier) : "—"}
                </Text>
                <Text style={{ color: MUTED, fontSize: 8.5, letterSpacing: 1 }}>
                  {multiplier > 1 ? `${basePoints} × ${multiplier}` : multiplier === 0 ? "BENCH" : "POINTS"}
                </Text>
              </View>
            </View>

            <ScrollView
              onScroll={swipe.onScroll}
              {...swipe.listTouch}
              scrollEventThrottle={16}
              contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 24 }}
            >
              {!shown && !failed && <ActivityIndicator color={THEME.accent} style={{ marginVertical: 40 }} />}
              {!shown && failed && (
                <View style={{ alignItems: "center", marginVertical: 32, gap: 10 }}>
                  <Text style={{ color: SOFT, fontSize: 12, textAlign: "center" }}>
                    {"Couldn't load this match. Check your connection and try again."}
                  </Text>
                  <Pressable onPress={load} accessibilityRole="button" hitSlop={8}>
                    <Text style={{ color: THEME.accent, fontSize: 12, fontWeight: "600" }}>Try again</Text>
                  </Pressable>
                </View>
              )}

              {shown && shown.fixtures.length === 0 && (
                <Text style={{ color: SOFT, fontSize: 12, textAlign: "center", marginVertical: 32 }}>
                  {`${player.team} have no match in gameweek ${event}.`}
                </Text>
              )}

              {shown?.fixtures.map((fixture) => (
                <MatchBlock key={fixture.id} fixture={fixture} player={player} live={shown.live} basics={shown.basics} />
              ))}
            </ScrollView>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

// What this player did for his points, by position: the figures FPL scores
// him on, with how close he is to the next award (defensive contribution,
// saves) and whether a clean sheet is still on.
type ImpactRow = { label: string; value: string; note?: string; progress?: number; good?: boolean; bad?: boolean };

function impactRows(type: number, stats: Record<string, number | string>, matchLive: boolean): ImpactRow[] {
  const conceded = num(stats.goals_conceded);
  const rows: ImpactRow[] = [];

  // Defensive contribution: 2 points at 10 (defenders: clearances, blocks,
  // interceptions and tackles) or 12 (midfielders and forwards, recoveries
  // too). Goalkeepers don't score it.
  if (type >= 2) {
    const target = type === 2 ? 10 : 12;
    const value = num(stats.defensive_contribution);
    const reached = value >= target;
    rows.push({
      label: "Defensive contribution",
      value: `${value} / ${target}`,
      note: reached ? "+2 pts earned" : `${target - value} more for +2 pts`,
      progress: Math.min(1, value / target),
      good: reached,
    });
  }

  // (No clean sheet row: a kept one shows in how his points were made.)

  if (type === 1) {
    const saves = num(stats.saves);
    rows.push({
      label: "Saves",
      value: String(saves),
      note: `${Math.floor(saves / 3)} pts · ${3 - (saves % 3)} more for the next point`,
      progress: (saves % 3) / 3,
    });
    if (num(stats.penalties_saved) > 0) rows.push({ label: "Penalties saved", value: String(num(stats.penalties_saved)), good: true });
  }

  // Goalkeepers and defenders lose a point for every 2 goals conceded.
  if (type <= 2 && conceded > 0) {
    rows.push({ label: "Goals conceded", value: String(conceded), note: `−${Math.floor(conceded / 2)} pts`, bad: conceded >= 2 });
  }

  // (Goals, assists, expected goals and the like aren't repeated here: they
  // are in the figures above and in how his points were made below.)
  return rows;
}

function ImpactCard({ type, stats, matchLive }: { type: number; stats: Record<string, number | string>; matchLive: boolean }) {
  const rows = impactRows(type, stats, matchLive);
  if (rows.length === 0) return null;
  return (
    <View style={{ marginTop: 10, borderRadius: 14, backgroundColor: THEME.surface, overflow: "hidden" }}>
      <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: THEME.line }}>
        <Text style={{ color: MUTED, fontSize: 8.5, letterSpacing: 1 }}>{`IMPACT · ${POS[type] ?? ""}`}</Text>
      </View>
      {rows.map((row) => (
        <View key={row.label} style={{ paddingHorizontal: 14, paddingVertical: 9 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ flex: 1, color: SOFT, fontSize: 11.5 }}>{row.label}</Text>
            <Text
              style={{
                color: row.good ? THEME.good : row.bad ? THEME.bad : INK,
                fontSize: 11.5,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
              }}
            >
              {row.value}
            </Text>
          </View>
          {row.progress != null && (
            <View style={{ height: 4, borderRadius: 2, marginTop: 6, backgroundColor: "rgba(255, 255, 255, 0.08)", overflow: "hidden" }}>
              <View
                style={{
                  width: `${Math.round(row.progress * 100)}%`,
                  height: "100%",
                  borderRadius: 2,
                  backgroundColor: row.good ? THEME.good : THEME.accent,
                }}
              />
            </View>
          )}
          {!!row.note && <Text style={{ color: MUTED, fontSize: 10, marginTop: 4 }}>{row.note}</Text>}
        </View>
      ))}
    </View>
  );
}

function MatchBlock({
  fixture,
  player,
  live,
  basics,
}: {
  fixture: Fixture;
  player: PlayerMatchTarget;
  live: LiveElement | null;
  basics: FplBasics;
}) {
  const home = basics.teams.get(fixture.team_h);
  const away = basics.teams.get(fixture.team_a);
  const state = status(fixture);
  const mine = new Set([player.id]);
  const lines = live?.explain.find((e) => e.fixture === fixture.id)?.stats ?? [];

  const provisionalBonus = provisionalBonusFor(fixture, live, player.id);
  const minutes = num(live?.stats.minutes);
  const figures: { label: string; value: string }[] = live
    ? [
        { label: "Minutes", value: String(minutes) },
        { label: "BPS", value: String(num(live.stats.bps)) },
        { label: "xG", value: num(live.stats.expected_goals).toFixed(2) },
        { label: "xA", value: num(live.stats.expected_assists).toFixed(2) },
      ]
    : [];

  return (
    <View>
      {/* His own match first (figures, impact, how his points were made),
          then the match itself. */}
      {fixture.started ? (
        <>
          <SectionTitle>{`${player.name.toUpperCase()} IN THIS MATCH`}</SectionTitle>
          {figures.length > 0 && (
            <View style={{ flexDirection: "row", borderRadius: 14, backgroundColor: THEME.surface, paddingVertical: 10 }}>
              {figures.map((figure, index) => (
                <View key={figure.label} style={{ flex: 1, alignItems: "center", borderLeftWidth: index ? 1 : 0, borderLeftColor: THEME.line }}>
                  <Text style={{ color: INK, fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{figure.value}</Text>
                  <Text style={{ color: MUTED, fontSize: 8.5, letterSpacing: 0.8, marginTop: 2 }}>{figure.label.toUpperCase()}</Text>
                </View>
              ))}
            </View>
          )}

          {live && minutes > 0 && <ImpactCard type={player.type} stats={live.stats} matchLive={state.live} />}

          <View style={{ marginTop: 10, borderRadius: 14, backgroundColor: THEME.surface, overflow: "hidden" }}>
            <View style={{ flexDirection: "row", paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: THEME.line }}>
              <Text style={{ flex: 1, color: MUTED, fontSize: 8.5, letterSpacing: 1 }}>HOW HIS POINTS WERE MADE</Text>
              <Text style={{ width: 44, textAlign: "right", color: MUTED, fontSize: 8.5, letterSpacing: 1 }}>VALUE</Text>
              <Text style={{ width: 44, textAlign: "right", color: MUTED, fontSize: 8.5, letterSpacing: 1 }}>PTS</Text>
            </View>
            {lines.length === 0 && provisionalBonus === 0 ? (
              <Text style={{ color: MUTED, fontSize: 11, paddingHorizontal: 14, paddingVertical: 12 }}>
                {minutes > 0 ? "No points recorded yet." : "Hasn't played in this match."}
              </Text>
            ) : (
              <>
                {lines.map((line) => (
                  <View key={line.identifier} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 9 }}>
                    <Text style={{ flex: 1, color: SOFT, fontSize: 11.5 }}>{label(line.identifier)}</Text>
                    <Text style={{ width: 44, textAlign: "right", color: MUTED, fontSize: 11.5, fontVariant: ["tabular-nums"] }}>{line.value}</Text>
                    <Text
                      style={{
                        width: 44,
                        textAlign: "right",
                        color: line.points < 0 ? THEME.bad : "#ffd400",
                        fontSize: 11.5,
                        fontWeight: "700",
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {line.points > 0 ? `+${line.points}` : line.points}
                    </Text>
                  </View>
                ))}
                {provisionalBonus > 0 && (
                  <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 9 }}>
                    <Text style={{ flex: 1, color: SOFT, fontSize: 11.5 }}>Bonus (provisional, not yet added)</Text>
                    <Text style={{ width: 44 }} />
                    <Text style={{ width: 44, textAlign: "right", color: "#f2c14e", fontSize: 11.5, fontWeight: "700" }}>
                      {`+${provisionalBonus}`}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
          {state.live && (
            <Text style={{ color: MUTED, fontSize: 10, marginTop: 8 }}>Live: updates every 30 seconds.</Text>
          )}
        </>
      ) : (
        <Text style={{ color: MUTED, fontSize: 11, marginTop: 12 }}>
          {"His points and match stats appear here once the match kicks off."}
        </Text>
      )}
      <SectionTitle>{state.live ? "LIVE MATCH" : fixture.started ? "MATCH" : "NEXT MATCH"}</SectionTitle>
      <View style={{ borderRadius: 16, backgroundColor: THEME.surface, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.06)", overflow: "hidden" }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8 }}>
          <Text numberOfLines={1} style={{ flex: 1, textAlign: "right", color: fixture.team_h === player.teamId ? INK : SOFT, fontSize: 13, fontWeight: "700" }}>
            {home?.name ?? home?.short ?? "Home"}
          </Text>
          <View style={{ minWidth: 76, alignItems: "center", marginHorizontal: 10 }}>
            {fixture.started ? (
              <Text style={{ color: INK, fontSize: 19, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
                {`${fixture.team_h_score ?? 0} – ${fixture.team_a_score ?? 0}`}
              </Text>
            ) : (
              <Text style={{ color: INK, fontSize: 14.5, fontWeight: "700" }}>{state.text}</Text>
            )}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
              {state.live && <LiveDot blink />}
              <Text style={{ color: state.live ? INK : MUTED, fontSize: 9.5, fontWeight: "600" }}>
                {fixture.started ? state.text : dayLabel(fixture.kickoff_time)}
              </Text>
            </View>
          </View>
          <Text numberOfLines={1} style={{ flex: 1, color: fixture.team_a === player.teamId ? INK : SOFT, fontSize: 13, fontWeight: "700" }}>
            {away?.name ?? away?.short ?? "Away"}
          </Text>
        </View>
        {fixture.started && (
          <View style={{ flexDirection: "row", gap: 16, paddingHorizontal: 14, paddingBottom: 10 }}>
            <Scorers fixture={fixture} side="h" basics={basics} mine={mine} />
            <Scorers fixture={fixture} side="a" basics={basics} mine={mine} />
          </View>
        )}
        {fixture.started && <MatchDetails fixture={fixture} basics={basics} mine={mine} />}
      </View>

    </View>
  );
}
