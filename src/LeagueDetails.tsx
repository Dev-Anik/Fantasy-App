import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { FplLeague, Gameweek, H2hMatch, LeagueStanding, LeagueStandings } from "./fpl";
import { AppSymbol } from "./AppSymbol";
import { Divider, Group, Heading, Stats, TextButton, LEAGUE_UI as UI } from "./leagueUi";
import { LiveLeagueTable } from "./LiveLeagueTable";

type Tab = "live" | "standings" | "matches";
const TAB_LABEL: Record<Tab, string> = { live: "Live", standings: "Standings", matches: "Matches" };

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

const formatNumber = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

type Movement = "up" | "down" | "same";

function movement(rank: number, lastRank: number | null | undefined): Movement {
  if (!lastRank || lastRank <= 0 || !rank || rank === lastRank) return "same";
  return rank < lastRank ? "up" : "down";
}

// A small coloured arrow for a rank that moved; nothing when it didn't.
function MovementMark({ value }: { value: Movement }) {
  if (value === "same") return null;
  return (
    <Text style={{ color: value === "up" ? UI.good : UI.bad, fontSize: 9, marginLeft: 3 }}>
      {value === "up" ? "▲" : "▼"}
    </Text>
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

function Tabs({ tabs, tab, onChange }: { tabs: Tab[]; tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: UI.line, marginBottom: 14 }}>
      {tabs.map((id) => {
        const active = id === tab;
        return (
          <Pressable
            key={id}
            onPress={() => onChange(id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{ marginRight: 22, paddingBottom: 10 }}
          >
            <Text style={{ color: active ? UI.ink : UI.muted, fontSize: 14, fontWeight: active ? "700" : "500" }}>
              {id === "live" && <Text style={{ color: UI.good }}>{"● "}</Text>}
              {TAB_LABEL[id]}
            </Text>
            <View style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: 2, backgroundColor: active ? UI.ink : "transparent" }} />
          </Pressable>
        );
      })}
    </View>
  );
}

function HeaderCell({ children, width, align = "left", flex }: {
  children: string;
  width?: number;
  flex?: number;
  align?: "left" | "center" | "right";
}) {
  return (
    <Text style={{ width, flex, textAlign: align, color: UI.muted, fontSize: 10.5, fontWeight: "700", letterSpacing: 0.5 }}>
      {children.toUpperCase()}
    </Text>
  );
}

