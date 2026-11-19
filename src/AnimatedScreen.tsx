// A full-screen page that glides in (fade, short slide from the right and a
// slight scale-up) and glides back out when closed, instead of vanishing.
//
// While closing, the page keeps showing what it showed last, even though the
// parent has already dropped its data. Runs on the native driver, so it stays
// smooth while the JS thread builds the screen underneath.
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, Text } from "react-native";
import { useAnimatedValue } from "./useAnimatedValue";

// A soft "ease out" with a long, gentle landing.
const EASE_IN = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_OUT = Easing.bezier(0.4, 0, 1, 1);
const ENTER_MS = 320;
const EXIT_MS = 190;
const SLIDE = 36;

export function AnimatedScreen({
  visible,
  children,
  zIndex,
}: {
  visible: boolean;
  children: ReactNode;
  zIndex: number;
}) {
  const progress = useAnimatedValue(0);
  // What is on screen: the latest children while open, the last ones while closing.
  const [kept, setKept] = useState<ReactNode>(visible ? children : null);
  const [mounted, setMounted] = useState(visible);

  // Adjust during render (not in an effect) so the content never lags a frame.
  if (visible && kept !== children) setKept(children);
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    progress.stopAnimation();
    if (visible) {
      Animated.timing(progress, {
        toValue: 1,
        duration: ENTER_MS,
        easing: EASE_IN,
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(progress, {
      toValue: 0,
      duration: EXIT_MS,
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setMounted(false);
      setKept(null);
    });
  }, [visible, progress]);

  if (!mounted) return null;

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        zIndex,
        elevation: zIndex,
        opacity: progress,
        transform: [
          { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [SLIDE, 0] }) },
          { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) },
        ],
      }}
    >
      {kept}
    </Animated.View>
  );
}

// A small "loading" card over a dimmed screen. Appears only if loading takes
// longer than a moment, so quick loads don't flash.
export function LoadingVeil({
  label,
  zIndex,
  onCancel,
  accent,
}: {
  label: string;
  zIndex: number;
  onCancel?: () => void;
  accent: string;
}) {
  const progress = useAnimatedValue(0);
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 260,
      delay: 140,
      easing: EASE_IN,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        zIndex,
        elevation: zIndex,
        opacity: progress,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} Tap to cancel`}
        onPress={onCancel}
        style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(3, 5, 12, 0.45)" }}
      >
        <Animated.View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 20,
            paddingVertical: 14,
            borderRadius: 18,
            backgroundColor: "rgba(21, 27, 44, 0.96)",
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.08)",
            transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
          }}
        >
          <ActivityIndicator color={accent} />
          <Text style={{ color: "#f3f4f8", fontSize: 13.5, fontWeight: "600" }}>{label}</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
