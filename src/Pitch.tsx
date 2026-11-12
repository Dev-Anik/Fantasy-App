import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Animated,
  Easing,
  Pressable,
  Text,
  View,
  useAnimatedValue,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { GlassView } from "expo-glass-effect";
import { AppSymbol } from "./AppSymbol";
import { Row } from "./fpl";
import { Jersey, JERSEY_HEM, JERSEY_LAYERS } from "./Jersey";
import { KIT_COLORS } from "./kits";

const GREEN = "#00d982";

// How players are drawn across the app: a club-coloured jersey, or the 3D
// kit avatar. Change this one value to switch every screen.
export const PLAYER_ART: "jersey" | "avatar" = "jersey";

export const TEAM_AVATARS: Record<string, any> = {
  ARS: require("../assets/images/avatar-sm/Ars.png"),
  AVL: require("../assets/images/avatar-sm/Avl.png"),
  BHA: require("../assets/images/avatar-sm/Bha.png"),
  BOU: require("../assets/images/avatar-sm/Bou.png"),
  BRE: require("../assets/images/avatar-sm/Bre.png"),
  CHE: require("../assets/images/avatar-sm/Che.png"),
  COV: require("../assets/images/avatar-sm/Cov.png"),
  CRY: require("../assets/images/avatar-sm/Cry.png"),
  EVE: require("../assets/images/avatar-sm/Eve.png"),
  FUL: require("../assets/images/avatar-sm/Ful.png"),
  HUL: require("../assets/images/avatar-sm/Hul.png"),
  IPS: require("../assets/images/avatar-sm/Ips.png"),
  LEE: require("../assets/images/avatar-sm/Lee.png"),
  LIV: require("../assets/images/avatar-sm/Liv.png"),
  MCI: require("../assets/images/avatar-sm/Mci.png"),
  MUN: require("../assets/images/avatar-sm/Mun.png"),
  NEW: require("../assets/images/avatar-sm/New.png"),
  NFO: require("../assets/images/avatar-sm/Nfo.png"),
  SUN: require("../assets/images/avatar-sm/Sun.png"),
  TOT: require("../assets/images/avatar-sm/Tot.png"),
};

const NO_CLUB_AVATAR = require("../assets/images/avatar-sm/no-club.png");

// Warm the image pipeline for the player art in use. Best effort: a failure
// here only means that image loads on first use.
let avatarsPreloaded = false;
export function preloadAvatars() {
  if (avatarsPreloaded) return;
  avatarsPreloaded = true;
  const sources =
    PLAYER_ART === "jersey"
      ? JERSEY_LAYERS
      : [...Object.values(TEAM_AVATARS), NO_CLUB_AVATAR];
  sources.forEach((source) => {
    Image.loadAsync(source).catch(() => {});
  });
}

// Player art at a fixed size, for lists and sheets outside the pitch.
export function PlayerArt({
  team,
  goalkeeper = false,
  size,
}: {
  team: string;
  goalkeeper?: boolean;
  size: number;
}) {
  if (PLAYER_ART === "jersey") {
    return <Jersey team={team} goalkeeper={goalkeeper} size={size} />;
  }
  return (
    <Image
      source={(team && TEAM_AVATARS[team]) || NO_CLUB_AVATAR}
      contentFit="contain"
      cachePolicy="memory-disk"
      accessible={false}
      style={{ width: size, height: size }}
    />
  );
}

// ---------------------------------------------------------------------------
// Responsive sizing
//
// Every card dimension is derived from the measured pitch width, so a row of
// five always fits on small phones and nothing looks lost on tablets. The
// original design was drawn at a 72pt card, so `scale` is relative to that.
// ---------------------------------------------------------------------------

const DESIGN_CARD_WIDTH = 72;
const ROW_PADDING = 6;
const MIN_GAP = 4;
// Stops pitch text from blowing out the layout at very large system font sizes.
const MAX_FONT_MULTIPLIER = 1.15;

