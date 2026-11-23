// Fixture planner: every club's next few fixtures in one grid, coloured by
// FPL's difficulty rating (1 easiest to 5 hardest), sorted by how kind the run
// is. The tool for planning transfers a few weeks ahead.
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppSymbol } from "./AppSymbol";
import { FDR_COLORS, FOOTER_HEIGHT, ScreenBackground, THEME } from "./theme";

const BG = THEME.bg;
const SURFACE = THEME.surface;
const LINE = THEME.line;
const INK = THEME.ink;
const SOFT = THEME.soft;
const MUTED = THEME.muted;
const LAST_GAMEWEEK = 38;

// FPL's own difficulty colours (shared with the Insights panel).
const FDR = FDR_COLORS;

const SPANS = [3, 5, 8] as const;
const TEAM_COLUMN = 50;
const AVG_COLUMN = 34;
const CELL = 52;
const ROW = 42;

type Fixture = {
  event: number;
  team_h: number;
  team_a: number;
  team_h_difficulty: number;
  team_a_difficulty: number;
};

type Cell = { opponent: string; home: boolean; fdr: number };

// A small toggle button for the planner's options.
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        paddingHorizontal: 12,
        height: 32,
        borderRadius: 16,
        justifyContent: "center",
        borderWidth: 1,
        borderColor: active ? THEME.accent : "rgba(255, 255, 255, 0.14)",
        backgroundColor: active ? THEME.accentSoft : "transparent",
      }}
    >
      <Text style={{ color: active ? INK : SOFT, fontSize: 12.5, fontWeight: active ? "600" : "400" }}>{label}</Text>
    </Pressable>
  );
}

