import { Pressable, Text, View } from "react-native";
import { AppSymbol } from "./AppSymbol";

const GREEN = "#00d982";
const MUTED = "#9db3a6";
const RED = "#ff526f";

type Props = {
  gameweek: number | null;
  gameweekPoints: number | null;
  live: boolean;
  season: string;
  totalPoints: number | null;
  overallRank: number | null;
  onOpenPoints: () => void;
};

const formatNumber = (value: number) =>
  String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function Label({ children, color = MUTED }: { children: string; color?: string }) {
  return (
    <Text
      numberOfLines={1}
      maxFontSizeMultiplier={1.15}
      style={{
        color,
        fontSize: 9,
        fontWeight: "800",
        letterSpacing: 0.5,
        includeFontPadding: false,
      }}
    >
      {children}
    </Text>
  );
}

function Value({ children, color = "#ffffff" }: { children: string; color?: string }) {
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
      maxFontSizeMultiplier={1.15}
      style={{
        color,
        fontSize: 17,
        lineHeight: 21,
        fontWeight: "900",
        includeFontPadding: false,
      }}
    >
      {children}
    </Text>
  );
}

const Divider = () => (
  <View style={{ width: 1, marginVertical: 8, backgroundColor: "rgba(255, 255, 255, 0.12)" }} />
);

// Manager's headline numbers under the team name on the home screen.
// The gameweek cell is the entry point to the detailed points page.
export function SquadSummaryBar({
  gameweek,
  gameweekPoints,
  live,
  season,
  totalPoints,
  overallRank,
  onOpenPoints,
}: Props) {
  const gwLabel = gameweek ? `GW ${gameweek} POINTS` : "GW POINTS";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "stretch",
        minHeight: 48,
        borderRadius: 12,
        backgroundColor: "rgba(4, 16, 10, 0.85)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.12)",
        overflow: "hidden",
      }}
    >
      <Pressable
        onPress={onOpenPoints}
        accessibilityRole="button"
        accessibilityLabel={`${gameweek ? `Gameweek ${gameweek}` : "Gameweek"}${
          live ? ", live" : ""
        }: ${gameweekPoints ?? "no"} points. Open points breakdown`}
        android_ripple={{ color: "rgba(0, 217, 130, 0.25)" }}
        style={({ pressed }) => ({
          flex: 1.15,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 10,
          paddingVertical: 6,
          backgroundColor: pressed ? "rgba(0, 217, 130, 0.22)" : "rgba(0, 217, 130, 0.12)",
          borderRightWidth: 1,
          borderRightColor: "rgba(0, 217, 130, 0.35)",
        })}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            {live && (
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN }} />
            )}
            <Label color={GREEN}>{live ? "LIVE POINTS" : gwLabel}</Label>
          </View>
          <Value color={gameweekPoints != null && gameweekPoints < 0 ? RED : "#ffffff"}>
            {gameweekPoints == null ? "—" : formatNumber(gameweekPoints)}
          </Value>
        </View>
        <AppSymbol
          name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
          color={GREEN}
          size={18}
        />
      </Pressable>

      <View
        accessible
        accessibilityLabel={`Season ${season} total: ${totalPoints ?? "no"} points`}
        style={{ flex: 1, justifyContent: "center", paddingHorizontal: 10, paddingVertical: 6 }}
      >
        <Label>{`SEASON ${season}`}</Label>
        <Value>{totalPoints == null ? "—" : formatNumber(totalPoints)}</Value>
      </View>

      <Divider />

      <View
        accessible
        accessibilityLabel={
          overallRank ? `Overall rank ${formatNumber(overallRank)}` : "Overall rank not available yet"
        }
        style={{ flex: 1.1, justifyContent: "center", paddingHorizontal: 10, paddingVertical: 6 }}
      >
        <Label>OVERALL RANK</Label>
        <Value>{overallRank ? formatNumber(overallRank) : "—"}</Value>
      </View>
    </View>
  );
}