const cell = (width: number, align: "center" | "right" = "right", color = UI.soft, weight: "500" | "700" = "500") => ({
  width,
  textAlign: align,
  color,
  fontSize: 13,
  fontWeight: weight,
  fontVariant: ["tabular-nums" as const],
});

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
  const isH2h = league.kind === "h2h";
  const latestGameweek = gameweeks[gameweeks.length - 1]?.id ?? 1;
  // A classic league with a gameweek in play (that counts for this league)
  // gets a live table, shown first.
  const latest = gameweeks[gameweeks.length - 1];
  const liveEvent =
    !isH2h && latest && !latest.finished && (league.start_event ?? 1) <= latest.id ? latest.id : null;
  const [tab, setTab] = useState<Tab>(liveEvent ? "live" : "standings");
  const tabs: Tab[] | null = isH2h ? ["standings", "matches"] : liveEvent ? ["live", "standings"] : null;
  const rows = standings?.standings?.results ?? [];
  const live = (row: LeagueStanding) => withLivePoints(row, league, liveEventId, liveEventPoints, latestGameweek);

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
  const ownMove = ownRank ? movement(ownRank, ownLastRank) : "same";
  const ownMoveBy = ownRank && ownLastRank ? Math.abs(ownLastRank - ownRank) : 0;

  const viewMember = (row: LeagueStanding) =>
    onViewMember(row.entry, latestGameweek, row.entry_name || row.player_name, row.player_name);

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to your leagues"
        onPress={onBack}
        hitSlop={12}
        style={({ pressed }) => ({
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          gap: 2,
          marginLeft: -4,
          paddingVertical: 4,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <AppSymbol name={{ ios: "chevron.left", android: "chevron_left", web: "chevron_left" }} color={UI.soft} size={20} />
        <Text style={{ color: UI.soft, fontSize: 14, fontWeight: "500" }}>Leagues</Text>
      </Pressable>

      <Text style={{ color: UI.ink, fontSize: 22, fontWeight: "700", marginTop: 8, marginBottom: 14 }}>
        {standings?.league?.name ?? league.name}
      </Text>

      {tabs && <Tabs tabs={tabs} tab={tab} onChange={setTab} />}

      {/* Your position in this league */}
      <Stats
        compact={isH2h}
        items={
          isH2h
            ? [
                { label: "Your rank", value: ownRank ? formatNumber(ownRank) : "—" },
                {
                  label: "W · D · L",
                  spoken: "Won, drawn, lost",
                  value: ownRow ? `${ownRow.matches_won ?? 0} · ${ownRow.matches_drawn ?? 0} · ${ownRow.matches_lost ?? 0}` : "—",
                },
                { label: "League pts", value: ownRow ? formatNumber(ownRow.total) : "—" },
              ]
            : [
                {
                  label: "Your rank",
                  value: ownRank ? formatNumber(ownRank) : "—",
                  note:
                    ownMove === "same"
                      ? undefined
                      : `${ownMove === "up" ? "▲" : "▼"} ${formatNumber(ownMoveBy)}`,
                  noteColor: ownMove === "up" ? UI.good : UI.bad,
                },
                { label: "Gameweek", value: ownEventPoints == null ? "—" : formatNumber(ownEventPoints) },
                { label: "Total", value: ownTotal == null ? "—" : formatNumber(ownTotal) },
              ]
        }
      />

      {league.entry_can_invite && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
          {inviteCode ? (
            <Text selectable style={{ color: UI.soft, fontSize: 13 }}>
              {"Invite code  "}
              <Text style={{ color: UI.ink, fontWeight: "700", letterSpacing: 0.5 }}>{inviteCode}</Text>
            </Text>
          ) : (
            <TextButton label="Show invite code" disabled={loading} onPress={onGetInviteCode} color={UI.good} />
          )}
        </View>
      )}

      {!!error && <Text style={{ color: UI.bad, marginTop: 12, fontSize: 13, lineHeight: 18 }}>{error}</Text>}

      {liveEvent && tab === "live" && (
        rows.length > 0 ? (
          <>
            <LiveLeagueTable
              rows={rows}
              event={liveEvent}
              userEntryId={userEntryId}
              userTeamName={ownRow?.entry_name || "Your team"}
              userManagerName={ownRow?.player_name || ""}
              onViewMember={onViewMember}
            />
            {standings && (standings.standings.page > 1 || standings.standings.has_next) && (
              <Text style={{ color: UI.muted, fontSize: 11.5, marginTop: 6, marginLeft: 2 }}>
                {`The live table covers the teams on page ${standings.standings.page} of the standings.`}
              </Text>
            )}
          </>
        ) : loading ? (
          <ActivityIndicator color={UI.soft} style={{ marginTop: 20 }} />
        ) : null
      )}

      {(isH2h ? tab === "standings" : tab !== "live") && (
        <View>
          {loading && !standings && <ActivityIndicator color={UI.soft} style={{ marginTop: 20 }} />}

          {standings && rows.length === 0 && (
            <Text style={{ color: UI.muted, fontSize: 13, textAlign: "center", paddingVertical: 24 }}>
              {isH2h
                ? "The table appears once this league's first gameweek has been played."
                : "No teams are ranked in this league yet."}
            </Text>
          )}

          {rows.length > 0 && (
            <>
              <Heading>Standings</Heading>
              <Group>
                <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8 }}>
                  {isH2h ? (
                    <>
                      <HeaderCell width={42}>#</HeaderCell>
                      <HeaderCell flex={1}>Team</HeaderCell>
                      <HeaderCell width={20} align="center">W</HeaderCell>
                      <HeaderCell width={20} align="center">D</HeaderCell>
                      <HeaderCell width={20} align="center">L</HeaderCell>
                      <HeaderCell width={44} align="right">PF</HeaderCell>
                      <HeaderCell width={34} align="right">Pts</HeaderCell>
                    </>
                  ) : (
                    <>
                      <HeaderCell width={56}>#</HeaderCell>
                      <HeaderCell flex={1}>Team</HeaderCell>
                      <HeaderCell width={38} align="right">GW</HeaderCell>
                      <HeaderCell width={58} align="right">Total</HeaderCell>
                    </>
                  )}
                </View>

                {rows.map((rawRow) => {
                  const isUser = rawRow.entry === userEntryId;
                  const row = isUser ? live(rawRow) : rawRow;
                  return (
                    <View key={row.entry}>
                      <Divider inset={0} />
                      <Pressable
                        onPress={() => viewMember(row)}
                        accessibilityRole="button"
                        accessibilityLabel={`${row.entry_name || row.player_name}, rank ${row.rank}, ${row.total} points${
                          isH2h && row.points_for != null ? `, ${row.points_for} scored in this league` : ""
                        }${isUser ? ", your team" : ""}. View team`}
                        style={({ pressed }) => ({
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 14,
                          paddingVertical: 11,
                          backgroundColor: pressed ? UI.pressed : isUser ? UI.mine : "transparent",
                        })}
                      >
                        <View style={{ width: isH2h ? 42 : 56, flexDirection: "row", alignItems: "center" }}>
                          <Text style={{ color: UI.ink, fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] }}>
                            {formatNumber(row.rank)}
                          </Text>
                          <MovementMark value={movement(row.rank, row.last_rank)} />
                        </View>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text numberOfLines={1} style={{ color: isUser ? UI.good : UI.ink, fontSize: 14, fontWeight: "600" }}>
                            {row.entry_name || row.player_name}
                          </Text>
                          {!!row.player_name && (
                            <Text numberOfLines={1} style={{ color: UI.muted, fontSize: 12, marginTop: 1 }}>
                              {row.player_name}
                            </Text>
                          )}
                        </View>
                        {isH2h ? (
                          <>
                            <Text style={cell(20, "center")}>{row.matches_won ?? 0}</Text>
                            <Text style={cell(20, "center")}>{row.matches_drawn ?? 0}</Text>
                            <Text style={cell(20, "center")}>{row.matches_lost ?? 0}</Text>
                            {/* Points scored in this league's matches (since it
                                started): separates teams level on Pts. */}
                            <Text style={cell(44)}>{row.points_for == null ? "—" : formatNumber(row.points_for)}</Text>
                            <Text style={cell(34, "right", UI.ink, "700")}>{row.total}</Text>
                          </>
                        ) : (
                          <>
                            <Text style={cell(38)}>{row.event_total}</Text>
                            <Text style={cell(58, "right", UI.ink, "700")}>{formatNumber(row.total)}</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  );
                })}
              </Group>
              <Text style={{ color: UI.muted, fontSize: 11.5, lineHeight: 16, marginTop: 6, marginLeft: 2 }}>
                {isH2h
                  ? "PF: points scored in this league's matches since it started. Teams level on Pts are ranked by PF. Tap a team to see its squad."
                  : "Tap a team to see its squad."}
              </Text>
            </>
          )}

          {standings && (standings.standings.page > 1 || standings.standings.has_next) && (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
              <TextButton
                label="‹ Previous"
                disabled={loading || standings.standings.page <= 1}
                onPress={() => onPage(standings.standings.page - 1)}
              />
              {loading ? (
                <ActivityIndicator accessibilityLabel="Loading league standings" color={UI.soft} size="small" />
              ) : (
                <Text style={{ color: UI.muted, fontSize: 13 }}>{`Page ${standings.standings.page}`}</Text>
              )}
              <TextButton
                label="Next ›"
                disabled={loading || !standings.standings.has_next}
                onPress={() => onPage(standings.standings.page + 1)}
              />
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
  const status: "upcoming" | "live" | "finished" = !gameweek ? "upcoming" : gameweek.finished ? "finished" : "live";

  // The user's own fixture first, then the rest in FPL's order.
  const ordered = [...matches].sort((a, b) => {
    const mine = (m: H2hMatch) => (m.entry_1_entry === userEntryId || m.entry_2_entry === userEntryId ? 0 : 1);
    return mine(a) - mine(b);
  });

  return (
    <View style={{ marginTop: 18 }}>
      {/* Gameweek stepper */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <TextButton
          label="‹ Previous"
          disabled={loading || shownEvent <= firstEvent}
          onPress={() => onSelectEvent(shownEvent - 1)}
        />
        <View style={{ alignItems: "center" }}>
          <Text style={{ color: UI.ink, fontSize: 15, fontWeight: "700" }}>{`Gameweek ${shownEvent}`}</Text>
          <Text style={{ color: status === "live" ? UI.good : UI.muted, fontSize: 12, marginTop: 1 }}>
            {status === "live" ? "● Live" : status === "finished" ? "Finished" : "Upcoming"}
          </Text>
        </View>
        <TextButton
          label="Next ›"
          disabled={loading || shownEvent >= LAST_GAMEWEEK}
          onPress={() => onSelectEvent(shownEvent + 1)}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={UI.soft} style={{ marginVertical: 24 }} />
      ) : ordered.length === 0 ? (
        <Text style={{ color: UI.muted, fontSize: 13, textAlign: "center", paddingVertical: 24 }}>
          {`No matches in Gameweek ${shownEvent}.`}
        </Text>
      ) : (
        <Group>
          {ordered.map((match, index) => {
            const isUserMatch = match.entry_1_entry === userEntryId || match.entry_2_entry === userEntryId;
            // The user's score moves during matches before FPL updates fixtures.
            const points = (entry: number | null, reported: number) =>
              entry === userEntryId && status === "live" && liveEventId === shownEvent && liveEventPoints != null
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
                  ? { text: done ? "Draw" : "Level", color: UI.soft }
                  : own > other
                    ? { text: done ? "Won" : "Winning", color: UI.good }
                    : { text: done ? "Lost" : "Losing", color: UI.bad };
            }

            const side = (entry: number | null, teamName: string, managerName: string, own: number, other: number) => {
              const isAverage = entry == null;
              const content = (
                <>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text
                      numberOfLines={1}
                      style={{ color: entry === userEntryId ? UI.good : UI.ink, fontSize: 14, fontWeight: "600" }}
                    >
                      {isAverage ? "League average" : teamName || managerName}
                    </Text>
                    <Text numberOfLines={1} style={{ color: UI.muted, fontSize: 12, marginTop: 1 }}>
                      {isAverage ? "Average score this gameweek" : managerName}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: played && own > other ? UI.ink : UI.soft,
                      fontSize: 16,
                      fontWeight: played && own > other ? "700" : "500",
                      minWidth: 30,
                      textAlign: "right",
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {played ? own : "–"}
                  </Text>
                </>
              );
              const rowStyle = { flexDirection: "row", alignItems: "center", paddingVertical: 4 } as const;
              // "League average" isn't a real team.
              if (isAverage) return <View style={rowStyle}>{content}</View>;
              return (
                <Pressable
                  onPress={() => onViewMember(entry, Math.min(shownEvent, latestGameweek), teamName, managerName)}
                  accessibilityRole="button"
                  accessibilityLabel={`${teamName || managerName}${played ? `, ${own} points` : ""}. View team`}
                  style={({ pressed }) => ({ ...rowStyle, opacity: pressed ? 0.6 : 1 })}
                >
                  {content}
                </Pressable>
              );
            };

            return (
              <View key={match.id ?? `match-${index}`}>
                {index > 0 && <Divider inset={0} />}
                <View style={{ paddingHorizontal: 14, paddingVertical: 10, backgroundColor: isUserMatch ? UI.mine : "transparent" }}>
                  {(result || match.is_knockout) && (
                    <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 4 }}>
                      {result && <Text style={{ color: result.color }}>{result.text.toUpperCase()}</Text>}
                      {result && match.is_knockout && <Text style={{ color: UI.muted }}>{"  ·  "}</Text>}
                      {match.is_knockout && <Text style={{ color: UI.gold }}>KNOCKOUT</Text>}
                    </Text>
                  )}
                  {side(match.entry_1_entry, match.entry_1_name, match.entry_1_player_name, p1, p2)}
                  {side(match.entry_2_entry, match.entry_2_name, match.entry_2_player_name, p2, p1)}
                </View>
              </View>
            );
          })}
        </Group>
      )}
    </View>
  );
}
