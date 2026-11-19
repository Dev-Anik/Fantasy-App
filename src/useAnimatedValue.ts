import { useState } from "react";
import { Animated } from "react-native";

// One Animated.Value for the component's lifetime. React Native's own
// `useAnimatedValue` is missing from react-native-web, which broke the web
// build; this works on every platform.
export function useAnimatedValue(initialValue: number) {
  const [value] = useState(() => new Animated.Value(initialValue));
  return value;
}
