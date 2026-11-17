import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import type { ScrollViewInstance } from "react-native";
import { leagueCategory } from "./fpl";
import type {
  FplLeague,
  Gameweek,
  H2hMatch,
  LeagueCategory,
  LeagueStanding,
  LeagueStandings,
  LeagueType,
} from "./fpl";
import { AppSymbol } from "./AppSymbol";
import { LeagueCard } from "./LeagueCard";
import { LeagueDetails } from "./LeagueDetails";
import { FadeIn } from "./FadeIn";

const LEAGUE_SECTIONS: { category: LeagueCategory; title: string; subtitle: string }[] = [
  { category: "classic", title: "Classic Leagues", subtitle: "Ranked by total points" },
  { category: "h2h", title: "Head-to-Head Leagues", subtitle: "Weekly matches against other managers" },
  { category: "general", title: "General Leagues", subtitle: "Overall, country, club and gameweek leagues" },
];

type Props = {
  leagues: FplLeague[];
  selectedLeague: FplLeague | null;
  standings: LeagueStandings | null;
  h2hMatches: H2hMatch[];
  h2hEvent: number | null;
  h2hLoading: boolean;
  userStanding: LeagueStanding | null;
  userTotalPoints: number | null;
  liveEventId: number | null;
  liveEventPoints: number | null;
  onSelectH2hEvent: (league: FplLeague, event: number) => void;
  onCloseLeague: () => void;
  loading: boolean;
  error: string;
  gameweeks: Gameweek[];
  userEntryId?: number;
  onSelectLeague: (league: FplLeague, page?: number) => void;
  onJoin: (code: string) => void;
  onCreate: (
    name: string,
    type: LeagueType,
    startEvent?: number,
    knockoutRounds?: number,
    maxEntries?: number,
  ) => void;
  inviteCode: string | null;
  onGetInviteCode: (league: FplLeague) => void;
  onViewMember: (entry: number, event: number, teamName?: string, managerName?: string) => void;
  successSignal?: number;
};

const GREEN = "#00d982";
const DARK_GREEN = "#071b12";
const CARD_BG = "rgba(255, 255, 255, 0.08)";
const CARD_BORDER = "rgba(255, 255, 255, 0.12)";

