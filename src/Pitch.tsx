import type { ReactNode } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { GlassView } from "expo-glass-effect";
import { AppSymbol } from "./AppSymbol";
import { Row } from "./fpl";

const GREEN = "#00d982";

type Kit = {
  shirt: string;
  trim: string;
  sleeves?: string;
  pattern?: "stripes";
};

const KIT_COLORS: Record<string, Kit> = {
  ARS: {
    shirt: "#ef0107",
    trim: "#ffffff",
    sleeves: "#ffffff",
  },
  AVL: {
    shirt: "#670e36",
    trim: "#95bfe5",
  },
  BHA: {
    shirt: "#0057b8",
    trim: "#ffffff",
    pattern: "stripes",
  },
  BOU: {
    shirt: "#da291c",
    trim: "#000000",
    pattern: "stripes",
  },
  BRE: {
    shirt: "#e30613",
    trim: "#ffffff",
    pattern: "stripes",
  },
  BUR: { shirt: "#6c1d45", trim: "#99d6ea" },
  CHE: { shirt: "#034694", trim: "#ffffff" },
  COV: { shirt: "#87ceeb", trim: "#ffffff" },
  CRY: {
    shirt: "#1b458f",
    trim: "#c4122e",
    pattern: "stripes",
  },
  EVE: { shirt: "#003399", trim: "#ffffff" },
  FUL: { shirt: "#ffffff", trim: "#cc0000", sleeves: "#cc0000" },
  HUL: {
    shirt: "#f68a1e",
    trim: "#111111",
    pattern: "stripes",
  },
  IPS: { shirt: "#3a64a3", trim: "#ffffff" },
  LEE: { shirt: "#ffffff", trim: "#1d428a" },
  LEI: { shirt: "#003090", trim: "#fdbe11" },
  LIV: { shirt: "#c8102e", trim: "#00b2a9", sleeves: "#c8102a" },
  LUT: { shirt: "#f78f1e", trim: "#231f20" },
  MCI: { shirt: "#6caddf", trim: "#ffffff" },
  MUN: { shirt: "#da291c", trim: "#fbe122" },
  NEW: {
    shirt: "#242424",
    trim: "#ffffff",
    pattern: "stripes",
  },
  NFO: { shirt: "#dd0000", trim: "#ffffff" },
  SOU: {
    shirt: "#d71920",
    trim: "#ffffff",
    pattern: "stripes",
  },
  SUN: {
    shirt: "#eb172b",
    trim: "#ffffff",
    pattern: "stripes",
  },
  TOT: { shirt: "#ffffff", trim: "#132257", sleeves: "#132257" },
  WHU: {
    shirt: "#7a263a",
    trim: "#1bb1e7",
  },
  WOL: { shirt: "#fdb913", trim: "#111111" },
};

const GOALKEEPER_KIT_COLORS: Record<string, Kit> = {
  ARS: { shirt: "#b8d923", trim: "#ffffff" },
  AVL: { shirt: "#f2a900", trim: "#670e36" },
  BHA: { shirt: "#f2e600", trim: "#0057b8" },
  BOU: { shirt: "#58b947", trim: "#000000" },
  BRE: { shirt: "#f2e600", trim: "#e30613" },
  BUR: { shirt: "#f28c28", trim: "#6c1d45" },
  CHE: { shirt: "#f28c28", trim: "#034694" },
  COV: { shirt: "#38a878", trim: "#ffffff" },
  CRY: { shirt: "#f28c28", trim: "#1b458f" },
  EVE: { shirt: "#b8d923", trim: "#003399" },
  FUL: { shirt: "#222222", trim: "#ffffff" },
  HUL: { shirt: "#e85d9e", trim: "#111111" },
  IPS: { shirt: "#e85d9e", trim: "#3a64a3" },
  LEE: { shirt: "#38a878", trim: "#1d428a" },
  LEI: { shirt: "#e85d9e", trim: "#003090" },
  LIV: { shirt: "#16805a", trim: "#c8102e" },
  LUT: { shirt: "#248bd2", trim: "#231f20" },
  MCI: { shirt: "#58b947", trim: "#6caddf" },
  MUN: { shirt: "#7846a8", trim: "#fbe122" },
  NEW: { shirt: "#f28c28", trim: "#242424" },
  NFO: { shirt: "#f2e600", trim: "#dd0000" },
  SOU: { shirt: "#58b947", trim: "#d71920" },
  SUN: { shirt: "#38a878", trim: "#eb172b" },
  TOT: { shirt: "#f2e600", trim: "#132257" },
  WHU: { shirt: "#f28c28", trim: "#7a263a" },
  WOL: { shirt: "#38a878", trim: "#111111" },
};

