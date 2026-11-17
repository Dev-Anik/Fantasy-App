import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Gameweek, MemberSquad, PlayerFixture, Row } from "./fpl";
import { AppSymbol } from "./AppSymbol";
import { GameweekPicker } from "./GameweekPicker";
import { computeLive } from "./live";
import { Pitch } from "./Pitch";
import { PointsBadge } from "./PointsBadge";

type Props = {
  title: string;
  managerName: string;
  entry: number;
  gameweeks: Gameweek[];
  selectedEvent: number;
  data: MemberSquad | null;
  loading: boolean;
  error: string;
  showBlankSquadOnError?: boolean;
  fixturesByTeam?: Record<number, PlayerFixture[]>;
  onBack: () => void;
  onSelectEvent: (event: number) => void;
};

const GREEN = "#00d982";
const DARK_GREEN = "#071b12";

// Small status lines under the points badge.
const STATUS_TEXT = {
  color: "#d7e6dd",
  fontSize: 10,
  fontWeight: "800" as const,
  backgroundColor: "rgba(4, 16, 10, 0.88)",
  borderRadius: 8,
  paddingHorizontal: 7,
  paddingVertical: 2,
  overflow: "hidden" as const,
};

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
  showBlankSquadOnError = false,
  fixturesByTeam,
  onBack,
  onSelectEvent,
}: Props) {
  const insets = useSafeAreaInsets();
  const [pickerOpen, setPickerOpen] = useState(false);
  const ownData = data?.entry === entry ? data : null;
  // While another gameweek loads, keep the previous one on screen (dimmed)
  // instead of blanking the pitch and popping the new one in.
  const stale = !!ownData && ownData.event !== selectedEvent;
  const currentData = ownData && (!stale || loading) ? ownData : null;
  const shownEvent = currentData?.event ?? selectedEvent;
  const selectedGwData = gameweeks.find((gw) => gw.id === shownEvent);
  const isLive = Boolean(selectedGwData?.isCurrent && !selectedGwData.finished);
  // Provisional bonus, projected auto-subs and the armband, as FPL will
  // settle them. For a finished gameweek these match what FPL applied.
  const live = currentData
    ? computeLive(currentData.picks, currentData.fixtures ?? [], currentData.chip)
    : null;
  const picks: Row[] =
    live?.picks.map((pick) => {
      // Bench players show their own points; only counted ones are multiplied.
      const shownMultiplier = Math.max(1, pick.effectiveMultiplier);
      return {
        id: pick.id,
        pos: pick.position,
        name: pick.name,
        team: pick.team,
        teamId: pick.teamId,
        type: pick.elementType,
        cap: pick.captain || !!pick.actingCaptain,
        vice: pick.viceCaptain && !pick.actingCaptain,
        multiplier: pick.effectiveMultiplier,
        minutes: pick.minutes,
        sell: 0,
        buy: 0,
        displayPoints: pick.livePoints * shownMultiplier,
        formMood: pick.formMood,
        fixtures: fixturesByTeam?.[pick.teamId] ?? [],
        autoSub: pick.autoSub,
        provisionalBonus: pick.provisionalBonus,
      };
    }) ?? [];
  // For finished gameweeks FPL's own figure is authoritative; while one is in
  // play its total lags, so use the live calculation.
  const totalPts =
    selectedGwData?.finished && currentData?.history.points != null
      ? currentData.history.points
      : (live?.total ?? 0);
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

          <Pressable
            onPress={() => setPickerOpen(true)}
            disabled={gameweeks.length === 0}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Gameweek ${selectedEvent}. Change gameweek`}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              height: 34,
              borderRadius: 17,
              paddingHorizontal: 14,
              borderWidth: 1,
              borderColor: "rgba(0, 217, 130, 0.4)",
              backgroundColor: pressed ? "rgba(0, 217, 130, 0.25)" : "rgba(0, 217, 130, 0.15)",
            })}
          >
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900" }}>
              GW {selectedEvent}
            </Text>
            <AppSymbol
              name={{ ios: "chevron.down", android: "expand_more", web: "expand_more" }}
              color={GREEN}
              size={16}
            />
          </Pressable>
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

      <GameweekPicker
        visible={pickerOpen}
        gameweeks={gameweeks.filter((gw) => gw.finished || gw.isCurrent)}
        selected={selectedEvent}
        onSelect={onSelectEvent}
        onClose={() => setPickerOpen(false)}
      />

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
        {loading && !currentData && (
          <ActivityIndicator color={GREEN} style={{ marginTop: 28 }} />
        )}

        {currentData || showBlankSquad ? (
          <View style={{ flex: 1, width: "100%" }}>
          <View style={{ flex: 1, width: "100%", opacity: stale ? 0.4 : 1 }}>
          <Pitch
            picks={currentData ? picks : blankPicks}
            selectedGw={shownEvent}
            selectedPos={null}
            compactAvatar
            overlay={
              <>
                <View pointerEvents="none" style={{ position: "absolute", top: 8, right: 8, zIndex: 10 }}>
                  <PointsBadge
                    gameweek={shownEvent}
                    points={currentData ? totalPts : null}
                    live={isLive}
                  />
                  {currentData && (isLive || (currentData.history.transferCost ?? 0) > 0) && (
                    <View
                      style={{
                        marginTop: 4,
                        alignSelf: "flex-end",
                        alignItems: "flex-end",
                        gap: 2,
                      }}
                    >
                      {isLive && live && (
                        <Text style={STATUS_TEXT}>
                          {live.stillToPlay > 0
                            ? `${live.stillToPlay} still to play`
                            : "All played"}
                        </Text>
                      )}
                      {(currentData.history.transferCost ?? 0) > 0 && (
                        <Text style={[STATUS_TEXT, { color: "#ff8a9c" }]}>
                          {`−${currentData.history.transferCost} hit`}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
                {currentData?.chip && (
                  <View pointerEvents="none" style={{ position: "absolute", top: 8, left: 8, zIndex: 10 }}>
                    <View
                      style={{
                        backgroundColor: "rgba(4, 16, 10, 0.92)",
                        borderRadius: 12,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderWidth: 1,
                        borderColor: GREEN,
                      }}
                    >
                      <Text style={{ color: GREEN, fontWeight: "900", fontSize: 11, letterSpacing: 0.3 }}>
                        {CHIP_LABELS[currentData.chip] ?? currentData.chip}
                      </Text>
                    </View>
                  </View>
                )}
              </>
            }
          />
          </View>
          {stale && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator
                color={GREEN}
                size="large"
                accessibilityLabel={`Loading gameweek ${selectedEvent}`}
              />
            </View>
          )}
          </View>
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

