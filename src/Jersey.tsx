import { Text, View } from "react-native";
import { Image } from "expo-image";
import { GOALKEEPER_KIT_COLORS, KIT_COLORS } from "./kits";
import type { Kit } from "./kits";

// White masks tinted per club, plus one untinted lighting overlay (shading,
// highlights, fabric texture and the ground shadow). Five small images cover
// every kit, so they are decoded once and reused everywhere.
const LAYERS = {
  body: require("../assets/images/jersey/body.png"),
  stripes: require("../assets/images/jersey/stripes.png"),
  sleeves: require("../assets/images/jersey/sleeves.png"),
  trim: require("../assets/images/jersey/trim.png"),
  shade: require("../assets/images/jersey/shade.png"),
};

export const JERSEY_LAYERS: number[] = Object.values(LAYERS);

// Where the shirt sits inside its square image, as fractions of the size.
// Callers use these to line the jersey up with what is around it.
export const JERSEY_HEM = 0.87;
const CHEST_CENTRE = 0.43;
const CHEST_WIDTH = 0.46;

const UNKNOWN_KIT: Kit = { shirt: "#8292a8", trim: "#e6ebf2" };

function luminance(hex: string) {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

type Props = {
  team: string;
  goalkeeper?: boolean;
  size: number;
  // Print the club's three-letter code across the chest.
  showCode?: boolean;
  // Called once the jersey has finished loading (or failed to).
  onReady?: () => void;
};

export function Jersey({ team, goalkeeper = false, size, showCode = false, onReady }: Props) {
  const known = (goalkeeper ? GOALKEEPER_KIT_COLORS[team] : KIT_COLORS[team]) as Kit | undefined;
  const kit = known ?? UNKNOWN_KIT;
  const striped = kit.pattern === "stripes";

  const layer = (source: number, tintColor?: string, last = false) => (
    <Image
      source={source}
      tintColor={tintColor}
      contentFit="contain"
      cachePolicy="memory-disk"
      priority="high"
      accessible={false}
      onLoad={last ? onReady : undefined}
      onError={last ? onReady : undefined}
      style={{ position: "absolute", top: 0, left: 0, width: size, height: size }}
    />
  );

  // Printed-on lettering: light on dark shirts, dark on light ones, with a
  // soft halo in the opposite tone so it stays readable over shading. Striped
  // shirts get a small dark panel, as two-tone stripes defeat any one colour.
  const lightShirt = luminance(kit.shirt) > 0.55;
  const codeColor = striped || !lightShirt ? "#ffffff" : "#0b1a12";
  const haloColor = striped || !lightShirt ? "rgba(0, 0, 0, 0.75)" : "rgba(255, 255, 255, 0.8)";
  const fontSize = Math.max(8, Math.round(size * 0.185 * 2) / 2);
  const lineHeight = Math.round(fontSize * 1.2);
  const codeWidth = Math.round(size * CHEST_WIDTH);

  return (
    <View style={{ width: size, height: size }}>
      {layer(LAYERS.body, kit.shirt)}
      {striped && layer(LAYERS.stripes, kit.trim)}
      {!!kit.sleeves && layer(LAYERS.sleeves, kit.sleeves)}
      {layer(LAYERS.trim, kit.trim)}
      {layer(LAYERS.shade, undefined, true)}
      {showCode && !!known && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: Math.round(size * CHEST_CENTRE - lineHeight / 2),
            left: (size - codeWidth) / 2,
            width: codeWidth,
            height: lineHeight,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 3,
            backgroundColor: striped ? "rgba(6, 14, 10, 0.72)" : "transparent",
          }}
        >
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            allowFontScaling={false}
            style={{
              width: "100%",
              color: codeColor,
              fontSize,
              lineHeight,
              fontWeight: "900",
              textAlign: "center",
              includeFontPadding: false,
              textAlignVertical: "center",
              textShadowColor: haloColor,
              textShadowOffset: { width: 0, height: 0.5 },
              textShadowRadius: 2,
            }}
          >
            {team}
          </Text>
        </View>
      )}
    </View>
  );
}
