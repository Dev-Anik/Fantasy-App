import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { AppSymbol } from "./AppSymbol";
import type { FplLeague } from "./fpl";
import { LEAGUE_UI as UI } from "./leagueUi";

type RankMovement = "up" | "down" | "same" | "new";

const formatRank = (rank: number) => String(rank).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function rankMovement(rank: number, lastRank: number | null | undefined): RankMovement {
  if (!lastRank || lastRank <= 0) return "new";
  if (rank < lastRank) return "up";
  if (rank > lastRank) return "down";
  return "same";
}

// Compact place counts, so a big jump in a huge league still fits: 1.2k, 35k.
function formatDelta(places: number) {
  if (places < 1000) return String(places);
  if (places < 10_000) return `${(places / 1000).toFixed(1).replace(/.0$/, "")}k`;
  if (places < 1_000_000) return `${Math.round(places / 1000)}k`;
  return `${(places / 1_000_000).toFixed(1).replace(/.0$/, "")}m`;
}

const MOVEMENT_LABEL: Record<RankMovement, string> = {
  up: "moved up",
  down: "moved down",
  same: "no change",
  new: "new entry",
};

type Props = {
  league: FplLeague;
  // True while this league's table is being fetched after a tap.
  loading?: boolean;
  // First row of its group: no divider above it.
  first?: boolean;
  onPress: (league: FplLeague) => void;
};

// One league in the list: its name, your rank and how it moved since the
// last gameweek.
export function LeagueCard({ league, loading = false, first = false, onPress }: Props) {
  const rank = league.entry_rank && league.entry_rank > 0 ? league.entry_rank : null;
  const movement = rank ? rankMovement(rank, league.entry_last_rank) : "new";
  const places = rank && league.entry_last_rank ? Math.abs(league.entry_last_rank - rank) : 0;
  const moved = movement === "up" || movement === "down";
  const movementText = moved
    ? `${MOVEMENT_LABEL[movement]} ${places} ${places === 1 ? "place" : "places"}`
    : MOVEMENT_LABEL[movement];

  return (
    <>
      {!first && <View style={{ height: 1, marginLeft: 16, backgroundColor: UI.line }} />}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          rank ? `${league.name}, rank ${formatRank(rank)}, ${movementText}` : `${league.name}, not ranked yet`
        }
        accessibilityState={{ busy: loading }}
        disabled={loading}
        onPress={() => onPress(league)}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 11,
          backgroundColor: pressed ? UI.pressed : "transparent",
        })}
      >
        {/* At least 28px between a long league name and the rank. */}
        <Text numberOfLines={1} style={{ flex: 1, color: UI.soft, fontSize: 13, marginRight: 28 }}>
          {league.name}
        </Text>
        {rank ? (
          // The rank, with its movement under it.
          <View style={{ alignItems: "flex-end", marginRight: 8 }}>
            <Text style={{ color: UI.ink, fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
              {formatRank(rank)}
            </Text>
            {moved && (
              <Text
                style={{
                  color: movement === "up" ? UI.good : UI.bad,
                  fontSize: 10.5,
                  fontWeight: "600",
                  marginTop: 1,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {`${movement === "up" ? "▲" : "▼"} ${formatDelta(places)}`}
              </Text>
            )}
          </View>
        ) : (
          <Text style={{ color: UI.muted, fontSize: 12.5, marginRight: 8 }}>Not ranked yet</Text>
        )}
        <View style={{ width: 16, alignItems: "center" }}>
          {loading ? (
            <ActivityIndicator color={UI.soft} size="small" />
          ) : (
            <AppSymbol name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }} color={UI.muted} size={16} />
          )}
        </View>
      </Pressable>
    </>
  );
}
