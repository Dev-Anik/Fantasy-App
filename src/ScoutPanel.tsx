// The Insights panel: slides in from the right of Home with quick facts on
// the coming gameweek (see scoutFacts.ts). Close it by tapping the dimmed
// pitch, the close button, Android's back button, or swiping it right.
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import type { GestureResponderEvent } from "react-native";
import type { SymbolViewProps } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppSymbol } from "./AppSymbol";
import { THEME, fdrColor } from "./theme";
import { useAnimatedValue } from "./useAnimatedValue";
import { buildFacts } from "./scoutFacts";
import type { Fact, FactFixture, FactItem, FactTone, ScoutElement } from "./scoutFacts";
import type { PlayerFixture, Row } from "./fpl";
import type { FplElement } from "./PlayerProfile";

const OPEN_MS = 280;
const CLOSE_MS = 200;
// Swipe right this far, or this fast (points per ms), to close.
const CLOSE_DISTANCE = 90;
const CLOSE_VELOCITY = 0.6;

const GOLD = "#f2c14e";
const BLUE = "#5b8cff";
const PURPLE = "#b48cff";
// Icon colours only (values keep gold, blue and sky for points, ownership
// and defence).
const CYAN = "#3ccfe0";
const ORANGE = "#ff9f43";
const SKY = "#7fd1ff";

// Each fact's icon, in a tinted tile like the More page's: a different
// colour for every card, so each is easy to find again.
const FACT_ICONS: Record<string, { name: SymbolViewProps["name"]; tint: string }> = {
  top: { name: { ios: "sparkles", android: "auto_awesome", web: "auto_awesome" }, tint: GOLD },
  cleansheets: { name: { ios: "lock.shield.fill", android: "verified_user", web: "verified_user" }, tint: SKY },
  fixtures: { name: { ios: "calendar", android: "calendar_month", web: "calendar_month" }, tint: PURPLE },
  differentials: { name: { ios: "diamond.fill", android: "diamond", web: "diamond" }, tint: CYAN },
  transfers: { name: { ios: "arrow.left.arrow.right", android: "swap_horiz", web: "swap_horiz" }, tint: THEME.accent },
  captain: { name: { ios: "star.fill", android: "star", web: "star" }, tint: ORANGE },
  hardest: { name: { ios: "exclamationmark.triangle.fill", android: "warning", web: "warning" }, tint: THEME.bad },
  missing: { name: { ios: "person.2.fill", android: "groups", web: "groups" }, tint: BLUE },
};

// The value on the right, as a pill coloured by what it is: points gold,
// ownership blue, defence sky, a rise green, a fall red, a difficulty in
// FPL's colours.
const TONE: Record<Exclude<FactTone, "fdr">, string> = {
  points: GOLD,
  ownership: BLUE,
  defence: SKY,
  good: THEME.good,
  bad: THEME.bad,
};

function ValuePill({ item }: { item: FactItem }) {
  const fdr = item.tone === "fdr" ? fdrColor(item.fdr ?? 3) : null;
  const tint = item.tone === "fdr" ? null : TONE[item.tone];
  return (
    <View
      style={{
        minWidth: 44,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 7,
        alignItems: "center",
        backgroundColor: fdr ? fdr.fill : `${tint}24`,
      }}
    >
      <Text
        style={{
          color: fdr ? fdr.ink : tint!,
          fontSize: 11,
          fontWeight: "800",
          fontVariant: ["tabular-nums"],
        }}
      >
        {item.value}
      </Text>
    </View>
  );
}

// A fixture in FPL's difficulty colours: opponent and H or A.
function FixtureChip({ fixture }: { fixture: FactFixture }) {
  const tone = fdrColor(fixture.fdr);
  return (
    <View style={{ paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, backgroundColor: tone.fill }}>
      <Text style={{ color: tone.ink, fontSize: 9, fontWeight: "700" }}>{`${fixture.opponent} ${fixture.venue}`}</Text>
    </View>
  );
}

