import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Animated,
  Easing,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useAnimatedValue } from "./useAnimatedValue";
import { Image } from "expo-image";
import { GlassView } from "expo-glass-effect";
import { AppSymbol } from "./AppSymbol";
import { Row } from "./fpl";
import type { PlayerFixture } from "./fpl";
import { Jersey, JERSEY_HEM, JERSEY_LAYERS } from "./Jersey";
import { KIT_COLORS } from "./kits";
import { SHIELD_CARDS } from "./shieldCards";
import { availability } from "./availability";
import type { Availability } from "./availability";
import { CARD_STAT_OPTIONS, CardStatsContext, cardStatValue } from "./cardStats";
import type { CardStatKey } from "./cardStats";

const GREEN = "#00d982";

// How players are drawn across the app: a club-coloured jersey, or the 3D
// kit avatar. Change this one value to switch every screen.
export const PLAYER_ART: "jersey" | "avatar" = "jersey";

// How the name and fixture under each player are drawn.
// "classic": boxed name plate, fixture row and three difficulty bars.
// "capsule": test style. Rounded name pill, a fixture pill filled with the
//            difficulty colour, and dots for the following fixtures.
// "circle":  TEST STYLE, like the player sheet header. The 3D kit avatar in
//            a round green-edged frame, the name in bold white and a quieter
//            line under it with difficulty dots.
// Set back to "classic" to return to the original look.
// "shield":  TEST STYLE, a rating-card look. A rounded rectangle card with the
//            avatar, its form and position in the corner (glowing at 7.0+)
//            and the name and club across the bottom.
export const CARD_STYLE: "classic" | "capsule" | "circle" | "shield" = "shield";

// TEST: frame starters in the same rounded card as bench players.
// Set to false to show starters without a card, as before.
export const FRAME_STARTERS = true;
// The shield is a card itself, so it never sits inside a frame.
const FRAMED = FRAME_STARTERS && CARD_STYLE !== "shield";

// TEST: the club-coloured circle behind each avatar. When false the avatar
// stands on the pitch as a cut-out, head and shoulders.
export const AVATAR_BACKDROP = true;
// TEST: one circle colour for every player instead of the club colour.
// The fill and ring below are the shared look (frosted glass).
export const UNIFORM_BACKDROP = true;
const UNIFORM_FILL = "rgba(255, 255, 255, 0.14)";
const UNIFORM_RING = "rgba(255, 255, 255, 0.38)";

// TEST: where the club code goes. "watermark": large faint letters inside the
// circle, behind the avatar. "tag": a small label on the circle's lower edge.
export const CLUB_CODE: "watermark" | "tag" = "watermark";
// A framed card is this much wider than its contents (3pt padding each side).
const FRAME_EXTRA = 6;

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

// Goalkeepers wear their club's keeper kit (made from assets/images/gk-avatar
// by scripts/make-gk-avatars.js).
export const GK_AVATARS: Record<string, any> = {
  ARS: require("../assets/images/avatar-sm/Ars-gk.png"),
  AVL: require("../assets/images/avatar-sm/Avl-gk.png"),
  BHA: require("../assets/images/avatar-sm/Bha-gk.png"),
  BOU: require("../assets/images/avatar-sm/Bou-gk.png"),
  BRE: require("../assets/images/avatar-sm/Bre-gk.png"),
  CHE: require("../assets/images/avatar-sm/Che-gk.png"),
  COV: require("../assets/images/avatar-sm/Cov-gk.png"),
  CRY: require("../assets/images/avatar-sm/Cry-gk.png"),
  EVE: require("../assets/images/avatar-sm/Eve-gk.png"),
  FUL: require("../assets/images/avatar-sm/Ful-gk.png"),
  HUL: require("../assets/images/avatar-sm/Hul-gk.png"),
  IPS: require("../assets/images/avatar-sm/Ips-gk.png"),
  LEE: require("../assets/images/avatar-sm/Lee-gk.png"),
  LIV: require("../assets/images/avatar-sm/Liv-gk.png"),
  MCI: require("../assets/images/avatar-sm/Mci-gk.png"),
  MUN: require("../assets/images/avatar-sm/Mun-gk.png"),
  NEW: require("../assets/images/avatar-sm/New-gk.png"),
  NFO: require("../assets/images/avatar-sm/Nfo-gk.png"),
  SUN: require("../assets/images/avatar-sm/Sun-gk.png"),
  TOT: require("../assets/images/avatar-sm/Tot-gk.png"),
};

const NO_CLUB_AVATAR = require("../assets/images/avatar-sm/no-club.png");
const SHIELD_CARD = require("../assets/images/card-shield.png");

// The avatar images are all 320px tall but come in different widths, and the
// player is drawn at a different size in each. Measured per file: image width
// and the head's width in pixels. Used to show every player at the same size.
const AVATAR_ART: Record<string, [width: number, head: number]> = {
  CRY: [340, 74],
  EVE: [320, 74],
  FUL: [320, 74],
  HUL: [320, 74],
  LEE: [320, 70],
  LIV: [287, 77],
  MUN: [320, 70],
  NEW: [287, 73],
  NFO: [255, 69],
  SUN: [287, 73],
  TOT: [320, 70],
};
// Most avatars (ARS, AVL, BHA, BOU, BRE, CHE, COV, IPS, MCI) share this.
const AVATAR_ART_STANDARD: [number, number] = [287, 78];
const AVATAR_ART_NO_CLUB: [number, number] = [255, 71];
// Every keeper avatar: drawn a little further out than the outfield ones.
const AVATAR_ART_GK: [number, number] = [287, 67];

// Image size that draws the player as a standard avatar would be drawn at
// `baseHeight`: same head size and same height for everyone.
function avatarArtSize(team: string, baseHeight: number, goalkeeper = false) {
  const [width, head] =
    goalkeeper && team && GK_AVATARS[team]
      ? AVATAR_ART_GK
      : (AVATAR_ART[team] ?? (team && TEAM_AVATARS[team] ? AVATAR_ART_STANDARD : AVATAR_ART_NO_CLUB));
  const height = Math.round(baseHeight * (AVATAR_ART_STANDARD[1] / head));
  return { width: Math.round((height * width) / 320), height };
}
const SHIELD_FADE = require("../assets/images/card-shield-fade.png");
const ELITE_PATTERN = require("../assets/images/card-shield-elite-pattern.png");
// Normal cards: the same texture in soft white (no gold, sparkles or shimmer).
const CARD_PATTERN = require("../assets/images/card-shield-pattern.png");
// Points page hauls ("Match Hero"): holographic foil, distinct from the gold
// in-form cards.
const HERO_PATTERN = require("../assets/images/card-shield-hero-pattern.png");
const HERO_FRAME = require("../assets/images/card-shield-hero-frame.png");
const ELITE_FRAME = require("../assets/images/card-shield-elite-frame.png");
// Soft auras behind elite and hero cards, 1.4 times the card each way.
const ELITE_GLOW = require("../assets/images/card-shield-elite-glow.png");
const HERO_GLOW = require("../assets/images/card-shield-hero-glow.png");
// Elite (gold) and hero (holo) cards: lettering colour (position, club).
const EPIC_STYLE = {
  elite: { ink: "#ffe27a" },
  hero: { ink: "#eadcff" },
};
// Shield style: form at which a card turns "elite" (gold foil frame, foil
// pattern and a shimmer). From 7.0 the form number glows.
export const ELITE_FORM = 8;
export const HOT_FORM = 7;
// Points page (a gameweek's scores, which carry no form): a card turns elite
// when the player scored this many points himself (before the armband).
export const ELITE_POINTS = 10;

// The 3D kit avatar for a club (a neutral one when the club is unknown);
// goalkeepers get the keeper kit.
export function teamAvatar(team: string | undefined, goalkeeper = false) {
  return (goalkeeper && team && GK_AVATARS[team]) || (team && TEAM_AVATARS[team]) || NO_CLUB_AVATAR;
}

// Warm the image pipeline for the player art in use. Best effort: a failure
// here only means that image loads on first use.
let avatarsPreloaded = false;
export function preloadAvatars() {
  if (avatarsPreloaded) return;
  avatarsPreloaded = true;
  // The circle and shield cards show the 3D avatars; the other styles use
  // the drawn shirts.
  const usesAvatars = CARD_STYLE === "circle" || CARD_STYLE === "shield";
  const sources: number[] = [
    ...(usesAvatars ? [...Object.values(TEAM_AVATARS), ...Object.values(GK_AVATARS), NO_CLUB_AVATAR] : JERSEY_LAYERS),
    ...(CARD_STYLE === "shield"
      ? [
          ...Object.values(SHIELD_CARDS),
          SHIELD_CARD,
          SHIELD_FADE,
          CARD_PATTERN,
          ELITE_PATTERN,
          ELITE_FRAME,
          ELITE_GLOW,
          HERO_PATTERN,
          HERO_FRAME,
          HERO_GLOW,
        ]
      : []),
    PITCH_GRASS,
    PITCH_TOP,
    PITCH_CENTRE,
    PITCH_BOTTOM,
  ];
  sources.forEach((source) => {
    Image.loadAsync(source).catch(() => {});
  });
}

