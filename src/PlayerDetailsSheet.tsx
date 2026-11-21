import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import type { ScrollViewInstance } from "react-native";
import { Image } from "expo-image";
import type { PlayerFixture, Row } from "./fpl";
import { teamAvatar } from "./Pitch";
import { AppSymbol } from "./AppSymbol";
import { availability } from "./availability";
import { PlayerProfile } from "./PlayerProfile";
import { THEME } from "./theme";
import { useSwipeToClose } from "./useSwipeToClose";
import type { FplElement, GameweekRow, PastSeason } from "./PlayerProfile";

const MUTED = THEME.muted;
// Captain gold, as on the pitch armband.
const GOLD = "#f2c14e";

// Section titles: quiet spaced capitals, as across the app.
export const SECTION_TITLE = {
  color: THEME.soft,
  fontSize: 11,
  fontWeight: "700" as const,
  letterSpacing: 1.4,
  marginBottom: 8,
};

// The Captain / Vice / Substitute buttons: rounded pills, like the app's.
const ACTION_PILL = {
  flex: 1,
  height: 44,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  borderRadius: 22,
  borderWidth: 1,
};

function price(value: number) {
  return `£${(value / 10).toFixed(1)}m`;
}

// Solid difficulty colours: green easy, ash grey average, red hard. `ink`
// is the main text on that colour and `muted` the gameweek label.
function fixtureCardStyle(difficulty: PlayerFixture["difficulty"]) {
  if (difficulty === "easy") {
    return { bg: "#14b866", border: "#1fd479", ink: "#ffffff", muted: "rgba(255, 255, 255, 0.78)" };
  }
  if (difficulty === "hard") {
    return { bg: "#d92b4f", border: "#ef4766", ink: "#ffffff", muted: "rgba(255, 255, 255, 0.78)" };
  }
  return { bg: "#3a4258", border: "#4b5470", ink: "#ffffff", muted: "rgba(255, 255, 255, 0.72)" };
}