const SKIN = "#d9a77e";
const HAIR = "#241a16";
export const TEAM_AVATARS: Record<string, any> = {
  ARS: require("../assets/images/final-avatar/Ars.png"),
  AVL: require("../assets/images/final-avatar/Avl.png"),
  BHA: require("../assets/images/final-avatar/Bha.png"),
  BOU: require("../assets/images/final-avatar/Bou.png"),
  BRE: require("../assets/images/final-avatar/Bre.png"),
  CHE: require("../assets/images/final-avatar/Che.png"),
  COV: require("../assets/images/final-avatar/Cov.png"),
  CRY: require("../assets/images/final-avatar/Cry.png"),
  EVE: require("../assets/images/final-avatar/Eve.png"),
  FUL: require("../assets/images/final-avatar/Ful.png"),
  HUL: require("../assets/images/final-avatar/Hul.png"),
  IPS: require("../assets/images/final-avatar/Ips.png"),
  LEE: require("../assets/images/final-avatar/Lee.png"),
  LIV: require("../assets/images/final-avatar/Liv.png"),
  MCI: require("../assets/images/final-avatar/Mci.png"),
  MUN: require("../assets/images/final-avatar/Mun.png"),
  NEW: require("../assets/images/final-avatar/New.png"),
  NFO: require("../assets/images/final-avatar/Nfo.png"),
  SUN: require("../assets/images/final-avatar/Sun.png"),
  TOT: require("../assets/images/final-avatar/Tot.png"),
};

const CHAIR = "#8292a8";

