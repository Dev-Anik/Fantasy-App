import { useEffect, useRef } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import type { ScrollViewInstance } from "react-native";
import type { PlayerFixture, Row } from "./fpl";

const PURPLE = "#37003c";
const GREEN = "#00d982";

function price(value: number) {
  return `£${(value / 10).toFixed(1)}m`;
}

function difficultyColor(difficulty: PlayerFixture["difficulty"]) {
  if (difficulty === "easy") return "#00e676";
  if (difficulty === "hard") return "#f02d55";
  return "#b8b8b8";
}

function fixtureTextColor(difficulty: PlayerFixture["difficulty"]) {
  return difficulty === "hard" ? "#ffffff" : "#252329";
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
        x: initialIndex * 90,
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
            backgroundColor: "rgba(12, 8, 15, 0.48)",
          }}
        />
        {player && (
          <View
            style={{
              maxHeight: "82%",
              paddingTop: 10,
              paddingHorizontal: 18,
              paddingBottom: Math.max(bottomInset, 12) + 10,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              backgroundColor: "#fbfafc",
            }}
          >
            <View
              style={{
                width: 38,
                height: 4,
                alignSelf: "center",
                marginBottom: 14,
                borderRadius: 2,
                backgroundColor: "#d8d3dd",
              }}
            />
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
                  style={{ color: PURPLE, fontSize: 21, fontWeight: "900" }}
                >
                  {player.name}
                </Text>
                <Text
                  style={{
                    color: "#726a78",
                    fontSize: 12,
                    fontWeight: "700",
                    marginTop: 3,
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
                  width: 34,
                  height: 34,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 17,
                  backgroundColor: "#eeeaf1",
                }}
              >
                <Text style={{ color: PURPLE, fontSize: 19, fontWeight: "700" }}>
                  ×
                </Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 18 }}>
              {[
                { label: "FORM", value: player.form || "—" },
                {
                  label: "OWNERSHIP",
                  value: player.ownership ? `${player.ownership}%` : "—",
                },
                {
                  label: "PRICE",
                  value: price(player.price ?? player.buy),
                  detail: priceChangeText,
                  detailColor:
                    player.priceChange == null || player.priceChange === 0
                      ? "#817987"
                      : player.priceChange > 0
                        ? "#16834b"
                        : "#c0392b",
                },
              ].map((stat) => (
                <View
                  key={stat.label}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    paddingVertical: 11,
                    paddingHorizontal: 8,
                    borderRadius: 14,
                    backgroundColor: "#f0edf3",
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      color: "#817987",
                      fontSize: 8,
                      fontWeight: "800",
                      letterSpacing: 0.35,
                    }}
                  >
                    {stat.label}
                  </Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                    style={{
                      color: PURPLE,
                      fontSize: 14,
                      fontWeight: "900",
                      marginTop: 4,
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

            <View style={{ marginTop: 19 }}>
              <Text
                style={{
                  color: PURPLE,
                  fontSize: 13,
                  fontWeight: "900",
                  marginBottom: 9,
                }}
              >
                FIXTURES
              </Text>
              {player.fixtures?.length ? (
                <ScrollView
                  ref={fixturesRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingRight: 2 }}
                >
                  {player.fixtures.map((fixture, index) => (
                    <View
                      key={`${fixture.event}-${fixture.opponent}-${index}`}
                      style={{
                        width: 82,
                        alignItems: "center",
                        paddingVertical: 10,
                        borderRadius: 13,
                        backgroundColor: difficultyColor(fixture.difficulty),
                        opacity: fixture.event < currentGw ? 0.52 : 1,
                      }}
                    >
                      <Text
                        style={{
                          color: fixtureTextColor(fixture.difficulty),
                          fontSize: 9,
                          fontWeight: "800",
                        }}
                      >
                        GW {fixture.event}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: fixtureTextColor(fixture.difficulty),
                          fontSize: 14,
                          fontWeight: "900",
                          marginTop: 5,
                        }}
                      >
                        {fixture.opponent}
                      </Text>
                      <Text
                        style={{
                          color: fixtureTextColor(fixture.difficulty),
                          fontSize: 9,
                          fontWeight: "700",
                          marginTop: 2,
                        }}
                      >
                        {fixture.venue}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Text style={{ color: "#77707c", fontSize: 12 }}>
                  No upcoming fixtures available.
                </Text>
              )}
            </View>

            {actionsEnabled && (
              <View style={{ flexDirection: "row", gap: 9, marginTop: 20 }}>
                {isTransferMode ? (
                  <>
                    <Pressable
                      onPress={onTransfer}
                      style={{
                        flex: 1,
                        minHeight: 46,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 14,
                        backgroundColor: GREEN,
                      }}
                    >
                      <Text style={{ color: PURPLE, fontWeight: "900" }}>
                        {isReplaced ? "Change player" : "Transfer out"}
                      </Text>
                    </Pressable>
                    {isReplaced && (
                      <Pressable
                        onPress={onUndoTransfer}
                        style={{
                          paddingHorizontal: 18,
                          minHeight: 46,
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 14,
                          backgroundColor: "#ffe7e5",
                        }}
                      >
                        <Text style={{ color: "#b42318", fontWeight: "900" }}>
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
                            minHeight: 46,
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 14,
                            backgroundColor: player.cap ? "#ffe58a" : PURPLE,
                          }}
                        >
                          <Text
                            style={{
                              color: player.cap ? PURPLE : "#fff",
                              fontWeight: "900",
                            }}
                          >
                            {player.cap ? "Captain ✓" : "Make Captain"}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => onSetRole("vice")}
                          style={{
                            flex: 1,
                            minHeight: 46,
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 14,
                            backgroundColor: player.vice
                              ? "#e5dcf2"
                              : "#eeeaf1",
                          }}
                        >
                          <Text style={{ color: PURPLE, fontWeight: "900" }}>
                            {player.vice ? "Vice ✓" : "Make Vice"}
                          </Text>
                        </Pressable>
                      </>
                    )}
                    <Pressable
                      onPress={onStartSubstitution}
                      style={{
                        paddingHorizontal: 14,
                        minHeight: 46,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: "#d9d2df",
                        backgroundColor: "#fff",
                      }}
                    >
                      <Text style={{ color: PURPLE, fontWeight: "900" }}>
                        Substitute
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
