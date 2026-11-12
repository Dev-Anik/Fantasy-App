import { useState } from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import type {
  FplLeague,
  Gameweek,
  H2hMatch,
  LeagueStanding,
  LeagueStandings,
} from "./fpl";
import { AppSymbol } from "./AppSymbol";

const GREEN = "#00d982";
const DARK_GREEN = "#071b12";
const MUTED = "#9db3a6";
const RED = "#ff526f";
const GOLD = "#ffd400";
const CARD_BG = "rgba(255, 255, 255, 0.08)";
const CARD_BORDER = "rgba(255, 255, 255, 0.12)";
const LAST_GAMEWEEK = 38;

type Props = {
  league: FplLeague;
  standings: LeagueStandings | null;
  // The logged-in manager's row, remembered across standings pages.
  userStanding: LeagueStanding | null;
  userEntryId?: number;
  userTotalPoints: number | null;
  // Latest gameweek score FPL reports for the manager; it moves during
  // matches, ahead of the league tables.
  liveEventId: number | null;
  liveEventPoints: number | null;
  h2hMatches: H2hMatch[];
  h2hEvent: number | null;
  h2hLoading: boolean;
  // Gameweeks that have kicked off (finished or in play), oldest first.
  gameweeks: Gameweek[];
  loading: boolean;
  error: string;
  inviteCode: string | null;
  onBack: () => void;
  onPage: (page: number) => void;
  onGetInviteCode: () => void;
  onSelectH2hEvent: (event: number) => void;
  onViewMember: (entry: number, event: number, teamName?: string, managerName?: string) => void;
};

const formatNumber = (value: number) =>
  String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

type Movement = "up" | "down" | "same";

function movement(rank: number, lastRank: number | null | undefined): Movement {
  if (!lastRank || lastRank <= 0 || !rank || rank === lastRank) return "same";
  return rank < lastRank ? "up" : "down";
}

function MovementIcon({ value, size = 10 }: { value: Movement; size?: number }) {
  if (value === "same") return null;
  return (
    <Image
      source={
        value === "up"
          ? require("../assets/images/up.png")
          : require("../assets/images/down.png")
      }
      style={{ width: size, height: size }}
      contentFit="contain"
      accessible={false}
    />
  );
}

// League tables only change when FPL recalculates them, but the manager's own
// gameweek score keeps moving during matches. Carry that difference into
// their row so the league page agrees with the home screen.
function withLivePoints(
  row: LeagueStanding,
  league: FplLeague,
  liveEventId: number | null,
  liveEventPoints: number | null,
  latestGameweek: number,
): LeagueStanding {
  if (league.kind !== "classic") return row;
  if (liveEventPoints == null || liveEventId == null || liveEventId !== latestGameweek) return row;
  if ((league.start_event ?? 1) > liveEventId) return row;
  const gain = liveEventPoints - (row.event_total ?? 0);
  if (gain <= 0) return row;
  return { ...row, event_total: liveEventPoints, total: row.total + gain };
}

