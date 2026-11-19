// Shown while a lineup or transfers are being sent to FPL: the screen dims
// and a card shows a spinner with a moving progress bar, then a tick once a
// lineup is saved. Touches are held meanwhile, so nothing changes mid-save.
import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, Easing, Text, View } from "react-native";
import { AppSymbol } from "./AppSymbol";
import { THEME } from "./theme";
import { useAnimatedValue } from "./useAnimatedValue";

export type SaveProgressState = { kind: "lineup" | "transfers"; phase: "working" | "done" } | null;

const BAR_WIDTH = 180;
const SLOW_AFTER_MS = 12_000;

export function SaveProgress({ state }: { state: SaveProgressState }) {
  const appear = useAnimatedValue(0);
  const sweep = useAnimatedValue(0);
  // What the card shows, kept while it fades out.
  const [shown, setShown] = useState<SaveProgressState>(state);
  const [slow, setSlow] = useState(false);
  if (state && (state.kind !== shown?.kind || state.phase !== shown?.phase)) {
    setShown(state);
    if (state.phase === "working" && shown?.phase !== "working") setSlow(false);
  }
  const visible = !!state;
  const working = shown?.phase === "working";

  // Fade and scale in and out.
  useEffect(() => {
    Animated.timing(appear, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 180,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setShown(null);
    });
  }, [visible, appear]);

  // The moving bar, looping while FPL works.
  useEffect(() => {
    if (!visible || !working) return;
    sweep.setValue(0);
    const loop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
    );
    loop.start();
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => {
      loop.stop();
      clearTimeout(timer);
    };
  }, [visible, working, sweep]);

  if (!shown) return null;
  const done = shown.phase === "done";
  const title = done
    ? shown.kind === "lineup"
      ? "Lineup saved"
      : "Transfers sent"
    : shown.kind === "lineup"
      ? "Saving your lineup…"
      : "Sending transfers to FPL…";

  return (
    <Animated.View
      // Holds touches while saving, so the team can't change mid-save.
      pointerEvents={visible ? "auto" : "none"}
      accessibilityLiveRegion="polite"
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 40,
        elevation: 40,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(3, 5, 12, 0.5)",
        opacity: appear,
      }}
    >
      <Animated.View
        accessible
        accessibilityLabel={title}
        style={{
          width: 240,
          alignItems: "center",
          paddingTop: 22,
          paddingBottom: 20,
          paddingHorizontal: 20,
          borderRadius: 22,
          backgroundColor: THEME.surfaceRaised,
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.08)",
          shadowColor: "#000",
          shadowOpacity: 0.45,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 },
          elevation: 18,
          transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
        }}
      >
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: THEME.accentSoft,
            borderWidth: 1,
            borderColor: THEME.accentLine,
          }}
        >
          {done ? (
            <AppSymbol name={{ ios: "checkmark", android: "check", web: "check" }} color={THEME.accent} size={26} />
          ) : (
            <ActivityIndicator color={THEME.accent} />
          )}
        </View>
        <Text style={{ color: THEME.ink, fontSize: 15.5, fontWeight: "700", marginTop: 14, textAlign: "center" }}>
          {title}
        </Text>
        <Text style={{ color: THEME.muted, fontSize: 12.5, marginTop: 4, textAlign: "center" }}>
          {done ? "Your FPL team is up to date" : slow ? "Taking longer than usual…" : "Waiting for FPL to confirm"}
        </Text>
        {!done && (
          <View
            style={{
              width: BAR_WIDTH,
              height: 4,
              borderRadius: 2,
              marginTop: 16,
              overflow: "hidden",
              backgroundColor: "rgba(255, 255, 255, 0.08)",
            }}
          >
            <Animated.View
              style={{
                width: BAR_WIDTH * 0.4,
                height: 4,
                borderRadius: 2,
                backgroundColor: THEME.accent,
                transform: [
                  {
                    translateX: sweep.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-BAR_WIDTH * 0.4, BAR_WIDTH],
                    }),
                  },
                ],
              }}
            />
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
}
