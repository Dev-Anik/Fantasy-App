import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, Pressable, Text, View } from "react-native";
import type { FplLeague, Gameweek, H2hMatch, LeagueStanding, LeagueStandings } from "./fpl";
import { AppSymbol } from "./AppSymbol";
import { Divider, Group, Heading, MINE_BAND, MovementBadge, Segmented, Stats, TABLE, TextButton, LEAGUE_UI as UI } from "./leagueUi";
import { LiveLeagueTable } from "./LiveLeagueTable";
import { loadLiveScores } from "./liveLeague";
import { loadCupLeague, loadCupMatches } from "./leagueDirect";
import type { LiveScore } from "./liveLeague";
import { LiveDot } from "./LiveDot";
import { THEME } from "./theme";

// Live head-to-head scores for these matches while their gameweek is in play,
// refreshed every minute and on returning to the app. Empty otherwise.
function useLiveH2hScores(matches: H2hMatch[], event: number, live: boolean, refreshSignal: number) {
  const [scores, setScores] = useState<{ key: string; byEntry: Map<number, LiveScore> } | null>(null);
  const entries = matches
    .flatMap((match) => [match.entry_1_entry, match.entry_2_entry])
    .filter((entry): entry is number => entry != null);
  const key = `${event}:${entries.join(",")}`;
  useEffect(() => {
    if (!live || entries.length === 0) return;
    let cancelled = false;
    const refresh = () =>
      loadLiveScores(entries, event).then(
        (byEntry) => {
          if (!cancelled) setScores({ key, byEntry });
        },
        // No signal or FPL busy: FPL's own numbers stay; the next refresh retries.
        () => {},
      );
    refresh();
    const timer = setInterval(refresh, 60_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
      subscription.remove();
    };
    // `key` stands for `entries` and `event`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, live, refreshSignal]);
  // Scores for another gameweek or other matches are stale.
  return live && scores?.key === key ? scores.byEntry : null;
}

type Tab = "live" | "standings" | "matches" | "cup";
const TAB_LABEL: Record<Tab, string> = { live: "Live", standings: "Standings", matches: "Matches", cup: "Cup" };

const LAST_GAMEWEEK = 38;
// Position column: the rank and its movement badge.
const RANK_W = 54;

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
  // Bumped when the user pulls to refresh: live tables reload at once.
  refreshSignal?: number;
};

const formatNumber = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

type Movement = "up" | "down" | "same";

function movement(rank: number, lastRank: number | null | undefined): Movement {
  if (!lastRank || lastRank <= 0 || !rank || rank === lastRank) return "same";
  return rank < lastRank ? "up" : "down";
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

// The top of a league's page: back to the list, and the league's name. Kept
// fixed above the scrolling standings and matches.
export function LeagueDetailsHeader({ name, onBack }: { name: string; onBack: () => void }) {
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
        <Text style={{ color: UI.soft, fontSize: 13, fontWeight: "500" }}>Leagues</Text>
      </Pressable>
      <Text
        accessibilityRole="header"
        numberOfLines={2}
        style={{ color: UI.ink, fontSize: 18, fontWeight: "700", marginTop: 6, marginBottom: 10 }}
      >
        {name}
      </Text>
    </View>
  );
}

function Tabs({ tabs, tab, onChange }: { tabs: Tab[]; tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <Segmented
      options={tabs.map((id) => ({ id, label: TAB_LABEL[id], live: id === "live" }))}
      value={tab}
      onChange={onChange}
    />
  );
}

function HeaderCell({ children, width, align = "left", flex }: {
  children: string;
  width?: number;
  flex?: number;
  align?: "left" | "center" | "right";
}) {
  return <Text style={{ width, flex, textAlign: align, ...TABLE.header }}>{children}</Text>;
}

const cell = (width: number, align: "center" | "right" = "right", strong = false) => ({
  width,
  textAlign: align,
  ...(strong ? TABLE.total : TABLE.figure),
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
  refreshSignal = 0,
}: Props) {
  const isH2h = league.kind === "h2h";
  const latestGameweek = gameweeks[gameweeks.length - 1]?.id ?? 1;
  // A classic league with a gameweek in play (that counts for this league)
  // gets a live table, shown first.
  const latest = gameweeks[gameweeks.length - 1];
  const liveEvent =
    !isH2h && latest && !latest.finished && (league.start_event ?? 1) <= latest.id ? latest.id : null;
  const [tab, setTab] = useState<Tab>(liveEvent ? "live" : "standings");
  // Classic leagues: Live while a gameweek is in play, the standings, and the
  // league's cup if it has one.
  const classicTabs: Tab[] = [...(liveEvent ? (["live"] as Tab[]) : []), "standings", ...(league.has_cup ? (["cup"] as Tab[]) : [])];
  const tabs: Tab[] | null = isH2h ? ["standings", "matches"] : classicTabs.length > 1 ? classicTabs : null;
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
    // The back link and league name are drawn above, fixed (see
    // LeagueDetailsHeader); everything here scrolls under them.
    <View>
      {tabs && <Tabs tabs={tabs} tab={tab} onChange={setTab} />}

      {/* Your position in this league */}
      <Stats
        compact
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
            <Text selectable style={{ color: UI.soft, fontSize: 12 }}>
              {"Invite code  "}
              <Text style={{ color: UI.ink, fontWeight: "700", letterSpacing: 0.5 }}>{inviteCode}</Text>
            </Text>
          ) : (
            <TextButton label="Show invite code" disabled={loading} onPress={onGetInviteCode} color={UI.good} />
          )}
        </View>
      )}

      {!!error && <Text style={{ color: UI.bad, marginTop: 12, fontSize: 12, lineHeight: 18 }}>{error}</Text>}

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
              refreshSignal={refreshSignal}
            />
            {standings && (standings.standings.page > 1 || standings.standings.has_next) && (
              <Text style={{ color: UI.muted, fontSize: 11, marginTop: 6, marginLeft: 2 }}>
                {`The live table covers the teams on page ${standings.standings.page} of the standings.`}
              </Text>
            )}
          </>
        ) : loading ? (
          <ActivityIndicator color={UI.soft} style={{ marginTop: 20 }} />
        ) : null
      )}

      {tab === "standings" && (
        <View>
          {loading && !standings && <ActivityIndicator color={UI.soft} style={{ marginTop: 20 }} />}

          {standings && rows.length === 0 && (
            <Text style={{ color: UI.muted, fontSize: 12, textAlign: "center", paddingVertical: 24 }}>
              {isH2h
                ? "The table appears once this league's first gameweek has been played."
                : "No teams are ranked in this league yet."}
            </Text>
          )}

          {rows.length > 0 && (
            <>
              <Heading>Standings</Heading>
              <Group>
                <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6 }}>
                  {isH2h ? (
                    <>
                      <HeaderCell width={RANK_W}>Pos</HeaderCell>
                      <HeaderCell flex={1}>Team</HeaderCell>
                      <HeaderCell width={24} align="center">W</HeaderCell>
                      <HeaderCell width={24} align="center">D</HeaderCell>
                      <HeaderCell width={24} align="center">L</HeaderCell>
                      <HeaderCell width={46} align="right">PF</HeaderCell>
                      <HeaderCell width={40} align="right">Pts</HeaderCell>
                    </>
                  ) : (
                    <>
                      <HeaderCell width={RANK_W}>Pos</HeaderCell>
                      <HeaderCell flex={1}>Team</HeaderCell>
                      <HeaderCell width={40} align="right">GW</HeaderCell>
                      <HeaderCell width={62} align="right">Total</HeaderCell>
                    </>
                  )}
                </View>

                {rows.map((rawRow, index) => {
                  const isUser = rawRow.entry === userEntryId;
                  const row = isUser ? live(rawRow) : rawRow;
                  // No line touching the highlighted band.
                  const nextIsUser = rows[index + 1]?.entry === userEntryId;
                  return (
                    <View key={row.entry} style={{ paddingHorizontal: 6, paddingBottom: index === rows.length - 1 ? 6 : 0 }}>
                      <Pressable
                        onPress={() => viewMember(row)}
                        accessibilityRole="button"
                        accessibilityLabel={`${row.entry_name || row.player_name}, rank ${row.rank}, ${row.total} points${
                          isH2h && row.points_for != null ? `, ${row.points_for} scored in this league` : ""
                        }${isUser ? ", your team" : ""}. View team`}
                        style={({ pressed }) => ({
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 12,
                          paddingVertical: TABLE.rowPaddingV,
                          borderRadius: 12,
                          ...(isUser ? MINE_BAND : null),
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <View style={{ width: RANK_W, flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text
                            style={{
                              minWidth: 18,
                              color: isUser ? UI.ink : UI.dim,
                              fontSize: TABLE.rank,
                              fontWeight: isUser ? "800" : "500",
                              fontVariant: ["tabular-nums"],
                            }}
                          >
                            {formatNumber(row.rank)}
                          </Text>
                          <MovementBadge value={movement(row.rank, row.last_rank)} />
                        </View>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text numberOfLines={1} style={TABLE.name}>
                            {row.entry_name || row.player_name}
                          </Text>
                          {!!row.player_name && (
                            <Text numberOfLines={1} style={isUser ? { ...TABLE.sub, color: UI.soft } : TABLE.sub}>
                              {row.player_name}
                            </Text>
                          )}
                        </View>
                        {isH2h ? (
                          <>
                            <Text style={cell(24, "center")}>{row.matches_won ?? 0}</Text>
                            <Text style={cell(24, "center")}>{row.matches_drawn ?? 0}</Text>
                            <Text style={cell(24, "center")}>{row.matches_lost ?? 0}</Text>
                            {/* Points scored in this league's matches (since it
                                started): separates teams level on Pts. */}
                            <Text style={cell(46)}>
                              {row.points_for == null ? "—" : formatNumber(row.points_for)}
                            </Text>
                            <Text style={cell(40, "right", true)}>{row.total}</Text>
                          </>
                        ) : (
                          <>
                            <Text style={cell(40)}>{row.event_total}</Text>
                            <Text style={cell(62, "right", true)}>{formatNumber(row.total)}</Text>
                          </>
                        )}
                      </Pressable>
                      {index < rows.length - 1 && !isUser && !nextIsUser && <Divider inset={12} />}
                    </View>
                  );
                })}
              </Group>
              <Text style={{ color: UI.muted, fontSize: 11, lineHeight: 16, marginTop: 6, marginLeft: 2 }}>
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
                <Text style={{ color: UI.muted, fontSize: 12 }}>{`Page ${standings.standings.page}`}</Text>
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

      {!isH2h && tab === "cup" && (
        <CupTab
          league={league}
          gameweeks={gameweeks}
          latestGameweek={latestGameweek}
          userEntryId={userEntryId}
          liveEventId={liveEventId}
          liveEventPoints={liveEventPoints}
          onViewMember={onViewMember}
          refreshSignal={refreshSignal}
        />
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
          refreshSignal={refreshSignal}
        />
      )}
    </View>
  );
}

// A classic league's cup: a knockout, played as head-to-head matches (FPL
// runs it as a league of its own once drawn). Before the draw, a note.
function CupTab({
  league,
  gameweeks,
  latestGameweek,
  userEntryId,
  liveEventId,
  liveEventPoints,
  onViewMember,
  refreshSignal,
}: {
  league: FplLeague;
  gameweeks: Gameweek[];
  latestGameweek: number;
  userEntryId?: number;
  liveEventId: number | null;
  liveEventPoints: number | null;
  onViewMember: Props["onViewMember"];
  refreshSignal: number;
}) {
  const cupId = league.cup_league ?? null;
  const [info, setInfo] = useState<{ id: number; startEvent: number } | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [round, setRound] = useState<{ key: string; matches: H2hMatch[] } | null>(null);
  const [failed, setFailed] = useState("");

  // The cup's first round, once.
  useEffect(() => {
    if (!cupId) return;
    let active = true;
    loadCupLeague(cupId).then(
      (cup) => {
        if (active) setInfo({ id: cupId, startEvent: cup.startEvent });
      },
      () => {
        if (active) setFailed(`info-${cupId}`);
      },
    );
    return () => {
      active = false;
    };
  }, [cupId, refreshSignal]);

  const started = gameweeks.filter((gw) => gw.finished || gw.isCurrent).map((gw) => gw.id);
  const firstRound = info?.id === cupId ? info.startEvent : null;
  // The round shown: the user's choice, else the latest round played (or the
  // first, if it's still to come).
  const shownEvent =
    chosen ?? (firstRound != null ? Math.max(firstRound, Math.min(latestGameweek, Math.max(...started, firstRound))) : null);
  const key = cupId && shownEvent ? `${cupId}-${shownEvent}` : "";

  useEffect(() => {
    if (!cupId || !shownEvent) return;
    let active = true;
    loadCupMatches(cupId, shownEvent).then(
      (matches) => {
        if (active) setRound({ key: `${cupId}-${shownEvent}`, matches });
      },
      () => {
        if (active) setFailed(`${cupId}-${shownEvent}`);
      },
    );
    return () => {
      active = false;
    };
  }, [cupId, shownEvent, refreshSignal]);

  if (!cupId) {
    return (
      <View style={{ marginTop: 18, padding: 16, borderRadius: 14, backgroundColor: UI.surface, gap: 6 }}>
        <Text style={{ color: UI.ink, fontSize: 14, fontWeight: "700" }}>{"The cup hasn't started yet"}</Text>
        <Text style={{ color: UI.soft, fontSize: 12.5, lineHeight: 18 }}>
          This league has a cup: a knockout, one match a gameweek against another team in the league. FPL draws it later
          in the season; the rounds and your matches will appear here then.
        </Text>
      </View>
    );
  }

  const shown = round?.key === key ? round.matches : null;
  const loadFailed = failed === key || failed === `info-${cupId}`;
  return (
    <View>
      {league.cup_qualified === false && (
        <Text style={{ color: UI.muted, fontSize: 12, marginTop: 14 }}>
          {"You didn't qualify for this cup; you can still follow its matches."}
        </Text>
      )}
      {loadFailed && !shown ? (
        <Text style={{ color: UI.muted, fontSize: 12, textAlign: "center", paddingVertical: 24 }}>
          {"Couldn't load the cup just now. Pull down to try again."}
        </Text>
      ) : shownEvent == null ? (
        <ActivityIndicator color={UI.soft} style={{ marginVertical: 24 }} />
      ) : (
        <H2hMatches
          league={{ ...league, id: cupId, kind: "h2h", start_event: firstRound ?? 1 }}
          matches={shown ?? []}
          event={shownEvent}
          loading={!shown}
          latestGameweek={latestGameweek}
          gameweeks={gameweeks}
          userEntryId={userEntryId}
          liveEventId={liveEventId}
          liveEventPoints={liveEventPoints}
          onSelectEvent={setChosen}
          onViewMember={onViewMember}
          refreshSignal={refreshSignal}
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
  refreshSignal,
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
  refreshSignal: number;
}) {
  const shownEvent = event ?? latestGameweek;
  const firstEvent = Math.max(1, league.start_event ?? 1);
  const gameweek = gameweeks.find((gw) => gw.id === shownEvent);
  // gameweeks only lists weeks that have kicked off, so anything else is ahead.
  const status: "upcoming" | "live" | "finished" = !gameweek ? "upcoming" : gameweek.finished ? "finished" : "live";

  const liveScores = useLiveH2hScores(matches, shownEvent, status === "live" && !loading, refreshSignal);

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
          <Text style={{ color: UI.ink, fontSize: 14, fontWeight: "700" }}>{`Gameweek ${shownEvent}`}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
            {status === "live" && <LiveDot color={UI.good} />}
            <Text style={{ color: status === "live" ? UI.good : UI.muted, fontSize: 11 }}>
              {status === "live" ? "Live" : status === "finished" ? "Finished" : "Upcoming"}
            </Text>
          </View>
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
        <Text style={{ color: UI.muted, fontSize: 12, textAlign: "center", paddingVertical: 24 }}>
          {`No matches in Gameweek ${shownEvent}.`}
        </Text>
      ) : (
        <View>
          {ordered.map((match, index) => {
            const isUserMatch = match.entry_1_entry === userEntryId || match.entry_2_entry === userEntryId;
            // Scores move during matches long before FPL updates its fixtures:
            // every team's live score, worked out like the points page; until
            // that has loaded, the user's own live points.
            const points = (entry: number | null, reported: number) => {
              const liveScore = entry != null ? liveScores?.get(entry) : undefined;
              if (liveScore != null) return liveScore.points;
              return entry === userEntryId && status === "live" && liveEventId === shownEvent && liveEventPoints != null
                ? Math.max(reported ?? 0, liveEventPoints)
                : reported ?? 0;
            };
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

            // One side of the fixture: the manager in bold, the team under,
            // both leaning in towards the score.
            const side = (entry: number | null, teamName: string, managerName: string, align: "left" | "right") => {
              const isAverage = entry == null;
              const toPlay = entry != null ? (liveScores?.get(entry)?.stillToPlay ?? null) : null;
              const content = (
                <>
                  <Text numberOfLines={1} style={{ ...TABLE.name, textAlign: align }}>
                    {isAverage ? "Average" : managerName || teamName}
                  </Text>
                  <Text numberOfLines={1} style={{ ...TABLE.sub, textAlign: align }}>
                    {isAverage ? "League average" : managerName ? teamName : ""}
                  </Text>
                  {/* While the gameweek is live: players with a match still to
                      come. The line is kept (blank) on every side from the
                      start, so the cards don't grow when the live scores
                      arrive a moment after the matches. */}
                  {status === "live" && (
                    <Text
                      numberOfLines={1}
                      style={{ color: UI.muted, fontSize: 10, lineHeight: 13, marginTop: 2, textAlign: align }}
                    >
                      {toPlay == null ? (
                        " "
                      ) : toPlay > 0 ? (
                        <>
                          {/* The count in yellow, so it stands out. */}
                          <Text style={{ color: UI.gold, fontWeight: "700" }}>{toPlay}</Text>
                          {" to play"}
                        </>
                      ) : (
                        "All played"
                      )}
                    </Text>
                  )}
                </>
              );
              const sideStyle = { flex: 1, alignItems: align === "right" ? "flex-end" : "flex-start" } as const;
              // "League average" isn't a real team.
              if (isAverage) return <View style={sideStyle}>{content}</View>;
              return (
                <Pressable
                  onPress={() => onViewMember(entry, Math.min(shownEvent, latestGameweek), teamName, managerName)}
                  accessibilityRole="button"
                  accessibilityLabel={`${teamName || managerName}. View team`}
                  hitSlop={6}
                  style={({ pressed }) => ({ ...sideStyle, opacity: pressed ? 0.6 : 1 })}
                >
                  {content}
                </Pressable>
              );
            };

            const scoreText = (own: number, other: number) => ({
              color: played && own >= other ? UI.ink : UI.muted,
              fontSize: 14,
              fontWeight: "800" as const,
              minWidth: 22,
              textAlign: "center" as const,
              fontVariant: ["tabular-nums" as const],
            });

            return (
              <View
                key={match.id ?? `match-${index}`}
                accessible={false}
                style={{
                  marginTop: index === 0 ? 0 : 8,
                  paddingHorizontal: 12,
                  paddingTop: 12,
                  paddingBottom: 9,
                  borderRadius: 16,
                  ...(isUserMatch ? MINE_BAND : { backgroundColor: UI.surface }),
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  {side(match.entry_1_entry, match.entry_1_name, match.entry_1_player_name, "right")}
                  {/* The score: a dark box with a thin rule between the two. */}
                  <View
                    accessible
                    accessibilityLabel={played ? `${p1} to ${p2}` : "Not played yet"}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 8,
                      height: 32,
                      borderRadius: 9,
                      backgroundColor: THEME.bg,
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.08)",
                    }}
                  >
                    <Text style={scoreText(p1, p2)}>{played ? p1 : "–"}</Text>
                    <View style={{ width: 1, height: 15, marginHorizontal: 7, backgroundColor: "rgba(255, 255, 255, 0.18)" }} />
                    <Text style={scoreText(p2, p1)}>{played ? p2 : "–"}</Text>
                  </View>
                  {side(match.entry_2_entry, match.entry_2_name, match.entry_2_player_name, "left")}
                </View>
                {/* Under the score: how the user's match stands, and knockouts. */}
                <Text style={{ textAlign: "center", fontSize: 10.5, marginTop: 8, color: UI.muted }}>
                  {result ? <Text style={{ color: result.color, fontWeight: "700" }}>{result.text}</Text> : `Gameweek ${shownEvent}`}
                  {match.is_knockout && <Text style={{ color: UI.gold, fontWeight: "700" }}>{"  ·  Knockout"}</Text>}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