export function FixturePlanner({
  teams,
  myClubs,
  startEvent,
  onBack,
}: {
  // Every club: FPL id and short name.
  teams: { id: number; short: string }[];
  // How many of your players each club has.
  myClubs: Record<number, number>;
  // The first gameweek to show (the next deadline's).
  startEvent: number;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [fixtures, setFixtures] = useState<Fixture[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [span, setSpan] = useState<(typeof SPANS)[number]>(5);
  const [sort, setSort] = useState<"easiest" | "name">("easiest");
  const [mineOnly, setMineOnly] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("https://fantasy.premierleague.com/api/fixtures/?future=1")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        if (active) setFixtures(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const events = useMemo(() => {
    const last = Math.min(LAST_GAMEWEEK, startEvent + span - 1);
    return Array.from({ length: Math.max(0, last - startEvent + 1) }, (_, i) => startEvent + i);
  }, [startEvent, span]);

  const short = useMemo(() => Object.fromEntries(teams.map((team) => [team.id, team.short])), [teams]);

  const rows = useMemo(() => {
    if (!fixtures) return [];
    const list = teams.map((team) => {
      const cells = events.map((event) =>
        fixtures
          .filter((f) => f.event === event && (f.team_h === team.id || f.team_a === team.id))
          .map<Cell>((f) => {
            const home = f.team_h === team.id;
            return {
              opponent: short[home ? f.team_a : f.team_h] ?? "?",
              home,
              fdr: home ? f.team_h_difficulty : f.team_a_difficulty,
            };
          }),
      );
      const all = cells.flat();
      // "Ease": easier fixtures score more, a double gameweek counts twice and
      // a blank counts nothing, so runs compare fairly.
      const ease = all.reduce((sum, cell) => sum + (6 - cell.fdr), 0);
      const average = all.length ? all.reduce((sum, cell) => sum + cell.fdr, 0) / all.length : null;
      return { team, cells, ease, average };
    });
    const shown = mineOnly ? list.filter((row) => (myClubs[row.team.id] ?? 0) > 0) : list;
    return shown.sort((a, b) =>
      sort === "name" ? a.team.short.localeCompare(b.team.short) : b.ease - a.ease || a.team.short.localeCompare(b.team.short),
    );
  }, [fixtures, teams, events, short, sort, mineOnly, myClubs]);

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
        <Text accessibilityRole="header" style={{ color: INK, fontSize: 24, fontWeight: "700", marginTop: 6 }}>
          Fixture planner
        </Text>
        <Text style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>
          {events.length ? `GW ${events[0]}–${events[events.length - 1]}, easiest runs first` : "No gameweeks left this season"}
        </Text>

        {/* Controls */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {SPANS.map((value) => (
            <Chip key={value} label={`${value} GWs`} active={span === value} onPress={() => setSpan(value)} />
          ))}
          <Chip
            label={sort === "easiest" ? "Easiest first" : "A–Z"}
            active={false}
            onPress={() => setSort((current) => (current === "easiest" ? "name" : "easiest"))}
          />
          <Chip label="Your clubs" active={mineOnly} onPress={() => setMineOnly((value) => !value)} />
        </View>
      </View>

      {!fixtures && !failed && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={SOFT} />
        </View>
      )}
      {failed && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 30 }}>
          <Text style={{ color: SOFT, fontSize: 13.5, textAlign: "center" }}>
            {"Couldn't load fixtures from FPL. Check your connection."}
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

      {fixtures && (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: insets.bottom + FOOTER_HEIGHT + 28 }}>
          <View style={{ flexDirection: "row", backgroundColor: SURFACE, borderRadius: 12, overflow: "hidden" }}>
            {/* Fixed columns: club and average difficulty */}
            <View style={{ borderRightWidth: 1, borderRightColor: LINE }}>
              <View style={{ flexDirection: "row", height: 30, alignItems: "center", paddingLeft: 10 }}>
                <Text style={{ width: TEAM_COLUMN - 10, color: MUTED, fontSize: 10.5, fontWeight: "700" }}>CLUB</Text>
                <Text style={{ width: AVG_COLUMN, color: MUTED, fontSize: 10.5, fontWeight: "700", textAlign: "center" }}>AVG</Text>
              </View>
              {rows.map((row) => {
                const mine = myClubs[row.team.id] ?? 0;
                return (
                  <View
                    key={row.team.id}
                    accessible
                    accessibilityLabel={`${row.team.short}${mine ? `, ${mine} of your players` : ""}, average difficulty ${row.average?.toFixed(1) ?? "none"}`}
                    style={{ flexDirection: "row", height: ROW, alignItems: "center", paddingLeft: 10, borderTopWidth: 1, borderTopColor: LINE }}
                  >
                    <View style={{ width: TEAM_COLUMN - 10 }}>
                      <Text style={{ color: INK, fontSize: 13, fontWeight: "700" }}>{row.team.short}</Text>
                      {mine > 0 && <Text style={{ color: MUTED, fontSize: 10 }}>{`${mine} yours`}</Text>}
                    </View>
                    <Text style={{ width: AVG_COLUMN, color: SOFT, fontSize: 12, textAlign: "center", fontVariant: ["tabular-nums"] }}>
                      {row.average != null ? row.average.toFixed(1) : "—"}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Gameweeks: scroll sideways when they don't fit */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={{ flexDirection: "row", height: 30, alignItems: "center" }}>
                  {events.map((event) => (
                    <Text key={event} style={{ width: CELL, color: MUTED, fontSize: 10.5, fontWeight: "700", textAlign: "center" }}>
                      {`GW ${event}`}
                    </Text>
                  ))}
                </View>
                {rows.map((row) => (
                  <View key={row.team.id} style={{ flexDirection: "row", height: ROW, borderTopWidth: 1, borderTopColor: LINE }}>
                    {row.cells.map((cells, index) => (
                      <View
                        key={events[index]}
                        accessible
                        accessibilityLabel={`${row.team.short} gameweek ${events[index]}: ${
                          cells.length === 0
                            ? "no match"
                            : cells.map((c) => `${c.opponent} ${c.home ? "home" : "away"}, ${FDR[c.fdr]?.label ?? ""}`).join("; ")
                        }`}
                        style={{ width: CELL, padding: 2, gap: 2 }}
                      >
                        {cells.length === 0 ? (
                          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 4, backgroundColor: "rgba(255,255,255,0.03)" }}>
                            <Text style={{ color: MUTED, fontSize: 11 }}>—</Text>
                          </View>
                        ) : (
                          cells.map((cell, i) => {
                            const tone = FDR[cell.fdr] ?? FDR[3];
                            return (
                              <View
                                key={`${cell.opponent}-${i}`}
                                style={{ flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 4, backgroundColor: tone.fill }}
                              >
                                <Text style={{ color: tone.ink, fontSize: cells.length > 1 ? 9.5 : 11.5, fontWeight: "700" }}>
                                  {cell.opponent.toUpperCase()}
                                  {!cell.home && (
                                    <Text style={{ fontSize: cells.length > 1 ? 7.5 : 8.5, fontWeight: "600" }}>{" (A)"}</Text>
                                  )}
                                </Text>
                              </View>
                            );
                          })
                        )}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Key */}
          <View style={{ flexDirection: "row", gap: 4, marginTop: 14 }}>
            {[1, 2, 3, 4, 5].map((fdr) => (
              <View key={fdr} style={{ flex: 1, height: 22, borderRadius: 4, alignItems: "center", justifyContent: "center", backgroundColor: FDR[fdr].fill }}>
                <Text style={{ color: FDR[fdr].ink, fontSize: 10.5, fontWeight: "700" }}>{FDR[fdr].label}</Text>
              </View>
            ))}
          </View>
          <Text style={{ color: MUTED, fontSize: 12, lineHeight: 17, marginTop: 10 }}>
            (A) marks an away match; the rest are at home. Two in one box is a double gameweek; — means no match
            (a blank). AVG is the average difficulty over these gameweeks; clubs are ordered by how easy their
            whole run is, with doubles counting twice.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}