function StatBlock({
  label,
  value,
  align = "flex-start",
  color = "#fff",
  children,
}: {
  label: string;
  value: string;
  align?: "flex-start" | "center" | "flex-end";
  color?: string;
  children?: ReactNode;
}) {
  return (
    <View style={{ flex: 1, alignItems: align }}>
      <Text style={{ color: MUTED, fontSize: 10, fontWeight: "800", marginBottom: 2, letterSpacing: 0.3 }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={{ color, fontSize: 19, fontWeight: "900", letterSpacing: -0.3 }}
        >
          {value}
        </Text>
        {children}
      </View>
    </View>
  );
}

const StatDivider = () => (
  <View style={{ width: 1, height: 28, backgroundColor: "rgba(255, 255, 255, 0.15)", marginHorizontal: 10 }} />
);

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={{
        flex: 1,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: active ? GREEN : CARD_BG,
        borderWidth: 1,
        borderColor: active ? GREEN : CARD_BORDER,
        alignItems: "center",
      }}
    >
      <Text style={{ color: active ? DARK_GREEN : "#fff", fontWeight: "900", fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

function HeaderCell({ children, width, align = "left", flex }: {
  children: string;
  width?: number;
  flex?: number;
  align?: "left" | "center" | "right";
}) {
  return (
    <Text
      style={{
        width,
        flex,
        textAlign: align,
        color: MUTED,
        fontSize: 10,
        fontWeight: "800",
        textTransform: "uppercase",
      }}
    >
      {children}
    </Text>
  );
}

function StepButton({ direction, disabled, onPress, label }: {
  direction: "left" | "right";
  disabled: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? "rgba(0, 217, 130, 0.25)" : CARD_BG,
        borderWidth: 1,
        borderColor: CARD_BORDER,
        opacity: disabled ? 0.35 : 1,
      })}
    >
      <AppSymbol
        name={
          direction === "left"
            ? { ios: "chevron.left", android: "chevron_left", web: "chevron_left" }
            : { ios: "chevron.right", android: "chevron_right", web: "chevron_right" }
        }
        color="#fff"
        size={18}
      />
    </Pressable>
  );
}