function PlayerAvatar({
  team,
  benched,
  goalkeeper,
  compact = false,
}: {
  team: string;
  benched: boolean;
  goalkeeper: boolean;
  compact?: boolean;
}) {
  const avatarSource = (team && TEAM_AVATARS[team]) ? TEAM_AVATARS[team] : require("../assets/images/final-avatar/no-club.png");
  const displayTeam = team && TEAM_AVATARS[team] ? team : "";

  return (
    <View
      style={{
        width: 64,
        height: compact ? 34 : 42,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        <Image
          source={avatarSource}
          contentFit="contain"
          style={{
            width: 64,
            height: 64,
            transform: [
              { scale: benched ? (compact ? 0.98 : 1.05) : (compact ? 1.125 : 1.125) },
              { translateY: compact ? 3 : 4 },
            ],
          }}
        />
        {!!displayTeam && (
          <View
            style={{
              position: "absolute",
              bottom: compact ? 1 : 2,
              backgroundColor: "rgba(20, 45, 92, 0.92)",
              paddingHorizontal: compact ? 3 : 4,
              paddingVertical: 0.5,
              borderRadius: 3,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.4)",
            }}
          >
            <Text
              style={{
                color: "#ffffff",
                fontSize: compact ? 7 : 8,
                fontWeight: "900",
                letterSpacing: 0.3,
              }}
            >
              {displayTeam}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function SwapIcon({ size = 22, color = "#ffd400" }: { size?: number; color?: string }) {
  return <AppSymbol name="arrow.2.circlepath" color={color} size={size} />;
}

function TransferOutIcon({ size = 14, color = "#ff3b30" }: { size?: number; color?: string }) {
  return (
    <View
      style={{
        width: 14,
        height: 14,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          position: "absolute",
          left: 1,
          width: 7,
          height: 2,
          backgroundColor: color,
          borderRadius: 1,
        }}
      />
      <View
        style={{
          position: "absolute",
          right: 1,
          width: 5,
          height: 5,
          borderTopWidth: 2,
          borderRightWidth: 2,
          borderColor: color,
          transform: [{ rotate: "45deg" }],
        }}
      />
    </View>
  );
}

function InfoIcon({ size = 16, color = "#ffffff" }: { size?: number; color?: string }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color,
          fontSize: size * 0.85,
          fontWeight: "900",
          fontStyle: "italic",
          includeFontPadding: false,
        }}
      >
        i
      </Text>
    </View>
  );
}

function PlayerCard({
  r,
  selectedGw,
  selected,
  showPrice,
  isRightmost = false,
  compact = false,
  onPress,
  onSetCaptain,
  onSetViceCaptain,
  onOpenDetails,
  onTransfer,
}: {
  r: Row;
  selectedGw?: number;
  selected: boolean;
  showPrice: boolean;
  isRightmost?: boolean;
  compact?: boolean;
  onPress?: (r: Row) => void;
  onSetCaptain?: (r: Row) => void;
  onSetViceCaptain?: (r: Row) => void;
  onOpenDetails?: (r: Row) => void;
  onTransfer?: (r: Row) => void;
}) {
  const fixtures = r.fixtures ?? [];
  const selectedFixtureIndex = fixtures.findIndex(
    (fixture) => fixture.event === selectedGw,
  );
  const displayedFixtures =
    selectedFixtureIndex < 0
      ? []
      : fixtures.slice(selectedFixtureIndex, selectedFixtureIndex + 3);
  const currentFx = displayedFixtures[0];
  const POS_LABELS = ["", "GKP", "DEF", "MID", "FWD"];
  const posLabel = POS_LABELS[r.type] || "";
  const isStarted = Boolean(currentFx?.started || currentFx?.finished);
  const isBenched = r.pos > 11;
  const isBenchedGK = isBenched && r.type === 1;

  return (
    <Pressable
      disabled={!onPress}
      onPress={() => onPress?.(r)}
      android_ripple={{ color: "rgba(255, 212, 0, 0.3)", borderless: false, radius: 24 }}
      style={({ pressed }) => ({
        alignItems: "center",
        alignSelf: "center",
        width: 72,
        borderRadius: 14,
        backgroundColor: "transparent",
        transform: [{ scale: pressed ? 0.90 : selected ? 1.05 : 1 }],
        opacity: pressed ? 0.85 : 1,
        position: "relative",
        zIndex: selected ? 99 : 1,
      })}
    >
      {({ pressed }) => {
        const isHighlight = selected || pressed;

        const benchedCardBg = isBenchedGK
          ? isHighlight
            ? "rgba(18, 44, 68, 0.95)"
            : "rgba(12, 28, 44, 0.88)"
          : isHighlight
            ? "rgba(38, 34, 10, 0.95)"
            : "rgba(8, 28, 18, 0.88)";

        const benchedCardBorder = isBenchedGK
          ? isHighlight
            ? "#38bdf8"
            : "rgba(56, 189, 248, 0.3)"
          : isHighlight
            ? "#ffd400"
            : "rgba(255, 212, 0, 0.22)";

        const cardContent = (
          <>
            <View
              style={{
                width: 66,
                height: compact ? 34 : 42,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PlayerAvatar
                team={r.team}
                benched={r.pos > 11}
                goalkeeper={r.type === 1}
                compact={compact}
              />

              {showPrice && !!posLabel && (
                <View
                  style={{
                    position: "absolute",
                    top: 2,
                    right: -3,
                    backgroundColor: "rgba(10, 32, 21, 0.95)",
                    borderColor: GREEN,
                    borderWidth: 1,
                    borderRadius: 4,
                    paddingHorizontal: 3.5,
                    paddingVertical: 1,
                    zIndex: 10,
                  }}
                >
                  <Text
                    style={{
                      color: "#ffffff",
                      fontSize: 7.5,
                      fontWeight: "900",
                      letterSpacing: 0.2,
                      includeFontPadding: false,
                    }}
                  >
                    {posLabel}
                  </Text>
                </View>
              )}

              {r.formMood && (
                <View
                  style={{
                    position: "absolute",
                    top: r.pos > 11 ? 11 : 4,
                    left: 2,
                    width: 15,
                    height: 15,
                    borderRadius: 8,
                    backgroundColor: "#000",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: "#FFC107",
                      fontSize: 10,
                      lineHeight: 12,
                      fontWeight: "900",
                      textAlign: "center",
                      includeFontPadding: false,
                      transform: [{ translateY: -2.5 }],
                    }}
                  >
                    ★
                  </Text>
                </View>
              )}
              {(r.cap || r.vice) && (
                <View
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: 17,
                    height: 17,
                    borderRadius: 9,
                    backgroundColor: r.cap ? "#ffd400" : "#ccc",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "bold" }}>
                    {r.cap ? "C" : "V"}
                  </Text>
                </View>
              )}
            </View>
            {!!r.name && (
              <View style={{ width: 72, maxWidth: "100%", marginTop: isBenched ? 2 : 0 }}>
                <View
                  style={{
                    backgroundColor: isHighlight
                      ? isBenchedGK
                        ? "#0f384a"
                        : "#3a3000"
                      : isBenchedGK
                        ? "#0c2030"
                        : "#102217",
                    borderColor: isHighlight
                      ? isBenchedGK
                        ? "#38bdf8"
                        : "#ffd400"
                      : "transparent",
                    borderWidth: isHighlight ? 1 : 0,
                    borderTopLeftRadius: 7,
                    borderTopRightRadius: 7,
                    paddingHorizontal: 2,
                    paddingVertical: 3,
                    width: "100%",
                  }}
                >
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                    style={{
                      color: isHighlight
                        ? isBenchedGK
                          ? "#38bdf8"
                          : "#ffd400"
                        : "#fff",
                      fontSize: 10,
                      textAlign: "center",
                      flexShrink: 1,
                      fontWeight: "700",
                    }}
                  >
                    {r.name}
                  </Text>
                </View>
                {showPrice ? (
                  <View
                    accessibilityLabel={`Price £${((r.price ?? r.buy) / 10).toFixed(1)}m${
                      r.priceChange
                        ? `, ${r.priceChange > 0 ? "up" : "down"} £${(
                            Math.abs(r.priceChange) / 10
                          ).toFixed(1)}m`
                        : ""
                    }`}
                    style={{
                      width: "100%",
                      overflow: "hidden",
                      borderBottomLeftRadius: 5,
                      borderBottomRightRadius: 5,
                    }}
                  >
                    <View
                      style={{
                        minHeight: 20,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 2,
                        paddingHorizontal: 1,
                        paddingVertical: 2.5,
                        backgroundColor: "#252329",
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.6}
                        style={{ color: "#fff", fontSize: 9.5, fontWeight: "900" }}
                      >
                        £{((r.price ?? r.buy) / 10).toFixed(1)}m
                      </Text>
                      {!!r.priceChange && (
                        <Text
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.55}
                          style={{
                            color: r.priceChange > 0 ? "#00e676" : "#ff526f",
                            fontSize: 8,
                            fontWeight: "900",
                          }}
                        >
                          {r.priceChange > 0 ? "+" : "-"}£
                          {(Math.abs(r.priceChange) / 10).toFixed(1)}m
                        </Text>
                      )}
                    </View>
                    <View style={{ flexDirection: "row", height: 4 }}>
                      {displayedFixtures.map((fixture, index) => (
                        <View
                          key={`${r.id}-${fixture.opponent}-${fixture.venue}-${index}-price-difficulty`}
                          style={{
                            flex: 1,
                            marginRight:
                              index < displayedFixtures.length - 1 ? 2 : 0,
                            backgroundColor:
                              fixture.difficulty === "easy"
                                ? "#00e676"
                                : fixture.difficulty === "average"
                                  ? "#f5f5f5"
                                  : "#f02d55",
                          }}
                        />
                      ))}
                    </View>
                  </View>
                ) : (displayedFixtures.length > 0 || r.displayPoints !== undefined) ? (() => {
                  const showPointsText = Boolean(isStarted || !currentFx);
                  const ptsVal = r.displayPoints ?? 0;
                  const ptsColor = ptsVal < 0 ? "#ff526f" : "#ffd400";
                  return (
                    <View
                      accessibilityLabel={
                        showPointsText
                          ? `Points: ${ptsVal} pts`
                          : `Fixtures from GW ${selectedGw}: ${displayedFixtures
                              .map((fixture) => `${fixture.opponent} (${fixture.venue})`)
                              .join(", ")}`
                      }
                      style={{
                        width: "100%",
                        overflow: "hidden",
                        borderBottomLeftRadius: 5,
                        borderBottomRightRadius: 5,
                      }}
                    >
                      <View style={{ flexDirection: "row" }}>
                        <View
                          style={{
                            flex: 1,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "#252329",
                            paddingVertical: 2,
                          }}
                        >
                          <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.7}
                            style={{
                              color: showPointsText ? ptsColor : "#a3a3a3",
                              fontSize: 10,
                              textAlign: "center",
                              fontWeight: "900",
                            }}
                          >
                            {showPointsText
                              ? `${ptsVal} pts`
                              : `${currentFx.opponent} (${currentFx.venue})`}
                          </Text>
                        </View>
                      </View>
                      {displayedFixtures.length > 0 && (
                        <View style={{ flexDirection: "row", height: 4 }}>
                          {displayedFixtures.map((fixture, index) => (
                            <View
                              key={`${r.id}-${fixture.opponent}-${fixture.venue}-${index}-difficulty`}
                              style={{
                                flex: 1,
                                marginRight:
                                  index < displayedFixtures.length - 1 ? 2 : 0,
                                backgroundColor:
                                  fixture.difficulty === "easy"
                                    ? "#00e676"
                                    : fixture.difficulty === "average"
                                      ? "#f5f5f5"
                                      : "#f02d55",
                              }}
                            />
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })() : fixtures.length > 0 && selectedGw !== undefined ? (
                  <View
                    style={{
                      width: "100%",
                      alignItems: "center",
                      paddingVertical: 2,
                      borderBottomLeftRadius: 5,
                      borderBottomRightRadius: 5,
                      backgroundColor: "#252329",
                    }}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 8,
                        fontWeight: "900",
                      }}
                    >
                      BLANK GW
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
          </>
        );

        return (
          <>
            {isBenched ? (
              <View
                style={{
                  alignItems: "center",
                  width: 78,
                  maxWidth: "100%",
                  paddingTop: 5,
                  paddingBottom: 5,
                  paddingHorizontal: 3,
                  borderRadius: 14,
                  backgroundColor: benchedCardBg,
                  borderWidth: 1,
                  borderColor: benchedCardBorder,
                  shadowColor: isBenchedGK ? "#ffd400" : "#00d982",
                  shadowOpacity: isHighlight ? 0.5 : 0.12,
                  shadowRadius: isHighlight ? 10 : 4,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: isHighlight ? 6 : 2,
                }}
              >
                {cardContent}
              </View>
            ) : (
              cardContent
            )}

            {/* Action Menu: C, V, Details (lineup mode) or Transfer, Details (transfers mode) */}
            {selected && (
              <View
                style={{
                  position: "absolute",
                  ...(isRightmost
                    ? { left: isBenched ? -24 : -22 }
                    : { right: isBenched ? -24 : -22 }),
                  top: isBenched ? 4 : 0,
                  zIndex: 99,
                  gap: 5,
                  alignItems: "center",
                }}
              >
                {/* Transfer Out Button (Transfers mode only) */}
                {showPrice && onTransfer && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation?.();
                      onTransfer(r);
                    }}
                    hitSlop={6}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: "#252329",
                      borderWidth: 1.5,
                      borderColor: "#ff3b30",
                      alignItems: "center",
                      justifyContent: "center",
                      shadowColor: "#000",
                      shadowOpacity: 0.35,
                      shadowRadius: 4,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: 6,
                    }}
                  >
                    <TransferOutIcon size={14} color="#ff3b30" />
                  </Pressable>
                )}

                {/* Captain 'C' Button (Lineup Mode only, starters only) */}
                {!showPrice && !isBenched && onSetCaptain && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation?.();
                      onSetCaptain?.(r);
                    }}
                    hitSlop={6}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: "#ffd400",
                      alignItems: "center",
                      justifyContent: "center",
                      shadowColor: "#000",
                      shadowOpacity: 0.35,
                      shadowRadius: 4,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: "#000",
                        fontSize: 11,
                        fontWeight: "900",
                        includeFontPadding: false,
                      }}
                    >
                      C
                    </Text>
                  </Pressable>
                )}

                {/* Vice Captain 'V' Button (Lineup Mode only, starters only) */}
                {!showPrice && !isBenched && onSetViceCaptain && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation?.();
                      onSetViceCaptain?.(r);
                    }}
                    hitSlop={6}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: "#ffffff",
                      alignItems: "center",
                      justifyContent: "center",
                      shadowColor: "#000",
                      shadowOpacity: 0.35,
                      shadowRadius: 4,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: "#000",
                        fontSize: 11,
                        fontWeight: "900",
                        includeFontPadding: false,
                      }}
                    >
                      V
                    </Text>
                  </Pressable>
                )}

                {/* Details Button */}
                {onOpenDetails && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation?.();
                      onOpenDetails?.(r);
                    }}
                    hitSlop={6}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: "#252329",
                      borderWidth: 1,
                      borderColor: "#ffffff",
                      alignItems: "center",
                      justifyContent: "center",
                      shadowColor: "#000",
                      shadowOpacity: 0.35,
                      shadowRadius: 4,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: 6,
                    }}
                  >
                    <InfoIcon size={16} color="#ffffff" />
                  </Pressable>
                )}
              </View>
            )}
          </>
        );
      }}
    </Pressable>
  );
}