export function LeagueHub({
  leagues,
  selectedLeague,
  standings,
  h2hMatches,
  h2hEvent,
  h2hLoading,
  userStanding,
  userTotalPoints,
  liveEventId,
  liveEventPoints,
  onSelectH2hEvent,
  onCloseLeague,
  loading,
  error,
  gameweeks,
  userEntryId,
  onSelectLeague,
  onJoin,
  onCreate,
  inviteCode,
  onGetInviteCode,
  onViewMember,
  successSignal,
}: Props) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [leagueType, setLeagueType] = useState<LeagueType>("classic");

  const currentGw = gameweeks.find((gw) => gw.isCurrent)?.id ?? gameweeks[0]?.id ?? 1;
  const seasonGameweeks = Array.from({ length: 38 }, (_, i) => {
    const id = i + 1;
    const existing = gameweeks.find((gw) => gw.id === id);
    return existing ?? { id, name: `Gameweek ${id}`, finished: id < currentGw, isCurrent: id === currentGw };
  }).filter((gw) => !gw.finished || gw.isCurrent);

  const [scoringStartGw, setScoringStartGw] = useState<number>(
    seasonGameweeks[0]?.id ?? currentGw
  );
  const [maxPlayers, setMaxPlayers] = useState<string>("N/A");
  const [knockoutRounds, setKnockoutRounds] = useState<number>(2);
  const [showGwDropdown, setShowGwDropdown] = useState(false);
  const [showKnockoutDropdown, setShowKnockoutDropdown] = useState(false);
  const [actionModal, setActionModal] = useState<"none" | "create" | "join">("none");
  const [showLeagueDetails, setShowLeagueDetails] = useState(false);
  const scrollViewRef = useRef<ScrollViewInstance>(null);
  // A league opens once its table has arrived (or the request has failed);
  // until then the list stays put and the tapped card shows a spinner.
  const detailsReady =
    showLeagueDetails && !!selectedLeague && (!!standings || !!error || !loading);
  const openingLeague = showLeagueDetails && !detailsReady ? selectedLeague : null;

  useEffect(() => {
    if (successSignal) {
      setActionModal("none");
      setCode("");
      setName("");
    }
  }, [successSignal]);

  // Jump to the top when a different league or standings page is shown, but
  // not when the same page is quietly refreshed in the background.
  const standingsLeagueId = standings?.league?.id;
  const standingsPage = standings?.standings?.page;
  useEffect(() => {
    if (standingsLeagueId == null) return;
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }, 50);
    return () => clearTimeout(timer);
  }, [standingsLeagueId, standingsPage]);

  const openLeague = (league: FplLeague) => {
    setShowLeagueDetails(true);
    onSelectLeague(league);
  };

  return (
    // Transparent: the screen's own textured background runs unbroken behind
    // the header and this page. A second copy here showed a visible seam.
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
      >
        {!detailsReady && (
          <>
            {/* Header / Title Section */}
            <View style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                <View
                  style={{
                    width: 3,
                    height: 14,
                    backgroundColor: GREEN,
                    borderRadius: 2,
                    marginRight: 6,
                  }}
                />
                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "900", letterSpacing: -0.2 }}>
                  Your Leagues
                </Text>
              </View>
              <Text style={{ color: "#9db3a6", fontSize: 11, marginLeft: 9 }}>
                Track your leagues and check your ranking
              </Text>
            </View>

            {/* Top Action Cards: Create League & Join League */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              <Pressable
                onPress={() => setActionModal(actionModal === "create" ? "none" : "create")}
                style={{
                  flex: 1,
                  backgroundColor: CARD_BG,
                  borderRadius: 14,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: actionModal === "create" ? GREEN : CARD_BORDER,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: "rgba(0, 217, 130, 0.15)",
                    borderWidth: 1,
                    borderColor: GREEN,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 5,
                  }}
                >
                  <Text style={{ color: GREEN, fontSize: 15, fontWeight: "900" }}>+</Text>
                </View>
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12, textAlign: "center" }}>
                  Create League
                </Text>
                <Text style={{ color: "#9db3a6", fontSize: 10, textAlign: "center", marginTop: 1 }}>
                  Start your own league
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActionModal(actionModal === "join" ? "none" : "join")}
                style={{
                  flex: 1,
                  backgroundColor: CARD_BG,
                  borderRadius: 14,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: actionModal === "join" ? GREEN : CARD_BORDER,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: "rgba(0, 217, 130, 0.15)",
                    borderWidth: 1,
                    borderColor: GREEN,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 5,
                  }}
                >
                  <AppSymbol
                    name={{ ios: "link", android: "link", web: "link" }}
                    color={GREEN}
                    size={14}
                  />
                </View>
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12, textAlign: "center" }}>
                  Join League
                </Text>
                <Text style={{ color: "#9db3a6", fontSize: 10, textAlign: "center", marginTop: 1 }}>
                  Enter a league code
                </Text>
              </Pressable>
            </View>

            {/* Inline Action Form (Create or Join) */}
            {actionModal === "join" && (
              <View
                style={{
                  backgroundColor: CARD_BG,
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: CARD_BORDER,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13, marginBottom: 6 }}>
                  Join with Code
                </Text>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  placeholder="Enter the FPL invite code"
                  placeholderTextColor="#7a9988"
                  autoCapitalize="none"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.3)",
                    color: "#fff",
                    borderRadius: 10,
                    padding: 10,
                    borderWidth: 1,
                    borderColor: CARD_BORDER,
                    fontSize: 12,
                  }}
                />
                <Pressable
                  disabled={loading || !code.trim()}
                  onPress={() => onJoin(code.trim())}
                  style={{
                    backgroundColor: GREEN,
                    borderRadius: 10,
                    alignItems: "center",
                    padding: 10,
                    marginTop: 8,
                    opacity: loading || !code.trim() ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: DARK_GREEN, fontWeight: "900", fontSize: 12 }}>Join League</Text>
                </Pressable>
              </View>
            )}

            {actionModal === "create" && (
              <View
                style={{
                  backgroundColor: CARD_BG,
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: CARD_BORDER,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13, marginBottom: 6 }}>
                  Create New League
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="League name"
                  placeholderTextColor="#7a9988"
                  maxLength={30}
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.3)",
                    color: "#fff",
                    borderRadius: 10,
                    padding: 10,
                    borderWidth: 1,
                    borderColor: CARD_BORDER,
                    fontSize: 12,
                    marginBottom: 8,
                  }}
                />
                <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
                  <Pressable
                    onPress={() => setLeagueType("classic")}
                    style={{
                      flex: 1,
                      padding: 8,
                      borderRadius: 8,
                      backgroundColor: leagueType === "classic" ? GREEN : "rgba(0, 0, 0, 0.3)",
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: CARD_BORDER,
                    }}
                  >
                    <Text style={{ color: leagueType === "classic" ? DARK_GREEN : "#fff", fontWeight: "800", fontSize: 11 }}>
                      Classic
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setLeagueType("h2h")}
                    style={{
                      flex: 1,
                      padding: 8,
                      borderRadius: 8,
                      backgroundColor: leagueType === "h2h" ? GREEN : "rgba(0, 0, 0, 0.3)",
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: CARD_BORDER,
                    }}
                  >
                    <Text style={{ color: leagueType === "h2h" ? DARK_GREEN : "#fff", fontWeight: "800", fontSize: 11 }}>
                      Head-to-Head
                    </Text>
                  </Pressable>
                </View>

                {/* Scoring starts dropdown (both classic and h2h) */}
                <View style={{ marginBottom: 10, position: "relative", zIndex: 10 }}>
                  <Text style={{ color: "#c5d8ce", fontSize: 11, fontWeight: "800", marginBottom: 4 }}>
                    Scoring starts
                  </Text>
                  <Pressable
                    onPress={() => setShowGwDropdown((visible) => !visible)}
                    style={{
                      backgroundColor: "rgba(5, 20, 13, 0.95)",
                      borderRadius: 10,
                      padding: 10,
                      borderWidth: 1,
                      borderColor: CARD_BORDER,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>
                      Gameweek {scoringStartGw}
                    </Text>
                    <Text style={{ color: "#9db3a6", fontSize: 12, fontWeight: "bold" }}>
                      {showGwDropdown ? "▲" : "▼"}
                    </Text>
                  </Pressable>

                  {showGwDropdown && (
                    <View
                      style={{
                        position: "absolute",
                        top: 62,
                        left: 0,
                        right: 0,
                        backgroundColor: "#0b2619",
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: GREEN,
                        maxHeight: 180,
                        zIndex: 99,
                        overflow: "hidden",
                      }}
                    >
                      <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled showsVerticalScrollIndicator>
                        {seasonGameweeks.map((gw) => {
                          const selected = scoringStartGw === gw.id;
                          return (
                            <Pressable
                              key={gw.id}
                              onPress={() => {
                                setScoringStartGw(gw.id);
                                setShowGwDropdown(false);
                              }}
                              style={{
                                padding: 10,
                                backgroundColor: selected ? "rgba(0, 217, 130, 0.2)" : "transparent",
                                borderBottomWidth: 1,
                                borderBottomColor: CARD_BORDER,
                              }}
                            >
                              <Text style={{ color: selected ? GREEN : "#fff", fontWeight: selected ? "900" : "600", fontSize: 12 }}>
                                Gameweek {gw.id}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  {leagueType === "classic" && (
                    <Text style={{ color: "#9db3a6", fontSize: 10, lineHeight: 14, marginTop: 6, fontStyle: "italic" }}>
                      The Cup is the league cup and starts in second half of the season dependent on the size of the league, and concludes at gameweek 38.
                    </Text>
                  )}
                </View>

                {/* Maximum players field (both classic and h2h) */}
                <View style={{ marginBottom: 10 }}>
                  <Text style={{ color: "#c5d8ce", fontSize: 11, fontWeight: "800", marginBottom: 4 }}>
                    Maximum players
                  </Text>
                  <TextInput
                    value={maxPlayers === "N/A" ? "" : maxPlayers}
                    onFocus={() => {
                      if (maxPlayers === "N/A") setMaxPlayers("");
                    }}
                    onBlur={() => {
                      if (maxPlayers.trim() === "") setMaxPlayers("N/A");
                    }}
                    onChangeText={(text) => {
                      const digits = text.replace(/[^0-9]/g, "");
                      setMaxPlayers(digits);
                    }}
                    placeholder="N/A"
                    placeholderTextColor="#7a9988"
                    keyboardType="numeric"
                    style={{
                      backgroundColor: "rgba(5, 20, 13, 0.95)",
                      color: "#fff",
                      borderRadius: 10,
                      padding: 10,
                      borderWidth: 1,
                      borderColor: CARD_BORDER,
                      fontSize: 12,
                    }}
                  />
                </View>

                {/* Knockout rounds (Head-to-Head league creation only) */}
                {leagueType === "h2h" && (
                  <View style={{ marginBottom: 10, position: "relative", zIndex: 8 }}>
                    <Text style={{ color: "#c5d8ce", fontSize: 11, fontWeight: "800", marginBottom: 4 }}>
                      Knockout rounds
                    </Text>
                    <Pressable
                      onPress={() => setShowKnockoutDropdown((visible) => !visible)}
                      style={{
                        backgroundColor: "rgba(5, 20, 13, 0.95)",
                        borderRadius: 10,
                        padding: 10,
                        borderWidth: 1,
                        borderColor: CARD_BORDER,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>
                        {knockoutRounds} {knockoutRounds === 1 ? "Round" : "Rounds"} ({knockoutRounds === 1 ? "Top 2" : knockoutRounds === 2 ? "Top 4" : "Top 8"} teams qualify)
                      </Text>
                      <Text style={{ color: "#9db3a6", fontSize: 12, fontWeight: "bold" }}>
                        {showKnockoutDropdown ? "▲" : "▼"}
                      </Text>
                    </Pressable>

                    {showKnockoutDropdown && (
                      <View
                        style={{
                          position: "absolute",
                          top: 62,
                          left: 0,
                          right: 0,
                          backgroundColor: "#0b2619",
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: GREEN,
                          zIndex: 99,
                          overflow: "hidden",
                        }}
                      >
                        {[
                          { rounds: 1, label: "1 Round (Top 2 teams · Final in GW38)" },
                          { rounds: 2, label: "2 Rounds (Top 4 teams · Semis & Final GW37-38)" },
                          { rounds: 3, label: "3 Rounds (Top 8 teams · Quarters to Final GW36-38)" },
                        ].map((item) => {
                          const selected = knockoutRounds === item.rounds;
                          return (
                            <Pressable
                              key={item.rounds}
                              onPress={() => {
                                setKnockoutRounds(item.rounds);
                                setShowKnockoutDropdown(false);
                              }}
                              style={{
                                padding: 10,
                                backgroundColor: selected ? "rgba(0, 217, 130, 0.2)" : "transparent",
                                borderBottomWidth: 1,
                                borderBottomColor: CARD_BORDER,
                              }}
                            >
                              <Text style={{ color: selected ? GREEN : "#fff", fontWeight: selected ? "900" : "600", fontSize: 12 }}>
                                {item.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}

                    <Text style={{ color: "#9db3a6", fontSize: 10, lineHeight: 14, marginTop: 6, fontStyle: "italic" }}>
                      Managers face off directly in knockout rounds ending in Gameweek 38. Highest GW score (minus transfer hits) wins and advances.
                    </Text>
                  </View>
                )}

                <Pressable
                  disabled={loading || !name.trim()}
                  onPress={() =>
                    onCreate(
                      name.trim(),
                      leagueType,
                      scoringStartGw,
                      leagueType === "h2h" ? knockoutRounds : undefined,
                      Number(maxPlayers) >= 2 ? Number(maxPlayers) : undefined,
                    )
                  }
                  style={{
                    backgroundColor: GREEN,
                    borderRadius: 10,
                    alignItems: "center",
                    padding: 10,
                    opacity: loading || !name.trim() ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: DARK_GREEN, fontWeight: "900", fontSize: 12 }}>Create League</Text>
                </Pressable>
              </View>
            )}

            {!!error && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  backgroundColor: "rgba(239, 68, 68, 0.12)",
                  borderWidth: 1,
                  borderColor: "rgba(239, 68, 68, 0.35)",
                  borderRadius: 12,
                  padding: 10,
                  marginBottom: 12,
                  gap: 8,
                }}
              >
                <AppSymbol
                  name={{ ios: "exclamationmark.triangle.fill", android: "warning", web: "warning" }}
                  color="#ff8080"
                  size={14}
                />
                <Text style={{ color: "#ff9d9d", fontSize: 12, fontWeight: "600", flex: 1, lineHeight: 16 }}>
                  {error}
                </Text>
              </View>
            )}

            {/* Leagues list, grouped as Classic / Head-to-Head / General */}
            {leagues.length === 0 ? (
              <Text style={{ color: "#9db3a6", marginTop: 8, fontSize: 12, textAlign: "center" }}>
                No leagues were returned for your FPL account.
              </Text>
            ) : (
              LEAGUE_SECTIONS.map((section) => {
                const sectionLeagues = leagues.filter(
                  (league) => leagueCategory(league) === section.category,
                );
                if (sectionLeagues.length === 0) return null;
                return (
                  <View key={section.category} style={{ marginTop: 14 }}>
                    <Text
                      accessibilityRole="header"
                      style={{ color: "#fff", fontSize: 13, fontWeight: "900", letterSpacing: -0.1 }}
                    >
                      {section.title}
                    </Text>
                    <Text style={{ color: "#9db3a6", fontSize: 10, marginTop: 1 }}>
                      {section.subtitle}
                    </Text>
                    {sectionLeagues.map((league) => (
                      <LeagueCard
                        key={`${league.kind}-${league.id}`}
                        league={league}
                        loading={
                          openingLeague?.id === league.id && openingLeague.kind === league.kind
                        }
                        onPress={openLeague}
                      />
                    ))}
                  </View>
                );
              })
            )}
          </>
        )}

        {selectedLeague && detailsReady && (
          <FadeIn key={`${selectedLeague.kind}-${selectedLeague.id}`} offsetX={24} offsetY={0}>
          <LeagueDetails
            // Remount per league so the Standings/Matches tab starts fresh.
            key={`${selectedLeague.kind}-${selectedLeague.id}`}
            league={selectedLeague}
            standings={standings}
            userStanding={userStanding}
            userEntryId={userEntryId}
            userTotalPoints={userTotalPoints}
            liveEventId={liveEventId}
            liveEventPoints={liveEventPoints}
            h2hMatches={h2hMatches}
            h2hEvent={h2hEvent}
            h2hLoading={h2hLoading}
            gameweeks={gameweeks}
            loading={loading}
            error={error}
            inviteCode={inviteCode}
            onBack={() => {
              setShowLeagueDetails(false);
              onCloseLeague();
            }}
            onPage={(page) => onSelectLeague(selectedLeague, page)}
            onGetInviteCode={() => onGetInviteCode(selectedLeague)}
            onSelectH2hEvent={(event) => onSelectH2hEvent(selectedLeague, event)}
            onViewMember={onViewMember}
          />
          </FadeIn>
        )}
      </ScrollView>

    </View>
  );
}
