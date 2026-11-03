import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { Row } from "./fpl";

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
  const teamKit = KIT_COLORS[team] ?? {
    shirt: "#37003c",
    trim: "#00ff87",
  };
  const kit = goalkeeper
    ? (GOALKEEPER_KIT_COLORS[team] ?? teamKit)
    : teamKit;
  const shirtTop = benched ? 41 : 37;
  const shirtWidth = benched ? 42 : 46;

  return (
    <View
      style={{
        width: 54,
        height: 52,
        alignItems: "center",
        transform: [{ scale: 0.88 }],
      }}
    >
      {benched && (
        <>
          <View
            style={{
              position: "absolute",
              top: 5,
              width: 58,
              height: 58,
              borderTopLeftRadius: 19,
              borderTopRightRadius: 19,
              borderBottomLeftRadius: 9,
              borderBottomRightRadius: 9,
              backgroundColor: CHAIR,
            }}
          />
          <View
            style={{
              position: "absolute",
              top: 11,
              width: 46,
              height: 48,
              borderTopLeftRadius: 15,
              borderTopRightRadius: 15,
              backgroundColor: "#a9b5c3",
            }}
          />
        </>
      )}

      <View
        style={{
          position: "absolute",
          top: shirtTop,
          width: shirtWidth,
          height: benched ? 25 : 29,
          borderTopLeftRadius: 15,
          borderTopRightRadius: 15,
          backgroundColor: kit.shirt,
          overflow: "hidden",
        }}
      >
        {kit.sleeves && (
          <>
            <View
              style={{
                position: "absolute",
                top: 3,
                left: benched ? 6 : 5,
                width: benched ? 10 : 12,
                height: 13,
                borderRadius: 4,
                backgroundColor: kit.sleeves,
                zIndex: 1,
              }}
            />
            <View
              style={{
                position: "absolute",
                top: 3,
                right: benched ? 6 : 5,
                width: benched ? 10 : 12,
                height: 13,
                borderRadius: 4,
                backgroundColor: kit.sleeves,
                zIndex: 1,
              }}
            />
          </>
        )}
        {kit.pattern === "stripes" &&
          [0, 1, 2].map((stripe) => (
            <View
              key={stripe}
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: (benched ? 7 : 8) + stripe * (benched ? 10 : 10),
                width: benched ? 5 : 6,
                backgroundColor: kit.trim,
              }}
            />
          ))}
      </View>

      <View
        style={{
          position: "absolute",
          top: shirtTop,
          width: 10,
          height: 4,
          borderBottomLeftRadius: 5,
          borderBottomRightRadius: 5,
          backgroundColor: kit.trim,
        }}
      />

      <View
        style={{
          position: "absolute",
          top: benched ? 31 : 27,
          width: 10,
          height: 12,
          backgroundColor: SKIN,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: benched ? 9 : 5,
          width: 26,
          height: 29,
          borderRadius: 12,
          backgroundColor: SKIN,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: benched ? 6 : 2,
          width: 28,
          height: 13,
          borderTopLeftRadius: 11,
          borderTopRightRadius: 11,
          borderBottomLeftRadius: 3,
          borderBottomRightRadius: 3,
          backgroundColor: HAIR,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: benched ? 7 : 3,
          right: 23,
          width: 14,
          height: 6,
          borderBottomLeftRadius: 9,
          backgroundColor: "#493021",
          transform: [{ rotate: "-18deg" }],
        }}
      />

      {!!team && (
        <View
          style={{
            position: "absolute",
            top: benched ? 45 : 43,
            minWidth: 31,
            height: 13,
            paddingHorizontal: 3,
            borderRadius: 3,
            backgroundColor: "#142d5c",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              color: "#ffffff",
              textAlign: "center",
              fontSize: 9,
              lineHeight: 11,
              letterSpacing: 0.3,
              fontWeight: "900",
            }}
          >
            {team}
          </Text>
        </View>
      )}
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
        backgroundColor: benchedGoalkeeper
          ? "#fff2b8"
          : r.pos > 11
            ? "rgba(255,255,255,0.58)"
            : "transparent",
        borderWidth: benchedGoalkeeper ? 1 : 0,
        borderColor: benchedGoalkeeper ? "#e4bd4a" : "transparent",
      }}
    >
      <View
        style={{
          width: 54,
          height: 50,
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
              left: 7,
              width: 15,
              height: 15,
              borderRadius: 8,
              backgroundColor: "#fff",
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
                transform: [{ translateY: -1 }],
                textShadowColor: "#FFC107",
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 1,
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
        <View style={{ width: 72, maxWidth: "100%", marginTop: 4 }}>
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
        marginVertical: benched ? 0 : 4,
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
        width: "100%",
        alignSelf: "stretch",
      }}
    >
      <View
        style={{
          backgroundColor: "#14a43a",
          marginHorizontal: 0,
          borderRadius: 26,
          paddingVertical: 4,
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
        <View style={{ transform: [{ translateY: -8 }] }}>
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
          backgroundColor: "rgba(255,255,255,0.78)",
          marginHorizontal: 12,
          marginTop: 6,
          borderRadius: 24,
          paddingVertical: 4,
          paddingHorizontal: 5,
          borderWidth: 1,
          borderColor: "#e8e1f3",
          elevation: 2,
        }}
      >
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