function ClubTag({ club }: { club: string }) {
  return (
    <View
      style={{
        marginLeft: 5,
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
        backgroundColor: "rgba(255, 255, 255, 0.08)",
      }}
    >
      <Text style={{ color: THEME.soft, fontSize: 9, fontWeight: "700", letterSpacing: 0.3 }}>{club}</Text>
    </View>
  );
}

function FactCard({ fact }: { fact: Fact }) {
  const icon = FACT_ICONS[fact.key];
  return (
    <View style={{ backgroundColor: THEME.surface, borderRadius: 12, paddingVertical: 9, marginBottom: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, marginBottom: 2 }}>
        {!!icon && (
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              marginRight: 9,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: `${icon.tint}26`,
            }}
          >
            <AppSymbol name={icon.name} color={icon.tint} size={13} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={{ color: THEME.ink, fontSize: 12.5, fontWeight: "700" }}>
            {fact.title}
          </Text>
          <Text style={{ color: THEME.muted, fontSize: 10, marginTop: 1 }}>{fact.caption}</Text>
        </View>
      </View>
      {fact.items.map((item, index) => (
        <View
          key={`${item.name}-${index}`}
          accessible
          accessibilityLabel={[
            item.name,
            item.club,
            ...(item.fixtures ?? []).map(
              (f) => `${f.opponent} ${f.venue === "H" ? "home" : "away"}, ${fdrColor(f.fdr).label.toLowerCase()}`,
            ),
            item.note,
            item.value,
          ]
            .filter(Boolean)
            .join(", ")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderTopWidth: index === 0 ? 0 : 1,
            borderTopColor: THEME.line,
          }}
        >
          <View style={{ flex: 1, paddingRight: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text numberOfLines={1} style={{ flexShrink: 1, color: THEME.ink, fontSize: 12, fontWeight: "700" }}>
                {item.name}
              </Text>
              {!!item.club && <ClubTag club={item.club} />}
            </View>
            {(!!item.fixtures?.length || !!item.note) && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 3, marginTop: 3 }}>
                {item.fixtures?.map((fixture, i) => (
                  <FixtureChip key={`${fixture.opponent}-${i}`} fixture={fixture} />
                ))}
                {!!item.note && <Text style={{ color: THEME.muted, fontSize: 10 }}>{item.note}</Text>}
              </View>
            )}
          </View>
          <ValuePill item={item} />
        </View>
      ))}
    </View>
  );
}