// The kit avatar in a round frame, for lists outside the pitch (the
// transfer picker), matching the player details sheet.
export function PlayerArt({ team, size, goalkeeper = false }: { team: string; size: number; goalkeeper?: boolean }) {
  // Same per-club normalisation as the cards, so every club's avatar shows
  // at the same scale: head and shoulders, cut off at the frame's bottom.
  const art = avatarArtSize(team, size * 1.05, goalkeeper);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: "rgba(0, 217, 130, 0.12)",
        borderWidth: 1.5,
        borderColor: "rgba(0, 217, 130, 0.45)",
        alignItems: "center",
      }}
    >
      <Image
        source={teamAvatar(team, goalkeeper)}
        contentFit="contain"
        cachePolicy="memory-disk"
        accessible={false}
        style={{ ...art, marginTop: Math.round(size * 0.06), flexShrink: 0 }}
      />
    </View>
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
// Shield cards: the least vertical space between two rows of starters.
const ROW_GAP = 8;
const MIN_GAP = 4;
// Stops pitch text from blowing out the layout at very large system font sizes.
const MAX_FONT_MULTIPLIER = 1.15;

type PitchMetrics = {
  pitchWidth: number;
  cardWidth: number;
  benchWidth: number;
  scale: number;
  // Height available to each of the four rows of starters, once measured.
  rowSpace: number | null;
};

// Each avatar reports here once its image has loaded (or failed), so the
// pitch can reveal the whole squad together instead of player by player.
const AvatarSettledContext = createContext<() => void>(() => {});
// If an image never reports, show the squad anyway after this long.
const REVEAL_TIMEOUT_MS = 1200;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

// `perRow`: the most players in one row. Shield cards are sized to fit the
// busiest row of the actual formation (4 in a 4-4-2), so they can be wider;
// other styles always leave room for five.
function computeMetrics(
  pitchWidth: number,
  rowSpace: number | null = null,
  perRow = 5,
): PitchMetrics {
  const slots = CARD_STYLE === "shield" ? clamp(perRow, 4, 5) : 5;
  const cardWidth = Math.floor(
    clamp(
      (pitchWidth - ROW_PADDING * 2 - MIN_GAP * (slots - 1)) / slots -
        (FRAMED ? FRAME_EXTRA : 0),
      54,
      CARD_STYLE === "shield" ? 100 : 86,
    ),
  );
  return {
    pitchWidth,
    cardWidth,
    benchWidth: cardWidth + FRAME_EXTRA,
    scale: cardWidth / DESIGN_CARD_WIDTH,
    rowSpace,
  };
}

// Circle style: the avatar as large as the card allows. Width sets the ideal
// size; on the pitch the measured row height caps it, leaving room for the
// name and fixture below, so rows never overlap on short screens.
function circleDiameter(metrics: PitchMetrics, compact: boolean, benched: boolean) {
  const boxWidth = metrics.cardWidth - 6;
  // With the frame on, the circle may use the frame's side padding too,
  // filling the card edge to edge.
  const ideal = (boxWidth + (FRAMED ? 8 : 0)) * (compact ? 0.95 : 1);
  // Name and fixture lines under the avatar, plus breathing room.
  const infoHeight = Math.round(34 * metrics.scale) + (FRAMED ? 12 : 0);
  const byHeight =
    !benched && metrics.rowSpace != null ? metrics.rowSpace - infoHeight : Infinity;
  return Math.round(clamp(Math.min(ideal, byHeight), 34, 88));
}

// Shield style: card size. As wide as the slot allows, 1.2 times as tall,
// shrunk on short screens so the fixture line below still fits.
// The face (player, form, name) is 1.2 times as tall as wide; the footer
// (difficulty bars, then the opponent or points) adds 0.34 below it.
const SHIELD_RATIO = 1.2;
// Tall enough for the difficulty bars and one line of text under them.
const SHIELD_FOOTER = 0.34;
function shieldSize(metrics: PitchMetrics, compact: boolean, benched: boolean) {
  const ideal = (metrics.cardWidth - 2) * (compact ? 0.94 : 1);
  // The bench uses the same limit, so its cards match the starters' size.
  void benched;
  const ratio = SHIELD_RATIO + SHIELD_FOOTER;
  const byHeight = metrics.rowSpace != null ? metrics.rowSpace / ratio : Infinity;
  const width = Math.round(clamp(Math.min(ideal, byHeight), 40, 96));
  const face = Math.round(width * SHIELD_RATIO);
  const height = Math.round(width * ratio);
  return { width, height, face, footer: height - face };
}

// Inside a card's footer: the difficulty bars, a gap, then one line of text
// (opponent, points or price), in the footer less a small inset.
function cardFooterLayout(footer: number) {
  const box = footer - Math.max(1, Math.round(footer * 0.06));
  const inner = footer - Math.max(2, footer * 0.12);
  const bar = Math.max(3.5, Math.round(inner * 0.27 * 2) / 2);
  const gap = Math.max(1, Math.round(inner * 0.08 * 2) / 2);
  const line = inner - bar - gap;
  const font = clamp(Math.round((line / 1.2) * 2) / 2, 6.5, 12);
  // Where the text line's middle sits, from the top of the footer: the card
  // itself ends here, so its bottom edge runs through the opponent chip.
  const lineMiddle = (box - inner) / 2 + bar + gap + line / 2;
  return { box, inner, bar, gap, line, font, lineMiddle };
}

// Height reserved for the player art, so the layout makes room for it.
function avatarBoxHeight(metrics: PitchMetrics, compact: boolean, benched: boolean) {
  if (CARD_STYLE === "shield") return shieldSize(metrics, compact, benched).height;
  if (CARD_STYLE === "circle") return circleDiameter(metrics, compact, benched) + 2;
  return Math.round((compact ? 34 : 42) * metrics.scale);
}

const PitchMetricsContext = createContext<PitchMetrics>(computeMetrics(360));

// The last measured size of each kind of pitch (Lineup, Transfers, points
// page), so a pitch seen before draws at its final size on the first frame
// instead of a guessed one.
const lastLayout = new Map<
  string,
  { width: number; startersHeight: number | null; pitchHeight: number | null }
>();

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

