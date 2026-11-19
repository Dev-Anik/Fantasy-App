// The live table of a classic league while a gameweek is in play: everyone
// on this page scored live and re-ranked, and a tap on a rival shows what
// separates your teams this week.
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, Text, View } from "react-native";
import type { LeagueStanding } from "./fpl";
import { differentials, loadLiveLeague } from "./liveLeague";
import type { LiveEntry, LiveLeague, LivePlayer } from "./liveLeague";
import { Divider, Group, Heading, TextButton, LEAGUE_UI as UI } from "./leagueUi";

const REFRESH_MS = 60_000;
const formatNumber = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const timeOf = (ms: number) => {
  const date = new Date(ms);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

function PlayerList({ title, players, points, color, armbandOnly }: {
  title: string;
  players: LivePlayer[];
  points: (player: LivePlayer) => number;
  color: string;
  // Both teams have him; only the armband differs.
  armbandOnly: (player: LivePlayer) => boolean;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color, fontSize: 10.5, fontWeight: "700", letterSpacing: 0.5, marginBottom: 4 }}>
        {title.toUpperCase()}
      </Text>
      {players.length === 0 ? (
        <Text style={{ color: UI.muted, fontSize: 12.5 }}>None</Text>
      ) : (
        players.map((player) => (
          <View key={player.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 }}>
            <Text numberOfLines={1} style={{ flex: 1, color: UI.soft, fontSize: 12.5, paddingRight: 6 }}>
              {player.name}
              {(player.multiplier >= 2 || armbandOnly(player)) && (
                <Text style={{ color: UI.muted }}>{armbandOnly(player) ? " (C only)" : player.multiplier === 3 ? " (TC)" : " (C)"}</Text>
              )}
            </Text>
            <Text style={{ color: UI.ink, fontSize: 12.5, fontWeight: "600", fontVariant: ["tabular-nums"] }}>
              {points(player)}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

// What separates the two teams this gameweek.
function Comparison({ me, them, onViewTeam }: { me: LiveEntry; them: LiveEntry; onViewTeam: () => void }) {
  const diff = differentials(me, them);
  const gap = me.liveTotal - them.liveTotal;
  return (
    <View style={{ paddingHorizontal: 14, paddingBottom: 12, paddingTop: 2 }}>
      <Text style={{ color: UI.soft, fontSize: 12.5, marginBottom: 10 }}>
        {gap === 0
          ? "You're level on points."
          : `You're ${Math.abs(gap)} point${Math.abs(gap) === 1 ? "" : "s"} ${gap > 0 ? "ahead" : "behind"}.`}
        {`  Captains: you ${me.captain ?? "—"}, them ${them.captain ?? "—"}.`}
        {them.stillToPlay > 0 ? `  They have ${them.stillToPlay} still to play` : ""}
        {them.stillToPlay > 0 && me.stillToPlay > 0 ? `, you ${me.stillToPlay}.` : them.stillToPlay > 0 ? "." : ""}
      </Text>
      <View style={{ flexDirection: "row", gap: 16 }}>
        <PlayerList
          title="Only them"
          players={diff.onlyThem}
          points={diff.points}
          color={UI.bad}
          armbandOnly={(player) => diff.armbandOnly(player, "them")}
        />
        <PlayerList
          title="Only you"
          players={diff.onlyMe}
          points={diff.points}
          color={UI.good}
          armbandOnly={(player) => diff.armbandOnly(player, "me")}
        />
      </View>
      <View style={{ alignItems: "flex-start", marginTop: 6 }}>
        <TextButton label="See their team ›" onPress={onViewTeam} />
      </View>
    </View>
  );
}

export function LiveLeagueTable({
  rows,
  event,
  userEntryId,
  userTeamName,
  userManagerName,
  onViewMember,
}: {
  rows: LeagueStanding[];
  event: number;
  userEntryId?: number;
  userTeamName: string;
  userManagerName: string;
  onViewMember: (entry: number, event: number, teamName?: string, managerName?: string) => void;
}) {
  const [live, setLive] = useState<LiveLeague | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
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
  }, [rowsKey, event, userEntryId]);

  if (!live) {
    return error ? (
      <Text style={{ color: UI.bad, fontSize: 13, marginTop: 16 }}>
        {"Couldn't load live scores. Check your connection; the official standings are still available."}
      </Text>
    ) : (
      <View style={{ alignItems: "center", paddingVertical: 28, gap: 8 }}>
        <ActivityIndicator color={UI.soft} />
        <Text style={{ color: UI.muted, fontSize: 12.5 }}>Working out live scores…</Text>
      </View>
    );
  }

  const me = live.entries.find((entry) => entry.entry === userEntryId) ?? null;
  const ranked = live.entries.filter((entry) => entry.liveRank > 0).sort((a, b) => a.liveRank - b.liveRank);

  return (
    <View>
      <Heading hint={`Gameweek ${live.event} · updated ${timeOf(live.updatedAt)}, refreshes every minute`}>Live table</Heading>
      <Group>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8 }}>
          <Text style={{ width: 56, color: UI.muted, fontSize: 10.5, fontWeight: "700" }}>#</Text>
          <Text style={{ flex: 1, color: UI.muted, fontSize: 10.5, fontWeight: "700" }}>TEAM</Text>
          <Text style={{ width: 42, color: UI.muted, fontSize: 10.5, fontWeight: "700", textAlign: "right" }}>GW</Text>
          <Text style={{ width: 58, color: UI.muted, fontSize: 10.5, fontWeight: "700", textAlign: "right" }}>TOTAL</Text>
        </View>
        {ranked.map((entry) => {
          const isMe = entry.entry === userEntryId;
          const moved = entry.officialRank - entry.liveRank;
          const expanded = open === entry.entry && !!me && !isMe;
          return (
            <View key={entry.entry}>
              <Divider inset={0} />
              <Pressable
                onPress={() =>
                  me && !isMe
                    ? setOpen((current) => (current === entry.entry ? null : entry.entry))
                    : onViewMember(entry.entry, live.event, entry.teamName, entry.managerName)
                }
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={`${entry.teamName}, live rank ${entry.liveRank}${
                  moved ? `, ${moved > 0 ? "up" : "down"} ${Math.abs(moved)}` : ""
                }, ${entry.gwPoints} this gameweek, ${entry.liveTotal} total${isMe ? ", your team" : ". Compare with your team"}`}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 14,
                  paddingVertical: 11,
                  backgroundColor: pressed ? UI.pressed : isMe ? UI.mine : expanded ? "rgba(255,255,255,0.03)" : "transparent",
                })}
              >
                <View style={{ width: 56, flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ color: UI.ink, fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] }}>
                    {formatNumber(entry.liveRank)}
                  </Text>
                  {moved !== 0 && (
                    <Text style={{ color: moved > 0 ? UI.good : UI.bad, fontSize: 9, marginLeft: 3 }}>
                      {moved > 0 ? "▲" : "▼"}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text numberOfLines={1} style={{ color: isMe ? UI.good : UI.ink, fontSize: 14, fontWeight: "600" }}>
                    {entry.teamName}
                  </Text>
                  <Text numberOfLines={1} style={{ color: UI.muted, fontSize: 12, marginTop: 1 }}>
                    {entry.stillToPlay > 0 ? `${entry.stillToPlay} to play` : "All played"}
                    {entry.captain ? ` · C ${entry.captain}` : ""}
                  </Text>
                </View>
                <Text style={{ width: 42, textAlign: "right", color: UI.soft, fontSize: 13, fontVariant: ["tabular-nums"] }}>
                  {entry.gwPoints}
                  {entry.hits > 0 && <Text style={{ color: UI.bad, fontSize: 10 }}>{`\n−${entry.hits}`}</Text>}
                </Text>
                <Text style={{ width: 58, textAlign: "right", color: UI.ink, fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                  {formatNumber(entry.liveTotal)}
                </Text>
              </Pressable>
              {expanded && me && (
                <Comparison
                  me={me}
                  them={entry}
                  onViewTeam={() => onViewMember(entry.entry, live.event, entry.teamName, entry.managerName)}
                />
              )}
            </View>
          );
        })}
      </Group>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
        <Text style={{ flex: 1, color: UI.muted, fontSize: 11.5, lineHeight: 16, marginLeft: 2 }}>
          {me ? "Tap a team to compare it with yours." : "Tap a team to see its squad."} Live scores include
          provisional bonus and auto-subs; FPL confirms them after each match.
        </Text>
        {refreshing && <ActivityIndicator color={UI.muted} size="small" style={{ marginLeft: 8 }} />}
      </View>
      {error && (
        <Text style={{ color: UI.bad, fontSize: 12, marginTop: 6 }}>
          {"Couldn't refresh just now; showing the last live scores."}
        </Text>
      )}
    </View>
  );
}