type PitchMetrics = {
  pitchWidth: number;
  cardWidth: number;
  benchWidth: number;
  scale: number;
};

// Each avatar reports here once its image has loaded (or failed), so the
// pitch can reveal the whole squad together instead of player by player.
const AvatarSettledContext = createContext<() => void>(() => {});
// If an image never reports, show the squad anyway after this long.
const REVEAL_TIMEOUT_MS = 1200;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function computeMetrics(pitchWidth: number): PitchMetrics {
  const cardWidth = Math.floor(
    clamp((pitchWidth - ROW_PADDING * 2 - MIN_GAP * 4) / 5, 54, 86),
  );
  return {
    pitchWidth,
    cardWidth,
    benchWidth: cardWidth + 6,
    scale: cardWidth / DESIGN_CARD_WIDTH,
  };
}

const PitchMetricsContext = createContext<PitchMetrics>(computeMetrics(360));

// Horizontal gap between cards in a row. Rows with fewer players stay grouped
// around the centre instead of being pushed out to the touchlines.
function rowGap(count: number, slotWidth: number, rowWidth: number, maxGap: number) {
  if (count <= 1) return 0;
  const evenGap = (rowWidth - count * slotWidth) / (count - 1);
  return Math.max(MIN_GAP, Math.min(evenGap, maxGap));
}

// Very dark shirts (e.g. black/white stripes) use their trim for the accent so
// it stays visible on the dark badge.
function badgeAccent(team: string) {
  const kit = KIT_COLORS[team];
  if (!kit) return GREEN;
  const hex = kit.shirt.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 0.12 ? kit.trim : kit.shirt;
}

function PlayerAvatar({
  team,
  benched,
  goalkeeper,
  compact = false,
  swapHint = false,
}: {
  team: string;
  benched: boolean;
  goalkeeper: boolean;
  compact?: boolean;
  swapHint?: boolean;
}) {
  const { cardWidth, scale } = useContext(PitchMetricsContext);
  const onSettled = useContext(AvatarSettledContext);
  const reported = useRef(false);
  const reportSettled = () => {
    if (reported.current) return;
    reported.current = true;
    onSettled();
  };
  const useJersey = PLAYER_ART === "jersey";
  const hasAvatar = Boolean(team && (useJersey ? KIT_COLORS[team] : TEAM_AVATARS[team]));
  const avatarSource = (team && TEAM_AVATARS[team]) || NO_CLUB_AVATAR;

  const boxWidth = cardWidth - 6;
  const boxHeight = Math.round((compact ? 34 : 42) * scale);
  const imageSize = Math.round((benched ? (compact ? 63 : 67) : 72) * scale);
  // The head may rise above the box; the hem tucks under the name plate.
  const imageTop = boxHeight / 2 - imageSize / 2 + (compact ? 3 : 4) * scale;
  const badgeFont = Math.max(compact ? 8 : 8.5, (compact ? 8.5 : 9.5) * scale);
  // Room for the widest three-letter code ("WWW") at this font size.
  const badgeWidth = Math.min(boxWidth, Math.round(badgeFont * 2.9 + 8));
  // Jersey: as large as the card allows, with its hem resting on the name
  // plate. The club code is printed on the shirt itself.
  const jerseySize = Math.round(Math.min(boxWidth, boxHeight * 1.5));
  const jerseyTop = Math.round(boxHeight - jerseySize * JERSEY_HEM + 1);
  // Swap badge: centred on the shirt body (or on the avatar box).
  const swapSize = Math.round(clamp(24 * scale, 20, 30));
  const swapCentreY = useJersey ? jerseyTop + jerseySize * 0.47 : boxHeight / 2;

  return (
    <View style={{ width: boxWidth, height: boxHeight }}>
      {useJersey ? (
        <View
          style={{
            position: "absolute",
            top: jerseyTop,
            left: (boxWidth - jerseySize) / 2,
          }}
        >
          <Jersey
            team={team}
            goalkeeper={goalkeeper}
            size={jerseySize}
            showCode
            onReady={reportSettled}
          />
        </View>
      ) : (
      <Image
        source={avatarSource}
        contentFit="contain"
        accessible={false}
        // Keep decoded avatars in memory so revisiting a pitch is instant, and
        // soften the first appearance instead of letting it pop in.
        cachePolicy="memory-disk"
        priority="high"
        transition={120}
        onLoad={reportSettled}
        onError={reportSettled}
        style={{
          position: "absolute",
          top: imageTop,
          left: (boxWidth - imageSize) / 2,
          width: imageSize,
          height: imageSize,
        }}
      />
      )}
      {hasAvatar && !useJersey && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: Math.round(2 * scale),
            // Fixed width: content-sized tags drop the last letter on Android.
            left: (boxWidth - badgeWidth) / 2,
            width: badgeWidth,
            alignItems: "center",
            backgroundColor: "rgba(6, 14, 10, 0.9)",
            paddingVertical: 1,
            borderRadius: 4,
            borderWidth: 0.5,
            borderColor: "rgba(255, 255, 255, 0.25)",
            borderBottomWidth: 2,
            borderBottomColor: badgeAccent(team),
            shadowColor: "#000",
            shadowOpacity: 0.45,
            shadowRadius: 2,
            shadowOffset: { width: 0, height: 1 },
            elevation: 3,
          }}
        >
          <Text
            numberOfLines={1}
            allowFontScaling={false}
            style={{
              width: "100%",
              color: "#ffffff",
              fontSize: badgeFont,
              lineHeight: badgeFont + 2,
              fontWeight: "900",
              textAlign: "center",
              includeFontPadding: false,
              textAlignVertical: "center",
            }}
          >
            {team}
          </Text>
        </View>
      )}
      {swapHint && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: Math.round(swapCentreY - swapSize / 2),
            left: (boxWidth - swapSize) / 2,
            zIndex: 20,
          }}
        >
          <SwapBadge size={swapSize} />
        </View>
      )}
    </View>
  );
}

