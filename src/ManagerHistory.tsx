import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import type { Gameweek, MemberSquad, Row } from "./fpl";
import { Pitch } from "./Pitch";

type Props = {
  title: string;
  managerName: string;
  entry: number;
  gameweeks: Gameweek[];
  selectedEvent: number;
  data: MemberSquad | null;
  loading: boolean;
  error: string;
  showGameweekSelector?: boolean;
  showBlankSquadOnError?: boolean;
  onBack: () => void;
  onSelectEvent: (event: number) => void;
};

const PURPLE = "#37003c";
const CHIP_LABELS: Record<string, string> = {
  wildcard: "Wildcard",
  freehit: "Free Hit",
  bboost: "Bench Boost",
  "3xc": "Triple Captain",
};

export function ManagerHistory({
  title,
  managerName,
  entry,
  gameweeks,
  selectedEvent,
  data,
  loading,
  error,
  showGameweekSelector = true,
  showBlankSquadOnError = false,
  onBack,
  onSelectEvent,
}: Props) {
  const currentData =
    data?.entry === entry && data.event === selectedEvent ? data : null;
  const picks: Row[] =
    currentData?.picks.map((pick) => ({
      id: pick.id,
      pos: pick.position,
      name: pick.name,
      team: pick.team,
      teamId: 0,
      type: pick.elementType,
      cap: pick.captain,
      vice: pick.viceCaptain,
      sell: 0,
      buy: 0,
      displayPoints: pick.points,
      formMood: pick.formMood,
    })) ?? [];
  const showBlankSquad =
    showBlankSquadOnError &&
    !loading &&
    error.includes("has not published") &&
    !currentData;
  const blankPicks: Row[] = Array.from({ length: 15 }, (_, index) => {
    const position = index + 1;
    const type =
      position === 1 || position === 12
        ? 1
        : position <= 5 || position === 13
          ? 2
          : position <= 8 || position === 14
            ? 3
            : 4;
    return {
      id: -position,
      pos: position,
      name: "",
      team: "",
      teamId: 0,
      type,
      cap: false,
      vice: false,
      sell: 0,
      buy: 0,
    };
  });

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f4f8" }}>
      <View
        style={{
          backgroundColor: PURPLE,
          paddingHorizontal: 16,
          paddingVertical: 16,
          flexDirection: "row",
          alignItems: "center",
          elevation: 3,
        }}
      >
        <Pressable onPress={onBack} hitSlop={10}>
          <Text style={{ color: "#fff", fontSize: 16 }}>‹ Back</Text>
        </Pressable>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text
            numberOfLines={1}
            style={{ color: "#fff", fontSize: 17, fontWeight: "800" }}
          >
            {title} · GW {selectedEvent}
          </Text>
          {!!managerName && (
            <Text numberOfLines={1} style={{ color: "#cdb9d1", marginTop: 2 }}>
              {managerName}
            </Text>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {showGameweekSelector && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12 }}
          >
            {gameweeks.map((gameweek) => (
              <Pressable
                key={gameweek.id}
                onPress={() => onSelectEvent(gameweek.id)}
                style={{
                  backgroundColor:
                    gameweek.id === selectedEvent ? PURPLE : "#fff",
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  marginRight: 8,
                  borderWidth: gameweek.id === selectedEvent ? 0 : 1,
                  borderColor: "#e6e0e9",
                }}
              >
                <Text
                  style={{
                    color: gameweek.id === selectedEvent ? "#fff" : PURPLE,
                    fontWeight: "700",
                  }}
                >
                  GW {gameweek.id}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {!!error && !showBlankSquad && (
          <Text
            style={{
              color: "#b00020",
              marginHorizontal: 16,
              marginBottom: 12,
            }}
          >
            {error}
          </Text>
        )}

        {loading && !currentData && (
          <ActivityIndicator color={PURPLE} style={{ marginTop: 28 }} />
        )}

        {(currentData || showBlankSquad) && (
          <>
            {currentData && (
              <View
                style={{
                  flexDirection: "row",
                  marginHorizontal: 12,
                  marginTop: 12,
                }}
              >
                {[
                  {
                    label: "GW points",
                    value: currentData.history.points,
                  },
                  {
                    label: "Total points",
                    value: currentData.history.totalPoints,
                  },
                ].map((stat) => (
                  <View
                    key={stat.label}
                    style={{
                      flex: 1,
                      marginHorizontal: 4,
                      padding: 12,
                      borderRadius: 14,
                      backgroundColor: "#fff",
                    }}
                  >
                    <Text style={{ color: "#756d78", fontSize: 12 }}>
                      {stat.label}
                    </Text>
                    <Text
                      style={{
                        color: PURPLE,
                        fontSize: 20,
                        fontWeight: "800",
                        marginTop: 2,
                      }}
                    >
                      {stat.value ?? "—"}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            {currentData?.chip && (
              <View
                style={{
                  alignSelf: "flex-start",
                  marginHorizontal: 16,
                  marginTop: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 16,
                  backgroundColor: "#e7f8ef",
                }}
              >
                <Text style={{ color: PURPLE, fontWeight: "700" }}>
                  {CHIP_LABELS[currentData.chip] ?? currentData.chip} played
                </Text>
              </View>
            )}
            <Text
              style={{
                color: PURPLE,
                fontSize: 18,
                fontWeight: "800",
                marginHorizontal: 16,
                marginTop: 12,
                marginBottom: 8,
              }}
            >
              Squad
            </Text>
            {currentData ? (
              <Pitch picks={picks} selectedPos={null} />
            ) : showBlankSquad ? (
              <Pitch picks={blankPicks} selectedPos={null} />
            ) : (
              <Text style={{ color: "#666", marginHorizontal: 16 }}>
                No squad details are available for this gameweek.
              </Text>
            )}
          </>
        )}

        {!loading && !error && !currentData && !showBlankSquad && (
          <Text style={{ color: "#666", marginHorizontal: 16, marginTop: 12 }}>
            Select a gameweek to view its squad and performance.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
