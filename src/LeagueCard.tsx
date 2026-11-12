import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import type { FplLeague } from "./fpl";

const CARD_BG = "rgba(255, 255, 255, 0.08)";
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

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        rank
          ? `${league.name}, rank ${formatRank(rank)}, ${MOVEMENT_LABEL[movement]}`
          : `${league.name}, not ranked yet`
      }
      accessibilityState={{ busy: loading }}
      disabled={loading}
      onPress={() => onPress(league)}
      style={({ pressed }) => ({
        backgroundColor: CARD_BG,
        borderRadius: 12,
        padding: 10,
        marginTop: 6,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: 1,
        borderColor: loading ? "rgba(0, 217, 130, 0.5)" : CARD_BORDER,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View style={{ flex: 1, marginRight: 10 }}>
        <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }} numberOfLines={1}>
          {league.name}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
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
              {movement === "up" || movement === "down" ? (
                <Image
                  source={
                    movement === "up"
                      ? require("../assets/images/up.png")
                      : require("../assets/images/down.png")
                  }
                  style={{ width: 12, height: 12 }}
                  contentFit="contain"
                />
              ) : (
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    marginHorizontal: 3,
                    backgroundColor: "#7a9988",
                  }}
                />
              )}
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
