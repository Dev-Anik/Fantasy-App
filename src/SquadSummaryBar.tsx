import { Pressable, Text, View } from "react-native";
import { AppSymbol } from "./AppSymbol";
import { THEME } from "./theme";
import { LiveDot } from "./LiveDot";

const GREEN = THEME.accent;
const MUTED = THEME.muted;
const RED = THEME.bad;

type Props = {
  gameweek: number | null;
  gameweekPoints: number | null;
  live: boolean;
  season: string;
  totalPoints: number | null;
  overallRank: number | null;
  // Places gained (positive) or lost (negative) since the last gameweek;
  // null when there's nothing to compare with.
  rankChange?: number | null;
  onOpenPoints: () => void;
  // Slim, for the screen's top row (as tall as the logo row), with shorter
  // labels.
  compact?: boolean;
};

const formatNumber = (value: number) =>
  String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// Short form for the movement beside the rank: 950, 12.3k, 1.2m.
const shortNumber = (value: number) =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`
    : value >= 10_000
      ? `${Math.round(value / 1000)}k`
      : value >= 1000
        ? `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`
        : String(value);

// The overall rank, easy to take in: 1.8m, 523k; below 10,000 in full.
const shortRank = (rank: number) => (rank >= 10_000 ? shortNumber(rank) : formatNumber(rank));

function Label({ children, color = MUTED, compact = false }: { children: string; color?: string; compact?: boolean }) {
  return (
    <Text
      numberOfLines={1}
      maxFontSizeMultiplier={1.15}
      style={{
        color,
        fontSize: compact ? 7 : 8,
        fontWeight: "800",
        letterSpacing: 0.5,
        includeFontPadding: false,
      }}
    >
      {children}
    </Text>
  );
}

function Value({ children, color = "#ffffff", compact = false }: { children: string; color?: string; compact?: boolean }) {
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
      maxFontSizeMultiplier={1.15}
      style={{
        color,
        fontSize: compact ? 12.5 : 14,
        lineHeight: compact ? 14 : 18,
        fontWeight: "900",
        includeFontPadding: false,
      }}
    >
      {children}
    </Text>
  );
}

const Divider = ({ compact = false }: { compact?: boolean }) => (
  <View style={{ width: 1, marginVertical: compact ? 5 : 8, backgroundColor: "rgba(255, 255, 255, 0.12)" }} />
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
  rankChange = null,
  onOpenPoints,
  compact = false,
}: Props) {
  const moved = rankChange != null && rankChange !== 0 && !!overallRank;
  const up = moved && rankChange > 0;
  const gwLabel = gameweek ? `GW ${gameweek} ${compact ? "PTS" : "POINTS"}` : compact ? "GW PTS" : "GW POINTS";
  const cellPadding = compact ? { paddingHorizontal: 8, paddingVertical: 1 } : { paddingHorizontal: 10, paddingVertical: 5 };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "stretch",
        ...(compact ? { height: 28 } : { minHeight: 42 }),
        borderRadius: compact ? 10 : 12,
        backgroundColor: THEME.surface,
        borderWidth: 1,
        borderColor: THEME.line,
        overflow: "hidden",
      }}
    >
      <Pressable
        onPress={onOpenPoints}
        accessibilityRole="button"
        accessibilityLabel={`${gameweek ? `Gameweek ${gameweek}` : "Gameweek"}${
          live ? ", live" : ""
        }: ${gameweekPoints ?? "no"} points. Open points breakdown`}
        android_ripple={{ color: "rgba(255, 255, 255, 0.06)" }}
        style={({ pressed }) => ({
          flex: 1.15,
          flexDirection: "row",
          alignItems: "center",
          ...cellPadding,
          backgroundColor: pressed ? "rgba(255, 255, 255, 0.05)" : "transparent",
          borderRightWidth: 1,
          borderRightColor: THEME.line,
        })}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            {live && (
              <LiveDot color={GREEN} />
            )}
            <Label color={GREEN} compact={compact}>
              {live ? (compact ? "LIVE PTS" : "LIVE POINTS") : gwLabel}
            </Label>
          </View>
          <Value compact={compact} color={gameweekPoints != null && gameweekPoints < 0 ? RED : "#ffffff"}>
            {gameweekPoints == null ? "—" : formatNumber(gameweekPoints)}
          </Value>
        </View>
        <AppSymbol
          name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
          color={GREEN}
          size={compact ? 13 : 16}
        />
      </Pressable>

      <View
        accessible
        accessibilityLabel={`Season ${season} total: ${totalPoints ?? "no"} points`}
        style={{ flex: 1, justifyContent: "center", ...cellPadding }}
      >
        <Label compact={compact}>{compact ? "SEASON" : `SEASON ${season}`}</Label>
        <Value compact={compact}>{totalPoints == null ? "—" : formatNumber(totalPoints)}</Value>
      </View>

      <Divider compact={compact} />

      <View
        accessible
        accessibilityLabel={
          overallRank
            ? `Overall rank ${formatNumber(overallRank)}${
                moved ? `, ${up ? "up" : "down"} ${formatNumber(Math.abs(rankChange))} places since last gameweek` : ""
              }`
            : "Overall rank not available yet"
        }
        style={{ flex: 1.1, justifyContent: "center", ...cellPadding }}
      >
        <Label compact={compact}>{compact ? "RANK" : "OVERALL RANK"}</Label>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ flexShrink: 1 }}>
            <Value compact={compact}>{overallRank ? shortRank(overallRank) : "—"}</Value>
          </View>
          {/* Up or down since the last gameweek, as in the league tables. */}
          {moved && (
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={1.15}
              style={{
                color: up ? THEME.good : RED,
                fontSize: 9.5,
                fontWeight: "800",
                fontVariant: ["tabular-nums"],
                includeFontPadding: false,
              }}
            >
              {`${up ? "▲" : "▼"} ${shortNumber(Math.abs(rankChange))}`}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}