function PitchRow({
  rows,
  selectedGw,
  selectedPos,
  showPrice,
  compact = false,
  onPress,
  onSetCaptain,
  onSetViceCaptain,
  onOpenDetails,
  onTransfer,
  benched = false,
}: {
  rows: Row[];
  selectedGw?: number;
  selectedPos: number | null;
  showPrice: boolean;
  compact?: boolean;
  onPress?: (r: Row) => void;
  onSetCaptain?: (r: Row) => void;
  onSetViceCaptain?: (r: Row) => void;
  onOpenDetails?: (r: Row) => void;
  onTransfer?: (r: Row) => void;
  benched?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        width: "100%",
        alignSelf: "stretch",
        justifyContent: rows.length <= 2 ? "center" : "space-between",
        columnGap: rows.length === 2 ? (compact ? 28 : 36) : rows.length > 1 ? (compact ? 3 : 5) : 0,
        flexWrap: "nowrap",
        marginVertical: benched ? 0 : (compact ? 1 : 2),
        paddingHorizontal: benched ? (compact ? 4 : 6) : 8,
      }}
    >
      {rows.map((r, index) => (
        <PlayerCard
          key={r.pos}
          r={r}
          selectedGw={selectedGw}
          selected={selectedPos === r.pos}
          showPrice={showPrice}
          isRightmost={index === rows.length - 1}
          compact={compact}
          onPress={onPress}
          onSetCaptain={onSetCaptain}
          onSetViceCaptain={onSetViceCaptain}
          onOpenDetails={onOpenDetails}
          onTransfer={onTransfer}
        />
      ))}
    </View>
  );
}