export function ScoutPanel({
  open,
  onClose,
  elements,
  teamNames,
  fixturesByTeam,
  squad,
  event,
}: {
  open: boolean;
  onClose: () => void;
  // FPL's full player records by id (as index.tsx keeps them).
  elements: Record<number, FplElement>;
  teamNames: Record<number, string>;
  fixturesByTeam: Record<number, PlayerFixture[]>;
  squad: Row[];
  event: number;
}) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(420, Math.round(screenWidth * 0.86));

  // Kept mounted while the closing slide plays.
  const [mounted, setMounted] = useState(open);
  // Mount as soon as it opens (set while rendering, React's pattern for
  // state that follows a prop); unmounting waits for the slide below.
  if (open && !mounted) setMounted(true);
  const slide = useAnimatedValue(width);
  const unmountTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (unmountTimer.current) clearTimeout(unmountTimer.current);
    if (open) {
      slide.setValue(width);
      Animated.timing(slide, { toValue: 0, duration: OPEN_MS, useNativeDriver: true }).start();
    } else {
      Animated.timing(slide, { toValue: width, duration: CLOSE_MS, useNativeDriver: true }).start();
      unmountTimer.current = setTimeout(() => setMounted(false), CLOSE_MS);
    }
    return () => {
      if (unmountTimer.current) clearTimeout(unmountTimer.current);
    };
  }, [open, slide, width]);

  // Worked out only while the panel is open (from data already loaded).
  const facts = useMemo(
    () =>
      open
        ? buildFacts({
            elements: elements as Record<number, ScoutElement>,
            teamNames,
            fixturesByTeam,
            squad,
            event,
          })
        : [],
    [open, elements, teamNames, fixturesByTeam, squad, event],
  );

  // Swipe right to close: the panel follows the finger, then closes or
  // springs back.
  const touch = useRef({ x: 0, y: 0, lastX: 0, lastT: 0, velocity: 0 });
  const swipe = {
    onTouchStart: (e: GestureResponderEvent) => {
      const { pageX, pageY, timestamp } = e.nativeEvent;
      touch.current = { x: pageX, y: pageY, lastX: pageX, lastT: timestamp, velocity: 0 };
    },
    // Only a clear sideways drag to the right; vertical scrolling stays.
    onMoveShouldSetResponderCapture: (e: GestureResponderEvent) => {
      const dx = e.nativeEvent.pageX - touch.current.x;
      const dy = e.nativeEvent.pageY - touch.current.y;
      return dx > 8 && Math.abs(dx) > Math.abs(dy) * 1.5;
    },
    onResponderTerminationRequest: () => false,
    onResponderMove: (e: GestureResponderEvent) => {
      const { pageX, timestamp } = e.nativeEvent;
      const t = touch.current;
      const elapsed = timestamp - t.lastT;
      if (elapsed > 0) t.velocity = (pageX - t.lastX) / elapsed;
      t.lastX = pageX;
      t.lastT = timestamp;
      slide.setValue(Math.max(0, pageX - t.x));
    },
    onResponderRelease: (e: GestureResponderEvent) => {
      const dx = e.nativeEvent.pageX - touch.current.x;
      if (dx > CLOSE_DISTANCE || touch.current.velocity > CLOSE_VELOCITY) onClose();
      else Animated.spring(slide, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
    },
    onResponderTerminate: () => Animated.spring(slide, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start(),
  };

  if (!mounted) return null;

  const backdropOpacity = slide.interpolate({ inputRange: [0, width], outputRange: [1, 0], extrapolate: "clamp" });

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Animated.View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: backdropOpacity }}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close insights"
          style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.55)" }}
        />
      </Animated.View>
      <Animated.View
        {...swipe}
        accessibilityViewIsModal
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width,
          backgroundColor: THEME.bg,
          borderLeftWidth: 1,
          borderLeftColor: THEME.line,
          transform: [{ translateX: slide }],
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingTop: insets.top + 14,
            paddingHorizontal: 16,
            paddingBottom: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={{ color: THEME.ink, fontSize: 17, fontWeight: "700" }}>
              Insights
            </Text>
            <Text style={{ color: THEME.muted, fontSize: 11, marginTop: 1 }}>{`Gameweek ${event}`}</Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close insights"
            hitSlop={8}
            style={({ pressed }) => ({
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? THEME.surfaceRaised : THEME.surface,
            })}
          >
            <AppSymbol name={{ ios: "xmark", android: "close", web: "close" }} color={THEME.soft} size={16} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          {facts.length === 0 ? (
            <Text style={{ color: THEME.muted, fontSize: 13, textAlign: "center", marginTop: 40, lineHeight: 19 }}>
              {"Loading FPL's player data…\nThe facts appear once it has arrived."}
            </Text>
          ) : (
            <>
              {facts.map((fact) => (
                <FactCard key={fact.key} fact={fact} />
              ))}
              <Text style={{ color: THEME.muted, fontSize: 10, lineHeight: 14, marginTop: 4, marginHorizontal: 4 }}>
                Estimates use recent form, points per match and fixture difficulty, plus each match&apos;s clean sheet
                chance for keepers, defenders and midfielders. They are readings of the data, not predictions.
                Players with under 270 minutes this season are left out.
              </Text>
            </>
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}
