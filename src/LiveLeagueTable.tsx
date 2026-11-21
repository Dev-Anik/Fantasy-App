// The live table of a classic league while a gameweek is in play: everyone
// on this page scored live and re-ranked; a tap on a team opens its squad.
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, Text, View } from "react-native";
import type { LeagueStanding } from "./fpl";
import { loadLiveLeague } from "./liveLeague";
import type { LiveLeague } from "./liveLeague";
import { Divider, Group, Heading, MINE_BAND, MovementBadge, TABLE, LEAGUE_UI as UI } from "./leagueUi";

const REFRESH_MS = 60_000;
const formatNumber = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const timeOf = (ms: number) => {
  const date = new Date(ms);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

export function LiveLeagueTable({
  rows,
  event,
  userEntryId,
  userTeamName,
  userManagerName,
  onViewMember,
  refreshSignal = 0,
}: {
  rows: LeagueStanding[];
  event: number;
  userEntryId?: number;
  userTeamName: string;
  userManagerName: string;
  onViewMember: (entry: number, event: number, teamName?: string, managerName?: string) => void;
  // Bumped when the user pulls to refresh: reload at once.
  refreshSignal?: number;
}) {
  const [live, setLive] = useState<LiveLeague | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);
  const rowsKey = rows.map((row) => row.entry).join(",");

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (inFlight.current || AppState.currentState !== "active") return;
      inFlight.current = true;
      setRefreshing(true);
      loadLiveLeague(
        rows,
        event,
        userEntryId ? { entry: userEntryId, teamName: userTeamName, managerName: userManagerName } : undefined,
      )
        .then((next) => {
          if (!active) return;
          setLive(next);
          setError(false);
        })
        .catch(() => {
          if (active) setError(true);
        })
        .finally(() => {
          inFlight.current = false;
          if (active) setRefreshing(false);
        });
    };
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      active = false;
      clearInterval(timer);
      subscription.remove();
    };
    // rowsKey stands for rows (a new page or league); the names only label
    // the user's own entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsKey, event, userEntryId, refreshSignal]);

  if (!live) {
    return error ? (
      <Text style={{ color: UI.bad, fontSize: 12, marginTop: 16 }}>
        {"Couldn't load live scores. Check your connection; the official standings are still available."}
      </Text>
    ) : (
      <View style={{ alignItems: "center", paddingVertical: 28, gap: 8 }}>
        <ActivityIndicator color={UI.soft} />
        <Text style={{ color: UI.muted, fontSize: 11.5 }}>Working out live scores…</Text>
      </View>
    );
  }

  const ranked = live.entries.filter((entry) => entry.liveRank > 0).sort((a, b) => a.liveRank - b.liveRank);

  return (
    <View>
      <Heading hint={`Gameweek ${live.event} · updated ${timeOf(live.updatedAt)}, refreshes every minute`}>Live table</Heading>
      <Group>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6 }}>
          <Text style={{ width: 54, ...TABLE.header }}>Pos</Text>
          <Text style={{ flex: 1, ...TABLE.header }}>Team</Text>
          <Text style={{ width: 44, textAlign: "right", ...TABLE.header }}>GW</Text>
          <Text style={{ width: 62, textAlign: "right", ...TABLE.header }}>Total</Text>
        </View>
        {ranked.map((entry, index) => {
          const isMe = entry.entry === userEntryId;
          // Up or down since the end of the last gameweek (not since FPL's
          // latest mid-gameweek table update, which moves on its own).
          const moved = entry.lastRank > 0 ? entry.lastRank - entry.liveRank : 0;
          // No line touching the highlighted band.
          const nextIsMe = ranked[index + 1]?.entry === userEntryId;
          return (
            <View key={entry.entry} style={{ paddingHorizontal: 6, paddingBottom: index === ranked.length - 1 ? 6 : 0 }}>
              <Pressable
                onPress={() => onViewMember(entry.entry, live.event, entry.teamName, entry.managerName)}
                accessibilityRole="button"
                accessibilityLabel={`${entry.teamName}, live rank ${entry.liveRank}${
                  moved ? `, ${moved > 0 ? "up" : "down"} ${Math.abs(moved)}` : ""
                }, ${entry.gwPoints} this gameweek, ${entry.liveTotal} total${isMe ? ", your team" : ""}. View team`}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 12,
                  paddingVertical: TABLE.rowPaddingV,
                  borderRadius: 12,
                  ...(isMe ? MINE_BAND : null),
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View style={{ width: 54, flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text
                    style={{ minWidth: 18, color: UI.ink, fontSize: 14, fontWeight: isMe ? "800" : "500", fontVariant: ["tabular-nums"] }}
                  >
                    {formatNumber(entry.liveRank)}
                  </Text>
                  <MovementBadge value={moved > 0 ? "up" : moved < 0 ? "down" : "same"} />
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text numberOfLines={1} style={TABLE.name}>
                    {entry.teamName}
                  </Text>
                  {/* Under the name: just the captain. */}
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: TABLE.sub.marginTop }}>
                    {!!entry.captain && (
                      <>
                        {/* The captain: a small filled badge with a white C. */}
                        <View
                          accessible
                          accessibilityLabel="Captain"
                          style={{
                            width: 15,
                            height: 15,
                            borderRadius: 7.5,
                            marginRight: 4,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "#0b1020",
                            borderWidth: 1,
                            borderColor: "rgba(255, 255, 255, 0.35)",
                          }}
                        >
                          <Text allowFontScaling={false} style={{ color: "#ffffff", fontSize: 9, fontWeight: "800", includeFontPadding: false }}>
                            C
                          </Text>
                        </View>
                        <Text numberOfLines={1} style={{ ...TABLE.sub, marginTop: 0, flexShrink: 1 }}>
                          {entry.captain}
                        </Text>
                      </>
                    )}
                  </View>
                </View>
                <View style={{ width: 44, alignItems: "flex-end" }}>
                  <Text style={TABLE.figure}>{entry.gwPoints}</Text>
                  {entry.hits > 0 && <Text style={{ color: UI.bad, fontSize: 11, fontVariant: ["tabular-nums"] }}>{`−${entry.hits}`}</Text>}
                </View>
                <Text style={{ width: 62, textAlign: "right", ...TABLE.total }}>{formatNumber(entry.liveTotal)}</Text>
              </Pressable>
              {index < ranked.length - 1 && !isMe && !nextIsMe && <Divider inset={12} />}
            </View>
          );
        })}
      </Group>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
        <Text style={{ flex: 1, color: UI.muted, fontSize: 11, lineHeight: 16, marginLeft: 2 }}>
          Tap a team to see its squad. Live scores include
          auto-subs; bonus is added once FPL confirms it, as in the official app.
        </Text>
        {refreshing && <ActivityIndicator color={UI.muted} size="small" style={{ marginLeft: 8 }} />}
      </View>
      {error && (
        <Text style={{ color: UI.bad, fontSize: 11, marginTop: 6 }}>
          {"Couldn't refresh just now; showing the last live scores."}
        </Text>
      )}
    </View>
  );
}