export function Pitch({
  picks,
  selectedGw,
  selectedPos,
  showPrice = false,
  compactAvatar = false,
  onPress,
  onSetCaptain,
  onSetViceCaptain,
  onOpenDetails,
  onTransfer,
  onBackgroundPress,
  overlay,
}: {
  picks: Row[];
  selectedGw?: number;
  selectedPos: number | null;
  showPrice?: boolean;
  compactAvatar?: boolean;
  onPress?: (r: Row) => void;
  onSetCaptain?: (r: Row) => void;
  onSetViceCaptain?: (r: Row) => void;
  onOpenDetails?: (r: Row) => void;
  onTransfer?: (r: Row) => void;
  onBackgroundPress?: () => void;
  overlay?: ReactNode;
}) {
  const isCompactAvatar = compactAvatar || showPrice;

  const starters = picks.filter((p) => p.pos <= 11);
  const bench = picks.filter((p) => p.pos > 11).sort((a, b) => a.pos - b.pos);
  const line = (type: number) => starters.filter((p) => p.type === type);

  return (
    <Pressable
      onPress={onBackgroundPress}
      style={{
        flex: 1,
        width: "100%",
        alignSelf: "stretch",
        justifyContent: "space-between",
        paddingBottom: 0,
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#073b12",
          marginHorizontal: 0,
          borderRadius: 16,
          paddingVertical: 8,
          justifyContent: "space-between",
          overflow: "hidden",
          borderWidth: 1.5,
          borderColor: "rgba(16, 125, 68, 0.25)",
          shadowColor: "#107d44",
          shadowOpacity: 0.15,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 2 },
          elevation: 5,
        }}
      >
        <Image
          source={require("../assets/images/pitch.svg")}
          contentFit="fill"
          accessible={false}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
          }}
        />
        <View style={{ flex: 1, justifyContent: "space-between", paddingTop: 8, paddingBottom: 4 }}>
          <PitchRow
            rows={line(1)}
            selectedGw={selectedGw}
            selectedPos={selectedPos}
            showPrice={showPrice}
            compact={isCompactAvatar}
            onPress={onPress}
            onSetCaptain={onSetCaptain}
            onSetViceCaptain={onSetViceCaptain}
            onOpenDetails={onOpenDetails}
            onTransfer={onTransfer}
          />
          <PitchRow
            rows={line(2)}
            selectedGw={selectedGw}
            selectedPos={selectedPos}
            showPrice={showPrice}
            compact={isCompactAvatar}
            onPress={onPress}
            onSetCaptain={onSetCaptain}
            onSetViceCaptain={onSetViceCaptain}
            onOpenDetails={onOpenDetails}
            onTransfer={onTransfer}
          />
          <PitchRow
            rows={line(3)}
            selectedGw={selectedGw}
            selectedPos={selectedPos}
            showPrice={showPrice}
            compact={isCompactAvatar}
            onPress={onPress}
            onSetCaptain={onSetCaptain}
            onSetViceCaptain={onSetViceCaptain}
            onOpenDetails={onOpenDetails}
            onTransfer={onTransfer}
          />
          <PitchRow
            rows={line(4)}
            selectedGw={selectedGw}
            selectedPos={selectedPos}
            showPrice={showPrice}
            compact={isCompactAvatar}
            onPress={onPress}
            onSetCaptain={onSetCaptain}
            onSetViceCaptain={onSetViceCaptain}
            onOpenDetails={onOpenDetails}
            onTransfer={onTransfer}
          />
        </View>
        {overlay}
      </View>

      <View
        style={{
          backgroundColor: "rgba(10, 32, 21, 0.75)",
          marginHorizontal: 4,
          marginTop: isCompactAvatar ? 2 : 4,
          borderRadius: 14,
          paddingVertical: isCompactAvatar ? 3 : 5,
          paddingHorizontal: 6,
          borderWidth: 1.5,
          borderColor: "rgba(16, 125, 68, 0.25)",
          elevation: 8,
          shadowColor: "#107d44",
          shadowOpacity: 0.2,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 0 },
          overflow: "hidden",
        }}
      >
        <GlassView
          pointerEvents="none"
          glassEffectStyle="regular"
          tintColor="rgba(12, 36, 24, 0.7)"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            borderRadius: 14,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 12,
            right: 12,
            height: 1,
            backgroundColor: "rgba(255, 255, 255, 0.35)",
          }}
        />
        <PitchRow
          rows={bench}
          selectedGw={selectedGw}
          selectedPos={selectedPos}
          showPrice={showPrice}
          compact={isCompactAvatar}
          onPress={onPress}
          onSetCaptain={onSetCaptain}
          onSetViceCaptain={onSetViceCaptain}
          onOpenDetails={onOpenDetails}
          onTransfer={onTransfer}
          benched
        />
      </View>
    </Pressable>
  );
}
