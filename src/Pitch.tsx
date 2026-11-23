import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { getLoadedFonts, isLoaded as isFontLoaded } from "expo-font";
import { Image } from "expo-image";
import { GlassView } from "expo-glass-effect";
import { AppSymbol } from "./AppSymbol";
import { Row } from "./fpl";
import type { PlayerFixture } from "./fpl";
import { SHIELD_CARDS } from "./shieldCards";
import { availability } from "./availability";
import { THEME } from "./theme";
import type { Availability } from "./availability";
import { CARD_STAT_OPTIONS, CardStatsContext, cardStatValue } from "./cardStats";
import type { CardStatKey } from "./cardStats";

const GREEN = "#00d982";

// A framed card is this much wider than its contents (3pt padding each side);
// the bench slots keep this width.
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

// Goalkeepers wear their club's keeper kit. Every avatar in avatar-sm is made
// by scripts/make-card-avatars.js (from final-avatar and gk-avatar).
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

// Every avatar shares one frame (360x400, the head the same size and in the
// same place; see scripts/make-card-avatars.js), so one size fits them all.
const AVATAR_ASPECT = 360 / 400;

// Image size for an avatar `height` tall.
function avatarArtSize(height: number) {
  return { width: Math.round(height * AVATAR_ASPECT), height: Math.round(height) };
}
// Card art: the avatar's height as a share of the card's width, and how far
// it is shifted from the top of its area (a share of the card's face; the
// image has a little empty space above the head). Larger scale = bigger head,
// less shirt above the name plate.
const CARD_AVATAR_SCALE = 1.12;
const CARD_AVATAR_OFFSET = -0.045;
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
// when the player scored this many points himself. Counted before the
// armband, so a captain needs the same 8 as anyone else (not 4 doubled).
export const ELITE_POINTS = 8;
// Points page: gap between the name plate and the points chip under it.
const POINTS_CHIP_TOP = 2;
// Points page: the points band stays inside the card's border: this far in
// from the sides (share of the card's width) and from the bottom edge.
// (The same as the name plate's PLATE_INSET, so the two line up.)
const POINTS_BAND_SIDE = 0.045;
const POINTS_BAND_BOTTOM = 4;
// Vertical nudge for the points in their band, as a share of the font size
// (negative: up). Android sets a line of this height with the spare room
// above the text, so the digits sat low (about 3px over them, 1-2px under on
// a phone); this lifts them to the middle.
const DIGIT_DROP = -0.04;
// Points page: the band under every name, in one look (see CapsuleInfo).
const POINTS_PAGE_BAND = {
  fill: "rgba(255, 255, 255, 0.22)",
  ink: "#ffffff",
  edge: "rgba(255, 255, 255, 0.4)",
};

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
  const sources: number[] = [
    ...Object.values(TEAM_AVATARS),
    ...Object.values(GK_AVATARS),
    NO_CLUB_AVATAR,
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
  // Head and shoulders, cut off at the frame's bottom.
  const art = avatarArtSize(size * 1.05);
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
const ROW_PADDING = 3;
// Shield cards: the least vertical space between two rows of starters.
const ROW_GAP = 8;
// The "Substitutes" label at the top of the bench tray.
const BENCH_LABEL_HEIGHT = 13;
// The gap between neighbouring cards: one fixed value for every row (a row
// of five, a row of three, the bench), so the spacing always matches. Card
// widths are worked out with it, so a row of five still fits.
const MIN_GAP = 7;
// Between the four bench cards.
const BENCH_GAP = 20;
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
  const slots = clamp(perRow, 4, 5);
  const cardWidth = Math.floor(
    clamp(
      (pitchWidth - ROW_PADDING * 2 - MIN_GAP * (slots - 1)) / slots,
      54,
      110,
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

// Shield style: card size. As wide as the slot allows, 1.2 times as tall,
// shrunk on short screens so the fixture line below still fits.
// The face (player, form, name) is 1.2 times as tall as wide; the footer
// (difficulty bars, then the opponent or points) adds 0.34 below it.
// (1.0, a square face: wider for its height than the original 1.2, so on
// screens where the rows' height sets the size, the cards still gain width.)
const SHIELD_RATIO = 1.0;
// Tall enough for the difficulty bars and one line of text under them.
const SHIELD_FOOTER = 0.34;
function shieldSize(metrics: PitchMetrics, compact: boolean, benched: boolean) {
  // (Compact pitches used to shrink cards by 6%; no longer, so Home and
  // Transfers cards are as wide as the Points page's for the same room.)
  void compact;
  const ideal = metrics.cardWidth - 2;
  // The bench uses the same limit, so its cards match the starters' size.
  void benched;
  const ratio = SHIELD_RATIO + SHIELD_FOOTER;
  const byHeight = metrics.rowSpace != null ? metrics.rowSpace / ratio : Infinity;
  const width = Math.round(clamp(Math.min(ideal, byHeight), 40, 108));
  const face = Math.round(width * SHIELD_RATIO);
  const height = Math.round(width * ratio);
  return { width, height, face, footer: height - face };
}

// Inside a card's footer: the difficulty bars, a gap, then one line of text
// (opponent, points or price), in the footer less a small inset.
// Points page: height of the points band under the name, nearly the whole
// footer (the bars it replaces are gone), so the points can be large. Kept
// inside the card: the gap above and the border below fit in the footer.
function pointsBandHeight(footer: number) {
  // A little under the full height, so the card's foot stays light.
  return Math.max(10, Math.floor(pointsBandRoom(footer) * 0.85));
}

// The room the footer leaves for the band: the points' size is set from
// this (82% of it), so the band could shrink without the points shrinking.
function pointsBandRoom(footer: number) {
  return Math.max(10, footer - POINTS_CHIP_TOP - POINTS_BAND_BOTTOM - 1);
}

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
  return shieldSize(metrics, compact, benched).height;
}

const PitchMetricsContext = createContext<PitchMetrics>(computeMetrics(360));

// Name plates: one font size for the whole pitch, bench included, so every
// name is the same size, chosen so the longest name fits its card in full
// (no "…", no name shrunk on its own), as on the FPL site. Null: no pitch
// around the card, which then sizes its own name.
// Larger than before: the condensed face below fits more letters per line.
const NAME_RATIO_MAX = 0.23;
// Player names are set in Roboto Condensed ExtraBold (assets/fonts, embedded by
// the expo-font plugin in app.json): narrower letters, so names can be
// bigger and still fit. Same name on Android (the file) and iOS (the font's
// own PostScript name).
const NAME_FONT = "RobotoCondensed-ExtraBold";
// The font is built into the app (a new build adds it). On a build without
// it, use the phone's own font in heavy bold instead, sized for its wider
// letters, so names are bold either way and still never cut.
const HAS_NAME_FONT = (() => {
  try {
    return isFontLoaded(NAME_FONT) || getLoadedFonts().includes(NAME_FONT);
  } catch {
    return false;
  }
})();
const NAME_STYLE = HAS_NAME_FONT
  ? // The face is bold already; asking for bold again would make Android
    // thicken it a second time.
    ({ fontFamily: NAME_FONT, fontWeight: "normal" } as const)
  : ({ fontWeight: "900" } as const);
// Roboto Condensed ExtraBold letters against regular Roboto's: about 0.9 on
// average, but capitals and wide letters run wider, so allow for that.
const CONDENSED = HAS_NAME_FONT ? 0.97 : 1.08;
// The name plate's side inset, as a share of the card's width.
// Inside the card's border, in line with the band below it (POINTS_BAND_SIDE),
// so name and band read as part of the card rather than laid over it.
// (Just inside the border: far enough to sit within it, no further, so the
// names keep as much room as possible.)
const PLATE_INSET = 0.045;
// The share of the card's width a name can fill: the plate (the card less
// its insets) less the plate's slim padding and edge.
const NAME_TEXT_SHARE = 1 - 2 * PLATE_INSET - 0.035;
// Letters set a touch closer, which also gives names a little more room.
const NAME_TRACKING = -0.2;
const NameFontContext = createContext<number | null>(null);

// A name's width in ems in the name font: narrow letters, wide ones,
// capitals and the rest, close enough to size the line without measuring.
function nameEms(name: string) {
  let ems = 0;
  for (const ch of name) {
    if ("iljtfrI.,'’-:! ".includes(ch)) ems += 0.32;
    else if ("mwMW".includes(ch)) ems += 0.86;
    else if (ch !== ch.toLowerCase()) ems += 0.68;
    else ems += 0.57;
  }
  return ems * CONDENSED;
}

// The plate's text area is the card less its side insets, padding and edge
// (about 90% of the width); keep spare room so rounding never cuts a letter.
function pitchNameFont(
  players: { name: string; pos: number }[],
  metrics: PitchMetrics,
  compact: boolean,
  // Largest size as a share of the card's width (Infinity: only the fit).
  cap = NAME_RATIO_MAX,
  // How much of the plate the longest name may fill (the rest is spare).
  // (The closer letter spacing saves about the margin a fill below 1 keeps.)
  fill = NAME_TEXT_SHARE,
) {
  let font = shieldSize(metrics, compact, false).width * cap;
  for (const player of players) {
    const width = shieldSize(metrics, compact, player.pos > 11).width;
    font = Math.min(font, (width * fill) / Math.max(1, nameEms(player.name)));
  }
  return Math.max(7, Math.floor(font * 2) / 2);
}

// Every page sizes its names the same way as the Points page: one size for
// the whole pitch, the largest at which the squad's longest name fits its
// card. (Home and Transfers once used a fixed size to stop the cards
// changing size as the page opened; the real cause of that, the shared pitch
// keeping the other page's measurements, is fixed in Pitch below.)
// The Lineup (Home) page is the one exception: its names a little larger,
// letting the longest name fill a little more of its plate. Still one size
// for every name, and still never cut.
const LINEUP_NAME_SCALE = 1.1;
const LINEUP_NAME_FILL = NAME_TEXT_SHARE;
// Names are measured on the phone, in the real font, at this size (see
// NameMeasurer); every name is then drawn at the largest size at which the
// widest of them exactly fits its plate. Until the measurements arrive (the
// first moment), the letter-count estimate stands in.
const NAME_MEASURE_SIZE = 20;
function nameFontFor(
  layoutKey: string,
  players: { name: string; pos: number }[],
  metrics: PitchMetrics,
  compact: boolean,
  widestName: number | null,
) {
  const lineup = layoutKey === "lineup";
  const cap = NAME_RATIO_MAX * (lineup ? LINEUP_NAME_SCALE : 1);
  if (widestName == null || widestName <= 0) {
    return lineup
      ? pitchNameFont(players, metrics, compact, cap, LINEUP_NAME_FILL)
      : pitchNameFont(players, metrics, compact);
  }
  const card = shieldSize(metrics, compact, false).width;
  // The plate's text room: the card less the plate's insets, padding and
  // edge, with a hair spare for rounding.
  const room = card * (1 - 2 * PLATE_INSET) - 3;
  const fitted = (room / widestName) * NAME_MEASURE_SIZE * 0.98;
  return Math.max(7, Math.floor(Math.min(card * cap, fitted) * 2) / 2);
}

// Draws each name once, out of sight, in the plate's font at
// NAME_MEASURE_SIZE, and reports the widest one's width.
function NameMeasurer({ names, onWidest }: { names: string[]; onWidest: (width: number) => void }) {
  const widths = useRef(new Map<string, number>());
  const unique = [...new Set(names)].filter(Boolean);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", left: -10000, top: 0, width: 4000, opacity: 0 }}
    >
      {unique.map((name) => (
        <Text
          key={name}
          allowFontScaling={false}
          numberOfLines={1}
          style={{
            alignSelf: "flex-start",
            fontSize: NAME_MEASURE_SIZE,
            ...NAME_STYLE,
            letterSpacing: NAME_TRACKING,
            includeFontPadding: false,
          }}
          onLayout={(event) => {
            widths.current.set(name, event.nativeEvent.layout.width);
            if (unique.every((n) => widths.current.has(n))) {
              onWidest(Math.max(...unique.map((n) => widths.current.get(n) ?? 0)));
            }
          }}
        >
          {name}
        </Text>
      ))}
    </View>
  );
}

// The last measured size of each kind of pitch (Lineup, Transfers, points
// page), so a pitch seen before draws at its final size on the first frame
// instead of a guessed one.
const lastLayout = new Map<
  string,
  { width: number; startersHeight: number | null; pitchHeight: number | null }
>();

// Horizontal gap between cards in a row: the same in every row, so rows of
// five and rows of three look alike; shorter rows simply sit as a tight
// group in the centre. Never more than the row has room for.
function rowGap(count: number, slotWidth: number, rowWidth: number, wanted = MIN_GAP) {
  if (count <= 1) return 0;
  const room = (rowWidth - count * slotWidth) / (count - 1);
  return Math.max(0, Math.min(wanted, room));
}

function PlayerAvatar({
  team,
  benched,
  goalkeeper,
  compact = false,
  swapHint = false,
  card,
}: {
  team: string;
  benched: boolean;
  goalkeeper: boolean;
  compact?: boolean;
  swapHint?: boolean;
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
    // The footer is a band inside the card, right under the name (see
    // CapsuleInfo), on every page.
    bandFooter?: boolean;
    // Transfers: this gameweek's price change ("+0.1"), shown on the card's
    // face so the price in the footer keeps its full size.
    priceChange?: { text: string; color: string };
    // Injury, suspension or doubt: shown just above the name plate, on the
    // right (the price change sits on the left), clear of the top corners.
    flag?: ReactNode;
    // Home: up to two extra figures the user chose (form, price...), shown
    // in the top corners under the position and the club.
    stats?: { key: string; label: string; value: string }[];
    // Shown in the card's footer: the next opponent and difficulty bars.
    footer?: ReactNode;
  };
}) {
  const metrics = useContext(PitchMetricsContext);
  const { scale } = metrics;
  const onSettled = useContext(AvatarSettledContext);
  const pitchNameFontSize = useContext(NameFontContext);
  const reported = useRef(false);
  const reportSettled = () => {
    if (reported.current) return;
    reported.current = true;
    onSettled();
  };
  const avatarSource = teamAvatar(team, goalkeeper);
  // Exactly the card: no empty margin either side, so the gap between two
  // cards is just the row's gap.
  const boxWidth = shieldSize(metrics, compact, benched).width;
  const boxHeight = avatarBoxHeight(metrics, compact, benched);
  // Swap badge size.
  const swapSize = Math.round(clamp(24 * scale, 20, 30));

  const { width, height, face, footer } = shieldSize(metrics, compact, benched);
  const epic = card?.hero ? EPIC_STYLE.hero : card?.elite ? EPIC_STYLE.elite : null;
  // Selected players keep the selection colour; epic cards letter in gold
  // (or holo violet); the rest in white.
  const ink = card?.highlight ?? epic?.ink ?? "#ffffff";
  // The club in the top-right corner, level with the position on the left
  // (a chosen card stat sits just under it).
  const clubFont = Math.max(7.5, Math.round(width * 0.105 * 2) / 2);
  const clubLine = Math.round(clubFont * 1.2);
  const clubTop = Math.round(face * 0.035);
  // The club itself sits a little lower than the position, clear of the
  // card's top edge (the stat under it moves down with it).
  const clubDrop = Math.round(face * 0.04);
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
  // Points page cards: the points sit at the top of the footer, in the dark
  // band right under the name, and the card ends just below them.
  // Cards whose footer is a band inside the card, right under the name:
  // every Home and Transfers card, and Points cards showing points.
  const pointsCard = !!card?.bandFooter;
  const art = card?.footer
    ? pointsCard
      ? Math.round(face + POINTS_CHIP_TOP + pointsBandHeight(footer) + POINTS_BAND_BOTTOM)
      : Math.round(face + footerLayout.lineMiddle)
    : height;
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
              // About the card's width, so the whole shirt (sleeves
              // included) shows and the kit, not the head, gives the card
              // its identity. The head sits just under the card's top edge.
              ...avatarArtSize(width * CARD_AVATAR_SCALE),
              marginTop: Math.round(face * CARD_AVATAR_OFFSET),
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
                top: clubTop,
                left: Math.round(width * 0.08),
                zIndex: 2,
                // Secondary text: a little quieter than the club and name.
                opacity: SECONDARY_OPACITY,
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
                  // A little smaller than the club in the other corner, but
                  // the same line height, so the two still sit level.
                  fontSize: Math.max(7, clubFont - 1.5),
                  lineHeight: clubLine,
                  fontWeight: "900",
                  letterSpacing: 0.4,
                  includeFontPadding: false,
                  textShadowColor: "rgba(0, 0, 0, 0.85)",
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 3,
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
                  opacity: SECONDARY_OPACITY,
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
                  // Just under the position (left) or the club (right), which
                  // share a size and top edge.
                  top: clubTop + clubLine + 3 + (index === 1 ? clubDrop : 0),
                  opacity: SECONDARY_OPACITY,
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
                // Inside the card's border, in line with the band below.
                left: Math.round(width * PLATE_INSET),
                right: Math.round(width * PLATE_INSET),
                // Just above the footer.
                bottom: footer + Math.round(face * 0.03),
                paddingVertical: 1.5,
                paddingHorizontal: 1,
                // Square ends: a strip set into the card, not a pill on it.
                borderRadius: 0,
                backgroundColor: plate.fill,
                borderWidth: 0.5,
                borderColor: plate.edge,
              }}
            >
              <Text
                numberOfLines={1}
                // Every name on the pitch is exactly the same size, short or
                // long, and shown in full, as on the official site: the size
                // is set for the whole pitch from its longest name (see
                // pitchNameFont). Normal case, in a condensed bold face.
                // Never "…": should a name still not fit (a font quirk on
                // some phone), it shrinks slightly instead of being cut.
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                allowFontScaling={false}
                style={{
                  textAlign: "center",
                  color: plate.ink,
                  fontSize: pitchNameFontSize ?? Math.floor(width * NAME_RATIO_MAX * 2) / 2,
                  ...NAME_STYLE,
                  letterSpacing: NAME_TRACKING,
                  includeFontPadding: false,
                }}
              >
                {card.name}
              </Text>
            </View>
            {/* The club, mirroring the position on the left: the same size
                and weight, solid white with a firm shadow so it reads on
                any kit. */}
            {!!card.club && (
              <Text
                numberOfLines={1}
                allowFontScaling={false}
                style={{
                  position: "absolute",
                  top: clubTop + clubDrop,
                  right: Math.round(width * 0.06),
                  textAlign: "right",
                  color: epic?.ink ?? "#ffffff",
                  fontSize: clubFont,
                  lineHeight: clubLine,
                  fontWeight: "900",
                  letterSpacing: 0.4,
                  includeFontPadding: false,
                  textShadowColor: "rgba(0, 0, 0, 0.85)",
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 3,
                }}
              >
                {card.club}
              </Text>
            )}
            {/* Injury or doubt: just above the name plate, on the right. */}
            {!!card.flag && (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  right: Math.round(width * 0.04),
                  bottom: footer + Math.round(face * 0.03) + Math.round(Math.max(10, width * 0.17) * 1.2) + 6,
                  zIndex: 3,
                }}
              >
                {card.flag}
              </View>
            )}
          </>
        )}
        {!!card?.footer && (
          <View
            style={{
              position: "absolute",
              // Points cards: exactly the band under the name (as wide as the
              // name plate), which the gold fills.
              // Inside the card's border on every side.
              top: pointsCard ? face + 1 : face,
              left: Math.round(width * (pointsCard ? POINTS_BAND_SIDE : 0.06)),
              right: Math.round(width * (pointsCard ? POINTS_BAND_SIDE : 0.06)),
              height: pointsCard ? art - face - 1 - POINTS_BAND_BOTTOM : footerLayout.box,
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
// The aura behind an elite or hero card: a faint, still halo. Enough to mark
// the card as special without pulling the eye from the rest of the screen
// (it used to breathe at full strength, which drowned out everything else).
const CARD_GLOW_OPACITY = 0.32;
function CardGlow({ hero, width, height }: { hero: boolean; width: number; height: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        // The glow image is 1.4 times the card, with the card centred in it.
        left: -width * 0.2,
        top: -height * 0.2,
        width: width * 1.4,
        height: height * 1.4,
        opacity: CARD_GLOW_OPACITY,
      }}
    >
      <Image
        source={hero ? HERO_GLOW : ELITE_GLOW}
        cachePolicy="memory-disk"
        contentFit="fill"
        accessible={false}
        style={{ width: "100%", height: "100%" }}
      />
    </View>
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
        // A rare, slow glint rather than a constant flicker.
        Animated.delay(7000),
        Animated.timing(sweep, {
          toValue: 1,
          duration: 1400,
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
      <View style={{ flex: 1, backgroundColor: `rgba(${tint}, 0.04)` }} />
      <View style={{ flex: 1, backgroundColor: `rgba(${tint}, 0.11)` }} />
      <View style={{ flex: 1, backgroundColor: `rgba(${tint}, 0.04)` }} />
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
// The action menu beside a selected player: big enough to tap easily.
const RAIL_BUTTON = 36;
const RAIL_WIDTH = RAIL_BUTTON + 8;
const CAPTAIN_GOLD = "#f2c14e";

function ActionRail({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        width: RAIL_WIDTH,
        padding: 3,
        gap: 4,
        borderRadius: RAIL_WIDTH / 2,
        alignItems: "center",
        backgroundColor: "rgba(27, 34, 54, 0.97)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.12)",
        shadowColor: "#000",
        shadowOpacity: 0.45,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 10,
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
      hitSlop={3}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        width: RAIL_BUTTON,
        height: RAIL_BUTTON,
        borderRadius: RAIL_BUTTON / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? tone : pressed ? `${tone}33` : "rgba(255, 255, 255, 0.06)",
        borderWidth: active ? 0 : 1,
        borderColor: "rgba(255, 255, 255, 0.08)",
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
      style={{ color, fontSize: 15, fontWeight: "800", includeFontPadding: false }}
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
  band = false,
}: {
  // Shield style: drawn inside the card's footer (this tall), with no
  // panel of its own.
  inCard?: number;
  // Home and Transfers: the footer as a band under the name (SquadBand).
  band?: boolean;
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
  const dark = { fill: "rgba(11, 16, 32, 0.92)", ink: "#ffffff" };
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
      // Points view: points once he has played, or once his match is under
      // way (0 until he scores; FPL's minutes lag the match), the opponent
      // before kick-off, a dash if his match is over and he didn't play.
      const matchOver = !!r.matchStarted && !!current?.finished;
      if ((r.minutes ?? 0) > 0 || (r.matchStarted && !matchOver)) {
        // Just the number: the gold already says these are points.
        text = `${points}`;
        tone = pointsTone;
      } else if (current && !started && !r.matchStarted) {
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

    // This gameweek's difficulty must read at a glance: a fixture is written
    // on a chip in its difficulty colour, followed by dots for the next two.
    // Beside a price or points there is no fixture text, so the first dot is
    // this gameweek's and is drawn larger, with a ring.
    const currentIsDot = !isFixture;
    // Points page: the number gets a solid chip of its own.
    const pointsChip = !!emphasis && /^-?\d+$/.test(text);
    // Points page: one look for every card's band, whatever it says (points,
    // an opponent, a dash): frosted glass over the card, so it takes on the
    // card's own club colour and sits in the design, with white lettering.
    // The points themselves in gold (red below zero), on the frosted band.
    const pointsBand = {
      ...POINTS_PAGE_BAND,
      ink: (r.displayPoints ?? 0) < 0 ? "#ff8a9c" : "#ffd400",
    };

    // Home and Transfers: one band inside the card, under the name. A wide
    // segment says this gameweek's opponent in its difficulty colour (or the
    // price on Transfers, or the points once the match is on); short
    // segments beside it give the difficulty of the fixtures that follow.
    // (The Points page's opponent still to play, or its dash for a player
    // who didn't play, use this band too; its points have their own below.)
    if (inCard && (band || (emphasis && !pointsChip))) {
      const bandHeight = pointsBandHeight(inCardHeight ?? 0);
      // This gameweek's difficulty colours the wide segment itself (behind
      // the opponent, or the price on Transfers), so only the next two
      // fixtures need marks, leaving the text plenty of room.
      const coloured = (isFixture || showPrice) && !!current;
      // The Points page shows no later fixtures: the gameweek is what counts.
      const following = emphasis ? [] : coloured ? fixtures.slice(1, 3) : fixtures.slice(0, 2);
      // Points page: an opponent still to play in its difficulty colour, as
      // on Home; a dash in the page's frosted band.
      const main = coloured
        ? DIFFICULTY_TONE[current.difficulty]
        : emphasis
        ? POINTS_PAGE_BAND
        : text === "BLANK" || text === "—" || !text
          ? { fill: "rgba(255, 255, 255, 0.08)", ink: "#8c9b93" }
          : { fill: "#d6dce6", ink: "#0b1020" };
      // Wide enough to read at a glance.
      const segment = Math.max(5, Math.round(bandHeight * 0.42));
      // The text's size: large, from the room the footer leaves (as the
      // Points page's numbers), but never wider than its segment. Set here,
      // not shrunk by the phone: that shrinking is what made it tiny.
      const bandWidth = width * (1 - 2 * POINTS_BAND_SIDE);
      // Sized from a typical line, not this card's own, so every card's
      // opponent (or price) is the same size, with two marks beside it.
      const sample = showPrice ? "£10.0m" : "WHU (H)";
      const textRoom = bandWidth - (emphasis ? 0 : 2) * (segment + 2) - 4;
      const textSize = Math.max(
        7,
        Math.floor(Math.min(pointsBandRoom(inCardHeight ?? 0) * 0.66, textRoom / (nameEms(sample) * 1.02)) * 2) / 2,
      );
      return (
        <View
          accessible
          accessibilityLabel={`${text}${following.length ? `, then ${following.map((f) => `${f.opponent} ${f.difficulty}`).join(", ")}` : ""}`}
          style={{ flex: 1, flexDirection: "row", alignItems: "stretch", gap: 2 }}
        >
          <View
            style={{
              flex: 1,
              borderRadius: 4,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 2,
              backgroundColor: main.fill,
              borderWidth: highlight || (emphasis && !coloured) ? 1 : 0,
              borderColor: highlight ? highlightColor : POINTS_PAGE_BAND.edge,
            }}
          >
            <Text
              numberOfLines={1}
              allowFontScaling={false}
              style={{
                color: main.ink,
                fontSize: textSize,
                lineHeight: bandHeight,
                fontWeight: "800",
                letterSpacing: 0.2,
                includeFontPadding: false,
                textAlignVertical: "center",
              }}
            >
              {text}
            </Text>
          </View>
          {following.map((fixture, index) => (
            <View
              key={`${fixture.event}-${fixture.opponent}-${index}`}
              style={{
                width: segment,
                borderRadius: 3,
                backgroundColor: DIFFICULTY_TONE[fixture.difficulty].fill,
                borderWidth: 1,
                borderColor: "rgba(0, 0, 0, 0.45)",
              }}
            />
          ))}
        </View>
      );
    }
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
          // Points page: the gold fills the whole band under the name.
          ...(inCard && pointsChip ? { flex: 1, alignItems: "stretch" as const } : null),
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
              : "rgba(11, 16, 32, 0.72)",
          borderWidth: !inCard && edge ? 1 : 0,
          borderColor: edge ?? "transparent",
        }}
      >
        {/* Points page: no difficulty bars (the gameweek is being played, so
            they no longer matter). Points move up into the dark band right
            under the name, where the bars were; an opponent not yet played
            keeps its usual place, with the band's height kept above it. */}
        {inCard && (emphasis ? isFixture ? <View style={{ height: cardBar + cardGap }} /> : null : barsView)}
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
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 3,
              maxWidth: "100%",
              ...(inCard && pointsChip ? { flex: 1, alignItems: "stretch" as const } : null),
            }}
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
                  : inCard && pointsChip
                  ? {
                      // Points page: the band under the name, the points
                      // centred in it (colour: pointsBand above).
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      // Rounded like the name plate above it.
                      borderRadius: 5,
                      backgroundColor: pointsBand.fill,
                      borderWidth: 1,
                      borderColor: POINTS_PAGE_BAND.edge,
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
                // Points in their band have a set size (below); shrinking
                // to fit the band is what made them tiny.
                adjustsFontSizeToFit={!(inCard && pointsChip)}
                minimumFontScale={0.7}
                maxFontSizeMultiplier={inCard ? 1 : MAX_FONT_MULTIPLIER}
                style={{
                  // Fixture: ink for its difficulty chip. Points keep their
                  // gold/red; a price stays quiet.
                  color: inCard && pointsChip
                    ? pointsBand.ink
                    : inCard && isFixture && current
                    ? DIFFICULTY_TONE[current.difficulty].ink
                    : inCard && (isFixture || showPrice)
                    ? "#eef4f0"
                    : isFixture && current
                      ? DIFFICULTY_SOFT[current.difficulty].ink
                      : tone.ink === "#ffffff"
                        ? "#c3d5cb"
                        : tone.ink,
                  fontSize:
                    inCard && pointsChip
                      ? // Points page: large, most of the band's height.
                        Math.round(pointsBandRoom(inCardHeight ?? 0) * 0.82)
                      : emphasis && !inCard
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
                  // Points in their band: firm but a step lighter than black.
                  fontWeight: inCard && pointsChip ? "800" : emphasis ? "900" : inCard ? "800" : "700",
                  letterSpacing: inCard ? 0.2 : 0,
                  // Centred on its own line box, so it sits mid-footer.
                  lineHeight: inCard && pointsChip
                    ? pointsBandHeight(inCardHeight ?? 0)
                    : inCard
                      ? Math.floor(cardLine)
                      : undefined,
                  includeFontPadding: !inCard,
                  textAlignVertical: "center",
                  // Measured on a phone: the line leaves the digits a little
                  // low in the band, so they're lifted to its middle.
                  // A soft dark edge, so gold reads on the light glass.
                  ...(inCard && pointsChip
                    ? { textShadowColor: "rgba(0, 0, 0, 0.6)", textShadowRadius: 2, textShadowOffset: { width: 0, height: 0.5 } }
                    : null),
                  ...(inCard && pointsChip
                    ? {
                        transform: [
                          { translateY: Math.round(pointsBandRoom(inCardHeight ?? 0) * 0.82 * DIGIT_DROP * 2) / 2 },
                        ],
                      }
                    : null),
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
  const { cardWidth, scale } = pitchMetrics;
  const nameFont = Math.max(9, Math.round(10 * scale * 2) / 2);
  const flag = availability(r.status, r.chance);
  const infoFont = Math.max(8.5, Math.round(9.5 * scale * 2) / 2);
  // Captain / vice-captain armband: a short band, sized with the card.
  const armCard = shieldSize(pitchMetrics, compact, isBenched);
  const armband = Math.round(clamp(armCard.width * 0.26, 18, 25));
  const armbandHeight = Math.round(armband * 0.78);
  // Shield cards: the footer's own height, so what is printed in it is sized
  // to fit inside the card on every screen.
  const footerHeight = shieldSize(pitchMetrics, compact, isBenched).footer;
  // Home and Transfers: the extra figures the user chose for the cards.
  const statKeys = useContext(CardStatsContext);
  const stats =
    pointsView
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
        width: shieldSize(pitchMetrics, compact, isBenched).width,
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

        const cardContent = (
          <>
            <View
              style={{
                width: shieldSize(pitchMetrics, compact, isBenched).width,
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
                  card={{
                    name: r.name,
                    // No fixed number in the corner: by default a card shows
                    // only the position and club, and any other figures (form,
                    // price change...) are the ones the user chose.
                    number: "",
                    // Starters' positions are clear from their row on the
                    // pitch; only the bench, in one line, needs the label.
                    position: isBenched ? posLabel : "",
                    highlight: isHighlight ? (isBenchedGK ? "#38bdf8" : "#ffd400") : undefined,
                    club: r.team,
                    hot: !pointsView && Number(r.form) >= HOT_FORM,
                    elite: !pointsView && Number(r.form) >= ELITE_FORM,
                    hero: pointsView && ownPoints >= ELITE_POINTS,
                    large: pointsView,
                    // Same rule as the footer's text (CapsuleInfo): before
                    // his match, a player without minutes shows the opponent.
                    // Every card, every page: the footer is a band in the card.
                    bandFooter: true,
                    stats,
                    // The price change is now a figure the user can choose
                    // ("Price change" in Card info), not shown by default.
                    priceChange: undefined,
                    flag:
                      flag && !r.pendingIn && !r.autoSub ? <AvailabilityFlag flag={flag} /> : undefined,
                    footer: (
                      <CapsuleInfo
                        inCard={footerHeight}
                        hideName
                        // Same footer on every screen: the line (fixture, price
                        // or points) and the difficulty bars.
                        bars
                        band={!pointsView}
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

              {!!r.autoSub && (
                <View
                  style={{
                    position: "absolute",
                    // Under the club code in the top-right corner.
                    top: (r.pos > 11 ? 11 : 4) + 14,
                    right: 2,
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
                    top: (r.pos > 11 ? 11 : 4) + 32,
                    right: 0,
                    zIndex: 11,
                  }}
                >
                  <BonusChip points={r.provisionalBonus ?? 0} />
                </View>
              )}

              {/* Armband: on the player's left arm (the card's left shoulder),
                  like a real captain's armband. */}
              {(r.cap || r.vice) && (
                <View
                  pointerEvents="none"
                  accessible={false}
                  style={{
                    position: "absolute",
                    top: Math.round(armCard.face * 0.53 - armbandHeight / 2),
                    // The box is now exactly the card, so measure from its edge.
                    left: Math.round(armCard.width * 0.17 - armband / 2),
                    width: armband,
                    height: armbandHeight,
                    borderRadius: 6,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: r.cap ? "#f2c14e" : "#e5e7ee",
                    borderWidth: 2,
                    borderColor: "#0b1020",
                    zIndex: 12,
                    shadowColor: r.cap ? "#f2c14e" : "#000",
                    shadowOpacity: r.cap ? 0.6 : 0.4,
                    shadowRadius: r.cap ? 6 : 3,
                    shadowOffset: { width: 0, height: 1 },
                    elevation: 6,
                  }}
                >
                  <Text
                    allowFontScaling={false}
                    style={{
                      color: "#1a1305",
                      fontSize: Math.round(armbandHeight * 0.66),
                      fontWeight: "900",
                      includeFontPadding: false,
                    }}
                  >
                    {r.cap ? "C" : "V"}
                  </Text>
                </View>
              )}
            </View>
          </>
        );

        return (
          <>
            {cardContent}

            {/* Action menu: C, V, details (lineup) or transfer, details (transfers) */}
            {selected && (
              <View
                style={{
                  position: "absolute",
                  // Beside the card, overlapping it slightly.
                  ...(isRightmost
                    ? { left: -(RAIL_WIDTH - 6) }
                    : { right: -(RAIL_WIDTH - 6) }),
                  // Strikers are the bottom row of the pitch: their rail
                  // (taller than the card) grows upwards from the card's
                  // bottom, so the bench below never covers it.
                  ...(r.type === 4 && !isBenched ? { bottom: 0 } : { top: isBenched ? 4 : 0 }),
                  zIndex: 99,
                }}
              >
                <ActionRail>
                  {showPrice && onTransfer && (
                    <RailButton label={`Transfer out ${r.name}`} tone={THEME.bad} onPress={() => onTransfer(r)}>
                      <AppSymbol
                        name={{ ios: "arrow.left.arrow.right", android: "swap_horiz", web: "swap_horiz" }}
                        color={THEME.bad}
                        size={20}
                      />
                    </RailButton>
                  )}

                  {/* Captain and vice-captain: lineup mode, starters only */}
                  {!showPrice && !isBenched && onSetCaptain && (
                    <RailButton
                      label={r.cap ? `${r.name} is captain` : `Make ${r.name} captain`}
                      tone={CAPTAIN_GOLD}
                      active={r.cap}
                      onPress={() => onSetCaptain(r)}
                    >
                      <RailLetter letter="C" color={r.cap ? "#1a1305" : CAPTAIN_GOLD} />
                    </RailButton>
                  )}
                  {!showPrice && !isBenched && onSetViceCaptain && (
                    <RailButton
                      label={r.vice ? `${r.name} is vice-captain` : `Make ${r.name} vice-captain`}
                      tone={THEME.ink}
                      active={r.vice}
                      onPress={() => onSetViceCaptain(r)}
                    >
                      <RailLetter letter="V" color={r.vice ? THEME.bg : THEME.ink} />
                    </RailButton>
                  )}

                  {onOpenDetails && (
                    <RailButton label={`${r.name} stats and details`} tone={THEME.accent} onPress={() => onOpenDetails(r)}>
                      <AppSymbol
                        name={{ ios: "chart.bar.fill", android: "bar_chart", web: "bar_chart" }}
                        color={THEME.accent}
                        size={19}
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
  const metrics = useContext(PitchMetricsContext);
  const { pitchWidth } = metrics;
  // Each card takes exactly its own width; the gap is the only space.
  const slotWidth = shieldSize(metrics, !!compact, !!benched).width;
  // Bench sits in an inset tray (4pt margin + 6pt padding + border each side).
  const rowWidth = pitchWidth - ROW_PADDING * 2 - (benched ? 22 : 0);
  // One gap for every row and the bench, on every pitch (Home, Transfers,
  // Points).
  // The bench, four in their own tray, is spaced a little more openly.
  const gap = rowGap(rows.length, slotWidth, rowWidth, benched ? BENCH_GAP : MIN_GAP);

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

// On the cards, the club, the player's name and the opponent are at full
// strength; the rest (position, form, chosen figures, price change) a little
// quieter, so the important three stand out.
const SECONDARY_OPACITY = 0.72;

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
  // Home and Transfers share this pitch (it isn't rebuilt between them), and
  // each page has a different amount of room. On a switch, start from the new
  // page's own remembered size at once (while rendering), instead of drawing
  // the cards at the old page's size and resizing them a moment later.
  const [sizedFor, setSizedFor] = useState(layoutKey);
  if (sizedFor !== layoutKey) {
    setSizedFor(layoutKey);
    // Not seen yet: keep the current measurements (real ones) until the new
    // page's arrive.
    if (remembered) {
      setMeasuredWidth(remembered.width);
      setStartersHeight(remembered.startersHeight);
      setPitchHeight(remembered.pitchHeight);
    }
  }
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
  // padding and border (17), the bench's "Substitutes" label, at least
  // ROW_GAP between the rows of starters and before the bench, and a little
  // slack (6).
  const shieldRow =
    pitchHeight == null
      ? null
      : (pitchHeight - 19 - startersPadding - 16 - 17 - BENCH_LABEL_HEIGHT - ROW_GAP * 4 - 6) / 5;
  const metrics = computeMetrics(
    measuredWidth ?? windowWidth - 16,
    shieldRow,
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
    pitchHeight != null;
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
  // Switched to a page whose size isn't known yet (its first visit): hide the
  // players (before paint) while the page measures itself, then show them at
  // their final size, rather than showing them and resizing them.
  const shownFor = useRef(layoutKey);
  useLayoutEffect(() => {
    if (shownFor.current === layoutKey) return;
    shownFor.current = layoutKey;
    // A page already measured: its size is right at once. (If a quick switch
    // away and back cut short a hidden wait, show the players now.)
    if (lastLayout.get(layoutKey)?.pitchHeight != null) {
      showSquad();
      return;
    }
    revealed.current = false;
    reveal.setValue(0);
    // The new measurement comes within a frame or two (if the size changed
    // at all); always show the players again shortly after.
    const timer = setTimeout(showSquad, 300);
    return () => clearTimeout(timer);
  }, [layoutKey, reveal, showSquad]);
  // The size has just been measured: show the squad if it was only waiting
  // for that.
  useEffect(() => {
    if (measured && waitingForSize.current) showSquad();
  }, [measured, showSquad]);

  // The squad's names, measured for their size (NameMeasurer).
  const namesKey = picks.map((p) => p.name).join("|");
  const [widestName, setWidestName] = useState<{ key: string; width: number } | null>(null);

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
      <NameFontContext.Provider
        value={nameFontFor(
          layoutKey,
          picks,
          metrics,
          isCompactAvatar,
          widestName?.key === namesKey ? widestName.width : null,
        )}
      >
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
          {/* What the tray is: a small, quiet label over the four. */}
          <Text
            accessibilityRole="header"
            allowFontScaling={false}
            style={{
              height: BENCH_LABEL_HEIGHT,
              lineHeight: BENCH_LABEL_HEIGHT,
              textAlign: "center",
              color: "rgba(255, 255, 255, 0.62)",
              fontSize: 9,
              fontWeight: "700",
              letterSpacing: 1.6,
              includeFontPadding: false,
            }}
          >
            SUBSTITUTES
          </Text>
          <Animated.View style={{ opacity: reveal }}>
            <PitchRow rows={bench} {...rowProps} benched />
          </Animated.View>
        </View>
        </View>
        <NameMeasurer
          key={namesKey}
          names={picks.map((p) => p.name)}
          onWidest={(width) =>
            setWidestName((current) =>
              current?.key === namesKey && current.width === width ? current : { key: namesKey, width },
            )
          }
        />
      </Pressable>
      </AvatarSettledContext.Provider>
      </CardStatsContext.Provider>
      </NameFontContext.Provider>
    </PitchMetricsContext.Provider>
  );
}
