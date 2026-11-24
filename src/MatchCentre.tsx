// Matches: every fixture of a gameweek with kick-off times, live scores and
// results, and what happened in each match (goals, assists, cards, bonus).
// Refreshes on its own while a match is in play. Reads FPL's public data.
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppSymbol } from "./AppSymbol";
import { FOOTER_HEIGHT, ScreenBackground, THEME } from "./theme";
import { loadFplBasics, peekFplBasics } from "./fplPublic";
import { FRESH, fplJson, peekFpl } from "./fplCache";
import type { FplBasics } from "./fplPublic";
import { matchBonus } from "./live";

const BG = THEME.bg;
const SURFACE = THEME.surface;
const LINE = THEME.line;
const INK = THEME.ink;
const SOFT = THEME.soft;
const MUTED = THEME.muted;
const GOOD = THEME.good;
const LAST_GAMEWEEK = 38;
const LIVE_REFRESH_MS = 30_000;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type StatRow = { element: number; value: number };
export type Fixture = {
  id: number;
  kickoff_time: string | null;
  provisional_start_time: boolean;
  started: boolean;
  finished: boolean;
  finished_provisional: boolean;
  minutes: number;
  team_h: number;
  team_a: number;
  team_h_score: number | null;
  team_a_score: number | null;
  stats: { identifier: string; h: StatRow[]; a: StatRow[] }[];
};

// The match events shown when a match is opened, in this order. (Goals,
// assists and own goals are shown under the score.)
const EVENTS: { id: string; label: string }[] = [
  { id: "penalties_missed", label: "Penalties missed" },
  { id: "penalties_saved", label: "Penalties saved" },
  { id: "red_cards", label: "Red cards" },
  { id: "bonus", label: "Bonus" },
];

const pad = (n: number) => String(n).padStart(2, "0");
export const isLive = (f: Fixture) => f.started && !f.finished_provisional;

export function dayLabel(iso: string | null) {
  if (!iso) return "Date to be confirmed";
  const date = new Date(iso);
  return `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function status(f: Fixture) {
  if (isLive(f)) return { text: f.minutes >= 90 ? "90+'" : `${Math.max(1, f.minutes)}'`, live: true };
  if (f.started) return { text: "FT", live: false };
  if (!f.kickoff_time || f.provisional_start_time) return { text: "TBC", live: false };
  const date = new Date(f.kickoff_time);
  return { text: `${pad(date.getHours())}:${pad(date.getMinutes())}`, live: false };
}

// One match's events for each side. Bonus comes from FPL once the match is
// confirmed; before that it is worked out from the bonus points system.
function matchEvents(f: Fixture) {
  const stat = (id: string) => f.stats.find((s) => s.identifier === id);
  const result: { id: string; label: string; h: StatRow[]; a: StatRow[] }[] = [];
  EVENTS.forEach((event) => {
    let h = stat(event.id)?.h ?? [];
    let a = stat(event.id)?.a ?? [];
    if (event.id === "bonus" && h.length + a.length === 0 && f.started && !f.finished) {
      const bps = stat("bps");
      if (bps) {
        const awards = matchBonus([...bps.h, ...bps.a]);
        const side = (rows: StatRow[]) =>
          rows.filter((row) => awards[row.element]).map((row) => ({ element: row.element, value: awards[row.element] }));
        h = side(bps.h);
        a = side(bps.a);
      }
    }
    if (h.length + a.length > 0) {
      const byValue = (rows: StatRow[]) => [...rows].sort((x, y) => y.value - x.value);
      result.push({ ...event, label: event.id === "bonus" && !f.finished ? "Bonus (provisional)" : event.label, h: byValue(h), a: byValue(a) });
    }
  });
  return result;
}

// Who scored and who assisted, for one side. Own goals count for the other
// team, so they're listed under the side that benefited.
function sideScorers(f: Fixture, side: "h" | "a") {
  const stat = (id: string) => f.stats.find((s) => s.identifier === id);
  const other = side === "h" ? "a" : "h";
  return {
    goals: [...(stat("goals_scored")?.[side] ?? [])].sort((x, y) => y.value - x.value),
    ownGoals: stat("own_goals")?.[other] ?? [],
    assists: [...(stat("assists")?.[side] ?? [])].sort((x, y) => y.value - x.value),
  };
}

