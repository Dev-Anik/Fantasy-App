import { Text, View } from "react-native";
import { THEME } from "./theme";

type Props = {
  points: number | null;
  // Gameweek total: label shows "GW n" (or LIVE while the gameweek is in play).
  gameweek?: number;
  live?: boolean;
  // Season total: pass the season label (e.g. "26-27") instead of a gameweek.
  season?: string;
};

const formatPoints = (value: number) =>
  String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// Points total shown in the top-right corner of the pitch: a quiet navy card
// with a spaced-capitals label, the number, and a short accent line.
export function PointsBadge({ points, gameweek, live = false, season }: Props) {
  const negative = points != null && points < 0;
  const label = season ? `SEASON ${season}` : live ? "LIVE" : `GW ${gameweek ?? ""}`.trim();
  const caption = season ? "TOTAL PTS" : "POINTS";
  const subject = season
    ? `Season ${season} total`
    : `Gameweek ${gameweek}${live ? ", live" : ""}`;
  const showLiveDot = live && !season;

  return (
    <View
      accessible
      accessibilityLabel={
        points == null ? `${subject}: points not available` : `${subject}: ${points} points`
      }
      style={{
        minWidth: 76,
        paddingHorizontal: 14,
        paddingTop: 8,
        paddingBottom: 9,
        borderRadius: 14,
        alignItems: "center",
        backgroundColor: "rgba(11, 16, 32, 0.88)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
        shadowColor: "#000",
        shadowOpacity: 0.4,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        {showLiveDot && (
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: THEME.bad }} />
        )}
        <Text
          maxFontSizeMultiplier={1.2}
          style={{
            color: showLiveDot ? THEME.ink : THEME.accent,
            fontSize: 9.5,
            fontWeight: "600",
            letterSpacing: 1.8,
            includeFontPadding: false,
          }}
        >
          {label}
        </Text>
      </View>

      <Text
        maxFontSizeMultiplier={1.2}
        style={{
          color: negative ? THEME.bad : THEME.ink,
          fontSize: 28,
          lineHeight: 32,
          fontWeight: "700",
          marginTop: 3,
          fontVariant: ["tabular-nums"],
          includeFontPadding: false,
        }}
      >
        {points == null ? "—" : formatPoints(points)}
      </Text>

      <View style={{ width: 16, height: 2, borderRadius: 1, backgroundColor: THEME.accent, marginTop: 4 }} />

      <Text
        maxFontSizeMultiplier={1.2}
        style={{
          color: THEME.muted,
          fontSize: 8.5,
          fontWeight: "500",
          letterSpacing: 1.6,
          marginTop: 4,
          includeFontPadding: false,
        }}
      >
        {caption}
      </Text>
    </View>
  );
}
