// The app's look: deep midnight navy fading to black, one green accent,
// calm light text and letter-spaced capitals for section titles. The pitch,
// the player cards and difficulty colours keep their own football colours;
// green and red still mean good and bad numbers.
import { Image } from "expo-image";
import { Text, View } from "react-native";

export const THEME = {
  // Backgrounds
  bg: "#0b1020",
  surface: "#151b2c",
  surfaceRaised: "#1b2236",
  nav: "#06080e",
  line: "rgba(255, 255, 255, 0.07)",
  // Text
  ink: "#f3f4f8",
  soft: "#c3c8d6",
  muted: "#7d8398",
  // Accent
  accent: "#00d982",
  accentSoft: "rgba(0, 217, 130, 0.14)",
  accentLine: "rgba(0, 217, 130, 0.45)",
  // Ink on an accent (green) button
  onAccent: "#04210f",
  // Meaning
  good: "#2fd39a",
  bad: "#ff6b7d",
};

// Height of the bottom tab bar (above the phone's own system area). Pages
// drawn under it leave this much room at the end of their scroll.
export const FOOTER_HEIGHT = 56;

const BACKGROUND = require("../assets/images/app-background.png");

// The navy-to-black backdrop, filling its parent. Put it first in a screen.
export function ScreenBackground() {
  return (
    <Image
      source={BACKGROUND}
      contentFit="fill"
      accessible={false}
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
    />
  );
}

// A section label: green capitals, widely spaced.
export function SectionLabel({ children, style }: { children: string; style?: object }) {
  return (
    <Text
      accessibilityRole="header"
      style={[
        { color: THEME.accent, fontSize: 11.5, fontWeight: "500", letterSpacing: 2, textTransform: "uppercase" },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// A centred title between two thin accent lines: ── LIVE UPDATES ──
export function SectionDivider({ children, style }: { children: string; style?: object }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 14 }, style]}>
      <View style={{ flex: 1, height: 1, backgroundColor: THEME.accentLine, opacity: 0.6 }} />
      <Text
        accessibilityRole="header"
        style={{ color: THEME.ink, fontSize: 13, fontWeight: "500", letterSpacing: 3, textTransform: "uppercase" }}
      >
        {children}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: THEME.accentLine, opacity: 0.6 }} />
    </View>
  );
}