export function Scorers({
  fixture,
  side,
  basics,
  mine,
}: {
  fixture: Fixture;
  side: "h" | "a";
  basics: FplBasics;
  mine: Set<number>;
}) {
  const { goals, ownGoals, assists } = sideScorers(fixture, side);
  const align = side === "h" ? "right" : "left";
  const name = (row: StatRow) => basics.players.get(row.element)?.name ?? "?";
  const names = (rows: StatRow[], suffix = "") =>
    rows.map((row, index) => (
      <Text key={`${row.element}-${suffix}`} style={{ color: mine.has(row.element) ? GOOD : undefined }}>
        {`${index > 0 ? ", " : ""}${name(row)}${row.value > 1 ? ` ×${row.value}` : ""}${suffix}`}
      </Text>
    ));
  if (goals.length + ownGoals.length + assists.length === 0) return <View style={{ flex: 1 }} />;
  return (
    <View style={{ flex: 1 }}>
      {goals.length + ownGoals.length > 0 && (
        <Text style={{ color: SOFT, fontSize: 11.5, lineHeight: 16, textAlign: align }}>
          {names(goals)}
          {goals.length > 0 && ownGoals.length > 0 ? <Text>, </Text> : null}
          {names(ownGoals, " (OG)")}
        </Text>
      )}
      {assists.length > 0 && (
        <Text style={{ color: MUTED, fontSize: 10.5, lineHeight: 15, textAlign: align, marginTop: 1 }}>
          <Text>{"Assists: "}</Text>
          {names(assists)}
        </Text>
      )}
    </View>
  );
}

export function MatchDetails({ fixture, basics, mine }: { fixture: Fixture; basics: FplBasics; mine: Set<number> }) {
  const events = matchEvents(fixture);
  const name = (row: StatRow, showValue: boolean) => {
    const player = basics.players.get(row.element)?.name ?? "?";
    return `${player}${showValue && row.value > 1 ? ` ×${row.value}` : ""}`;
  };
  const side = (rows: StatRow[], align: "left" | "right", isBonus: boolean) => (
    <View style={{ flex: 1, alignItems: align === "left" ? "flex-start" : "flex-end" }}>
      {rows.map((row) => {
        const own = mine.has(row.element);
        return (
          <Text
            key={row.element}
            numberOfLines={1}
            style={{ color: own ? GOOD : SOFT, fontSize: 11.5, fontWeight: own ? "700" : "400", textAlign: align, lineHeight: 16 }}
          >
            {isBonus ? `${basics.players.get(row.element)?.name ?? "?"} ${row.value}` : name(row, true)}
          </Text>
        );
      })}
    </View>
  );
  if (events.length === 0) {
    return (
      <Text style={{ color: MUTED, fontSize: 11.5, textAlign: "center", paddingBottom: 10 }}>
        {fixture.started ? "No cards, penalties or bonus yet." : "Not started yet."}
      </Text>
    );
  }
  return (
    <View style={{ paddingHorizontal: 14, paddingBottom: 10, gap: 8 }}>
      {events.map((event) => (
        <View key={event.id}>
          <Text style={{ color: MUTED, fontSize: 9.5, fontWeight: "700", letterSpacing: 0.6, textAlign: "center", marginBottom: 2 }}>
            {event.label.toUpperCase()}
          </Text>
          <View style={{ flexDirection: "row", gap: 16 }}>
            {side(event.h, "left", event.id === "bonus")}
            {side(event.a, "right", event.id === "bonus")}
          </View>
        </View>
      ))}
    </View>
  );
}

const fixturesPath = (event: number) => `fixtures/?event=${event}`;

// What the page needs before it opens: names and the gameweek's matches.
export function loadMatchCentre(event: number) {
  return Promise.all([loadFplBasics(), fplJson(fixturesPath(event), FRESH.live)]);
}