// Shown over the selected player's shirt: pops in, then the arrows keep
// flipping to signal "tap another player to swap".
function SwapBadge({ size }: { size: number }) {
  const pop = useAnimatedValue(0);
  const spin = useAnimatedValue(0);

  useEffect(() => {
    const popIn = Animated.spring(pop, {
      toValue: 1,
      friction: 5,
      tension: 140,
      useNativeDriver: true,
    });
    // The icon is symmetrical, so a half turn loops without a visible reset.
    const flip = Animated.loop(
      Animated.sequence([
        Animated.timing(spin, {
          toValue: 1,
          duration: 550,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(650),
      ]),
    );
    popIn.start();
    flip.start();
    return () => {
      popIn.stop();
      flip.stop();
    };
  }, [pop, spin]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(6, 14, 10, 0.88)",
        borderWidth: 1.5,
        borderColor: "#ffd400",
        shadowColor: "#000",
        shadowOpacity: 0.4,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
        elevation: 4,
        opacity: pop,
        transform: [{ scale: pop }],
      }}
    >
      <Animated.View
        style={{
          transform: [
            {
              rotate: spin.interpolate({
                inputRange: [0, 1],
                outputRange: ["0deg", "180deg"],
              }),
            },
          ],
        }}
      >
        <AppSymbol
          name={{ ios: "arrow.left.arrow.right", android: "swap_horiz", web: "swap_horiz" }}
          color="#ffd400"
          size={Math.round(size * 0.62)}
        />
      </Animated.View>
    </Animated.View>
  );
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
  swapHint = false,
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
  swapHint?: boolean;
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
  const { cardWidth, benchWidth, scale } = useContext(PitchMetricsContext);
  const nameFont = Math.max(9, Math.round(10 * scale * 2) / 2);
  const infoFont = Math.max(8.5, Math.round(9.5 * scale * 2) / 2);

  return (
    <Pressable
      disabled={!onPress}
      onPress={() => onPress?.(r)}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${r.name}${r.team ? `, ${r.team}` : ""}${posLabel ? `, ${posLabel}` : ""}${
        r.cap ? ", captain" : r.vice ? ", vice captain" : ""
      }${isBenched ? ", on bench" : ""}${r.pendingIn ? ", transfer in, not yet confirmed" : ""}`}
      android_ripple={{ color: "rgba(255, 212, 0, 0.3)", borderless: false, radius: 24 }}
      style={({ pressed }) => ({
        alignItems: "center",
        alignSelf: "center",
        width: isBenched ? benchWidth : cardWidth,
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
                width: cardWidth - 6,
                height: Math.round((compact ? 34 : 42) * scale),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PlayerAvatar
                team={r.team}
                benched={isBenched}
                goalkeeper={r.type === 1}
                compact={compact}
                swapHint={swapHint && selected}
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

              {r.pendingIn && (
                <View
                  style={{
                    position: "absolute",
                    top: isBenched ? 9 : 2,
                    left: 0,
                    borderRadius: 5,
                    paddingHorizontal: 4,
                    paddingVertical: 1,
                    backgroundColor: GREEN,
                    zIndex: 10,
                  }}
                >
                  <Text
                    allowFontScaling={false}
                    style={{
                      color: "#071b12",
                      fontSize: 8,
                      fontWeight: "900",
                      includeFontPadding: false,
                    }}
                  >
                    IN
                  </Text>
                </View>
              )}

              {r.formMood && !r.pendingIn && (
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
              <View style={{ width: cardWidth, maxWidth: "100%", marginTop: isBenched ? 2 : 0 }}>
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
                      : r.pendingIn
                        ? GREEN
                        : "transparent",
                    borderWidth: isHighlight || r.pendingIn ? 1 : 0,
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
                    maxFontSizeMultiplier={MAX_FONT_MULTIPLIER}
                    style={{
                      color: isHighlight
                        ? isBenchedGK
                          ? "#38bdf8"
                          : "#ffd400"
                        : "#fff",
                      fontSize: nameFont,
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
                        maxFontSizeMultiplier={MAX_FONT_MULTIPLIER}
                        style={{ color: "#fff", fontSize: infoFont, fontWeight: "900" }}
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
                  const ptsVal = r.displayPoints ?? 0;
                  const ptsColor = ptsVal < 0 ? "#ff526f" : "#ffd400";

                  // Points view (minutes data present): show opponent for unstarted fixtures,
                  // dash for benched/unused, actual points only when player has played.
                  const hasMinutes = r.minutes !== undefined;
                  let cellText: string;
                  let cellColor: string;
                  if (hasMinutes) {
                    if ((r.minutes ?? 0) > 0) {
                      cellText = `${ptsVal} pts`;
                      cellColor = ptsColor;
                    } else if (currentFx && !isStarted) {
                      cellText = `${currentFx.opponent} (${currentFx.venue})`;
                      cellColor = "#a3a3a3";
                    } else {
                      cellText = "—";
                      cellColor = "#777";
                    }
                  } else {
                    const showPointsText = Boolean(isStarted || !currentFx);
                    cellText = showPointsText
                      ? `${ptsVal} pts`
                      : `${currentFx!.opponent} (${currentFx!.venue})`;
                    cellColor = showPointsText ? ptsColor : "#a3a3a3";
                  }

                  return (
                    <View
                      accessibilityLabel={cellText}
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
                            maxFontSizeMultiplier={MAX_FONT_MULTIPLIER}
                            style={{
                              color: cellColor,
                              fontSize: nameFont,
                              textAlign: "center",
                              fontWeight: "900",
                            }}
                          >
                            {cellText}
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
                  width: benchWidth,
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
  swapHint = false,
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
  swapHint?: boolean;
  onPress?: (r: Row) => void;
  onSetCaptain?: (r: Row) => void;
  onSetViceCaptain?: (r: Row) => void;
  onOpenDetails?: (r: Row) => void;
  onTransfer?: (r: Row) => void;
  benched?: boolean;
}) {
  const { cardWidth, benchWidth, pitchWidth } = useContext(PitchMetricsContext);
  const slotWidth = benched ? benchWidth : cardWidth;
  // Bench sits in an inset tray (4pt margin + 6pt padding + border each side).
  const rowWidth = pitchWidth - ROW_PADDING * 2 - (benched ? 22 : 0);
  // The bench is a fixed set of four, so it may spread wider than pitch lines.
  const maxGap = cardWidth * (benched ? 0.6 : 0.45);
  const gap = rowGap(rows.length, slotWidth, rowWidth, maxGap);

  return (
    <View
      style={{
        flexDirection: "row",
        width: "100%",
        alignSelf: "stretch",
        justifyContent: "center",
        columnGap: gap,
        flexWrap: "nowrap",
        marginVertical: benched ? 0 : compact ? 1 : 2,
        paddingHorizontal: benched ? 0 : ROW_PADDING,
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
          swapHint={swapHint}
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
  swapHint = false,
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
  // Show an animated swap badge on the selected player's shirt.
  swapHint?: boolean;
  onPress?: (r: Row) => void;
  onSetCaptain?: (r: Row) => void;
  onSetViceCaptain?: (r: Row) => void;
  onOpenDetails?: (r: Row) => void;
  onTransfer?: (r: Row) => void;
  onBackgroundPress?: () => void;
  overlay?: ReactNode;
}) {
  const isCompactAvatar = compactAvatar || showPrice;
  const { width: windowWidth } = useWindowDimensions();
  // Measured width wins; the window width is only a first-frame estimate.
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const metrics = computeMetrics(measuredWidth ?? windowWidth - 16);

  // Players stay hidden until every avatar is ready, then fade in as one.
  const reveal = useAnimatedValue(0);
  const revealed = useRef(false);
  const settledCount = useRef(0);
  const expectedCount = useRef(picks.length);
  const showSquad = useCallback(() => {
    if (revealed.current) return;
    revealed.current = true;
    Animated.timing(reveal, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [reveal]);
  const onAvatarSettled = useCallback(() => {
    settledCount.current += 1;
    if (settledCount.current >= expectedCount.current) showSquad();
  }, [showSquad]);
  useEffect(() => {
    expectedCount.current = picks.length;
    if (picks.length === 0 || settledCount.current >= picks.length) showSquad();
  }, [picks.length, showSquad]);
  useEffect(() => {
    const timer = setTimeout(showSquad, REVEAL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [showSquad]);

  const starters = picks.filter((p) => p.pos <= 11);
  const bench = picks.filter((p) => p.pos > 11).sort((a, b) => a.pos - b.pos);
  const lines = [1, 2, 3, 4].map((type) => starters.filter((p) => p.type === type));
  const rowProps = {
    selectedGw,
    selectedPos,
    showPrice,
    compact: isCompactAvatar,
    swapHint,
    onPress,
    onSetCaptain,
    onSetViceCaptain,
    onOpenDetails,
    onTransfer,
  };

  return (
    <PitchMetricsContext.Provider value={metrics}>
      <AvatarSettledContext.Provider value={onAvatarSettled}>
      <Pressable
        onPress={onBackgroundPress}
        onLayout={(event) => {
          const width = Math.round(event.nativeEvent.layout.width);
          setMeasuredWidth((current) => (current === width ? current : width));
        }}
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
          <Animated.View
            style={{
              flex: 1,
              justifyContent: "space-between",
              paddingTop: Math.round(10 * metrics.scale),
              paddingBottom: 4,
              opacity: reveal,
            }}
          >
            {lines.map((rows, index) => (
              <PitchRow key={index} rows={rows} {...rowProps} />
            ))}
          </Animated.View>
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
          <Animated.View style={{ opacity: reveal }}>
            <PitchRow rows={bench} {...rowProps} benched />
          </Animated.View>
        </View>
      </Pressable>
      </AvatarSettledContext.Provider>
    </PitchMetricsContext.Provider>
  );
}
