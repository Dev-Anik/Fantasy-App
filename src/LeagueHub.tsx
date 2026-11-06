import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import type { ScrollViewInstance } from "react-native";
import type {
  FplLeague,
  Gameweek,
  LeagueStandings,
  LeagueType,
  MemberSquad,
} from "./fpl";
import { AppSymbol } from "./AppSymbol";
import { ManagerHistory } from "./ManagerHistory";

type Props = {
  leagues: FplLeague[];
  selectedLeague: FplLeague | null;
  standings: LeagueStandings | null;
  loading: boolean;
  error: string;
  gameweeks: Gameweek[];
  userEntryId?: number;
  onSelectLeague: (league: FplLeague, page?: number) => void;
  onJoin: (code: string) => void;
  onCreate: (name: string, type: LeagueType, startEvent?: number, knockoutRounds?: number) => void;
  inviteCode: string | null;
  memberSquad: MemberSquad | null;
  managerLoading: boolean;
  managerError: string;
  onGetInviteCode: (league: FplLeague) => void;
  onViewMember: (entry: number, event: number, teamName?: string, managerName?: string) => void;
};

const GREEN = "#00d982";
const DARK_GREEN = "#071b12";
const CARD_BG = "rgba(255, 255, 255, 0.08)";
const CARD_BORDER = "rgba(255, 255, 255, 0.12)";