export function PlayerDetailsSheet({
  visible,
  player,
  currentGw,
  bottomInset,
  isTransferMode,
  isReplaced,
  actionsEnabled,
  onClose,
  onSetRole,
  onTransfer,
  onUndoTransfer,
  onStartSubstitution,
  element = null,
  elementFailed = false,
  onRetryElement,
  teamNames = {},
}: {
  visible: boolean;
  player: Row | null;
  // FPL's full record for this player (season stats), when loaded.
  element?: FplElement | null;
  // Reading FPL's player records failed; offer a retry.
  elementFailed?: boolean;
  onRetryElement?: () => void;
  // Club short names by FPL team id, for the recent-gameweeks table.
  teamNames?: Record<number, string>;
  currentGw: number;
  bottomInset: number;
  isTransferMode: boolean;
  isReplaced: boolean;
  actionsEnabled: boolean;
  onClose: () => void;
  onSetRole: (role: "cap" | "vice") => void;
  onTransfer: () => void;
  onUndoTransfer: () => void;
  onStartSubstitution: () => void;
}) {
  const fixturesRef = useRef<ScrollViewInstance>(null);
  // The last loaded player's record. Kept with that player's id, so another
  // player's (or a closed sheet's) record is never shown, with no reset needed.
  const [loaded, setLoaded] = useState<{
    id: number;
    history: GameweekRow[];
    pastSeasons: PastSeason[];
  } | null>(null);
  const current = visible && !!player?.id && loaded?.id === player.id ? loaded : null;
  const history = current?.history ?? null;
  const pastSeasons = current?.pastSeasons ?? null;
  const playerHistory: Record<number, number> = {};
  history?.forEach((row) => {
    playerHistory[row.round] = (playerHistory[row.round] ?? 0) + row.total_points;
  });

  useEffect(() => {
    const id = player?.id;
    if (!visible || !id) return;

    let isMounted = true;

    fetch(`https://fantasy.premierleague.com/api/element-summary/${id}/`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        setLoaded({
          id,
          history: Array.isArray(data?.history) ? data.history : [],
          pastSeasons: Array.isArray(data?.history_past) ? data.history_past : [],
        });
      })
      .catch(() => {
        if (!isMounted) return;
        setLoaded({ id, history: [], pastSeasons: [] });
      });

    return () => {
      isMounted = false;
    };
  }, [visible, player?.id]);

  const priceChangeText =
    player?.priceChange == null
      ? "Price change unavailable"
      : player.priceChange > 0
        ? `+${price(player.priceChange)} this GW`
        : player.priceChange < 0
          ? `-${price(Math.abs(player.priceChange))} this GW`
          : "No change this GW";

  useEffect(() => {
    if (!visible || !player?.fixtures?.length) return;

    const fixtures = player.fixtures;
    const currentIndex = fixtures.findIndex(
      (fixture) => fixture.event === currentGw,
    );
    const initialIndex =
      currentIndex >= 0
        ? currentIndex
        : fixtures.findIndex((fixture) => fixture.event > currentGw);
    if (initialIndex < 0) return;

    requestAnimationFrame(() => {
      fixturesRef.current?.scrollTo({
        x: initialIndex * 64,
        animated: false,
      });
    });
  }, [currentGw, player, visible]);

  // Drag the sheet down to close it.
  const swipe = useSwipeToClose(onClose, visible && player !== null);

  return (
    <Modal
      visible={visible && player !== null}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close player details"
          onPress={onClose}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: "rgba(4, 7, 16, 0.7)",
          }}
        />
        {player && (
          <Animated.View
            {...swipe.panHandlers}
            style={{
              transform: swipe.transform,
              maxHeight: "85%",
              paddingTop: 10,
              paddingHorizontal: 18,
              paddingBottom: Math.max(bottomInset, 12) + 12,
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              borderTopWidth: 1.5,
              borderColor: "rgba(255, 255, 255, 0.1)",
              backgroundColor: THEME.bg,
              elevation: 10,
            }}
          >
            {/* Top Handle */}
            <View
              style={{
                width: 36,
                height: 4,
                alignSelf: "center",
                marginBottom: 14,
                borderRadius: 2,
                backgroundColor: "rgba(255, 255, 255, 0.2)",
              }}
            />

            {/* Player Header Info */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              {/* 3D kit avatar in the club colours */}
              <View
                style={{
                  width: 64,
                  height: 64,
                  marginRight: 12,
                  borderRadius: 32,
                  overflow: "hidden",
                  backgroundColor: THEME.surfaceRaised,
                  borderWidth: 1.5,
                  borderColor: "rgba(255, 255, 255, 0.12)",
                  alignItems: "center",
                }}
              >
                <Image
                  source={teamAvatar(player.team, player.type === 1)}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  accessible={false}
                  // Keeper art is drawn further out: enlarge it to match (head 67 vs 78).
                  style={player.type === 1 ? { width: 70, height: 77, marginTop: 3 } : { width: 60, height: 66, marginTop: 4 }}
                />
              </View>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text
                  numberOfLines={1}
                  style={{ color: "#ffffff", fontSize: 20, fontWeight: "900" }}
                >
                  {player.name}
                </Text>
                <Text
                  style={{
                    color: MUTED,
                    fontSize: 12,
                    fontWeight: "600",
                    marginTop: 2,
                  }}
                >
                  {player.team} ·{" "}
                  {["", "Goalkeeper", "Defender", "Midfielder", "Forward"][
                    player.type
                  ] ?? "Player"}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close player details"
                onPress={onClose}
                hitSlop={10}
                style={({ pressed }) => ({
                  width: 34,
                  height: 34,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 17,
                  backgroundColor: pressed ? THEME.surfaceRaised : THEME.surface,
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.12)",
                })}
              >
                <AppSymbol name={{ ios: "xmark", android: "close", web: "close" }} color={THEME.soft} size={16} />
              </Pressable>
            </View>

            <ScrollView
              onScroll={swipe.onScroll}
              {...swipe.listTouch}
              scrollEventThrottle={16}
              style={{ flexGrow: 0, flexShrink: 1 }}
              contentContainerStyle={{ paddingBottom: 4 }}
              showsVerticalScrollIndicator={false}
            >
            {/* Injury / suspension news from FPL */}
            {(() => {
              const flag = availability(player.status, player.chance);
              const news = player.news?.trim();
              if (!flag && !news) return null;
              const color = flag?.color ?? MUTED;
              return (
                <View
                  accessible
                  accessibilityLabel={[flag?.label, news].filter(Boolean).join(". ")}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 8,
                    marginTop: 12,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 12,
                    backgroundColor: `${color}1f`,
                    borderWidth: 1,
                    borderColor: `${color}80`,
                  }}
                >
                  <View style={{ marginTop: 1 }}>
                    <AppSymbol
                      name={
                        flag?.level === "out"
                          ? { ios: "cross.circle.fill", android: "medical_services", web: "medical_services" }
                          : { ios: "exclamationmark.circle.fill", android: "error", web: "error" }
                      }
                      color={color}
                      size={16}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    {!!flag && (
                      <Text style={{ color, fontSize: 12, fontWeight: "900" }}>{flag.label}</Text>
                    )}
                    {!!news && (
                      <Text style={{ color: THEME.soft, fontSize: 12, marginTop: flag ? 2 : 0, lineHeight: 16 }}>
                        {news}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })()}

            {/* Quick Stat Cards */}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
              {[
                { label: "FORM", value: player.form || "—", color: "#ffffff" },
                {
                  label: "OWNERSHIP",
                  value: player.ownership ? `${player.ownership}%` : "—",
                  color: "#ffffff",
                },
                {
                  label: "PRICE",
                  value: price(player.price ?? player.buy),
                  color: GOLD,
                  detail: priceChangeText,
                  detailColor:
                    player.priceChange == null || player.priceChange === 0
                      ? MUTED
                      : player.priceChange > 0
                        ? THEME.good
                        : THEME.bad,
                },
              ].map((stat) => (
                <View
                  key={stat.label}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    paddingVertical: 9,
                    paddingHorizontal: 8,
                    borderRadius: 14,
                    backgroundColor: THEME.surface,
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.06)",
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      color: MUTED,
                      fontSize: 8.5,
                      fontWeight: "800",
                      letterSpacing: 0.3,
                    }}
                  >
                    {stat.label}
                  </Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                    style={{
                      color: stat.color,
                      fontSize: 15,
                      fontWeight: "900",
                      marginTop: 3,
                    }}
                  >
                    {stat.value}
                  </Text>
                  {"detail" in stat && (
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                      style={{
                        color: stat.detailColor,
                        fontSize: 8,
                        fontWeight: "700",
                        marginTop: 2,
                      }}
                    >
                      {stat.detail}
                    </Text>
                  )}
                </View>
              ))}
            </View>

            {/* Fixtures Section with Small Cards & Previous GW Points */}
            <View style={{ marginTop: 16 }}>
              <Text accessibilityRole="header" style={SECTION_TITLE}>
                FIXTURES
              </Text>
              {player.fixtures?.length ? (
                <ScrollView
                  ref={fixturesRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, paddingRight: 2 }}
                >
                  {player.fixtures.map((fixture, index) => {
                    const style = fixtureCardStyle(fixture.difficulty);
                    const isPastGw = fixture.event < currentGw || fixture.finished;
                    const isCurrentGw = fixture.event === currentGw && !fixture.finished;

                    const historyPts = playerHistory[fixture.event];
                    let pointsText = "";

                    if (historyPts !== undefined && historyPts !== null) {
                      pointsText = historyPts > 0 ? `${historyPts} pts` : "-";
                    } else if (isCurrentGw) {
                      if (player.displayPoints !== undefined && player.displayPoints !== null && player.displayPoints > 0) {
                        pointsText = `${player.displayPoints} pts`;
                      } else {
                        pointsText = "-";
                      }
                    } else if (isPastGw) {
                      pointsText = "-";
                    } else {
                      pointsText = fixture.venue;
                    }

                    return (
                      <View
                        key={`${fixture.event}-${fixture.opponent}-${index}`}
                        style={{
                          width: 58,
                          alignItems: "center",
                          paddingVertical: 6,
                          paddingHorizontal: 4,
                          borderRadius: 10,
                          backgroundColor: style.bg,
                          borderWidth: 1,
                          borderColor: style.border,
                          // Played gameweeks recede but keep their colour.
                          opacity: isPastGw ? 0.55 : 1,
                        }}
                      >
                        <Text
                          style={{
                            color: style.muted,
                            fontSize: 8,
                            fontWeight: "800",
                          }}
                        >
                          GW {fixture.event}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{
                            color: "#ffffff",
                            fontSize: 11.5,
                            fontWeight: "900",
                            marginTop: 3,
                          }}
                        >
                          {fixture.opponent}
                        </Text>
                        <Text
                          style={{
                            color: style.ink,
                            fontSize: pointsText === "-" ? 12 : 8.5,
                            fontWeight: "900",
                            marginTop: 2,
                          }}
                        >
                          {pointsText}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
              ) : (
                <Text style={{ color: MUTED, fontSize: 12 }}>
                  No upcoming fixtures available.
                </Text>
              )}
            </View>

            <PlayerProfile
              element={element}
              failed={elementFailed}
              onRetry={onRetryElement}
              history={history}
              pastSeasons={pastSeasons}
              teamNames={teamNames}
            />
            </ScrollView>

            {/* Action Buttons Row */}
            {actionsEnabled && (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
                {isTransferMode ? (
                  <>
                    {/* Transfer out: a soft red pill, clear but not shouting */}
                    <Pressable
                      onPress={onTransfer}
                      accessibilityRole="button"
                      style={({ pressed }) => ({
                        flex: 1,
                        height: 46,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        borderRadius: 23,
                        backgroundColor: pressed ? "rgba(255, 107, 125, 0.26)" : "rgba(255, 107, 125, 0.16)",
                        borderWidth: 1,
                        borderColor: "rgba(255, 107, 125, 0.5)",
                      })}
                    >
                      <AppSymbol
                        name={{ ios: "arrow.left.arrow.right", android: "swap_horiz", web: "swap_horiz" }}
                        color={THEME.bad}
                        size={16}
                      />
                      <Text style={{ color: THEME.bad, fontWeight: "700", fontSize: 14 }}>
                        {isReplaced ? "Change player" : "Transfer out"}
                      </Text>
                    </Pressable>

                    {isReplaced && (
                      <Pressable
                        onPress={onUndoTransfer}
                        accessibilityRole="button"
                        style={({ pressed }) => ({
                          paddingHorizontal: 18,
                          height: 46,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 5,
                          borderRadius: 23,
                          backgroundColor: pressed ? THEME.surfaceRaised : THEME.surface,
                          borderWidth: 1,
                          borderColor: "rgba(255, 255, 255, 0.14)",
                        })}
                      >
                        <AppSymbol
                          name={{ ios: "arrow.uturn.backward", android: "undo", web: "undo" }}
                          color={THEME.soft}
                          size={15}
                        />
                        <Text style={{ color: THEME.soft, fontWeight: "600", fontSize: 13.5 }}>Undo</Text>
                      </Pressable>
                    )}
                  </>
                ) : (
                  <>
                    {player.pos <= 11 && (
                      <>
                        <Pressable
                          onPress={() => onSetRole("cap")}
                          accessibilityRole="button"
                          accessibilityState={{ selected: player.cap }}
                          style={({ pressed }) => ({
                            ...ACTION_PILL,
                            backgroundColor: player.cap ? GOLD : pressed ? THEME.surfaceRaised : THEME.surface,
                            borderColor: player.cap ? GOLD : "rgba(255, 255, 255, 0.14)",
                          })}
                        >
                          <Text style={{ color: player.cap ? THEME.onAccent : THEME.ink, fontWeight: "700", fontSize: 13 }}>
                            Captain
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => onSetRole("vice")}
                          accessibilityRole="button"
                          accessibilityState={{ selected: player.vice }}
                          style={({ pressed }) => ({
                            ...ACTION_PILL,
                            backgroundColor: player.vice ? THEME.ink : pressed ? THEME.surfaceRaised : THEME.surface,
                            borderColor: player.vice ? THEME.ink : "rgba(255, 255, 255, 0.14)",
                          })}
                        >
                          <Text style={{ color: player.vice ? THEME.bg : THEME.ink, fontWeight: "700", fontSize: 13 }}>
                            Vice
                          </Text>
                        </Pressable>
                      </>
                    )}
                    <Pressable
                      onPress={onStartSubstitution}
                      accessibilityRole="button"
                      style={({ pressed }) => ({
                        ...ACTION_PILL,
                        backgroundColor: pressed ? THEME.surfaceRaised : THEME.surface,
                        borderColor: "rgba(255, 255, 255, 0.14)",
                      })}
                    >
                      <Text style={{ color: THEME.ink, fontWeight: "700", fontSize: 13 }}>Substitute</Text>
                    </Pressable>
                  </>
                )}
              </View>
            )}
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}
