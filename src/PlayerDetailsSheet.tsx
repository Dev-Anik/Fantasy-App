import { useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import type { ScrollViewInstance } from "react-native";
import type { PlayerFixture, Row } from "./fpl";

const GREEN = "#00d982";

function price(value: number) {
  return `£${(value / 10).toFixed(1)}m`;
}

function fixtureCardStyle(difficulty: PlayerFixture["difficulty"]) {
  if (difficulty === "easy") {
    return {
      bg: "rgba(0, 230, 118, 0.22)",
      border: "rgba(0, 230, 118, 0.5)",
      accent: "#00e676",
    };
  }
  if (difficulty === "hard") {
    return {
      bg: "rgba(240, 45, 85, 0.22)",
      border: "rgba(240, 45, 85, 0.5)",
      accent: "#ff526f",
    };
  }
  return {
    bg: "rgba(255, 255, 255, 0.12)",
    border: "rgba(255, 255, 255, 0.25)",
    accent: "#ffffff",
  };
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
}: {
  visible: boolean;
  player: Row | null;
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
  const [showFullProfile, setShowFullProfile] = useState(false);
  const [playerHistory, setPlayerHistory] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!visible || !player?.id) {
      setPlayerHistory({});
      return;
    }

    let isMounted = true;

    fetch(`https://fantasy.premierleague.com/api/element-summary/${player.id}/`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data?.history) return;
        const map: Record<number, number> = {};
        data.history.forEach((h: any) => {
          if (h.round != null && h.total_points != null) {
            map[h.round] = h.total_points;
          }
        });
        setPlayerHistory(map);
      })
      .catch(() => {});

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
    if (!visible) {
      setShowFullProfile(false);
    }
  }, [visible]);

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
            backgroundColor: "rgba(5, 15, 10, 0.65)",
          }}
        />
        {player && (
          <View
            style={{
              maxHeight: "85%",
              paddingTop: 10,
              paddingHorizontal: 18,
              paddingBottom: Math.max(bottomInset, 12) + 12,
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              borderTopWidth: 1.5,
              borderColor: "rgba(0, 217, 130, 0.3)",
              backgroundColor: "rgba(14, 38, 26, 0.98)",
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
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text
                  numberOfLines={1}
                  style={{ color: "#ffffff", fontSize: 20, fontWeight: "900" }}
                >
                  {player.name}
                </Text>
                <Text
                  style={{
                    color: "#9db3a6",
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
                style={{
                  width: 32,
                  height: 32,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 16,
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.2)",
                }}
              >
                <Text style={{ color: GREEN, fontSize: 16, fontWeight: "800" }}>
                  ✕
                </Text>
              </Pressable>
            </View>

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
                  color: "#ffd400",
                  detail: priceChangeText,
                  detailColor:
                    player.priceChange == null || player.priceChange === 0
                      ? "#9db3a6"
                      : player.priceChange > 0
                        ? "#00e676"
                        : "#ff526f",
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
                    backgroundColor: "rgba(5, 20, 16, 0.85)",
                    borderWidth: 1,
                    borderColor: "rgba(0, 217, 130, 0.25)",
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      color: "#9db3a6",
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
              <Text
                style={{
                  color: "#ffffff",
                  fontSize: 12,
                  fontWeight: "900",
                  letterSpacing: 0.4,
                  marginBottom: 8,
                }}
              >
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
                    let isPoints = false;

                    if (historyPts !== undefined && historyPts !== null) {
                      isPoints = true;
                      pointsText = historyPts > 0 ? `${historyPts} pts` : "-";
                    } else if (fixture.points !== undefined && fixture.points !== null) {
                      isPoints = true;
                      pointsText = fixture.points > 0 ? `${fixture.points} pts` : "-";
                    } else if (isCurrentGw) {
                      isPoints = true;
                      if (player.displayPoints !== undefined && player.displayPoints !== null && player.displayPoints > 0) {
                        pointsText = `${player.displayPoints} pts`;
                      } else {
                        pointsText = "-";
                      }
                    } else if (isPastGw) {
                      isPoints = true;
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
                          opacity: isPastGw ? 0.65 : 1,
                        }}
                      >
                        <Text
                          style={{
                            color: "#9db3a6",
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
                            color: isPoints && pointsText !== "-" ? "#ffd400" : style.accent,
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
                <Text style={{ color: "#9db3a6", fontSize: 12 }}>
                  No upcoming fixtures available.
                </Text>
              )}
            </View>

            {/* Full Profile Details Collapsible Card */}
            {showFullProfile && (
              <View
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 14,
                  backgroundColor: "rgba(5, 20, 16, 0.9)",
                  borderWidth: 1,
                  borderColor: "rgba(0, 217, 130, 0.3)",
                }}
              >
                <Text style={{ color: GREEN, fontSize: 12, fontWeight: "900", marginBottom: 8 }}>
                  FULL PLAYER PROFILE
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  <View style={{ width: "47%" }}>
                    <Text style={{ color: "#9db3a6", fontSize: 10, fontWeight: "700" }}>Name</Text>
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800", marginTop: 1 }}>{player.name}</Text>
                  </View>
                  <View style={{ width: "47%" }}>
                    <Text style={{ color: "#9db3a6", fontSize: 10, fontWeight: "700" }}>Club</Text>
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800", marginTop: 1 }}>{player.team}</Text>
                  </View>
                  <View style={{ width: "47%" }}>
                    <Text style={{ color: "#9db3a6", fontSize: 10, fontWeight: "700" }}>Position</Text>
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800", marginTop: 1 }}>
                      {["", "Goalkeeper", "Defender", "Midfielder", "Forward"][player.type] ?? "Player"}
                    </Text>
                  </View>
                  <View style={{ width: "47%" }}>
                    <Text style={{ color: "#9db3a6", fontSize: 10, fontWeight: "700" }}>Price</Text>
                    <Text style={{ color: "#ffd400", fontSize: 12, fontWeight: "800", marginTop: 1 }}>{price(player.price ?? player.buy)}</Text>
                  </View>
                  <View style={{ width: "47%" }}>
                    <Text style={{ color: "#9db3a6", fontSize: 10, fontWeight: "700" }}>GW Points</Text>
                    <Text style={{ color: GREEN, fontSize: 12, fontWeight: "800", marginTop: 1 }}>{player.displayPoints ?? 0} pts</Text>
                  </View>
                  <View style={{ width: "47%" }}>
                    <Text style={{ color: "#9db3a6", fontSize: 10, fontWeight: "700" }}>Form</Text>
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800", marginTop: 1 }}>{player.form || "0.0"}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Action Buttons Row */}
            {actionsEnabled && (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
                {isTransferMode ? (
                  <>
                    {/* Transfer Out Button (Red, Smaller) */}
                    <Pressable
                      onPress={onTransfer}
                      style={({ pressed }) => ({
                        flex: 1,
                        minHeight: 42,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 14,
                        backgroundColor: "#dc2626",
                        opacity: pressed ? 0.8 : 1,
                        elevation: 4,
                      })}
                    >
                      <Text style={{ color: "#ffffff", fontWeight: "900", fontSize: 13.5 }}>
                        {isReplaced ? "Change player" : "Transfer out"}
                      </Text>
                    </Pressable>

                    {/* Full Profile Button */}
                    <Pressable
                      onPress={() => setShowFullProfile(!showFullProfile)}
                      style={({ pressed }) => ({
                        flex: 1,
                        minHeight: 42,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 14,
                        backgroundColor: showFullProfile ? "rgba(0, 217, 130, 0.2)" : "rgba(255, 255, 255, 0.1)",
                        borderWidth: 1.5,
                        borderColor: "rgba(0, 217, 130, 0.4)",
                        opacity: pressed ? 0.8 : 1,
                        elevation: 4,
                      })}
                    >
                      <Text style={{ color: GREEN, fontWeight: "900", fontSize: 13.5 }}>
                        {showFullProfile ? "Hide profile" : "Full profile"}
                      </Text>
                    </Pressable>

                    {isReplaced && (
                      <Pressable
                        onPress={onUndoTransfer}
                        style={({ pressed }) => ({
                          paddingHorizontal: 14,
                          minHeight: 42,
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 14,
                          backgroundColor: "rgba(255, 255, 255, 0.1)",
                          borderWidth: 1,
                          borderColor: "rgba(255, 255, 255, 0.2)",
                          opacity: pressed ? 0.8 : 1,
                        })}
                      >
                        <Text style={{ color: "#ff8080", fontWeight: "800", fontSize: 13 }}>
                          Undo
                        </Text>
                      </Pressable>
                    )}
                  </>
                ) : (
                  <>
                    {player.pos <= 11 && (
                      <>
                        <Pressable
                          onPress={() => onSetRole("cap")}
                          style={{
                            flex: 1,
                            minHeight: 40,
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 12,
                            backgroundColor: player.cap ? "#ffd400" : "rgba(255, 255, 255, 0.12)",
                            borderWidth: player.cap ? 0 : 1,
                            borderColor: "rgba(255, 255, 255, 0.2)",
                          }}
                        >
                          <Text
                            style={{
                              color: player.cap ? "#000000" : "#ffffff",
                              fontWeight: "900",
                              fontSize: 12,
                            }}
                          >
                            {player.cap ? "Captain ✓" : "Captain"}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => onSetRole("vice")}
                          style={{
                            flex: 1,
                            minHeight: 40,
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 12,
                            backgroundColor: player.vice ? "#ffffff" : "rgba(255, 255, 255, 0.12)",
                            borderWidth: player.vice ? 0 : 1,
                            borderColor: "rgba(255, 255, 255, 0.2)",
                          }}
                        >
                          <Text style={{ color: player.vice ? "#000000" : "#ffffff", fontWeight: "900", fontSize: 12 }}>
                            {player.vice ? "Vice ✓" : "Vice"}
                          </Text>
                        </Pressable>
                      </>
                    )}
                    <Pressable
                      onPress={onStartSubstitution}
                      style={{
                        flex: 1,
                        minHeight: 40,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: "rgba(255, 255, 255, 0.2)",
                        backgroundColor: "rgba(255, 255, 255, 0.1)",
                      }}
                    >
                      <Text style={{ color: "#ffffff", fontWeight: "900", fontSize: 12 }}>
                        Substitute
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setShowFullProfile(!showFullProfile)}
                      style={{
                        flex: 1,
                        minHeight: 40,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 12,
                        backgroundColor: showFullProfile ? "rgba(0, 217, 130, 0.2)" : "rgba(255, 255, 255, 0.1)",
                        borderWidth: 1.5,
                        borderColor: "rgba(0, 217, 130, 0.4)",
                      }}
                    >
                      <Text style={{ color: GREEN, fontWeight: "900", fontSize: 12 }}>
                        {showFullProfile ? "Hide" : "Profile"}
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}