export function LeagueHub({
  leagues,
  selectedLeague,
  standings,
  loading,
  error,
  gameweeks,
  userEntryId,
  onSelectLeague,
  onJoin,
  onCreate,
  inviteCode,
  memberSquad,
  managerLoading,
  managerError,
  onGetInviteCode,
  onViewMember,
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
  const [selectedMember, setSelectedMember] =
    useState<LeagueStandings["standings"]["results"][number] | null>(null);
  const [selectedEvent, setSelectedEvent] = useState(1);
  const [showLeagueDetails, setShowLeagueDetails] = useState(false);
  const scrollViewRef = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    if (standings) {
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: 0,
          animated: true,
        });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [standings]);

  const userRow =
    standings?.standings?.results?.find((row) => row.entry === userEntryId) ??
    (selectedLeague
      ? {
          entry: userEntryId ?? 0,
          entry_name: "Your Team",
          player_name: "",
          rank: selectedLeague.entry_rank ?? 0,
          last_rank: selectedLeague.entry_last_rank,
          total: 0,
          event_total: 0,
        }
      : undefined);

  return (
    <View style={{ flex: 1, backgroundColor: DARK_GREEN }}>
      <Image
        source={require("../assets/images/background-texture.png")}
        contentFit="cover"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        }}
      />
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
      >
        {!showLeagueDetails && (
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
                  <Text style={{ fontSize: 13 }}>🔗</Text>
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
                  onPress={() => {
                    onJoin(code.trim());
                    setCode("");
                    setActionModal("none");
                  }}
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
                  onPress={() => {
                    onCreate(name.trim(), leagueType, scoringStartGw, leagueType === "h2h" ? knockoutRounds : undefined);
                    setName("");
                    setActionModal("none");
                  }}
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

            {/* Leagues List Grouped by Classics and Head to Head */}
            {leagues.length === 0 ? (
              <Text style={{ color: "#9db3a6", marginTop: 8, fontSize: 12, textAlign: "center" }}>
                No leagues were returned for your FPL account.
              </Text>
            ) : (
              <>
                {leagues.some((l) => l.kind === "classic") && (
                  <View style={{ marginTop: 12, marginBottom: 4 }}>
                    <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900", letterSpacing: -0.1 }}>
                      Classics
                    </Text>
                  </View>
                )}
                {leagues
                  .filter((l) => l.kind === "classic")
                  .map((league) => (
                    <Pressable
                      key={`${league.kind}-${league.id}`}
                      onPress={() => {
                        setSelectedMember(null);
                        setShowLeagueDetails(true);
                        onSelectLeague(league);
                      }}
                      style={{
                        backgroundColor: CARD_BG,
                        borderRadius: 12,
                        padding: 10,
                        marginTop: 6,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderWidth: 1,
                        borderColor: CARD_BORDER,
                      }}
                    >
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }} numberOfLines={1}>
                          {league.name}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        {(() => {
                          const currentRank = league.entry_rank ?? 0;
                          const lastRank = league.entry_last_rank;
                          const hasHistory = lastRank !== null && lastRank !== undefined && lastRank > 0;
                          const isUp = hasHistory ? currentRank <= lastRank : true;
                          return (
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                backgroundColor: "rgba(0, 0, 0, 0.25)",
                                paddingHorizontal: 6,
                                paddingVertical: 3,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: CARD_BORDER,
                                gap: 4,
                              }}
                            >
                              {hasHistory ? (
                                <>
                                  <Image
                                    source={isUp ? require("../assets/images/up.png") : require("../assets/images/down.png")}
                                    style={{ width: 12, height: 12 }}
                                    contentFit="contain"
                                  />
                                  <Text style={{ color: "#c5d8ce", fontWeight: "900", fontSize: 11 }}>
                                    Rank {league.entry_rank ?? "0"}
                                  </Text>
                                </>
                              ) : (
                                <Text style={{ color: "#c5d8ce", fontWeight: "900", fontSize: 11 }}>
                                  N/A
                                </Text>
                              )}
                            </View>
                          );
                        })()}
                        <Text style={{ color: "#9db3a6", fontSize: 14, fontWeight: "bold" }}>›</Text>
                      </View>
                    </Pressable>
                  ))}

                {leagues.some((l) => l.kind === "h2h") && (
                  <View style={{ marginTop: 16, marginBottom: 4 }}>
                    <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900", letterSpacing: -0.1 }}>
                      Head to Head
                    </Text>
                  </View>
                )}
                {leagues
                  .filter((l) => l.kind === "h2h")
                  .map((league) => (
                    <Pressable
                      key={`${league.kind}-${league.id}`}
                      onPress={() => {
                        setSelectedMember(null);
                        setShowLeagueDetails(true);
                        onSelectLeague(league);
                      }}
                      style={{
                        backgroundColor: CARD_BG,
                        borderRadius: 12,
                        padding: 10,
                        marginTop: 6,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderWidth: 1,
                        borderColor: CARD_BORDER,
                      }}
                    >
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }} numberOfLines={1}>
                          {league.name}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        {(() => {
                          const currentRank = league.entry_rank ?? 0;
                          const lastRank = league.entry_last_rank;
                          const hasHistory = lastRank !== null && lastRank !== undefined && lastRank > 0;
                          const isUp = hasHistory ? currentRank <= lastRank : true;
                          return (
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                backgroundColor: "rgba(0, 0, 0, 0.25)",
                                paddingHorizontal: 6,
                                paddingVertical: 3,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: CARD_BORDER,
                                gap: 4,
                              }}
                            >
                              {hasHistory ? (
                                <>
                                  <Image
                                    source={isUp ? require("../assets/images/up.png") : require("../assets/images/down.png")}
                                    style={{ width: 12, height: 12 }}
                                    contentFit="contain"
                                  />
                                  <Text style={{ color: "#c5d8ce", fontWeight: "900", fontSize: 11 }}>
                                    Rank {league.entry_rank ?? "0"}
                                  </Text>
                                </>
                              ) : (
                                <Text style={{ color: "#c5d8ce", fontWeight: "900", fontSize: 11 }}>
                                  N/A
                                </Text>
                              )}
                            </View>
                          );
                        })()}
                        <Text style={{ color: "#9db3a6", fontSize: 14, fontWeight: "bold" }}>›</Text>
                      </View>
                    </Pressable>
                  ))}
              </>
            )}
          </>
        )}

        {selectedLeague && showLeagueDetails && (
          <View style={{ marginTop: 4 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to your leagues"
              onPress={() => {
                setSelectedMember(null);
                setShowLeagueDetails(false);
              }}
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
              {standings?.league?.name ?? selectedLeague.name}
            </Text>

            {/* User Position & Team Info Summary Card at Top */}
            {userRow && (
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
                  justifyContent: "space-between",
                }}
              >
                {/* Left: Your Rank */}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#9db3a6", fontSize: 11, fontWeight: "800", marginBottom: 2 }}>
                    Your Rank
                  </Text>
                  <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: -0.5 }}>
                    #{userRow.rank}
                  </Text>
                </View>

                {/* Vertical Divider */}
                <View
                  style={{
                    width: 1,
                    height: 28,
                    backgroundColor: "rgba(255, 255, 255, 0.15)",
                    marginHorizontal: 16,
                  }}
                />

                {/* Right: Total Points */}
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <Text style={{ color: "#9db3a6", fontSize: 11, fontWeight: "800", marginBottom: 2 }}>
                    Total Points
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: -0.5 }}>
                      {userRow.total}
                    </Text>
                    {(() => {
                      const lastRank = userRow.last_rank;
                      const hasHistory = lastRank !== null && lastRank !== undefined && lastRank > 0;
                      const isUp = hasHistory ? userRow.rank <= lastRank : true;
                      const eventTotal = userRow.event_total ?? 0;
                      return (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                          {hasHistory && (
                            <Image
                              source={isUp ? require("../assets/images/up.png") : require("../assets/images/down.png")}
                              style={{ width: 10, height: 10 }}
                              contentFit="contain"
                            />
                          )}
                          <Text style={{ color: GREEN, fontWeight: "900", fontSize: 12 }}>
                            {eventTotal >= 0 ? `+${eventTotal}` : eventTotal}
                          </Text>
                        </View>
                      );
                    })()}
                  </View>
                </View>
              </View>
            )}

            {selectedLeague.entry_can_invite && (
              <View style={{ marginBottom: 10 }}>
                {inviteCode ? (
                  <Text style={{ color: GREEN, fontWeight: "800", fontSize: 12 }}>
                    Invite code: {inviteCode}
                  </Text>
                ) : (
                  <Pressable
                    disabled={loading}
                    onPress={() => onGetInviteCode(selectedLeague)}
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
                    <Text style={{ color: GREEN, fontWeight: "900", fontSize: 11 }}>
                      Show invite code
                    </Text>
                  </Pressable>
                )}
              </View>
            )}

            {loading && (
              <ActivityIndicator color={GREEN} style={{ marginTop: 12 }} />
            )}
            {!!error && (
              <Text style={{ color: "#ffb4b4", marginTop: 10, fontSize: 12 }}>{error}</Text>
            )}

            <View>
              {standings?.standings?.results && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ width: 55, color: "#9db3a6", fontSize: 10, fontWeight: "800", textTransform: "uppercase" }}>
                    Rank
                  </Text>
                  <Text style={{ flex: 1, color: "#9db3a6", fontSize: 10, fontWeight: "800", textTransform: "uppercase", paddingLeft: 8 }}>
                    Team
                  </Text>
                  <Text style={{ width: 45, textAlign: "right", color: "#9db3a6", fontSize: 10, fontWeight: "800", textTransform: "uppercase" }}>
                    GWP
                  </Text>
                  <Text style={{ width: 60, textAlign: "right", color: "#9db3a6", fontSize: 10, fontWeight: "800", textTransform: "uppercase" }}>
                    Total
                  </Text>
                </View>
              )}

              {standings?.standings?.results?.map((row) => {
                const isUser = row.entry === userEntryId;
                const lastRank = row.last_rank;
                const hasHistory = lastRank !== null && lastRank !== undefined && lastRank > 0;
                const isUp = hasHistory ? row.rank < lastRank : false;
                const isDown = hasHistory ? row.rank > lastRank : false;

                return (
                  <Pressable
                    key={row.entry}
                    onPress={() => {
                      const validGw = gameweeks.filter((gw) => gw.finished || gw.isCurrent);
                      const event = validGw[validGw.length - 1]?.id ?? 1;
                      onViewMember(row.entry, event, row.entry_name || row.player_name, row.player_name);
                    }}
                    style={{
                      backgroundColor: isUser ? "rgba(0, 217, 130, 0.18)" : CARD_BG,
                      borderRadius: 10,
                      padding: 10,
                      marginTop: 6,
                      flexDirection: "row",
                      alignItems: "center",
                      borderWidth: isUser ? 1.5 : 1,
                      borderColor: isUser ? GREEN : CARD_BORDER,
                    }}
                  >
                    {/* Rank Column */}
                    <View style={{ width: 55, flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900" }}>
                        {row.rank}
                      </Text>
                      {isUp && (
                        <Image
                          source={require("../assets/images/up.png")}
                          style={{ width: 10, height: 10 }}
                          contentFit="contain"
                        />
                      )}
                      {isDown && (
                        <Image
                          source={require("../assets/images/down.png")}
                          style={{ width: 10, height: 10 }}
                          contentFit="contain"
                        />
                      )}
                    </View>

                    {/* Team Column */}
                    <View style={{ flex: 1, marginRight: 8, paddingLeft: 8 }}>
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900" }} numberOfLines={1}>
                        {row.entry_name || row.player_name}
                      </Text>
                      {row.player_name && (
                        <Text style={{ color: "#9db3a6", fontSize: 10, fontWeight: "400", marginTop: 1 }} numberOfLines={1}>
                          {row.player_name}
                        </Text>
                      )}
                    </View>

                    {/* GWP Column */}
                    <Text style={{ width: 45, textAlign: "right", color: "#c5d8ce", fontSize: 11, fontWeight: "700" }}>
                      {row.event_total}
                    </Text>

                    {/* Total Column */}
                    <View style={{ width: 60, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 2 }}>
                      <Text style={{ color: isUser ? GREEN : "#fff", fontSize: 12, fontWeight: "900" }}>
                        {row.total}
                      </Text>
                      <Text style={{ color: "#9db3a6", fontSize: 12, fontWeight: "bold" }}>›</Text>
                    </View>
                  </Pressable>
                );
              })}

              {standings && (
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
                    onPress={() =>
                      onSelectLeague(
                        selectedLeague,
                        standings.standings.page - 1,
                      )
                    }
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
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11 }}>
                      Previous
                    </Text>
                  </Pressable>
                  {loading ? (
                    <ActivityIndicator
                      accessibilityLabel="Loading league standings"
                      color={GREEN}
                      size="small"
                    />
                  ) : (
                    <Text style={{ color: "#9db3a6", fontSize: 11, fontWeight: "600" }}>
                      Page {standings.standings.page}
                    </Text>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Next page of league standings"
                    disabled={loading || !standings.standings.has_next}
                    onPress={() =>
                      onSelectLeague(
                        selectedLeague,
                        standings.standings.page + 1,
                      )
                    }
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
          </View>
        )}
      </ScrollView>

    </View>
  );
}
