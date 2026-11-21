// The small dot beside live figures, pulsing gently while there is live
// action to follow. Runs on the native driver; holds still if the phone asks
// for reduced motion.
import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";
import { THEME } from "./theme";
import { useAnimatedValue } from "./useAnimatedValue";
import { useSquadPlaying } from "./squadPlaying";

// `blink`: pulse or hold still. By default it pulses only while one of the
// signed-in manager's players has a match under way (squadPlaying.ts).
export function LiveDot({ color = THEME.accent, size = 6, blink }: { color?: string; size?: number; blink?: boolean }) {
  const squadPlaying = useSquadPlaying();
  const pulsing = blink ?? squadPlaying;
  const opacity = useAnimatedValue(1);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion, () => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion || !pulsing) {
      opacity.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.2, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity, reduceMotion, pulsing]);

  return (
    <Animated.View
      accessible={false}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity }}
    />
  );
}
