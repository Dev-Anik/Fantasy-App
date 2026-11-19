import { useEffect } from "react";
import type { ReactNode } from "react";
import { Animated, Easing } from "react-native";
import { useAnimatedValue } from "./useAnimatedValue";
import type { StyleProp, ViewStyle } from "react-native";

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  // Distance the content travels while fading in.
  offsetX?: number;
  offsetY?: number;
  duration?: number;
};

// Fades and slides its children in on mount. Runs on the native driver, so it
// stays smooth even while the JS thread is busy rendering the new screen.
export function FadeIn({ children, style, offsetX = 0, offsetY = 12, duration = 240 }: Props) {
  const progress = useAnimatedValue(0);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress, duration]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [offsetX, 0] }) },
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [offsetY, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
