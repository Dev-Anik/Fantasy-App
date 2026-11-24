// The FPL Cup (the game-wide knockout), shown with the General leagues: the
// manager's matches once it's under way, how qualifying went, or a note that
// it starts later in the season.
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { H2hMatch } from "./fpl";
import { loadFplCup, peekFplCup } from "./leagueDirect";
import type { FplCup } from "./leagueDirect";
import { Divider, LEAGUE_UI as UI } from "./leagueUi";

export function FplCupCard({
  entry,
  refreshSignal = 0,
  onViewMember,
}: {
  entry: number;
  refreshSignal?: number;
  onViewMember: (entry: number, event: number, teamName?: string, managerName?: string) => void;
}) {
  // Read ahead once Home is up, so the card starts complete.
  const [cup, setCup] = useState<{ entry: number; data: FplCup } | null>(() => {
    const ready = peekFplCup(entry);
    return ready ? { entry, data: ready } : null;
  });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    loadFplCup(entry).then(
      (data) => {
        if (!active) return;
        setCup({ entry, data });
        setFailed(false);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [entry, refreshSignal]);

  const data = cup?.entry === entry ? cup.data : null;

  return (
    <View style={{ marginTop: 14, borderRadius: 14, backgroundColor: UI.surface, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10 }}>
        <Text style={{ flex: 1, color: UI.ink, fontSize: 14, fontWeight: "700" }}>FPL Cup</Text>
        <Text style={{ color: UI.gold, fontSize: 10.5, fontWeight: "700", letterSpacing: 0.6 }}>KNOCKOUT</Text>
      </View>
      {!data ? (
        failed ? (
          <Text style={{ color: UI.muted, fontSize: 12, paddingHorizontal: 14, paddingBottom: 14 }}>
            {"Couldn't load the cup just now. Pull down to try again."}
          </Text>
        ) : (
          <ActivityIndicator color={UI.soft} style={{ marginBottom: 14 }} />
        )
      ) : data.matches.length > 0 ? (
        // Most recent round first.
        [...data.matches]
          .sort((a, b) => b.event - a.event)
          .map((match) => <CupMatchRow key={match.id ?? match.event} match={match} entry={entry} onViewMember={onViewMember} />)
      ) : (
        <Text style={{ color: UI.soft, fontSize: 12.5, lineHeight: 18, paddingHorizontal: 14, paddingBottom: 14 }}>
          {data.qualificationEvent
            ? `Qualifying is decided by scores in gameweek ${data.qualificationEvent}${
                data.qualificationState ? ` (${data.qualificationState.toLowerCase().replace(/_/g, " ")})` : ""
              }. Your matches will appear here.`
            : "The FPL Cup starts later in the season: managers qualify on their score in one gameweek, then play a knockout, one match a gameweek. Your matches will appear here."}
        </Text>
      )}
    </View>
  );
}

function CupMatchRow({
  match,
  entry,
  onViewMember,
}: {
  match: H2hMatch;
  entry: number;
  onViewMember: (entry: number, event: number, teamName?: string, managerName?: string) => void;
}) {
  const mineFirst = match.entry_1_entry === entry;
  const opponent = mineFirst
    ? { entry: match.entry_2_entry, team: match.entry_2_name, manager: match.entry_2_player_name, points: match.entry_2_points }
    : { entry: match.entry_1_entry, team: match.entry_1_name, manager: match.entry_1_player_name, points: match.entry_1_points };
  const own = mineFirst ? match.entry_1_points : match.entry_2_points;
  const decided = match.winner != null;
  const won = decided && match.winner === entry;
  const result = decided ? (won ? { text: "Through", color: UI.good } : { text: "Out", color: UI.bad }) : null;

  return (
    <View>
      <Divider inset={0} />
      <Pressable
        disabled={!opponent.entry}
        onPress={() => opponent.entry && onViewMember(opponent.entry, match.event, opponent.team, opponent.manager)}
        accessibilityRole="button"
        accessibilityLabel={`Gameweek ${match.event}: you ${own}, ${opponent.team || "bye"} ${opponent.points}${
          result ? `, ${result.text}` : ""
        }`}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
          paddingVertical: 11,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ width: 52, color: UI.muted, fontSize: 11.5, fontWeight: "600" }}>{`GW ${match.event}`}</Text>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text numberOfLines={1} style={{ color: UI.ink, fontSize: 13, fontWeight: "600" }}>
            {opponent.entry ? opponent.manager || opponent.team : "Bye"}
          </Text>
          {!!opponent.entry && !!opponent.manager && (
            <Text numberOfLines={1} style={{ color: UI.soft, fontSize: 11.5, marginTop: 1 }}>
              {opponent.team}
            </Text>
          )}
        </View>
        <Text style={{ color: UI.ink, fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
          {`${own} – ${opponent.points}`}
        </Text>
        {result && (
          <Text style={{ width: 58, textAlign: "right", color: result.color, fontSize: 11.5, fontWeight: "700" }}>
            {result.text}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
