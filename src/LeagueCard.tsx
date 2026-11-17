import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { AppSymbol } from "./AppSymbol";
import type { FplLeague } from "./fpl";

// Solid, so the pitch-texture background does not show through.
const CARD_BG = "#212826";
const CARD_BG_PRESSED = "#2c3431";
const CARD_BORDER = "rgba(255, 255, 255, 0.12)";

type RankMovement = "up" | "down" | "same" | "new";

const formatRank = (rank: number) =>
  String(rank).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

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

const MOVEMENT_STYLE: Record<RankMovement, { color: string; bg: string; border: string }> = {
  up: { color: "#00e676", bg: "rgba(0, 230, 118, 0.14)", border: "rgba(0, 230, 118, 0.4)" },
  down: { color: "#ff5a72", bg: "rgba(255, 90, 114, 0.14)", border: "rgba(255, 90, 114, 0.4)" },
  same: { color: "#9db3a6", bg: "rgba(255, 255, 255, 0.06)", border: "rgba(255, 255, 255, 0.14)" },
  new: { color: "#7cc4ff", bg: "rgba(124, 196, 255, 0.12)", border: "rgba(124, 196, 255, 0.4)" },
};

// Rank change since the last gameweek: arrow and places for a move, a dash
// for no change, "NEW" when there is nothing to compare with yet.
function MovementChip({ movement, places }: { movement: RankMovement; places: number }) {
  const tone = MOVEMENT_STYLE[movement];
  const moved = movement === "up" || movement === "down";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 26,
        height: 18,
        paddingHorizontal: 5,
        borderRadius: 9,
        gap: 1,
        backgroundColor: tone.bg,
        borderWidth: 1,
        borderColor: tone.border,
      }}
    >
      {moved && (
        <AppSymbol
          name={
            movement === "up"
              ? { ios: "arrowtriangle.up.fill", android: "arrow_drop_up", web: "arrow_drop_up" }
              : { ios: "arrowtriangle.down.fill", android: "arrow_drop_down", web: "arrow_drop_down" }
          }
          color={tone.color}
          size={14}
        />
      )}
      <Text
        numberOfLines={1}
        allowFontScaling={false}
        style={{
          color: tone.color,
          fontSize: movement === "new" ? 9 : 10.5,
          fontWeight: "900",
          letterSpacing: movement === "new" ? 0.4 : 0,
          includeFontPadding: false,
        }}
      >
        {moved ? formatDelta(places) : movement === "new" ? "NEW" : "–"}
      </Text>
    </View>
  );
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
  onPress: (league: FplLeague) => void;
};

export function LeagueCard({ league, loading = false, onPress }: Props) {
  const rank = league.entry_rank && league.entry_rank > 0 ? league.entry_rank : null;
  const movement = rank ? rankMovement(rank, league.entry_last_rank) : "new";
  const places = rank && league.entry_last_rank ? Math.abs(league.entry_last_rank - rank) : 0;
  const movementText =
    movement === "up" || movement === "down"
      ? `${MOVEMENT_LABEL[movement]} ${places} ${places === 1 ? "place" : "places"}`
      : MOVEMENT_LABEL[movement];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        rank
          ? `${league.name}, rank ${formatRank(rank)}, ${movementText}`
          : `${league.name}, not ranked yet`
      }
      accessibilityState={{ busy: loading }}
      disabled={loading}
      onPress={() => onPress(league)}
      style={({ pressed }) => ({
        backgroundColor: pressed ? CARD_BG_PRESSED : CARD_BG,
        borderRadius: 12,
        padding: 10,
        marginTop: 6,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: 1,
        borderColor: loading ? "rgba(0, 217, 130, 0.5)" : CARD_BORDER,
      })}
    >
      <View style={{ flex: 1, marginRight: 10 }}>
        <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }} numberOfLines={1}>
          {league.name}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {rank ? <MovementChip movement={movement} places={places} /> : null}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(0, 0, 0, 0.25)",
            paddingHorizontal: 6,
            paddingVertical: 3,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: CARD_BORDER,
            gap: 4,
          }}
        >
          {rank ? (
            <>
              <Text style={{ color: "#c5d8ce", fontWeight: "900", fontSize: 11 }}>
                {formatRank(rank)}
              </Text>
            </>
          ) : (
            <Text style={{ color: "#c5d8ce", fontWeight: "900", fontSize: 11 }}>
              Not ranked yet
            </Text>
          )}
        </View>
        <View style={{ width: 16, alignItems: "center" }}>
          {loading ? (
            <ActivityIndicator color="#00d982" size="small" />
          ) : (
            <Text style={{ color: "#9db3a6", fontSize: 14, fontWeight: "bold" }}>›</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}
