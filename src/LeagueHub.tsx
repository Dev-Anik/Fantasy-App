import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import type { ScrollViewInstance } from "react-native";
import type {
  FplLeague,
  Gameweek,
  LeagueStandings,
  LeagueType,
  MemberSquad,
} from "./fpl";
import { ManagerHistory } from "./ManagerHistory";

type Props = {
  leagues: FplLeague[];
  selectedLeague: FplLeague | null;
  standings: LeagueStandings | null;
  loading: boolean;
  error: string;
  gameweeks: Gameweek[];
  onSelectLeague: (league: FplLeague, page?: number) => void;
  onJoin: (code: string) => void;
  onCreate: (name: string, type: LeagueType) => void;
  inviteCode: string | null;
  memberSquad: MemberSquad | null;
  managerLoading: boolean;
  managerError: string;
  onGetInviteCode: (league: FplLeague) => void;
  onViewMember: (entry: number, event: number) => void;
};

const PURPLE = "#37003c";
const GREEN = "#00d982";
const DARK_GREEN = "#073b25";
const CARD_GREEN = "#104a31";

export function LeagueHub({
  leagues,
  selectedLeague,
  standings,
  loading,
  error,
  gameweeks,
  inviteCode,
  memberSquad,
  managerLoading,
  managerError,
  onSelectLeague,
  onJoin,
  onCreate,
  onGetInviteCode,
  onViewMember,
}: Props) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [leagueType, setLeagueType] = useState<LeagueType>("classic");
  const [selectedMember, setSelectedMember] =
    useState<LeagueStandings["standings"]["results"][number] | null>(null);
  const [selectedEvent, setSelectedEvent] = useState(1);
  const [showLeagueDetails, setShowLeagueDetails] = useState(false);
  const scrollViewRef = useRef<ScrollViewInstance>(null);
  const standingsTop = useRef(0);
  const wasLoading = useRef(loading);

  useEffect(() => {
    if (wasLoading.current && !loading && standings) {
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({
          y: standingsTop.current,
          animated: true,
        });
      });
    }
    wasLoading.current = loading;
  }, [loading, standings]);

  const typeButton = (type: LeagueType) => (
    <Pressable
      key={type}
      onPress={() => setLeagueType(type)}
      style={{
        flex: 1,
        alignItems: "center",
        padding: 10,
        borderRadius: 12,
        backgroundColor: leagueType === type ? PURPLE : "#e6dfeb",
      }}
    >
      <Text
        style={{
          color: leagueType === type ? "#fff" : PURPLE,
          fontWeight: "700",
        }}
      >
        {type === "classic" ? "Classic" : "Head-to-Head"}
      </Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: DARK_GREEN }}>
    <ScrollView
      ref={scrollViewRef}
      key={showLeagueDetails ? "league-details" : "league-list"}
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 12, paddingBottom: 28 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ display: showLeagueDetails ? "none" : "flex" }}>
      <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800" }}>
        Your leagues
      </Text>

      {leagues.length === 0 ? (
        <Text style={{ color: "#c5d8ce", marginTop: 10, fontSize: 13 }}>
          No leagues were returned for your FPL account.
        </Text>
      ) : (
        leagues.map((league) => (
          <Pressable
            key={`${league.kind}-${league.id}`}
            onPress={() => {
              setSelectedMember(null);
              setShowLeagueDetails(true);
              onSelectLeague(league);
            }}
            style={{
              backgroundColor: CARD_GREEN,
              borderRadius: 13,
              padding: 10,
              marginTop: 8,
              borderWidth: selectedLeague?.id === league.id ? 2 : 1,
              borderColor: selectedLeague?.id === league.id ? GREEN : "#286344",
              elevation: selectedLeague?.id === league.id ? 2 : 0,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
              {league.name}
            </Text>
            <Text style={{ color: "#c5d8ce", marginTop: 3, fontSize: 12 }}>
              {league.kind === "classic" ? "Classic" : "Head-to-Head"}
              {" · "}Rank {league.entry_rank ?? "—"}
            </Text>
          </Pressable>
        ))
      )}
      </View>

      {selectedLeague && showLeagueDetails && (
        <View style={{ marginTop: 18 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to your leagues"
            onPress={() => {
              setSelectedMember(null);
              setShowLeagueDetails(false);
            }}
            style={{ alignSelf: "flex-start", paddingVertical: 6, paddingRight: 12 }}
          >
            <Text style={{ color: GREEN, fontSize: 14, fontWeight: "700" }}>
              ‹ Your leagues
            </Text>
          </Pressable>
          <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 8 }}>
            {standings?.league?.name ?? selectedLeague.name}
          </Text>

          {selectedLeague.entry_can_invite && (
            <View style={{ marginTop: 10 }}>
              {inviteCode ? (
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                  Invite code: {inviteCode}
                </Text>
              ) : (
                <Pressable
                  disabled={loading}
                  onPress={() => onGetInviteCode(selectedLeague)}
                  style={{
                    backgroundColor: PURPLE,
                    borderRadius: 18,
                    padding: 10,
                    alignSelf: "flex-start",
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700" }}>
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
            <Text style={{ color: "#ffb4b4", marginTop: 12 }}>{error}</Text>
          )}

          <View
            onLayout={(event) => {
              standingsTop.current = event.nativeEvent.layout.y;
            }}
          >
          {standings?.standings?.results?.map((row) => (
            <Pressable
              key={row.entry}
              onPress={() => {
                setSelectedMember(row);
                const event =
                  gameweeks[gameweeks.length - 1]?.id ??
                  1;
                setSelectedEvent(event);
                onViewMember(row.entry, event);
              }}
              style={{
                backgroundColor: CARD_GREEN,
                borderRadius: 12,
                padding: 10,
                marginTop: 7,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                borderWidth: 1,
                borderColor: "#286344",
              }}
            >
              <Text style={{ color: "#fff", flex: 1, fontSize: 13 }}>
                {row.rank}. {row.entry_name || row.player_name}
              </Text>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>
                {row.total} pts · View squad
              </Text>
            </Pressable>
          ))}

          {standings && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 14,
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
                  backgroundColor: CARD_GREEN,
                  borderRadius: 18,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  opacity: loading || standings.standings.page <= 1 ? 0.45 : 1,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>
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
                <Text style={{ color: "#c5d8ce", fontSize: 12 }}>
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
                  backgroundColor: CARD_GREEN,
                  borderRadius: 18,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  opacity: loading || !standings.standings.has_next ? 0.45 : 1,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Next</Text>
              </Pressable>
            </View>
          )}
          </View>

        </View>
      )}

      <View style={{ display: showLeagueDetails ? "none" : "flex" }}>
      <Text
        style={{
          color: "#fff",
          fontSize: 16,
          fontWeight: "800",
          marginTop: 20,
        }}
      >
        Join a league
      </Text>
      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder="Enter the FPL invite code"
        placeholderTextColor="#c5d8ce"
        autoCapitalize="none"
        style={{
          backgroundColor: CARD_GREEN,
          color: "#fff",
          borderRadius: 12,
          padding: 10,
          marginTop: 8,
          borderWidth: 1,
          borderColor: "#286344",
        }}
      />
      <Pressable
        disabled={loading || !code.trim()}
        onPress={() => onJoin(code.trim())}
        style={{
          backgroundColor: PURPLE,
          borderRadius: 22,
          alignItems: "center",
          padding: 12,
          marginTop: 10,
          opacity: loading || !code.trim() ? 0.5 : 1,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "800" }}>Join with code</Text>
      </Pressable>

      <Text
        style={{
          color: "#fff",
          fontSize: 16,
          fontWeight: "800",
          marginTop: 20,
        }}
      >
        Create a league
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="League name"
        placeholderTextColor="#c5d8ce"
        maxLength={30}
        style={{
          backgroundColor: CARD_GREEN,
          color: "#fff",
          borderRadius: 12,
          padding: 10,
          marginTop: 8,
          borderWidth: 1,
          borderColor: "#286344",
        }}
      />
      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        {typeButton("classic")}
        {typeButton("h2h")}
      </View>
      <Pressable
        disabled={loading || !name.trim()}
        onPress={() => onCreate(name.trim(), leagueType)}
        style={{
          backgroundColor: GREEN,
          borderRadius: 22,
          alignItems: "center",
          padding: 12,
          marginTop: 10,
          opacity: loading || !name.trim() ? 0.5 : 1,
        }}
      >
        <Text style={{ color: PURPLE, fontWeight: "800" }}>Create league</Text>
      </Pressable>

      {loading && !selectedLeague && (
        <ActivityIndicator color={PURPLE} style={{ marginTop: 14 }} />
      )}
      {!!error && (
        <Text style={{ color: "#b00020", marginTop: 14 }}>{error}</Text>
      )}
      </View>
    </ScrollView>
    {selectedMember && (
      <View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 2,
          elevation: 2,
          backgroundColor: DARK_GREEN,
        }}
      >
        <ManagerHistory
          title={selectedMember.entry_name || "Squad history"}
          managerName={selectedMember.player_name}
          entry={selectedMember.entry}
          gameweeks={gameweeks}
          selectedEvent={selectedEvent}
          data={memberSquad}
          loading={managerLoading}
          error={managerError}
          onBack={() => setSelectedMember(null)}
          onSelectEvent={(event) => {
            setSelectedEvent(event);
            onViewMember(selectedMember.entry, event);
          }}
        />
      </View>
    )}
    </View>
  );
}
