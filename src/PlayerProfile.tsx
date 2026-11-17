// The detailed FPL profile inside the player sheet: season stats, expected
// stats, ICT, transfers and price, set pieces, recent gameweeks and past
// seasons. Sections that do not apply (a goalkeeper's xG, an empty set-piece
// role) are left out.
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";

const GREEN = "#00d982";
const MUTED = "#9db3a6";
const GOLD = "#ffd400";
const RED = "#ff526f";

// The fields of FPL's player record (bootstrap-static "elements") used here.
export type FplElement = {
  id: number;
  element_type: number;
  total_points: number;
  points_per_game: string;
  ep_next: string | null;
  event_points: number;
  minutes: number;
  starts: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  own_goals: number;
  penalties_saved: number;
  penalties_missed: number;
  yellow_cards: number;
  red_cards: number;
  saves: number;
  bonus: number;
  bps: number;
  defensive_contribution?: number;
  expected_goals: string;
  expected_assists: string;
  expected_goal_involvements: string;
  expected_goals_conceded: string;
  expected_goals_per_90?: number;
  expected_assists_per_90?: number;
  expected_goal_involvements_per_90?: number;
  expected_goals_conceded_per_90?: number;
  influence: string;
  creativity: string;
  threat: string;
  ict_index: string;
  ict_index_rank_type?: number;
  form_rank_type?: number;
  points_per_game_rank_type?: number;
  selected_by_percent: string;
  transfers_in_event: number;
  transfers_out_event: number;
  transfers_in: number;
  transfers_out: number;
  cost_change_start: number;
  now_cost: number;
  value_season: string;
  dreamteam_count: number;
  penalties_order: number | null;
  direct_freekicks_order: number | null;
  corners_and_indirect_freekicks_order: number | null;
};

// One gameweek from the player's FPL history.
export type GameweekRow = {
  round: number;
  opponent_team: number;
  was_home: boolean;
  team_h_score: number | null;
  team_a_score: number | null;
  minutes: number;
  goals_scored: number;
  assists: number;
  bonus: number;
  total_points: number;
};

export type PastSeason = {
  season_name: string;
  total_points: number;
  minutes: number;
  goals_scored: number;
  assists: number;
  start_cost: number;
  end_cost: number;
};

const POSITION_NAMES = ["", "goalkeepers", "defenders", "midfielders", "forwards"];

const money = (tenths: number) => `£${(tenths / 10).toFixed(1)}m`;
const thousands = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  if (abs >= 10_000) return `${Math.round(value / 1000)}k`;
  if (abs >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(value);
};
const ordinal = (n: number) => {
  const tail = n % 100;
  if (tail >= 11 && tail <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
};
const per90 = (value: number | undefined) =>
  value == null || !Number.isFinite(value) ? "—" : value.toFixed(2);

function SectionTitle({ children }: { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: "#ffffff",
        fontSize: 12,
        fontWeight: "900",
        letterSpacing: 0.4,
        marginTop: 16,
        marginBottom: 8,
      }}
    >
      {children}
    </Text>
  );
}

type Stat = { label: string; value: string; color?: string; note?: string };

