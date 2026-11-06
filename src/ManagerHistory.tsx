import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Gameweek, MemberSquad, Row } from "./fpl";
import { AppSymbol } from "./AppSymbol";
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

const GREEN = "#00d982";
const DARK_GREEN = "#071b12";
const CARD_BG = "rgba(255, 255, 255, 0.08)";
const CARD_BORDER = "rgba(255, 255, 255, 0.12)";

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
  const insets = useSafeAreaInsets();
  const currentData =
    data?.entry === entry && data.event === selectedEvent ? data : null;
  const picks: Row[] =
    currentData?.picks.map((pick) => {
      const mult =
        typeof pick.multiplier === "number" && pick.multiplier > 0
          ? pick.multiplier
          : pick.captain
            ? currentData.chip === "3xc"
              ? 3
              : 2
            : 1;
      const rawPoints = pick.points ?? 0;
      const finalPoints = rawPoints * mult;

      return {
        id: pick.id,
        pos: pick.position,
        name: pick.name,
        team: pick.team,
        teamId: 0,
        type: pick.elementType,
        cap: pick.captain,
        vice: pick.viceCaptain,
        multiplier: mult,
        sell: 0,
        buy: 0,
        displayPoints: finalPoints,
        formMood: pick.formMood,
      };
    }) ?? [];
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

      {/* Top Header Section */}
      <View
        style={{
          paddingTop: insets.top ? insets.top + 6 : 12,
          paddingHorizontal: 12,
          paddingBottom: 6,
          zIndex: 2,
        }}
      >
        {/* Row 1: Back Button & GW Selector Badge */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <Pressable
            onPress={onBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(0, 217, 130, 0.15)",
              borderWidth: 1,
              borderColor: "rgba(0, 217, 130, 0.4)",
              borderRadius: 16,
              paddingHorizontal: 14,
              height: 34,
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
              Back
            </Text>
          </Pressable>

          <View
            style={{
              borderRadius: 16,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.18)",
              backgroundColor: "rgba(14, 38, 26, 0.9)",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>
              GW {selectedEvent}
            </Text>
          </View>
        </View>

        {/* Row 2: Team Name with Green Accent Bar & Manager Name */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: 3,
              height: 14,
              backgroundColor: GREEN,
              borderRadius: 2,
              marginRight: 6,
            }}
          />
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{ color: "#fff", fontSize: 13, fontWeight: "900" }}
            >
              {title}
            </Text>
            {!!managerName && (
              <Text
                numberOfLines={1}
                style={{ color: "#9db3a6", fontSize: 10, marginTop: 1 }}
              >
                {managerName}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Gameweek Selector Horizontal Bar */}
      {showGameweekSelector && (
        <View style={{ height: 32, marginBottom: 4 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12 }}
          >
            {gameweeks
              .filter((gw) => gw.finished || gw.isCurrent)
              .map((gameweek) => {
                const isSelected = gameweek.id === selectedEvent;
                return (
                  <Pressable
                    key={gameweek.id}
                    onPress={() => onSelectEvent(gameweek.id)}
                    style={{
                      backgroundColor: isSelected ? GREEN : CARD_BG,
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      height: 28,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 6,
                      borderWidth: 1,
                      borderColor: isSelected ? GREEN : CARD_BORDER,
                    }}
                  >
                    <Text
                      style={{
                        color: isSelected ? DARK_GREEN : "#fff",
                        fontWeight: isSelected ? "900" : "600",
                        fontSize: 11,
                        lineHeight: 14,
                        textAlign: "center",
                        textAlignVertical: "center",
                        includeFontPadding: false,
                      }}
                    >
                      GW {gameweek.id}
                    </Text>
                  </Pressable>
                );
              })}
          </ScrollView>
        </View>
      )}

      {/* Main Pitch View with Top-Right Points Overlay or Empty State */}
      <View
        style={{
          flex: 1,
          width: "100%",
          paddingBottom: insets.bottom + 62,
          justifyContent: !loading && !currentData && !showBlankSquad ? "center" : "flex-start",
          position: "relative",
        }}
      >
        {/* Top Right: Gameweek Points Only Badge (No Text) */}
        {(currentData || showBlankSquad) && (
          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              zIndex: 10,
            }}
          >
            <View
              style={{
                borderRadius: 14,
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderWidth: 1,
                borderColor: GREEN,
                backgroundColor: "rgba(14, 38, 26, 0.9)",
                elevation: 5,
              }}
            >
              <Text
                style={{
                  color: (currentData?.history.points ?? 0) < 0 ? "#ff526f" : "#ffd400",
                  fontSize: 14,
                  fontWeight: "900",
                }}
              >
                {currentData?.history.points ?? "—"}
              </Text>
            </View>
          </View>
        )}

        {/* Top Left: Chip Badge if Played */}
        {currentData?.chip && (
          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              zIndex: 10,
            }}
          >
            <View
              style={{
                backgroundColor: "rgba(0, 217, 130, 0.15)",
                borderRadius: 12,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderWidth: 1,
                borderColor: GREEN,
              }}
            >
              <Text style={{ color: GREEN, fontWeight: "800", fontSize: 10 }}>
                {CHIP_LABELS[currentData.chip] ?? currentData.chip}
              </Text>
            </View>
          </View>
        )}

        {loading && !currentData && (
          <ActivityIndicator color={GREEN} style={{ marginTop: 28 }} />
        )}

        {currentData ? (
          <Pitch picks={picks} selectedGw={selectedEvent} selectedPos={null} compactAvatar={true} />
        ) : showBlankSquad ? (
          <Pitch picks={blankPicks} selectedGw={selectedEvent} selectedPos={null} compactAvatar={true} />
        ) : !loading ? (
          <View style={{ alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
            <Text
              style={{
                color: "#9db3a6",
                fontSize: 14,
                fontWeight: "600",
                textAlign: "center",
                lineHeight: 20,
              }}
            >
              No past gameweek history available.
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

