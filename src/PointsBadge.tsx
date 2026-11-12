import { Text, View } from "react-native";

const GREEN = "#00d982";
const DARK_GREEN = "#071b12";
const RED = "#ff526f";

type Props = {
  points: number | null;
  // Gameweek total: header shows "GW n" (or LIVE while the gameweek is in play).
  gameweek?: number;
  live?: boolean;
  // Season total: pass the season label (e.g. "26-27") instead of a gameweek.
  season?: string;
};

const formatPoints = (value: number) =>
  String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// Points total shown in the top-right corner of the pitch.
export function PointsBadge({ points, gameweek, live = false, season }: Props) {
  const negative = points != null && points < 0;
  const header = season ? `SEASON ${season}` : live ? "LIVE" : `GW ${gameweek ?? ""}`.trim();
  const caption = season ? "TOTAL POINTS" : "POINTS";
  const subject = season
    ? `Season ${season} total`
    : `Gameweek ${gameweek}${live ? ", live" : ""}`;

  return (
    <View
      accessible
      accessibilityLabel={
        points == null ? `${subject}: points not available` : `${subject}: ${points} points`
      }
      style={{
        minWidth: 74,
        borderRadius: 14,
        overflow: "hidden",
        backgroundColor: "rgba(4, 16, 10, 0.92)",
        borderWidth: 1,
        borderColor: "rgba(0, 217, 130, 0.45)",
        shadowColor: "#000",
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 8,
      }}
    >
      <View
        style={{
          backgroundColor: GREEN,
          paddingHorizontal: 10,
          paddingVertical: 3,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        }}
      >
        {live && !season && (
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: DARK_GREEN }} />
        )}
        <Text
          maxFontSizeMultiplier={1.2}
          style={{
            color: DARK_GREEN,
            fontSize: 10,
            fontWeight: "900",
            letterSpacing: 0.6,
            includeFontPadding: false,
          }}
        >
          {header}
        </Text>
      </View>
      <View
        style={{
          paddingHorizontal: 12,
          paddingTop: 4,
          paddingBottom: 5,
          alignItems: "center",
        }}
      >
        <Text
          maxFontSizeMultiplier={1.2}
          style={{
            color: negative ? RED : "#ffffff",
            fontSize: 26,
            lineHeight: 30,
            fontWeight: "900",
            includeFontPadding: false,
          }}
        >
          {points == null ? "—" : formatPoints(points)}
        </Text>
        <Text
          maxFontSizeMultiplier={1.2}
          style={{
            color: "#9db3a6",
            fontSize: 9,
            fontWeight: "800",
            letterSpacing: 0.8,
            includeFontPadding: false,
          }}
        >
          {caption}
        </Text>
      </View>
    </View>
  );
}