export function MatchCentre({
  startEvent,
  myPlayerIds,
  onBack,
}: {
  // The gameweek shown first.
  startEvent: number;
  // Players in your squad, highlighted in match events.
  myPlayerIds: number[];
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [event, setEvent] = useState(Math.min(LAST_GAMEWEEK, Math.max(1, startEvent)));
  // Read before the page opens (loadMatchCentre), so it starts complete.
  const [basics, setBasics] = useState<FplBasics | null>(peekFplBasics);
  const [fixtures, setFixtures] = useState<{ event: number; list: Fixture[]; updatedAt: number } | null>(() => {
    const ready = peekFpl(fixturesPath(event));
    return Array.isArray(ready) ? { event, list: ready, updatedAt: Date.now() } : null;
  });
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const mine = useMemo(() => new Set(myPlayerIds), [myPlayerIds]);
  const inFlight = useRef(false);

  // Club and player names, once.
  useEffect(() => {
    let active = true;
    loadFplBasics()
      .then((next) => active && setBasics(next))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [attempt]);

  // The gameweek's fixtures, and again every 30 seconds while one is live.
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    const load = () => {
      if (inFlight.current || AppState.currentState !== "active") return;
      inFlight.current = true;
      fplJson<Fixture[]>(fixturesPath(event), FRESH.live)
        .then((list) => {
          if (!active) return;
          setFixtures({ event, list: Array.isArray(list) ? list : [], updatedAt: Date.now() });
          setFailed(false);
          const anyLive = list.some(isLive) || list.some((f) => f.finished_provisional && !f.finished);
          if (anyLive && !timer) timer = setInterval(load, LIVE_REFRESH_MS);
          if (!anyLive && timer) {
            clearInterval(timer);
            timer = null;
          }
        })
        .catch(() => active && setFailed(true))
        .finally(() => {
          inFlight.current = false;
        });
    };
    load();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") load();
    });
    return () => {
      active = false;
      if (timer) clearInterval(timer);
      subscription.remove();
    };
  }, [event, attempt]);

  const shown = fixtures?.event === event ? fixtures.list : null;
  const groups = useMemo(() => {
    if (!shown) return [];
    const sorted = [...shown].sort(
      (a, b) => (a.kickoff_time ?? "9").localeCompare(b.kickoff_time ?? "9") || a.id - b.id,
    );
    const list: { day: string; matches: Fixture[] }[] = [];
    sorted.forEach((fixture) => {
      const day = dayLabel(fixture.kickoff_time);
      const last = list[list.length - 1];
      if (last && last.day === day) last.matches.push(fixture);
      else list.push({ day, matches: [fixture] });
    });
    return list;
  }, [shown]);
  const liveCount = shown?.filter(isLive).length ?? 0;

  const step = (delta: number) => {
    setOpen(null);
    setEvent((current) => Math.min(LAST_GAMEWEEK, Math.max(1, current + delta)));
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScreenBackground />
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 16 }}>
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => ({
            alignSelf: "flex-start",
            flexDirection: "row",
            alignItems: "center",
            gap: 2,
            paddingVertical: 6,
            marginLeft: -4,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <AppSymbol name={{ ios: "chevron.left", android: "chevron_left", web: "chevron_left" }} color={SOFT} size={20} />
          <Text style={{ color: SOFT, fontSize: 14, fontWeight: "500" }}>Back</Text>
        </Pressable>
        <Text accessibilityRole="header" style={{ color: INK, fontSize: 20, fontWeight: "700", marginTop: 4 }}>
          Matches
        </Text>

        {/* Gameweek stepper */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
          <Pressable
            onPress={() => step(-1)}
            disabled={event <= 1}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Previous gameweek"
            style={{ opacity: event <= 1 ? 0.3 : 1, paddingVertical: 6, paddingRight: 12 }}
          >
            <AppSymbol name={{ ios: "chevron.left", android: "chevron_left", web: "chevron_left" }} color={INK} size={20} />
          </Pressable>
          <View style={{ alignItems: "center" }}>
            <Text style={{ color: INK, fontSize: 14, fontWeight: "700" }}>{`Gameweek ${event}`}</Text>
            <Text style={{ color: liveCount ? GOOD : MUTED, fontSize: 12, marginTop: 1 }}>
              {liveCount ? `● ${liveCount} live now` : shown ? `${shown.filter((f) => f.started).length} of ${shown.length} played` : " "}
            </Text>
          </View>
          <Pressable
            onPress={() => step(1)}
            disabled={event >= LAST_GAMEWEEK}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Next gameweek"
            style={{ opacity: event >= LAST_GAMEWEEK ? 0.3 : 1, paddingVertical: 6, paddingLeft: 12 }}
          >
            <AppSymbol name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }} color={INK} size={20} />
          </Pressable>
        </View>
      </View>

      {(!shown || !basics) && !failed && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={SOFT} />
        </View>
      )}
      {failed && (!shown || !basics) && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 30 }}>
          <Text style={{ color: SOFT, fontSize: 13.5, textAlign: "center" }}>
            {"Couldn't load matches from FPL. Check your connection."}
          </Text>
          <Pressable
            onPress={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
            accessibilityRole="button"
            style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: LINE }}
          >
            <Text style={{ color: INK, fontWeight: "600" }}>Try again</Text>
          </Pressable>
        </View>
      )}

      {shown && basics && (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + FOOTER_HEIGHT + 28 }}>
          {shown.length === 0 && (
            <Text style={{ color: MUTED, fontSize: 13, textAlign: "center", marginTop: 30 }}>
              No matches in this gameweek.
            </Text>
          )}
          {groups.map((group) => (
            <View key={group.day}>
              <Text
                accessibilityRole="header"
                style={{ color: THEME.accent, fontSize: 10.5, fontWeight: "500", letterSpacing: 2, textTransform: "uppercase", marginTop: 18, marginBottom: 8, marginLeft: 2 }}
              >
                {group.day}
              </Text>
              <View style={{ backgroundColor: SURFACE, borderRadius: 12, overflow: "hidden" }}>
                {group.matches.map((fixture, index) => {
                  const home = basics.teams.get(fixture.team_h);
                  const away = basics.teams.get(fixture.team_a);
                  const state = status(fixture);
                  const expanded = open === fixture.id;
                  const scored = fixture.started && fixture.team_h_score != null && fixture.team_a_score != null;
                  return (
                    <View key={fixture.id}>
                      {index > 0 && <View style={{ height: 1, backgroundColor: LINE }} />}
                      <Pressable
                        onPress={() => setOpen((current) => (current === fixture.id ? null : fixture.id))}
                        accessibilityRole="button"
                        accessibilityState={{ expanded }}
                        accessibilityLabel={`${home?.name ?? "?"} ${scored ? fixture.team_h_score : ""} ${away?.name ?? "?"} ${scored ? fixture.team_a_score : ""}, ${
                          state.live ? `live, ${state.text}` : state.text === "FT" ? "full time" : `kick-off ${state.text}`
                        }. Show match details`}
                        style={({ pressed }) => ({
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 14,
                          paddingTop: 10,
                          paddingBottom: scored ? 4 : 10,
                          backgroundColor: pressed ? "rgba(255,255,255,0.04)" : "transparent",
                        })}
                      >
                        <Text numberOfLines={1} style={{ flex: 1, color: INK, fontSize: 12.5, fontWeight: "600", textAlign: "right" }}>
                          {home?.name ?? "?"}
                        </Text>
                        <View style={{ width: 64, alignItems: "center" }}>
                          {scored ? (
                            <Text style={{ color: INK, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                              {`${fixture.team_h_score} – ${fixture.team_a_score}`}
                            </Text>
                          ) : (
                            <Text style={{ color: SOFT, fontSize: 12.5, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{state.text}</Text>
                          )}
                          {scored && (
                            <Text style={{ color: state.live ? GOOD : MUTED, fontSize: 10, fontWeight: state.live ? "700" : "500", marginTop: 1 }}>
                              {state.live ? `● ${state.text}` : state.text}
                            </Text>
                          )}
                        </View>
                        <Text numberOfLines={1} style={{ flex: 1, color: INK, fontSize: 12.5, fontWeight: "600" }}>
                          {away?.name ?? "?"}
                        </Text>
                      </Pressable>
                      {scored && (
                        <Pressable
                          onPress={() => setOpen((current) => (current === fixture.id ? null : fixture.id))}
                          accessible={false}
                          style={{ flexDirection: "row", paddingHorizontal: 14, paddingBottom: 10, gap: 64 }}
                        >
                          <Scorers fixture={fixture} side="h" basics={basics} mine={mine} />
                          <Scorers fixture={fixture} side="a" basics={basics} mine={mine} />
                        </Pressable>
                      )}
                      {expanded && <MatchDetails fixture={fixture} basics={basics} mine={mine} />}
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
          {shown.length > 0 && (
            <Text style={{ color: MUTED, fontSize: 11.5, lineHeight: 16, marginTop: 12, marginLeft: 2 }}>
              {`Tap a match for penalties, red cards and bonus. Your players are shown in green.${
                liveCount ? " Live scores refresh every 30 seconds." : ""
              } Kick-off times are in your phone's time zone.`}
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}