// A grid of small stat tiles, three per row.
function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {stats.map((stat) => (
        <View
          key={stat.label}
          accessible
          accessibilityLabel={`${stat.label}: ${stat.value}${stat.note ? `, ${stat.note}` : ""}`}
          style={{
            width: "31.8%",
            paddingVertical: 7,
            paddingHorizontal: 8,
            borderRadius: 12,
            backgroundColor: "rgba(5, 20, 16, 0.85)",
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.08)",
          }}
        >
          <Text numberOfLines={1} style={{ color: MUTED, fontSize: 9, fontWeight: "800" }}>
            {stat.label}
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={{ color: stat.color ?? "#ffffff", fontSize: 15, fontWeight: "900", marginTop: 2 }}
          >
            {stat.value}
          </Text>
          {!!stat.note && (
            <Text numberOfLines={1} style={{ color: MUTED, fontSize: 8.5, fontWeight: "700", marginTop: 1 }}>
              {stat.note}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

export function PlayerProfile({
  element,
  failed = false,
  onRetry,
  history,
  pastSeasons,
  teamNames,
}: {
  element: FplElement | null;
  failed?: boolean;
  onRetry?: () => void;
  history: GameweekRow[] | null;
  pastSeasons: PastSeason[] | null;
  teamNames: Record<number, string>;
}) {
  // Opening a player whose record isn't loaded asks for it straight away.
  const missing = !element;
  useEffect(() => {
    if (missing) onRetry?.();
    // Only when this player's record is missing, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing]);

  if (!element) {
    return failed ? (
      <View style={{ marginTop: 16, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ flex: 1, color: MUTED, fontSize: 12 }}>
          {"Couldn't load detailed stats from FPL."}
        </Text>
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => ({
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 14,
            backgroundColor: pressed ? "rgba(0, 217, 130, 0.3)" : "rgba(0, 217, 130, 0.18)",
            borderWidth: 1,
            borderColor: "rgba(0, 217, 130, 0.5)",
          })}
        >
          <Text style={{ color: GREEN, fontSize: 12, fontWeight: "900" }}>Retry</Text>
        </Pressable>
      </View>
    ) : (
      <Text style={{ color: MUTED, fontSize: 12, marginTop: 16 }}>
        Detailed stats are loading…
      </Text>
    );
  }

  const type = element.element_type;
  const isGk = type === 1;
  const isDef = type === 2;
  const isOutfield = !isGk;
  const rankNote = (rank: number | undefined) =>
    rank ? `${ordinal(rank)} of ${POSITION_NAMES[type]}` : undefined;

  // Season: what scores points for this position.
  const season: Stat[] = [
    { label: "Total points", value: String(element.total_points), color: GREEN },
    {
      label: "Points / match",
      value: element.points_per_game,
      note: rankNote(element.points_per_game_rank_type),
    },
    { label: "xPts next GW", value: element.ep_next ?? "—", note: "FPL projection" },
    { label: "Starts", value: String(element.starts) },
    { label: "Minutes", value: thousands(element.minutes) },
    ...(isOutfield
      ? [
          { label: "Goals", value: String(element.goals_scored) },
          { label: "Assists", value: String(element.assists) },
        ]
      : []),
    ...(isGk || isDef
      ? [
          { label: "Clean sheets", value: String(element.clean_sheets) },
          { label: "Goals conceded", value: String(element.goals_conceded) },
        ]
      : type === 3
        ? [{ label: "Clean sheets", value: String(element.clean_sheets) }]
        : []),
    ...(isGk
      ? [
          { label: "Saves", value: String(element.saves) },
          { label: "Pens saved", value: String(element.penalties_saved) },
        ]
      : []),
    ...(isOutfield && element.defensive_contribution != null
      ? [{ label: "Def. contribution", value: String(element.defensive_contribution) }]
      : []),
    { label: "Bonus", value: String(element.bonus), color: GOLD },
    { label: "BPS", value: String(element.bps) },
    { label: "Dream team", value: String(element.dreamteam_count) },
    {
      label: "Cards",
      value: `${element.yellow_cards}Y · ${element.red_cards}R`,
      color: element.red_cards > 0 ? RED : element.yellow_cards >= 4 ? GOLD : undefined,
    },
    ...(element.own_goals > 0 ? [{ label: "Own goals", value: String(element.own_goals), color: RED }] : []),
    ...(element.penalties_missed > 0
      ? [{ label: "Pens missed", value: String(element.penalties_missed), color: RED }]
      : []),
  ];

  // Expected stats: attacking for outfield players, conceded for defence.
  const expected: Stat[] = [
    ...(isOutfield
      ? [
          { label: "xG", value: element.expected_goals, note: `${per90(element.expected_goals_per_90)} per 90` },
          { label: "xA", value: element.expected_assists, note: `${per90(element.expected_assists_per_90)} per 90` },
          {
            label: "xGI",
            value: element.expected_goal_involvements,
            note: `${per90(element.expected_goal_involvements_per_90)} per 90`,
          },
        ]
      : []),
    ...(isGk || isDef
      ? [
          {
            label: "xGC",
            value: element.expected_goals_conceded,
            note: `${per90(element.expected_goals_conceded_per_90)} per 90`,
          },
        ]
      : []),
  ];

  const ict: Stat[] = [
    { label: "Influence", value: element.influence },
    { label: "Creativity", value: element.creativity },
    { label: "Threat", value: element.threat },
    { label: "ICT index", value: element.ict_index, note: rankNote(element.ict_index_rank_type), color: GREEN },
  ];

  const priceChange = element.cost_change_start;
  const netTransfers = element.transfers_in_event - element.transfers_out_event;
  const market: Stat[] = [
    {
      label: "Since start",
      value: priceChange === 0 ? "No change" : `${priceChange > 0 ? "+" : "−"}${money(Math.abs(priceChange))}`,
      color: priceChange > 0 ? "#00e676" : priceChange < 0 ? RED : undefined,
    },
    { label: "Selected by", value: `${element.selected_by_percent}%` },
    { label: "Value", value: element.value_season, note: "points per £m" },
    { label: "In this GW", value: thousands(element.transfers_in_event), color: "#00e676" },
    { label: "Out this GW", value: thousands(element.transfers_out_event), color: RED },
    {
      label: "Net this GW",
      value: `${netTransfers > 0 ? "+" : netTransfers < 0 ? "−" : ""}${thousands(Math.abs(netTransfers))}`,
      color: netTransfers > 0 ? "#00e676" : netTransfers < 0 ? RED : undefined,
    },
  ];

  const setPieces = [
    element.penalties_order ? `Penalties: ${ordinal(element.penalties_order)} choice` : null,
    element.direct_freekicks_order ? `Direct free kicks: ${ordinal(element.direct_freekicks_order)} choice` : null,
    element.corners_and_indirect_freekicks_order
      ? `Corners & indirect free kicks: ${ordinal(element.corners_and_indirect_freekicks_order)} choice`
      : null,
  ].filter((line): line is string => !!line);

  const recent = (history ?? []).slice(-6).reverse();
  const past = (pastSeasons ?? []).slice(-3).reverse();

  return (
    <View>
      <SectionTitle>THIS SEASON</SectionTitle>
      <StatGrid stats={season} />

      {expected.length > 0 && (
        <>
          <SectionTitle>EXPECTED STATS</SectionTitle>
          <StatGrid stats={expected} />
        </>
      )}

      <SectionTitle>ICT</SectionTitle>
      <StatGrid stats={ict} />

      <SectionTitle>PRICE & TRANSFERS</SectionTitle>
      <StatGrid stats={market} />

      {setPieces.length > 0 && (
        <>
          <SectionTitle>SET PIECES</SectionTitle>
          <View
            style={{
              padding: 10,
              borderRadius: 12,
              backgroundColor: "rgba(5, 20, 16, 0.85)",
              gap: 4,
            }}
          >
            {setPieces.map((line) => (
              <Text key={line} style={{ color: "#ffffff", fontSize: 12, fontWeight: "700" }}>
                {line}
              </Text>
            ))}
          </View>
        </>
      )}

      <SectionTitle>RECENT GAMEWEEKS</SectionTitle>
      {history === null ? (
        <Text style={{ color: MUTED, fontSize: 12 }}>Loading…</Text>
      ) : recent.length === 0 ? (
        <Text style={{ color: MUTED, fontSize: 12 }}>No matches played yet this season.</Text>
      ) : (
        <View style={{ borderRadius: 12, overflow: "hidden", backgroundColor: "rgba(5, 20, 16, 0.85)" }}>
          <TableRow header cells={["GW", "Opponent", "Result", "Min", "G", "A", "B", "Pts"]} />
          {recent.map((row) => {
            const own = row.was_home ? row.team_h_score : row.team_a_score;
            const other = row.was_home ? row.team_a_score : row.team_h_score;
            const result =
              own == null || other == null
                ? "—"
                : `${own > other ? "W" : own < other ? "L" : "D"} ${own}-${other}`;
            return (
              <TableRow
                key={`${row.round}-${row.opponent_team}`}
                cells={[
                  String(row.round),
                  `${teamNames[row.opponent_team] ?? "?"} (${row.was_home ? "H" : "A"})`,
                  result,
                  String(row.minutes),
                  String(row.goals_scored),
                  String(row.assists),
                  String(row.bonus),
                  String(row.total_points),
                ]}
              />
            );
          })}
        </View>
      )}

      {past.length > 0 && (
        <>
          <SectionTitle>PREVIOUS SEASONS</SectionTitle>
          <View style={{ borderRadius: 12, overflow: "hidden", backgroundColor: "rgba(5, 20, 16, 0.85)" }}>
            <TableRow header cells={["Season", "Pts", "Min", "G", "A", "Price"]} widths={PAST_WIDTHS} />
            {past.map((row) => (
              <TableRow
                key={row.season_name}
                widths={PAST_WIDTHS}
                cells={[
                  row.season_name,
                  String(row.total_points),
                  thousands(row.minutes),
                  String(row.goals_scored),
                  String(row.assists),
                  money(row.end_cost),
                ]}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const RECENT_WIDTHS = [0.09, 0.25, 0.17, 0.1, 0.08, 0.08, 0.08, 0.15];
const PAST_WIDTHS = [0.24, 0.14, 0.16, 0.12, 0.12, 0.22];

function TableRow({
  cells,
  header = false,
  widths = RECENT_WIDTHS,
}: {
  cells: string[];
  header?: boolean;
  widths?: number[];
}) {
  // Text columns (gameweek and opponent, or season) sit left; numbers centre.
  const leftColumns = widths === RECENT_WIDTHS ? 2 : 1;
  const last = cells.length - 1;
  return (
    <View
      accessible={!header}
      accessibilityLabel={header ? undefined : cells.join(", ")}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        paddingVertical: header ? 6 : 7,
        backgroundColor: header ? "rgba(0, 217, 130, 0.12)" : "transparent",
        borderTopWidth: header ? 0 : 1,
        borderTopColor: "rgba(255, 255, 255, 0.06)",
      }}
    >
      {cells.map((cell, index) => (
        <Text
          key={index}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={{
            width: `${widths[index] * 100}%`,
            textAlign: index < leftColumns ? "left" : "center",
            color: header ? MUTED : index === last ? GREEN : "#ffffff",
            fontSize: header ? 9 : 11.5,
            fontWeight: header || index === last ? "900" : "700",
          }}
        >
          {cell}
        </Text>
      ))}
    </View>
  );
}
