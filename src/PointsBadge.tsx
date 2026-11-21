import { Text, View } from "react-native";
import { PITCH_PANEL, THEME } from "./theme";
import { LiveDot } from "./LiveDot";

type Props = {
  points: number | null;
  // Gameweek total: label shows "GW n" (or LIVE while the gameweek is in play).
  gameweek?: number;
  live?: boolean;
  // Season total: pass the season label (e.g. "26-27") instead of a gameweek.
  season?: string;
  // At least this size, to match a card beside it (content stays centred).
  minSize?: { width: number; height: number } | null;
  // Pulse the live dot (a match of this team's players is under way).
  // Unset: follows the signed-in manager's squad.
  blink?: boolean;
};

const formatPoints = (value: number) =>
  String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// Points total shown in the top-right corner of the pitch: a quiet navy card
// with a spaced-capitals label, the number, and a short accent line.
export function PointsBadge({ points, gameweek, live = false, season, minSize, blink }: Props) {
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
        // Compact, so it doesn't crowd the pitch.
        minWidth: Math.max(44, minSize?.width ?? 0),
        minHeight: minSize?.height,
        paddingHorizontal: 7,
        paddingTop: 7,
        paddingBottom: 7,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        ...PITCH_PANEL,
        shadowColor: "#000",
        shadowOpacity: 0.4,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        {showLiveDot && (
          <LiveDot blink={blink} />
        )}
        <Text
          maxFontSizeMultiplier={1.2}
          style={{
            color: showLiveDot ? THEME.ink : THEME.accent,
            fontSize: 7,
            fontWeight: "600",
            letterSpacing: 1.4,
            includeFontPadding: false,
          }}
        >
          {label}
        </Text>
      </View>

      <Text
        maxFontSizeMultiplier={1.2}
        style={{
          // Gold, like the points on the players' cards (red below zero).
          color: negative ? THEME.bad : "#ffd400",
          fontSize: 18,
          lineHeight: 21,
          fontWeight: "700",
          marginTop: 1,
          fontVariant: ["tabular-nums"],
          includeFontPadding: false,
        }}
      >
        {points == null ? "—" : formatPoints(points)}
      </Text>

      <View style={{ width: 12, height: 2, borderRadius: 1, backgroundColor: THEME.accent, marginTop: 2 }} />

      <Text
        maxFontSizeMultiplier={1.2}
        style={{
          color: THEME.muted,
          fontSize: 6.5,
          fontWeight: "500",
          letterSpacing: 1.3,
          marginTop: 2,
          includeFontPadding: false,
        }}
      >
        {caption}
      </Text>
    </View>
  );
}