export function LeagueDetails({
  league,
  standings,
  userStanding,
  userEntryId,
  userTotalPoints,
  liveEventId,
  liveEventPoints,
  h2hMatches,
  h2hEvent,
  h2hLoading,
  gameweeks,
  loading,
  error,
  inviteCode,
  onBack,
  onPage,
  onGetInviteCode,
  onSelectH2hEvent,
  onViewMember,
}: Props) {
  const [tab, setTab] = useState<"standings" | "matches">("standings");
  const isH2h = league.kind === "h2h";
  const latestGameweek = gameweeks[gameweeks.length - 1]?.id ?? 1;
  const rows = standings?.standings?.results ?? [];
  const live = (row: LeagueStanding) =>
    withLivePoints(row, league, liveEventId, liveEventPoints, latestGameweek);

  // Own row: the current page first, then the remembered row from an earlier
  // page. Without either (big leagues), only values we can vouch for are shown.
  const ownRow = rows.find((row) => row.entry === userEntryId) ?? userStanding;
  const ownLive = ownRow ? live(ownRow) : null;
  const countsFromGw1 = (league.start_event ?? 1) <= 1;
  const ownRank = ownRow?.rank || league.entry_rank || null;
  const ownLastRank = ownRow ? ownRow.last_rank : league.entry_last_rank;
  const ownTotal = ownLive ? ownLive.total : !isH2h && countsFromGw1 ? userTotalPoints : null;
  const ownEventPoints = ownLive
    ? ownLive.event_total
    : !isH2h && liveEventId === latestGameweek
      ? liveEventPoints
      : null;

  const viewMember = (row: LeagueStanding) =>
    onViewMember(row.entry, latestGameweek, row.entry_name || row.player_name, row.player_name);

  return (
    <View style={{ marginTop: 4 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to your leagues"
        onPress={onBack}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={({ pressed }) => ({
          alignSelf: "flex-start",
          backgroundColor: "rgba(0, 217, 130, 0.15)",
          borderWidth: 1,
          borderColor: "rgba(0, 217, 130, 0.4)",
          borderRadius: 16,
          paddingHorizontal: 14,
          height: 34,
          marginBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <AppSymbol
          name={{ ios: "chevron.left", android: "chevron_left", web: "chevron_left" }}
          color={GREEN}
          size={16}
        />
        <Text
          style={{
            color: "#fff",
            fontSize: 13,
            fontWeight: "800",
            includeFontPadding: false,
            textAlignVertical: "center",
          }}
        >
          Your leagues
        </Text>
      </Pressable>

      <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900", marginBottom: 6 }}>
        {standings?.league?.name ?? league.name}
      </Text>

      {isH2h && (
        <View accessibilityRole="tablist" style={{ flexDirection: "row", marginTop: 4, marginBottom: 12, gap: 8 }}>
          <TabButton label="Standings" active={tab === "standings"} onPress={() => setTab("standings")} />
          <TabButton label="Matches" active={tab === "matches"} onPress={() => setTab("matches")} />
        </View>
      )}

      {/* Your position in this league */}
      <View
        style={{
          backgroundColor: CARD_BG,
          borderRadius: 12,
          padding: 12,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: CARD_BORDER,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <StatBlock label="YOUR RANK" value={ownRank ? `#${formatNumber(ownRank)}` : "—"}>
          {ownRank ? <MovementIcon value={movement(ownRank, ownLastRank)} size={11} /> : null}
        </StatBlock>
        <StatDivider />
        {isH2h ? (
          <>
            <StatBlock
              label="W - D - L"
              align="center"
              value={
                ownRow
                  ? `${ownRow.matches_won ?? 0} - ${ownRow.matches_drawn ?? 0} - ${ownRow.matches_lost ?? 0}`
                  : "—"
              }
            />
            <StatDivider />
            <StatBlock
              label="LEAGUE PTS"
              align="flex-end"
              color={GOLD}
              value={ownRow ? formatNumber(ownRow.total) : "—"}
            />
          </>
        ) : (
          <>
            <StatBlock
              label="GW POINTS"
              align="center"
              color={GREEN}
              value={ownEventPoints == null ? "—" : formatNumber(ownEventPoints)}
            />
            <StatDivider />
            <StatBlock
              label="TOTAL POINTS"
              align="flex-end"
              value={ownTotal == null ? "—" : formatNumber(ownTotal)}
            />
          </>
        )}
      </View>

      {league.entry_can_invite && (
        <View style={{ marginBottom: 10 }}>
          {inviteCode ? (
            <Text selectable style={{ color: GREEN, fontWeight: "800", fontSize: 12 }}>
              Invite code: {inviteCode}
            </Text>
          ) : (
            <Pressable
              disabled={loading}
              onPress={onGetInviteCode}
              style={{
                backgroundColor: "rgba(0, 217, 130, 0.15)",
                borderRadius: 10,
                paddingVertical: 6,
                paddingHorizontal: 10,
                alignSelf: "flex-start",
                borderWidth: 1,
                borderColor: GREEN,
                opacity: loading ? 0.5 : 1,
              }}
            >
              <Text style={{ color: GREEN, fontWeight: "900", fontSize: 11 }}>Show invite code</Text>
            </Pressable>
          )}
        </View>
      )}

      {!!error && <Text style={{ color: "#ffb4b4", marginBottom: 10, fontSize: 12 }}>{error}</Text>}

      {(!isH2h || tab === "standings") && (
        <View>
          {loading && !standings && <ActivityIndicator color={GREEN} style={{ marginTop: 12 }} />}

          {standings && rows.length === 0 && (
            <Text style={{ color: MUTED, fontSize: 12, textAlign: "center", paddingVertical: 20 }}>
              {isH2h
                ? "The table appears once this league's first gameweek has been played."
                : "No teams are ranked in this league yet."}
            </Text>
          )}

          {rows.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: isH2h ? 8 : 10,
                paddingVertical: 6,
                marginBottom: 4,
              }}
            >
              {isH2h ? (
                <>
                  <HeaderCell width={40}>Pos</HeaderCell>
                  <HeaderCell flex={1}>Team</HeaderCell>
                  <HeaderCell width={22} align="center">W</HeaderCell>
                  <HeaderCell width={22} align="center">D</HeaderCell>
                  <HeaderCell width={22} align="center">L</HeaderCell>
                  <HeaderCell width={48} align="right">Score</HeaderCell>
                  <HeaderCell width={34} align="right">Pts</HeaderCell>
                </>
              ) : (
                <>
                  <HeaderCell width={58}>Rank</HeaderCell>
                  <HeaderCell flex={1}>Team</HeaderCell>
                  <HeaderCell width={42} align="right">GW</HeaderCell>
                  <HeaderCell width={62} align="right">Total</HeaderCell>
                </>
              )}
            </View>
          )}

          {rows.map((rawRow) => {
            const isUser = rawRow.entry === userEntryId;
            const row = isUser ? live(rawRow) : rawRow;
            const rowMovement = movement(row.rank, row.last_rank);

            return (
              <Pressable
                key={row.entry}
                onPress={() => viewMember(row)}
                accessibilityRole="button"
                accessibilityLabel={`${row.entry_name || row.player_name}, rank ${row.rank}, ${row.total} points${
                  isUser ? ", your team" : ""
                }`}
                android_ripple={{ color: "rgba(0, 217, 130, 0.18)" }}
                style={{
                  backgroundColor: isUser ? "rgba(0, 217, 130, 0.18)" : CARD_BG,
                  borderRadius: 10,
                  paddingVertical: isH2h ? 9 : 10,
                  paddingHorizontal: isH2h ? 8 : 10,
                  marginTop: 6,
                  flexDirection: "row",
                  alignItems: "center",
                  borderWidth: isUser ? 1.5 : 1,
                  borderColor: isUser ? GREEN : CARD_BORDER,
                }}
              >
                <View style={{ width: isH2h ? 40 : 58, flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900" }}>
                    {formatNumber(row.rank)}
                  </Text>
                  <MovementIcon value={rowMovement} />
                </View>

                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900" }} numberOfLines={1}>
                    {row.entry_name || row.player_name}
                  </Text>
                  {!!row.player_name && (
                    <Text style={{ color: MUTED, fontSize: 10, marginTop: 1 }} numberOfLines={1}>
                      {row.player_name}
                    </Text>
                  )}
                </View>

                {isH2h ? (
                  <>
                    <Text style={{ width: 22, textAlign: "center", color: GREEN, fontSize: 11, fontWeight: "800" }}>
                      {row.matches_won ?? 0}
                    </Text>
                    <Text style={{ width: 22, textAlign: "center", color: MUTED, fontSize: 11, fontWeight: "800" }}>
                      {row.matches_drawn ?? 0}
                    </Text>
                    <Text style={{ width: 22, textAlign: "center", color: RED, fontSize: 11, fontWeight: "800" }}>
                      {row.matches_lost ?? 0}
                    </Text>
                    <Text style={{ width: 48, textAlign: "right", color: "#fff", fontSize: 11, fontWeight: "800" }}>
                      {formatNumber(row.points_for ?? 0)}
                    </Text>
                    <Text style={{ width: 34, textAlign: "right", color: GOLD, fontSize: 13, fontWeight: "900" }}>
                      {row.total}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={{ width: 42, textAlign: "right", color: "#c5d8ce", fontSize: 11, fontWeight: "700" }}>
                      {row.event_total}
                    </Text>
                    <Text
                      style={{
                        width: 62,
                        textAlign: "right",
                        color: isUser ? GREEN : "#fff",
                        fontSize: 12,
                        fontWeight: "900",
                      }}
                    >
                      {formatNumber(row.total)}
                    </Text>
                  </>
                )}
              </Pressable>
            );
          })}

          {standings && (standings.standings.page > 1 || standings.standings.has_next) && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 12,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous page of league standings"
                disabled={loading || standings.standings.page <= 1}
                onPress={() => onPage(standings.standings.page - 1)}
                style={{
                  backgroundColor: CARD_BG,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderWidth: 1,
                  borderColor: CARD_BORDER,
                  opacity: loading || standings.standings.page <= 1 ? 0.45 : 1,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11 }}>Previous</Text>
              </Pressable>
              {loading ? (
                <ActivityIndicator accessibilityLabel="Loading league standings" color={GREEN} size="small" />
              ) : (
                <Text style={{ color: MUTED, fontSize: 11, fontWeight: "600" }}>
                  Page {standings.standings.page}
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next page of league standings"
                disabled={loading || !standings.standings.has_next}
                onPress={() => onPage(standings.standings.page + 1)}
                style={{
                  backgroundColor: CARD_BG,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderWidth: 1,
                  borderColor: CARD_BORDER,
                  opacity: loading || !standings.standings.has_next ? 0.45 : 1,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11 }}>Next</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {isH2h && tab === "matches" && (
        <H2hMatches
          league={league}
          matches={h2hMatches}
          event={h2hEvent}
          loading={h2hLoading}
          latestGameweek={latestGameweek}
          gameweeks={gameweeks}
          userEntryId={userEntryId}
          liveEventId={liveEventId}
          liveEventPoints={liveEventPoints}
          onSelectEvent={onSelectH2hEvent}
          onViewMember={onViewMember}
        />
      )}
    </View>
  );
}

function H2hMatches({
  league,
  matches,
  event,
  loading,
  latestGameweek,
  gameweeks,
  userEntryId,
  liveEventId,
  liveEventPoints,
  onSelectEvent,
  onViewMember,
}: {
  league: FplLeague;
  matches: H2hMatch[];
  event: number | null;
  loading: boolean;
  latestGameweek: number;
  gameweeks: Gameweek[];
  userEntryId?: number;
  liveEventId: number | null;
  liveEventPoints: number | null;
  onSelectEvent: (event: number) => void;
  onViewMember: Props["onViewMember"];
}) {
  const shownEvent = event ?? latestGameweek;
  const firstEvent = Math.max(1, league.start_event ?? 1);
  const gameweek = gameweeks.find((gw) => gw.id === shownEvent);
  // gameweeks only lists weeks that have kicked off, so anything else is ahead.
  const status: "upcoming" | "live" | "finished" = !gameweek
    ? "upcoming"
    : gameweek.finished
      ? "finished"
      : "live";
  const statusColor = status === "live" ? GREEN : MUTED;

  // The user's own fixture first, then the rest in FPL's order.
  const ordered = [...matches].sort((a, b) => {
    const mine = (m: H2hMatch) =>
      m.entry_1_entry === userEntryId || m.entry_2_entry === userEntryId ? 0 : 1;
    return mine(a) - mine(b);
  });

  return (
    <View style={{ marginTop: 6 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <StepButton
          direction="left"
          label="Previous gameweek fixtures"
          disabled={loading || shownEvent <= firstEvent}
          onPress={() => onSelectEvent(shownEvent - 1)}
        />
        <View style={{ alignItems: "center" }}>
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900", letterSpacing: 0.3 }}>
            Gameweek {shownEvent}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
            {status === "live" && (
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN }} />
            )}
            <Text style={{ color: statusColor, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 }}>
              {status === "live" ? "LIVE" : status === "finished" ? "FINISHED" : "UPCOMING"}
            </Text>
          </View>
        </View>
        <StepButton
          direction="right"
          label="Next gameweek fixtures"
          disabled={loading || shownEvent >= LAST_GAMEWEEK}
          onPress={() => onSelectEvent(shownEvent + 1)}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={GREEN} style={{ marginVertical: 24 }} />
      ) : ordered.length === 0 ? (
        <Text style={{ color: MUTED, fontSize: 12, textAlign: "center", paddingVertical: 20 }}>
          No fixtures for Gameweek {shownEvent}.
        </Text>
      ) : (
        ordered.map((match, index) => {
          const isUserMatch = match.entry_1_entry === userEntryId || match.entry_2_entry === userEntryId;
          // The user's score moves during matches before FPL updates fixtures.
          const points = (entry: number | null, reported: number) =>
            entry === userEntryId &&
            status === "live" &&
            liveEventId === shownEvent &&
            liveEventPoints != null
              ? Math.max(reported ?? 0, liveEventPoints)
              : reported ?? 0;
          const p1 = points(match.entry_1_entry, match.entry_1_points);
          const p2 = points(match.entry_2_entry, match.entry_2_points);
          const played = status !== "upcoming";

          let result: { text: string; color: string } | null = null;
          if (isUserMatch && played) {
            const own = match.entry_1_entry === userEntryId ? p1 : p2;
            const other = match.entry_1_entry === userEntryId ? p2 : p1;
            const done = status === "finished";
            result =
              own === other
                ? { text: done ? "DRAW" : "LEVEL", color: MUTED }
                : own > other
                  ? { text: done ? "WON" : "WINNING", color: GREEN }
                  : { text: done ? "LOST" : "LOSING", color: RED };
          }

          const side = (
            entry: number | null,
            teamName: string,
            managerName: string,
            own: number,
            other: number,
          ) => {
            const isAverage = entry == null;
            const content = (
              <>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900" }} numberOfLines={1}>
                    {isAverage ? "League average" : teamName || managerName}
                  </Text>
                  <Text style={{ color: MUTED, fontSize: 10, fontWeight: "600", marginTop: 1 }} numberOfLines={1}>
                    {isAverage ? "Average score of all teams this gameweek" : managerName}
                  </Text>
                </View>
                <Text
                  style={{
                    color: played && own > other ? GREEN : "#fff",
                    fontSize: 16,
                    fontWeight: "900",
                    minWidth: 30,
                    textAlign: "right",
                  }}
                >
                  {played ? own : "–"}
                </Text>
              </>
            );
            const rowStyle = { flexDirection: "row", alignItems: "center" } as const;
            // "League average" isn't a real team, and upcoming fixtures have no
            // squad to show yet.
            if (isAverage) return <View style={rowStyle}>{content}</View>;
            return (
              <Pressable
                onPress={() => onViewMember(entry, Math.min(shownEvent, latestGameweek), teamName, managerName)}
                accessibilityRole="button"
                accessibilityLabel={`${teamName || managerName}${played ? `, ${own} points` : ""}. View team`}
                style={({ pressed }) => ({ ...rowStyle, opacity: pressed ? 0.7 : 1 })}
              >
                {content}
              </Pressable>
            );
          };

          return (
            <View
              key={match.id ?? `match-${index}`}
              style={{
                backgroundColor: isUserMatch ? "rgba(0, 217, 130, 0.12)" : CARD_BG,
                borderRadius: 14,
                padding: 12,
                marginBottom: 8,
                borderWidth: isUserMatch ? 1.5 : 1,
                borderColor: isUserMatch ? GREEN : CARD_BORDER,
              }}
            >
              {(result || match.is_knockout) && (
                <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
                  {result && (
                    <View
                      style={{
                        borderRadius: 6,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        backgroundColor: "rgba(0, 0, 0, 0.3)",
                        borderWidth: 1,
                        borderColor: result.color,
                      }}
                    >
                      <Text style={{ color: result.color, fontSize: 9, fontWeight: "900", letterSpacing: 0.5 }}>
                        {result.text}
                      </Text>
                    </View>
                  )}
                  {match.is_knockout && (
                    <View
                      style={{
                        borderRadius: 6,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        backgroundColor: "rgba(0, 0, 0, 0.3)",
                        borderWidth: 1,
                        borderColor: GOLD,
                      }}
                    >
                      <Text style={{ color: GOLD, fontSize: 9, fontWeight: "900", letterSpacing: 0.5 }}>
                        KNOCKOUT
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {side(match.entry_1_entry, match.entry_1_name, match.entry_1_player_name, p1, p2)}
              <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 8, gap: 8 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255, 255, 255, 0.1)" }} />
                <Text style={{ color: MUTED, fontSize: 9, fontWeight: "800" }}>VS</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255, 255, 255, 0.1)" }} />
              </View>
              {side(match.entry_2_entry, match.entry_2_name, match.entry_2_player_name, p2, p1)}
            </View>
          );
        })
      )}
    </View>
  );
}