// A club colour mixed toward black: `amount` 0 keeps it, 1 is black.
function darken(hex: string, amount: number) {
  const value = hex.replace("#", "");
  const channel = (index: number) =>
    Math.round(parseInt(value.slice(index, index + 2), 16) * (1 - amount))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

// Circle style: the avatar's backdrop in the player's club colour, darkened
// so the avatar's own shirt still stands out in front of it.
function clubBackdrop(team: string) {
  if (UNIFORM_BACKDROP) return { fill: UNIFORM_FILL, ring: UNIFORM_RING };
  const shirt = KIT_COLORS[team]?.shirt;
  if (!shirt) return { fill: "#262d2a", ring: "rgba(255, 255, 255, 0.22)" };
  return { fill: darken(shirt, 0.55), ring: darken(shirt, 0.15) };
}

function PlayerAvatar({
  team,
  benched,
  goalkeeper,
  compact = false,
  swapHint = false,
  ring,
  card,
}: {
  team: string;
  benched: boolean;
  goalkeeper: boolean;
  compact?: boolean;
  swapHint?: boolean;
  // Circle style: colour of the frame when the player is selected.
  ring?: string;
  // Shield style: the text printed on the card.
  card?: {
    name: string;
    number: string;
    position: string;
    highlight?: string;
    // Club short name, printed under the player's name.
    club?: string;
    // In good form (7.0 or more): the number glows.
    hot?: boolean;
    // In very good form (ELITE_FORM or more): the card turns gold foil.
    elite?: boolean;
    // Points page: a big gameweek score turns the card holographic.
    hero?: boolean;
    // Points page: larger name.
    large?: boolean;
    // Transfers: this gameweek's price change ("+0.1"), shown on the card's
    // face so the price in the footer keeps its full size.
    priceChange?: { text: string; color: string };
    // Home: up to two extra figures the user chose (form, price...), shown
    // in the top corners under the position and the club.
    stats?: { key: string; label: string; value: string }[];
    // Shown in the card's footer: the next opponent and difficulty bars.
    footer?: ReactNode;
  };
}) {
  const metrics = useContext(PitchMetricsContext);
  const { cardWidth, scale } = metrics;
  const onSettled = useContext(AvatarSettledContext);
  const reported = useRef(false);
  const reportSettled = () => {
    if (reported.current) return;
    reported.current = true;
    onSettled();
  };
  const useJersey = PLAYER_ART === "jersey";
  const hasAvatar = Boolean(team && (useJersey ? KIT_COLORS[team] : TEAM_AVATARS[team]));
  const avatarSource = teamAvatar(team, goalkeeper);

  const boxWidth = cardWidth - 6;
  const boxHeight = avatarBoxHeight(metrics, compact, benched);
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

  if (CARD_STYLE === "shield") {
    const { width, height, face, footer } = shieldSize(metrics, compact, benched);
    const epic = card?.hero ? EPIC_STYLE.hero : card?.elite ? EPIC_STYLE.elite : null;
    // Selected players keep the selection colour; epic cards letter in gold
    // (or holo violet); the rest in white.
    const ink = card?.highlight ?? epic?.ink ?? "#ffffff";
    // The name plate is the same dark strip with white lettering on every
    // card (the selection colour when selected).
    const plate = {
      fill: "rgba(0, 0, 0, 0.62)",
      edge: card?.highlight ?? "rgba(255, 255, 255, 0.14)",
      ink: card?.highlight ?? "#ffffff",
    };
    const footerLayout = cardFooterLayout(footer);
    // The card's art (colours, pattern, fade, frame) stops at the middle of
    // the footer's text line; the chip there sits across the bottom edge.
    const art = card?.footer ? Math.round(face + footerLayout.lineMiddle) : height;
    return (
      <View style={{ width: boxWidth, height: boxHeight }}>
        <View
          style={{
            position: "absolute",
            top: 0,
            left: (boxWidth - width) / 2,
            width,
            height,
          }}
        >
          {(card?.elite || card?.hero) && <CardGlow hero={!!card.hero} width={width} height={art} />}
          <Image
            // The club colours card, or a neutral slate one for an unknown club.
            source={(team && SHIELD_CARDS[team]) || SHIELD_CARD}
            contentFit="fill"
            accessible={false}
            style={{ position: "absolute", top: 0, left: 0, width, height: art }}
          />
          {!!card && (
            <Image
              source={card.hero ? HERO_PATTERN : card.elite ? ELITE_PATTERN : CARD_PATTERN}
              cachePolicy="memory-disk"
              contentFit="fill"
              accessible={false}
              style={{ position: "absolute", top: 0, left: 0, width, height: art }}
            />
          )}
          {/* The avatar, clipped to the card's inner area. */}
          <View
            style={{
              position: "absolute",
              top: Math.round(face * 0.05),
              left: Math.round(width * 0.03),
              right: Math.round(width * 0.03),
              // The avatar runs down to the footer.
              height: Math.round(face * 0.93),
              overflow: "hidden",
              alignItems: "center",
            }}
          >
            <Image
              source={avatarSource}
              contentFit="contain"
              accessible={false}
              cachePolicy="memory-disk"
              priority="high"
              transition={120}
              onLoad={reportSettled}
              onError={reportSettled}
              style={{
                // Larger than the card, so head and shoulders fill it;
                // centred, with the small rating tucked in the corner.
                ...avatarArtSize(team, width * 1.52, goalkeeper),
                // Raised (the image has empty space above the head) so more
                // of the shirt shows before the fade.
                marginTop: -Math.round(face * 0.07),
                flexShrink: 0,
              }}
            />
            {(card?.elite || card?.hero) && (
              <Shimmer
                width={width}
                height={Math.round(face * 0.93)}
                tint={card.hero ? "232, 214, 255" : "255, 246, 210"}
              />
            )}
          </View>
          <Image
            source={SHIELD_FADE}
            cachePolicy="memory-disk"
            contentFit="fill"
            accessible={false}
            style={{ position: "absolute", top: 0, left: 0, width, height: art }}
          />
          {!!card && (
            <>
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: Math.round(face * 0.05),
                  left: Math.round(width * 0.08),
                  zIndex: 2,
                }}
              >
                {!!card.number && (
                <Text
                  allowFontScaling={false}
                  accessibilityLabel={card.hot ? `Form ${card.number}, in good form` : undefined}
                  style={{
                    // Good form glows gold; other numbers are a little faded so
                    // the glowing ones stand out.
                    color: card.highlight
                      ? ink
                      : card.hot
                        ? "#fff3b0"
                        : "rgba(255, 255, 255, 0.68)",
                    fontSize: Math.max(8, Math.round(width * 0.15)),
                    lineHeight: Math.max(9, Math.round(width * 0.17)),
                    fontWeight: "900",
                    includeFontPadding: false,
                    // Good form: a warm gold glow around the number.
                    textShadowColor: card.hot ? "rgba(255, 196, 0, 0.95)" : "rgba(0, 0, 0, 0.5)",
                    textShadowOffset: card.hot ? { width: 0, height: 0 } : { width: 0, height: 1 },
                    textShadowRadius: card.hot ? 7 : 2,
                  }}
                >
                  {card.number}
                </Text>
                )}
                <Text
                  allowFontScaling={false}
                  style={{
                    color: ink,
                    fontSize: Math.max(6, Math.round(width * 0.09)),
                    lineHeight: Math.max(7, Math.round(width * 0.11)),
                    fontWeight: "800",
                    letterSpacing: 0.4,
                    includeFontPadding: false,
                    textShadowColor: "rgba(0, 0, 0, 0.5)",
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2,
                  }}
                >
                  {card.position}
                </Text>
              </View>
              {!!card.priceChange && (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: Math.round(width * 0.05),
                    // Above the name plate (its text plus padding and edge).
                    bottom:
                      footer +
                      Math.round(face * 0.03) +
                      Math.round(Math.max(10, width * 0.17) * 1.2) +
                      6,
                    paddingHorizontal: 3.5,
                    paddingVertical: 0.5,
                    borderRadius: 4,
                    backgroundColor: "rgba(6, 12, 9, 0.9)",
                    borderWidth: 0.5,
                    borderColor: card.priceChange.color,
                  }}
                >
                  <Text
                    allowFontScaling={false}
                    style={{
                      color: card.priceChange.color,
                      fontSize: Math.max(7, Math.round(width * 0.11 * 2) / 2),
                      fontWeight: "900",
                      includeFontPadding: false,
                    }}
                  >
                    {card.priceChange.text}
                  </Text>
                </View>
              )}
              {/* Home: the user's chosen figures, in the top corners beside the
                  head (1 under the position, 2 under the club): the number,
                  with a tiny label under it. */}
              {(card.stats ?? []).slice(0, 2).map((stat, index) => (
                <View
                  key={stat.key}
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: Math.round(face * 0.06 + Math.max(7, width * 0.11) + 3),
                    ...(index === 0 ? { left: Math.round(width * 0.08) } : { right: Math.round(width * 0.08) }),
                    alignItems: index === 0 ? "flex-start" : "flex-end",
                    zIndex: 2,
                  }}
                >
                  <Text
                    allowFontScaling={false}
                    style={{
                      color: epic?.ink ?? "#ffffff",
                      fontSize: Math.max(8, Math.round(width * 0.13 * 2) / 2),
                      lineHeight: Math.max(9, Math.round(width * 0.15)),
                      fontWeight: "900",
                      includeFontPadding: false,
                      textShadowColor: "rgba(0, 0, 0, 0.75)",
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 3,
                    }}
                  >
                    {stat.value}
                  </Text>
                  {!!stat.label && (
                    <Text
                      allowFontScaling={false}
                      style={{
                        color: "rgba(255, 255, 255, 0.7)",
                        fontSize: Math.max(5.5, Math.round(width * 0.065 * 2) / 2),
                        fontWeight: "800",
                        letterSpacing: 0.5,
                        includeFontPadding: false,
                        textShadowColor: "rgba(0, 0, 0, 0.75)",
                        textShadowOffset: { width: 0, height: 1 },
                        textShadowRadius: 2,
                      }}
                    >
                      {stat.label}
                    </Text>
                  )}
                </View>
              ))}
              {/* Name plate: a solid strip, so the name reads over any kit. */}
              <View
                style={{
                  position: "absolute",
                  left: Math.round(width * 0.05),
                  right: Math.round(width * 0.05),
                  // Just above the footer.
                  bottom: footer + Math.round(face * 0.03),
                  paddingVertical: 1.5,
                  paddingHorizontal: 2,
                  borderRadius: 4,
                  backgroundColor: plate.fill,
                  borderWidth: 0.5,
                  borderColor: plate.edge,
                }}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                  allowFontScaling={false}
                  style={{
                    textAlign: "center",
                    color: plate.ink,
                    // Readable on small phones; long names still shrink to fit.
                    fontSize: Math.max(10, Math.round(width * (card.large ? 0.18 : 0.17) * 2) / 2),
                    fontWeight: "900",
                    letterSpacing: 0.2,
                    includeFontPadding: false,
                  }}
                >
                  {card.name.toUpperCase()}
                </Text>
              </View>
              {!!card.club && (
                <Text
                  numberOfLines={1}
                  allowFontScaling={false}
                  style={{
                    position: "absolute",
                    top: Math.round(face * 0.06),
                    right: Math.round(width * 0.08),
                    textAlign: "right",
                    color: epic?.ink ?? "rgba(255, 255, 255, 0.78)",
                    fontSize: Math.max(7, Math.round(width * 0.1 * 2) / 2),
                    fontWeight: "800",
                    letterSpacing: 0.8,
                    includeFontPadding: false,
                    textShadowColor: "rgba(0, 0, 0, 0.5)",
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2,
                  }}
                >
                  {card.club}
                </Text>
              )}
            </>
          )}
          {!!card?.footer && (
            <View
              style={{
                position: "absolute",
                top: face,
                left: Math.round(width * 0.06),
                right: Math.round(width * 0.06),
                height: footerLayout.box,
                justifyContent: "center",
                overflow: "hidden",
                // Above the elite and hero frames, which cross the chip.
                zIndex: 3,
              }}
            >
              {card.footer}
            </View>
          )}
          {(card?.elite || card?.hero) && (
            <Image
              source={card.hero ? HERO_FRAME : ELITE_FRAME}
              cachePolicy="memory-disk"
              contentFit="fill"
              accessible={false}
              style={{ position: "absolute", top: 0, left: 0, width, height: art }}
            />
          )}
          {swapHint && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: Math.round(face * 0.4 - swapSize / 2),
                left: (width - swapSize) / 2,
                zIndex: 20,
              }}
            >
              <SwapBadge size={swapSize} />
            </View>
          )}
        </View>
      </View>
    );
  }

  if (CARD_STYLE === "circle") {
    // Same framing as the player sheet header: head and shoulders in a round
    // frame, sized to the screen (see circleDiameter).
    const diameter = circleDiameter(metrics, compact, benched);
    const top = boxHeight - diameter - 1;
    const backdrop = clubBackdrop(team);
    // Club tag: scales with the avatar, sized for the widest code ("WWW").
    const clubTagFont = Math.round(clamp(diameter * 0.15, 7.5, 10) * 2) / 2;
    const clubTagWidth = Math.round(clubTagFont * 2.8 + 8);
    return (
      <View style={{ width: boxWidth, height: boxHeight }}>
        <View
          style={{
            position: "absolute",
            top,
            left: (boxWidth - diameter) / 2,
            width: diameter,
            height: diameter,
            // Without the circle, the clip is square: the shoulders end in a
            // straight line, like a bust.
            borderRadius: AVATAR_BACKDROP ? diameter / 2 : 0,
            overflow: "hidden",
            alignItems: "center",
            backgroundColor: AVATAR_BACKDROP ? backdrop.fill : "transparent",
            borderWidth: AVATAR_BACKDROP ? 1.5 : 0,
            borderColor: ring ?? backdrop.ring,
          }}
        >
          {CLUB_CODE === "watermark" && !!team && (
            <Text
              numberOfLines={1}
              allowFontScaling={false}
              accessible={false}
              style={{
                position: "absolute",
                // Above the head (the avatar sits lower in watermark mode), so
                // all three letters show, including the middle one.
                top: Math.round(diameter * 0.07),
                left: 0,
                right: 0,
                textAlign: "center",
                color: "rgba(255, 255, 255, 0.34)",
                fontSize: Math.round(diameter * 0.27),
                lineHeight: Math.round(diameter * 0.3),
                fontWeight: "900",
                letterSpacing: Math.max(1, diameter * 0.03),
                includeFontPadding: false,
              }}
            >
              {team}
            </Text>
          )}
          <Image
            source={avatarSource}
            contentFit="contain"
            accessible={false}
            cachePolicy="memory-disk"
            priority="high"
            transition={120}
            onLoad={reportSettled}
            onError={reportSettled}
            style={{
              ...avatarArtSize(team, diameter * 1.16, goalkeeper),
              // Lower in watermark mode, leaving the top of the circle for
              // the club code.
              marginTop: Math.round(diameter * (CLUB_CODE === "watermark" ? 0.24 : 0.06)),
            }}
          />
        </View>
        {/* Club code on the frame's lower edge: small and muted, so it is
            there when needed without competing with the name below. */}
        {CLUB_CODE === "tag" && !!team && (
          <View
            pointerEvents="none"
            accessible
            accessibilityLabel={`Club ${team}`}
            style={{
              position: "absolute",
              bottom: 0,
              // Fixed width: content-sized tags drop the last letter on Android.
              left: (boxWidth - clubTagWidth) / 2,
              width: clubTagWidth,
              alignItems: "center",
              borderRadius: 5,
              backgroundColor: "rgba(4, 12, 8, 0.92)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.12)",
              zIndex: 5,
            }}
          >
            <Text
              numberOfLines={1}
              allowFontScaling={false}
              style={{
                width: "100%",
                color: "#b9cbc1",
                fontSize: clubTagFont,
                lineHeight: clubTagFont + 2,
                fontWeight: "800",
                letterSpacing: 0.3,
                textAlign: "center",
                includeFontPadding: false,
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
              top: Math.round(top + diameter / 2 - swapSize / 2),
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

// Form at a glance: a small pill with a trend arrow and the form score.
// Mint and rising for hot form, coral and falling for poor form.
function FormPill({ mood, form }: { mood: "good" | "bad"; form?: string }) {
  const good = mood === "good";
  const value = Number(form);
  const label = form && Number.isFinite(value) ? value.toFixed(1) : "";
  const ink = good ? "#04210f" : "#ffffff";
  return (
    <View
      accessible
      accessibilityLabel={`${good ? "In good form" : "In poor form"}${label ? `, ${label}` : ""}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        // Fixed width: content-sized tags drop the last letter on Android.
        width: label ? 29 : 15,
        height: 14,
        borderRadius: 7,
        paddingHorizontal: 2,
        gap: 1,
        backgroundColor: good ? "#00d982" : "#ff5a72",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.5)",
        shadowColor: good ? "#00d982" : "#ff5a72",
        shadowOpacity: 0.6,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 0 },
        elevation: 3,
      }}
    >
      <AppSymbol
        name={
          good
            ? { ios: "arrow.up.right", android: "trending_up", web: "trending_up" }
            : { ios: "arrow.down.right", android: "trending_down", web: "trending_down" }
        }
        color={ink}
        size={9}
      />
      {!!label && (
        <Text
          numberOfLines={1}
          allowFontScaling={false}
          style={{
            color: ink,
            fontSize: 8.5,
            lineHeight: 10,
            fontWeight: "900",
            includeFontPadding: false,
            textAlignVertical: "center",
          }}
        >
          {label}
        </Text>
      )}
    </View>
  );
}

// Injury, suspension or doubt for the next gameweek.
function AvailabilityFlag({ flag }: { flag: Availability }) {
  return (
    <View
      accessible
      accessibilityLabel={flag.label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        height: 15,
        paddingLeft: 2,
        paddingRight: 4,
        gap: 1.5,
        borderRadius: 8,
        backgroundColor: flag.color,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.6)",
        shadowColor: flag.color,
        shadowOpacity: 0.6,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 0 },
        elevation: 3,
      }}
    >
      <AppSymbol
        name={
          flag.level === "out"
            ? { ios: "cross.circle.fill", android: "medical_services", web: "medical_services" }
            : { ios: "exclamationmark.circle.fill", android: "error", web: "error" }
        }
        color={flag.ink}
        size={10}
      />
      <Text
        allowFontScaling={false}
        style={{
          color: flag.ink,
          fontSize: 8,
          fontWeight: "900",
          includeFontPadding: false,
        }}
      >
        {flag.short}
      </Text>
    </View>
  );
}

// Live gameweek: a projected automatic substitution.
function AutoSubBadge({ kind }: { kind: "in" | "out" }) {
  const coming = kind === "in";
  return (
    <View
      accessible
      accessibilityLabel={coming ? "Coming on as an automatic substitute" : "Substituted out automatically"}
      style={{
        width: 17,
        height: 17,
        borderRadius: 9,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: coming ? "#00d982" : "#ff5a72",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.6)",
        elevation: 3,
      }}
    >
      <AppSymbol
        name={
          coming
            ? { ios: "arrow.up", android: "arrow_upward", web: "arrow_upward" }
            : { ios: "arrow.down", android: "arrow_downward", web: "arrow_downward" }
        }
        color={coming ? "#04210f" : "#ffffff"}
        size={11}
      />
    </View>
  );
}

// Live gameweek: bonus a player is on course for, not yet added by FPL.
function BonusChip({ points }: { points: number }) {
  return (
    <View
      accessible
      accessibilityLabel={`${points} provisional bonus ${points === 1 ? "point" : "points"}`}
      style={{
        height: 15,
        minWidth: 22,
        paddingHorizontal: 4,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ffd400",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.6)",
        elevation: 3,
      }}
    >
      <Text
        allowFontScaling={false}
        style={{
          color: "#1b1600",
          fontSize: 8.5,
          fontWeight: "900",
          includeFontPadding: false,
        }}
      >
        {`+${points}B`}
      </Text>
    </View>
  );
}

// Shown over the selected player's shirt: pops in, then the arrows keep
// flipping to signal "tap another player to swap".
// Elite cards: a soft band of light sweeps across every few seconds, like
// light catching a foil card. Runs on the native thread.
// The aura behind an elite or hero card: a soft glow that slowly breathes.
// Runs on the native driver, so many on one pitch stay smooth.
function CardGlow({ hero, width, height }: { hero: boolean; width: number; height: number }) {
  const pulse = useAnimatedValue(0);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        // The glow image is 1.4 times the card, with the card centred in it.
        left: -width * 0.2,
        top: -height * 0.2,
        width: width * 1.4,
        height: height * 1.4,
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
      }}
    >
      <Image
        source={hero ? HERO_GLOW : ELITE_GLOW}
        cachePolicy="memory-disk"
        contentFit="fill"
        accessible={false}
        style={{ width: "100%", height: "100%" }}
      />
    </Animated.View>
  );
}

function Shimmer({
  width,
  height,
  tint = "255, 246, 210",
}: {
  width: number;
  height: number;
  // "r, g, b" of the light band.
  tint?: string;
}) {
  const sweep = useAnimatedValue(0);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1800),
        Animated.timing(sweep, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);

  const band = Math.round(width * 0.32);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: -height * 0.2,
        left: 0,
        width: band,
        height: height * 1.4,
        flexDirection: "row",
        transform: [
          {
            translateX: sweep.interpolate({
              inputRange: [0, 1],
              outputRange: [-band * 1.5, width + band * 0.5],
            }),
          },
          { rotate: "18deg" },
        ],
      }}
    >
      {/* Soft edges: faint, bright, faint. */}
      <View style={{ flex: 1, backgroundColor: `rgba(${tint}, 0.07)` }} />
      <View style={{ flex: 1, backgroundColor: `rgba(${tint}, 0.2)` }} />
      <View style={{ flex: 1, backgroundColor: `rgba(${tint}, 0.07)` }} />
    </Animated.View>
  );
}

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

// The small menu beside a selected player: one dark capsule holding the
// actions, in the same glassy green style as the app's cards.
function ActionRail({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        width: 32,
        padding: 2,
        gap: 2,
        borderRadius: 16,
        alignItems: "center",
        backgroundColor: "rgba(4, 16, 10, 0.95)",
        borderWidth: 1,
        borderColor: "rgba(0, 217, 130, 0.5)",
        shadowColor: "#00d982",
        shadowOpacity: 0.3,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 8,
      }}
    >
      {children}
    </View>
  );
}

// One action in the rail. `tone` colours the icon or letter and the pressed
// state; `active` fills the button (the current captain or vice-captain).
function RailButton({
  label,
  tone,
  active = false,
  onPress,
  children,
}: {
  label: string;
  tone: string;
  active?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={(event) => {
        event.stopPropagation?.();
        onPress();
      }}
      hitSlop={5}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? tone : pressed ? `${tone}40` : "rgba(255, 255, 255, 0.07)",
      })}
    >
      {children}
    </Pressable>
  );
}

function RailLetter({ letter, color }: { letter: string; color: string }) {
  return (
    <Text
      allowFontScaling={false}
      style={{ color, fontSize: 12, fontWeight: "900", includeFontPadding: false }}
    >
      {letter}
    </Text>
  );
}

// Circle style: a quiet tint with coloured text, so the fixture stays
// secondary to the player's name while still showing its difficulty.
const DIFFICULTY_SOFT: Record<PlayerFixture["difficulty"], { fill: string; ink: string }> = {
  easy: { fill: "rgba(0, 230, 118, 0.16)", ink: "#4cf09a" },
  average: { fill: "rgba(255, 255, 255, 0.1)", ink: "#d5e0da" },
  hard: { fill: "rgba(240, 45, 85, 0.2)", ink: "#ff7a90" },
};

const DIFFICULTY_TONE: Record<PlayerFixture["difficulty"], { fill: string; ink: string }> = {
  easy: { fill: "#00e676", ink: "#04210f" },
  average: { fill: "#e9efe9", ink: "#12241a" },
  hard: { fill: "#f02d55", ink: "#ffffff" },
};

// TEST STYLE ("capsule"): the name in a rounded pill, and below it a smaller
// pill for the fixture, points or price. A fixture pill is filled with its
// difficulty colour; dots show the difficulty of the fixtures after it.
function CapsuleInfo({
  plain = false,
  inCard: inCardHeight,
  hideName = false,
  bars = false,
  emphasis = false,
  r,
  width,
  benched,
  highlight,
  highlightColor,
  showPrice,
  fixtures,
  hasSeasonFixtures,
  started,
  nameFont,
  infoFont,
}: {
  // "circle" style: bold name and a quiet line on one soft panel, no pills.
  plain?: boolean;
  // Shield style: drawn inside the card's footer (this tall), with no
  // panel of its own.
  inCard?: number;
  // Shield style: the name is printed on the card already.
  hideName?: boolean;
  // Shield style: difficulty as three thin bars (this gameweek and the next
  // two) under the fixture, instead of dots.
  bars?: boolean;
  // Points page: larger, bolder text (the points are the point of the page).
  emphasis?: boolean;
  r: Row;
  width: number;
  benched: boolean;
  highlight: boolean;
  highlightColor: string;
  showPrice: boolean;
  fixtures: PlayerFixture[];
  hasSeasonFixtures: boolean;
  started: boolean;
  nameFont: number;
  infoFont: number;
}) {
  const current = fixtures[0];
  const dark = { fill: "rgba(4, 16, 10, 0.92)", ink: "#ffffff" };
  const inCard = inCardHeight != null;
  // Inside a card: bars, a small gap, then one line of text, all within the
  // footer (less its top and bottom inset).
  const footerLayout = cardFooterLayout(inCardHeight ?? 0);
  // The bars take about a quarter of it, so the difficulty reads at a glance.
  const { bar: cardBar, gap: cardGap, line: cardLine, font: cardFont } = footerLayout;

  // What the lower pill says, mirroring the classic card's rules.
  let text = "";
  let tone = dark;
  let extra: { text: string; color: string } | null = null;
  // Fixtures shown as dots: all of them beside a price or points, the ones
  // after the current fixture when the pill itself is the current fixture.
  let dots = fixtures;
  let isFixture = false;
  if (showPrice) {
    text = `£${((r.price ?? r.buy) / 10).toFixed(1)}m`;
    if (r.priceChange) {
      extra = {
        text: `${r.priceChange > 0 ? "+" : "−"}${(Math.abs(r.priceChange) / 10).toFixed(1)}`,
        color: r.priceChange > 0 ? "#00e676" : "#ff7a90",
      };
    }
  } else if (fixtures.length > 0 || r.displayPoints !== undefined) {
    const points = r.displayPoints ?? 0;
    const pointsTone = { fill: dark.fill, ink: points < 0 ? "#ff7a90" : "#ffd400" };
    const fixtureText = current ? `${current.opponent} (${current.venue})` : "";
    if (r.minutes !== undefined) {
      // Points view: points once he has played, the opponent before kick-off.
      if ((r.minutes ?? 0) > 0) {
        // Just the number: the gold already says these are points.
        text = `${points}`;
        tone = pointsTone;
      } else if (current && !started) {
        text = fixtureText;
        tone = DIFFICULTY_TONE[current.difficulty];
        dots = fixtures.slice(1);
        isFixture = true;
      } else {
        text = "—";
        tone = { fill: dark.fill, ink: "#8c9b93" };
      }
    } else if (started || !current) {
      text = `${points} pts`;
      tone = pointsTone;
    } else {
      text = fixtureText;
      tone = DIFFICULTY_TONE[current.difficulty];
      dots = fixtures.slice(1);
      isFixture = true;
    }
  } else if (hasSeasonFixtures) {
    text = "BLANK";
    tone = { fill: dark.fill, ink: "#8c9b93" };
  }

  if (plain) {
    // This gameweek's difficulty must read at a glance: a fixture is written
    // on a chip in its difficulty colour, followed by dots for the next two.
    // Beside a price or points there is no fixture text, so the first dot is
    // this gameweek's and is drawn larger, with a ring.
    const currentIsDot = !isFixture;
    // Shield cards on squad screens: smaller opponent and difficulty bars.
    const compactLine = inCard || (hideName && !emphasis);
    const edge = highlight ? highlightColor : r.pendingIn ? GREEN : null;
    // Difficulty bars: this gameweek and the next two. Inside a card they sit
    // right under the name plate, above the opponent, where the elite and
    // hero frames cannot cover them.
    const barsView = bars && fixtures.length > 0 && (
      <View
        accessible={false}
        style={{
          flexDirection: "row",
          alignSelf: "stretch",
          gap: inCard ? 2 : compactLine ? 1.5 : 2,
          height: inCard ? cardBar : compactLine ? 3 : 4,
          marginTop: inCard ? 0 : compactLine ? 1.5 : 2.5,
          marginBottom: inCard ? cardGap : 0,
        }}
      >
        {fixtures.slice(0, 3).map((fixture, index) => (
          <View
            key={`${fixture.event}-${fixture.opponent}-${index}-bar`}
            style={{
              flex: 1,
              borderRadius: 2,
              backgroundColor: DIFFICULTY_TONE[fixture.difficulty].fill,
              borderWidth: inCard ? 0.5 : 0,
              borderColor: "rgba(0, 0, 0, 0.45)",
            }}
          />
        ))}
      </View>
    );
    return (
      <View
        style={{
          // Shield cards: a compact line right under the card, narrower
          // than the card so it reads as a caption.
          width: inCard ? "100%" : compactLine ? Math.round(width * 0.82) : width,
          maxWidth: "100%",
          alignItems: "center",
          marginTop: inCard || hideName ? 0 : benched ? 3 : 2,
          paddingHorizontal: inCard ? 0 : compactLine ? 2 : 3,
          paddingTop: inCard ? 0 : compactLine ? 1 : 1.5,
          paddingBottom: inCard ? 0 : compactLine ? 1.5 : 2.5,
          borderRadius: compactLine ? 7 : 9,
          // Inside a card the card's own dark base is the background.
          backgroundColor: inCard
            ? "transparent"
            : highlight
              ? "rgba(40, 34, 4, 0.92)"
              : "rgba(4, 16, 10, 0.72)",
          borderWidth: !inCard && edge ? 1 : 0,
          borderColor: edge ?? "transparent",
        }}
      >
        {inCard && barsView}
        {!hideName && (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            maxFontSizeMultiplier={MAX_FONT_MULTIPLIER}
            style={{
              width: "100%",
              color: highlight ? highlightColor : "#ffffff",
              fontSize: nameFont + 1,
              fontWeight: "900",
              textAlign: "center",
              marginBottom: 1.5,
            }}
          >
            {r.name}
          </Text>
        )}
        {!!text && (
          <View
            accessible
            // A bare number is points; screen readers still say so.
            accessibilityLabel={`${text}${/^-?\d+$/.test(text) ? " points" : ""}${extra ? ` ${extra.text}` : ""}`}
            style={{ flexDirection: "row", alignItems: "center", gap: 3, maxWidth: "100%" }}
          >
            <View
              style={
                isFixture && current && inCard
                  ? {
                      // In a card: a solid chip in this fixture's difficulty
                      // colour (green easy, light grey average, red hard).
                      flexShrink: 1,
                      paddingHorizontal: 4,
                      borderRadius: 4,
                      backgroundColor: DIFFICULTY_TONE[current.difficulty].fill,
                    }
                  : inCard
                  ? {
                      flexShrink: 1,
                      paddingHorizontal: 4,
                      borderRadius: 4,
                      backgroundColor: "rgba(6, 12, 9, 0.94)",
                      borderWidth: 0.5,
                      borderColor: "rgba(255, 255, 255, 0.2)",
                    }
                  : isFixture && current
                  ? {
                      flexShrink: 1,
                      paddingHorizontal: compactLine ? 3.5 : 5,
                      paddingVertical: compactLine ? 0 : 0.5,
                      borderRadius: 6,
                      backgroundColor: DIFFICULTY_SOFT[current.difficulty].fill,
                    }
                  : { flexShrink: 1 }
              }
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                maxFontSizeMultiplier={inCard ? 1 : MAX_FONT_MULTIPLIER}
                style={{
                  // Fixture: ink for its difficulty chip. Points keep their
                  // gold/red; a price stays quiet.
                  color: inCard && isFixture && current
                    ? DIFFICULTY_TONE[current.difficulty].ink
                    : inCard && (isFixture || showPrice)
                    ? "#eef4f0"
                    : isFixture && current
                      ? DIFFICULTY_SOFT[current.difficulty].ink
                      : tone.ink === "#ffffff"
                        ? "#c3d5cb"
                        : tone.ink,
                  fontSize:
                    emphasis && !inCard
                      ? infoFont + 1.5
                      : inCard
                        ? // Points (digits only, no descenders) can fill the
                          // whole line; other text keeps room for its tails.
                          // Prices too: they are what the transfers page is for.
                          (emphasis && /^-?\d+$/.test(text)) || (showPrice && !isFixture)
                          ? clamp(Math.floor(cardLine * 2) / 2, 8, 15)
                          : cardFont
                        : compactLine
                        ? Math.max(7, infoFont - 2.5)
                        : Math.max(8, infoFont - 1),
                  fontWeight: emphasis ? "900" : inCard ? "800" : "700",
                  letterSpacing: inCard ? 0.2 : 0,
                  // Centred on its own line box, so it sits mid-footer.
                  lineHeight: inCard ? Math.floor(cardLine) : undefined,
                  includeFontPadding: !inCard,
                  textAlignVertical: "center",
                }}
              >
                {text}
              </Text>
            </View>
            {/* In a card the change is shown on the card's face instead. */}
            {!!extra && !inCard && (
              <Text
                numberOfLines={1}
                allowFontScaling={false}
                style={{ color: extra.color, fontSize: 8, fontWeight: "900" }}
              >
                {extra.text}
              </Text>
            )}
            {!bars && dots.slice(0, 3).map((fixture, index) => {
              const current = currentIsDot && index === 0;
              return (
                <View
                  key={`${fixture.event}-${fixture.opponent}-${index}`}
                  style={{
                    width: current ? 8 : 5,
                    height: current ? 8 : 5,
                    borderRadius: 4,
                    backgroundColor: DIFFICULTY_TONE[fixture.difficulty].fill,
                    borderWidth: current ? 1 : 0,
                    borderColor: "#ffffff",
                  }}
                />
              );
            })}
          </View>
        )}
        {!inCard && barsView}
      </View>
    );
  }

  return (
    <View
      style={{
        width,
        maxWidth: "100%",
        alignItems: "center",
        marginTop: benched ? 2 : 0,
      }}
    >
      <View
        style={{
          alignSelf: "stretch",
          borderRadius: 999,
          paddingHorizontal: 6,
          paddingVertical: 2.5,
          backgroundColor: highlight ? "rgba(40, 34, 4, 0.96)" : "rgba(4, 16, 10, 0.9)",
          borderWidth: 1,
          borderColor: highlight
            ? highlightColor
            : r.pendingIn
              ? GREEN
              : "rgba(255, 255, 255, 0.2)",
        }}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          maxFontSizeMultiplier={MAX_FONT_MULTIPLIER}
          style={{
            color: highlight ? highlightColor : "#ffffff",
            fontSize: nameFont,
            fontWeight: "800",
            textAlign: "center",
          }}
        >
          {r.name}
        </Text>
      </View>

      {!!text && (
        <View
          accessible
          accessibilityLabel={`${text}${extra ? ` ${extra.text}` : ""}`}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            maxWidth: "100%",
            marginTop: 2,
            borderRadius: 999,
            paddingHorizontal: 6,
            paddingVertical: 1.5,
            backgroundColor: tone.fill,
            borderWidth: 1,
            borderColor: "rgba(0, 0, 0, 0.35)",
          }}
        >
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            maxFontSizeMultiplier={MAX_FONT_MULTIPLIER}
            style={{ flexShrink: 1, color: tone.ink, fontSize: infoFont, fontWeight: "900" }}
          >
            {text}
          </Text>
          {!!extra && (
            <Text
              numberOfLines={1}
              allowFontScaling={false}
              style={{ color: extra.color, fontSize: 8, fontWeight: "900" }}
            >
              {extra.text}
            </Text>
          )}
          {dots.slice(0, 3).map((fixture, index) => (
            <View
              key={`${fixture.event}-${fixture.opponent}-${index}`}
              style={{
                width: 5,
                height: 5,
                borderRadius: 3,
                backgroundColor: DIFFICULTY_TONE[fixture.difficulty].fill,
                // A thin edge keeps a dot visible on a pill of its own colour.
                borderWidth: 0.5,
                borderColor: "rgba(0, 0, 0, 0.55)",
              }}
            />
          ))}
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
  // Points page rows carry minutes; squad rows do not.
  const pointsView = r.minutes !== undefined;
  // The player's own points this gameweek, before captain/triple multipliers.
  const ownPoints = (r.displayPoints ?? 0) / Math.max(1, r.multiplier ?? 1);
  const isStarted = Boolean(currentFx?.started || currentFx?.finished);
  const isBenched = r.pos > 11;
  const isBenchedGK = isBenched && r.type === 1;
  const pitchMetrics = useContext(PitchMetricsContext);
  const { cardWidth, benchWidth, scale } = pitchMetrics;
  const nameFont = Math.max(9, Math.round(10 * scale * 2) / 2);
  const flag = availability(r.status, r.chance);
  const infoFont = Math.max(8.5, Math.round(9.5 * scale * 2) / 2);
  // Shield cards: the footer's own height, so what is printed in it is sized
  // to fit inside the card on every screen.
  const footerHeight = shieldSize(pitchMetrics, compact, isBenched).footer;
  // Home only: the extra figures the user chose for the cards.
  const statKeys = useContext(CardStatsContext);
  const stats =
    showPrice || pointsView
      ? undefined
      : statKeys.flatMap((key) => {
          const value = cardStatValue(key, r, selectedGw);
          const option = CARD_STAT_OPTIONS.find((o) => o.key === key);
          return value == null || !option ? [] : [{ key, label: option.short, value }];
        });

  return (
    <Pressable
      disabled={!onPress}
      onPress={() => onPress?.(r)}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${r.name}${r.team ? `, ${r.team}` : ""}${posLabel ? `, ${posLabel}` : ""}${
        r.cap ? ", captain" : r.vice ? ", vice captain" : ""
      }${isBenched ? ", on bench" : ""}${r.pendingIn ? ", transfer in, not yet confirmed" : ""}${
        flag ? `, ${flag.label}` : ""
      }`}
      android_ripple={{ color: "rgba(255, 212, 0, 0.3)", borderless: false, radius: 24 }}
      style={({ pressed }) => ({
        alignItems: "center",
        alignSelf: "center",
        width: isBenched || FRAMED ? benchWidth : cardWidth,
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
                height: avatarBoxHeight(pitchMetrics, compact, isBenched),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View style={{ opacity: r.autoSub === "out" ? 0.45 : 1 }}>
                <PlayerAvatar
                  team={r.team}
                  benched={isBenched}
                  goalkeeper={r.type === 1}
                  compact={compact}
                  swapHint={swapHint && selected}
                  ring={isHighlight ? (isBenchedGK ? "#38bdf8" : "#ffd400") : undefined}
                  card={{
                    name: r.name,
                    // FPL has no overall rating: the corner shows form, on the
                    // Transfers screen only (where it helps choose players).
                    // The home screen and the points page show no number.
                    number: pointsView || !showPrice
                      ? ""
                      : r.form && Number.isFinite(Number(r.form))
                        ? Number(r.form).toFixed(1)
                        : "",
                    position: posLabel,
                    highlight: isHighlight ? (isBenchedGK ? "#38bdf8" : "#ffd400") : undefined,
                    club: r.team,
                    hot: !pointsView && Number(r.form) >= HOT_FORM,
                    elite: !pointsView && Number(r.form) >= ELITE_FORM,
                    hero: pointsView && ownPoints >= ELITE_POINTS,
                    large: pointsView,
                    stats,
                    priceChange:
                      showPrice && r.priceChange
                        ? {
                            text: `${r.priceChange > 0 ? "+" : "−"}${(Math.abs(r.priceChange) / 10).toFixed(1)}`,
                            color: r.priceChange > 0 ? "#00e676" : "#ff7a90",
                          }
                        : undefined,
                    footer: (
                      <CapsuleInfo
                        plain
                        inCard={footerHeight}
                        hideName
                        // Same footer on every screen: the line (fixture, price
                        // or points) and the difficulty bars.
                        bars
                        emphasis={pointsView}
                        r={r}
                        width={cardWidth}
                        benched={isBenched}
                        highlight={isHighlight}
                        highlightColor={isBenchedGK ? "#38bdf8" : "#ffd400"}
                        showPrice={showPrice}
                        fixtures={displayedFixtures}
                        hasSeasonFixtures={fixtures.length > 0 && selectedGw !== undefined}
                        started={isStarted}
                        nameFont={nameFont}
                        infoFont={infoFont}
                      />
                    ),
                  }}
                />
              </View>

              {showPrice && !!posLabel && CARD_STYLE !== "shield" && (
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

              {!!r.autoSub && (
                <View
                  style={{
                    position: "absolute",
                    // Shield cards: under the club code in the top-right corner.
                    top: (r.pos > 11 ? 11 : 4) + (CARD_STYLE === "shield" ? 14 : 0),
                    ...(CARD_STYLE === "shield" ? { right: 2 } : { left: 2 }),
                    zIndex: 11,
                  }}
                >
                  <AutoSubBadge kind={r.autoSub} />
                </View>
              )}

              {!showPrice && (r.provisionalBonus ?? 0) > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: (r.pos > 11 ? 11 : 4) + (CARD_STYLE === "shield" ? 32 : 0),
                    right: 0,
                    zIndex: 11,
                  }}
                >
                  <BonusChip points={r.provisionalBonus ?? 0} />
                </View>
              )}

              {!!flag && !r.pendingIn && !r.autoSub && (
                <View
                  style={{
                    position: "absolute",
                    // Shield cards: under the club code in the top-right corner.
                    top: (r.pos > 11 ? 11 : 4) + (CARD_STYLE === "shield" ? 14 : 0),
                    ...(CARD_STYLE === "shield" ? { right: 2 } : { left: 2 }),
                    zIndex: 11,
                  }}
                >
                  <AvailabilityFlag flag={flag} />
                </View>
              )}

              {r.formMood && !r.pendingIn && !r.autoSub && !flag && CARD_STYLE !== "shield" && (
                <View
                  style={{
                    position: "absolute",
                    top: r.pos > 11 ? 11 : 4,
                    left: 2,
                    zIndex: 10,
                  }}
                >
                  <FormPill mood={r.formMood} form={r.form} />
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
            {!!r.name && CARD_STYLE === "classic" && (
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
            {!!r.name && CARD_STYLE !== "classic" && CARD_STYLE !== "shield" && (
              <CapsuleInfo
                plain={CARD_STYLE === "circle"}
                r={r}
                width={cardWidth}
                benched={isBenched}
                highlight={isHighlight}
                highlightColor={isBenchedGK ? "#38bdf8" : "#ffd400"}
                showPrice={showPrice}
                fixtures={displayedFixtures}
                hasSeasonFixtures={fixtures.length > 0 && selectedGw !== undefined}
                started={isStarted}
                nameFont={nameFont}
                infoFont={infoFont}
              />
            )}
          </>
        );

        return (
          <>
            {(isBenched && CARD_STYLE !== "shield") || FRAMED ? (
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

            {/* Action menu: C, V, details (lineup) or transfer, details (transfers) */}
            {selected && (
              <View
                style={{
                  position: "absolute",
                  ...(isRightmost
                    ? { left: isBenched ? -30 : -28 }
                    : { right: isBenched ? -30 : -28 }),
                  top: isBenched ? 4 : 0,
                  zIndex: 99,
                }}
              >
                <ActionRail>
                  {showPrice && onTransfer && (
                    <RailButton label={`Transfer out ${r.name}`} tone="#ff5a72" onPress={() => onTransfer(r)}>
                      <AppSymbol
                        name={{ ios: "arrow.left.arrow.right", android: "swap_horiz", web: "swap_horiz" }}
                        color="#ff5a72"
                        size={16}
                      />
                    </RailButton>
                  )}

                  {/* Captain and vice-captain: lineup mode, starters only */}
                  {!showPrice && !isBenched && onSetCaptain && (
                    <RailButton
                      label={r.cap ? `${r.name} is captain` : `Make ${r.name} captain`}
                      tone="#ffd400"
                      active={r.cap}
                      onPress={() => onSetCaptain(r)}
                    >
                      <RailLetter letter="C" color={r.cap ? "#1b1600" : "#ffd400"} />
                    </RailButton>
                  )}
                  {!showPrice && !isBenched && onSetViceCaptain && (
                    <RailButton
                      label={r.vice ? `${r.name} is vice-captain` : `Make ${r.name} vice-captain`}
                      tone="#e6efe9"
                      active={r.vice}
                      onPress={() => onSetViceCaptain(r)}
                    >
                      <RailLetter letter="V" color={r.vice ? "#04210f" : "#e6efe9"} />
                    </RailButton>
                  )}

                  {onOpenDetails && (
                    <RailButton label={`${r.name} stats and details`} tone={GREEN} onPress={() => onOpenDetails(r)}>
                      <AppSymbol
                        name={{ ios: "chart.bar.fill", android: "bar_chart", web: "bar_chart" }}
                        color={GREEN}
                        size={15}
                      />
                    </RailButton>
                  )}
                </ActionRail>
              </View>
            )}
          </>
        );
      }}
    </Pressable>
  );
}

// The pitch, drawn so it never distorts. The grass fills any shape; straight
// lines are plain views; the goal, boxes and circles keep their true shape,
// scaled by width only and pinned to the top, the halfway line and the
// bottom. Units are those of the 600-wide drawing.
const PITCH_LINE = "rgba(255, 255, 255, 0.24)";
// The halfway line sits a little below the middle, leaving room for the
// defence and midfield rows above it.
const HALFWAY = "53.75%";
const PITCH_GRASS = require("../assets/images/pitch-grass.png");
const PITCH_TOP = require("../assets/images/pitch-top.png");
const PITCH_CENTRE = require("../assets/images/pitch-centre.png");
const PITCH_BOTTOM = require("../assets/images/pitch-bottom.png");

function PitchMarkings({ width }: { width: number }) {
  const unit = width / 600;
  const line = Math.max(1, 2.5 * unit);
  const inset = Math.round(25 * unit);
  const topHeight = Math.round(215 * unit);
  const centreHeight = Math.round(160 * unit);
  const bottomHeight = Math.round(185 * unit);
  const fill = { position: "absolute" as const, top: 0, right: 0, bottom: 0, left: 0 };
  return (
    <View pointerEvents="none" style={fill}>
      <Image source={PITCH_GRASS} cachePolicy="memory-disk" contentFit="fill" accessible={false} style={fill} />
      {/* Touchlines, from the goal line down. */}
      <View
        style={{
          position: "absolute",
          top: Math.round(32 * unit),
          bottom: 0,
          left: inset,
          width: line,
          backgroundColor: PITCH_LINE,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: Math.round(32 * unit),
          bottom: 0,
          right: inset,
          width: line,
          backgroundColor: PITCH_LINE,
        }}
      />
      {/* Halfway line. */}
      <View
        style={{
          position: "absolute",
          top: HALFWAY,
          left: inset,
          right: inset,
          height: line,
          backgroundColor: PITCH_LINE,
        }}
      />
      <Image
        source={PITCH_TOP}
        cachePolicy="memory-disk"
        contentFit="contain"
        accessible={false}
        style={{ position: "absolute", top: 0, left: 0, width, height: topHeight }}
      />
      <Image
        source={PITCH_CENTRE}
        cachePolicy="memory-disk"
        contentFit="contain"
        accessible={false}
        style={{
          position: "absolute",
          top: HALFWAY,
          left: 0,
          width,
          height: centreHeight,
          marginTop: -centreHeight / 2 + line / 2,
        }}
      />
      <Image
        source={PITCH_BOTTOM}
        cachePolicy="memory-disk"
        contentFit="contain"
        accessible={false}
        style={{ position: "absolute", bottom: 0, left: 0, width, height: bottomHeight }}
      />
    </View>
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
  const slotWidth = benched || FRAMED ? benchWidth : cardWidth;
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

const NO_STATS: CardStatKey[] = [];

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
  layoutId,
  cardStats = NO_STATS,
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
  // Which screen this pitch is on, so its measured size is remembered apart
  // from other screens (default: "lineup", or "transfers" with prices).
  layoutId?: string;
  // Home: the extra figures shown on each card (see cardStats.ts).
  cardStats?: CardStatKey[];
}) {
  const isCompactAvatar = compactAvatar || showPrice;
  const { width: windowWidth } = useWindowDimensions();
  // Measured width wins; the window width is only a first-frame estimate.
  // Start from the last measurement of this kind of pitch, if any.
  const layoutKey = layoutId ?? (showPrice ? "transfers" : "lineup");
  const remembered = lastLayout.get(layoutKey);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(remembered?.width ?? null);
  // Height of the starters area, so player art can grow to fill it.
  const [startersHeight, setStartersHeight] = useState<number | null>(
    remembered?.startersHeight ?? null,
  );
  // Height of the whole pitch (players' area plus bench). It is set by the
  // screen, not by the cards, so sizing cards from it cannot feed back.
  const [pitchHeight, setPitchHeight] = useState<number | null>(
    remembered?.pitchHeight ?? null,
  );
  useEffect(() => {
    if (measuredWidth != null && (startersHeight != null || pitchHeight != null)) {
      lastLayout.set(layoutKey, { width: measuredWidth, startersHeight, pitchHeight });
    }
  }, [layoutKey, measuredWidth, startersHeight, pitchHeight]);
  // The busiest row of this formation (the bench always has four).
  const perRow = Math.max(
    4,
    ...[1, 2, 3, 4].map((type) => picks.filter((p) => p.pos <= 11 && p.type === type).length),
  );
  const firstMetrics = computeMetrics(measuredWidth ?? windowWidth - 16, null, perRow);
  const startersPadding = Math.round(10 * firstMetrics.scale) + 4;
  // Shield cards: split the whole pitch height between the four rows of
  // starters and the bench (five cards high) after the fixed spacing, so
  // every row and the bench always fit. Fixed spacing: pitch border and
  // padding (19), starters padding, row margins (4 x 4), bench tray margin,
  // padding and border (17), at least ROW_GAP between the rows of starters
  // and before the bench, and a little slack (6).
  const shieldRow =
    pitchHeight == null
      ? null
      : (pitchHeight - 19 - startersPadding - 16 - 17 - ROW_GAP * 4 - 6) / 5;
  const metrics = computeMetrics(
    measuredWidth ?? windowWidth - 16,
    CARD_STYLE === "shield"
      ? shieldRow
      : // Four rows, each with 2pt margins above and below.
        startersHeight == null
        ? null
        : (startersHeight - startersPadding) / 4 - 4,
    perRow,
  );

  // Players stay hidden until every avatar is ready and the pitch's real size
  // is known, then fade in as one, already at their final size.
  const reveal = useAnimatedValue(0);
  const revealed = useRef(false);
  const settledCount = useRef(0);
  const expectedCount = useRef(picks.length);
  const measured =
    measuredWidth != null &&
    (CARD_STYLE === "shield" ? pitchHeight != null : startersHeight != null);
  const measuredRef = useRef(measured);
  // Kept in step after each render (effects run in order, before the one
  // below that reveals the squad once measured).
  useEffect(() => {
    measuredRef.current = measured;
  }, [measured]);
  // Ready to show apart from the size (avatars settled or waited long enough).
  const waitingForSize = useRef(false);
  const showSquad = useCallback(() => {
    if (revealed.current) return;
    if (!measuredRef.current) {
      waitingForSize.current = true;
      return;
    }
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
  // The size has just been measured: show the squad if it was only waiting
  // for that.
  useEffect(() => {
    if (measured && waitingForSize.current) showSquad();
  }, [measured, showSquad]);

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
      <CardStatsContext.Provider value={cardStats}>
      <AvatarSettledContext.Provider value={onAvatarSettled}>
      <Pressable
        onPress={onBackgroundPress}
        onLayout={(event) => {
          const width = Math.round(event.nativeEvent.layout.width);
          const height = Math.round(event.nativeEvent.layout.height);
          setMeasuredWidth((current) => (current === width ? current : width));
          setPitchHeight((current) => (current === height ? current : height));
        }}
        style={{
          flex: 1,
          width: "100%",
          alignSelf: "stretch",
        }}
      >
        {/* Absolute layer: the pitch's size is set by the screen alone, never
            by the cards inside it (on a scrolling screen it would grow with
            them, and the cards would grow with it). */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: "space-between",
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
          <PitchMarkings width={metrics.pitchWidth - 3} />
          <Animated.View
            onLayout={(event) => {
              const height = Math.round(event.nativeEvent.layout.height);
              setStartersHeight((current) => (current === height ? current : height));
            }}
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
        </View>
      </Pressable>
      </AvatarSettledContext.Provider>
      </CardStatsContext.Provider>
    </PitchMetricsContext.Provider>
  );
}
