import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
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
const TEAM_AVATARS: Record<string, any> = {
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
}: {
  team: string;
  benched: boolean;
  goalkeeper: boolean;
}) {
  const avatarSource = (team && TEAM_AVATARS[team]) ? TEAM_AVATARS[team] : require("../assets/images/final-avatar/no-club.png");
  const displayTeam = team && TEAM_AVATARS[team] ? team : "";

  return (
    <View
      style={{
        width: 54,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        <Image
          source={avatarSource}
          contentFit="contain"
          style={{
            width: 60,
            height: 60,
            transform: [{ scale: benched ? 0.95 : 1.15 }],
          }}
        />
        {!!displayTeam && (
          <View
            style={{
              position: "absolute",
              bottom: 2,
              backgroundColor: "rgba(20, 45, 92, 0.92)",
              paddingHorizontal: 4,
              paddingVertical: 1,
              borderRadius: 3,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.4)",
            }}
          >
            <Text
              style={{
                color: "#ffffff",
                fontSize: 8,
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

function PlayerCard({
  r,
  selectedGw,
  selected,
  showPrice,
  onPress,
}: {
  r: Row;
  selectedGw?: number;
  selected: boolean;
  showPrice: boolean;
  onPress?: (r: Row) => void;
}) {
  const fixtures = r.fixtures ?? [];
  const selectedFixtureIndex = fixtures.findIndex(
    (fixture) => fixture.event === selectedGw,
  );
  const displayedFixtures =
    selectedFixtureIndex < 0
      ? []
      : fixtures.slice(selectedFixtureIndex, selectedFixtureIndex + 3);
  const benchedGoalkeeper = r.pos > 11 && r.type === 1;

  return (
    <Pressable
      disabled={!onPress}
      onPress={() => onPress?.(r)}
      style={{
        alignItems: "center",
        flex: 1,
        flexBasis: 0,
        maxWidth: 140,
        minWidth: 0,
        paddingVertical: r.pos > 11 ? 7 : 0,
        borderRadius: 18,
        backgroundColor: "transparent",
        borderWidth: 0,
        borderColor: "transparent",
      }}
    >
      <View
        style={{
          width: 54,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 10,
          backgroundColor: selected ? "#fff6a8" : "transparent",
          borderWidth: selected ? 2 : 0,
          borderColor: selected ? "#ff9f00" : "transparent",
        }}
      >
        <PlayerAvatar
          team={r.team}
          benched={r.pos > 11}
          goalkeeper={r.type === 1}
        />
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
        {r.displayPoints != null && (
          <View
            style={{
              position: "absolute",
              top: 0,
              right: -5,
              minWidth: 32,
              paddingHorizontal: 3,
              height: 16,
              borderRadius: 8,
              backgroundColor: r.displayPoints < 0 ? "#d32f2f" : "#00d982",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: r.displayPoints < 0 ? "#fff" : "#37003c",
                fontSize: 9,
                fontWeight: "900",
              }}
            >
              {r.displayPoints === 0 ? "-" : `${r.displayPoints} pts`}
            </Text>
          </View>
        )}
        {(r.cap || r.vice) && (
          <View
            style={{
              position: "absolute",
              bottom: 0,
              right: r.displayPoints != null ? undefined : 0,
              left: r.displayPoints != null ? 0 : undefined,
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
        <View style={{ width: 72, maxWidth: "100%", marginTop: 0 }}>
          <View
            style={{
              backgroundColor: "#37003c",
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
                color: "#fff",
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
                  minHeight: 18,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                  paddingHorizontal: 2,
                  paddingVertical: 2,
                  backgroundColor: "#252329",
                }}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={{ color: "#fff", fontSize: 8, fontWeight: "900" }}
                >
                  £{((r.price ?? r.buy) / 10).toFixed(1)}m
                </Text>
                {!!r.priceChange && (
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.65}
                    style={{
                      color: r.priceChange > 0 ? "#00e676" : "#ff526f",
                      fontSize: 7,
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
          ) : displayedFixtures.length > 0 ? (
            <View
              accessibilityLabel={`Fixtures from GW ${selectedGw}: ${displayedFixtures
                .map((fixture) => `${fixture.opponent} (${fixture.venue})`)
                .join(", ")}`}
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
                      color: "#fff",
                      fontSize: 8,
                      textAlign: "center",
                      fontWeight: "900",
                    }}
                  >
                    {displayedFixtures[0].opponent} ({displayedFixtures[0].venue})
                  </Text>
                </View>
              </View>
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
            </View>
          ) : fixtures.length > 0 && selectedGw !== undefined ? (
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
    </Pressable>
  );
}

function PitchRow({
  rows,
  selectedGw,
  selectedPos,
  showPrice,
  onPress,
  benched = false,
}: {
  rows: Row[];
  selectedGw?: number;
  selectedPos: number | null;
  showPrice: boolean;
  onPress?: (r: Row) => void;
  benched?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        width: "100%",
        alignSelf: "stretch",
        justifyContent: rows.length === 1 ? "center" : "space-between",
        columnGap: rows.length > 1 ? 6 : 0,
        flexWrap: "nowrap",
        marginVertical: benched ? 1 : 4,
        paddingHorizontal: benched ? 8 : 10,
      }}
    >
      {rows.map((r) => (
        <PlayerCard
          key={r.pos}
          r={r}
          selectedGw={selectedGw}
          selected={selectedPos === r.pos}
          showPrice={showPrice}
          onPress={onPress}
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
  onPress,
  overlay,
}: {
  picks: Row[];
  selectedGw?: number;
  selectedPos: number | null;
  showPrice?: boolean;
  onPress?: (r: Row) => void;
  overlay?: ReactNode;
}) {
  const starters = picks.filter((p) => p.pos <= 11);
  const bench = picks.filter((p) => p.pos > 11).sort((a, b) => a.pos - b.pos);
  const line = (type: number) => starters.filter((p) => p.type === type);

  return (
    <View
      style={{
        flex: 1,
        width: "100%",
        alignSelf: "stretch",
        justifyContent: "space-between",
        paddingBottom: 4,
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#073b12",
          marginHorizontal: 0,
          borderRadius: 26,
          paddingVertical: 8,
          justifyContent: "space-between",
          overflow: "hidden",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.45)",
          elevation: 3,
        }}
      >
        <Image
          source={require("../assets/images/pitch.svg")}
          contentFit="cover"
          accessible={false}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
          }}
        />
        <View style={{ flex: 1, justifyContent: "space-between", paddingVertical: 2 }}>
          <PitchRow
            rows={line(1)}
            selectedGw={selectedGw}
            selectedPos={selectedPos}
            showPrice={showPrice}
            onPress={onPress}
          />
          <PitchRow
            rows={line(2)}
            selectedGw={selectedGw}
            selectedPos={selectedPos}
            showPrice={showPrice}
            onPress={onPress}
          />
          <PitchRow
            rows={line(3)}
            selectedGw={selectedGw}
            selectedPos={selectedPos}
            showPrice={showPrice}
            onPress={onPress}
          />
          <PitchRow
            rows={line(4)}
            selectedGw={selectedGw}
            selectedPos={selectedPos}
            showPrice={showPrice}
            onPress={onPress}
          />
        </View>
        {overlay}
      </View>

      <View
        style={{
          backgroundColor: "rgba(10, 32, 21, 0.75)",
          marginHorizontal: 4,
          marginTop: 6,
          borderRadius: 26,
          paddingVertical: 8,
          paddingHorizontal: 8,
          borderWidth: 1.5,
          borderColor: "rgba(0, 217, 130, 0.5)",
          elevation: 8,
          shadowColor: "#00d982",
          shadowOpacity: 0.4,
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
            borderRadius: 26,
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
          onPress={onPress}
          benched
        />
      </View>
    </View>
  );
}
