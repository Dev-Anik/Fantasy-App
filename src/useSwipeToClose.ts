// Drag a bottom sheet down to close it. The sheet follows the finger; let go
// far or fast enough and it slides away, otherwise it springs back. Inside a
// scrolling list the drag only starts with the list at its top, so scrolling
// up through the content still works, and sideways swipes (a row of fixtures)
// are left alone.
import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import type { GestureResponderEvent, NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useAnimatedValue } from "./useAnimatedValue";

const CLOSE_DISTANCE = 110;
// Points per millisecond.
const CLOSE_VELOCITY = 0.9;

export function useSwipeToClose(onClose: () => void, open: boolean) {
  const translateY = useAnimatedValue(0);
  const atTop = useRef(true);
  // Where the touch began, and the last move (for its speed).
  const touch = useRef({ x: 0, y: 0, lastY: 0, lastT: 0, velocity: 0 });

  // Set once the sheet starts sliding away (see closeSheet).
  const closing = useRef(false);

  // Each opening starts in place, at the top of its content.
  useEffect(() => {
    if (!open) return;
    translateY.setValue(0);
    atTop.current = true;
    closing.current = false;
  }, [open, translateY]);

  // Slide away and close, once (the sheet's and the list's own drag can
  // both finish the same gesture).
  const closeSheet = () => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(translateY, { toValue: 900, duration: 180, useNativeDriver: true }).start(() => onClose());
  };

  const springBack = () =>
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();

  const handlers = {
    onTouchStart: (event: GestureResponderEvent) => {
      const { pageX, pageY, timestamp } = event.nativeEvent;
      touch.current = { x: pageX, y: pageY, lastY: pageY, lastT: timestamp, velocity: 0 };
    },
    // Take over from the content only for a clear downward drag.
    onMoveShouldSetResponderCapture: (event: GestureResponderEvent) => {
      const dy = event.nativeEvent.pageY - touch.current.y;
      const dx = event.nativeEvent.pageX - touch.current.x;
      return atTop.current && dy > 8 && Math.abs(dy) > Math.abs(dx) * 1.5;
    },
    onResponderTerminationRequest: () => false,
    onResponderMove: (event: GestureResponderEvent) => {
      const { pageY, timestamp } = event.nativeEvent;
      const start = touch.current;
      const elapsed = timestamp - start.lastT;
      if (elapsed > 0) start.velocity = (pageY - start.lastY) / elapsed;
      start.lastY = pageY;
      start.lastT = timestamp;
      translateY.setValue(Math.max(0, pageY - start.y));
    },
    onResponderRelease: (event: GestureResponderEvent) => {
      const dy = event.nativeEvent.pageY - touch.current.y;
      if (dy > CLOSE_DISTANCE || touch.current.velocity > CLOSE_VELOCITY) {
        closeSheet();
      } else {
        springBack();
      }
    },
    onResponderTerminate: springBack,
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    atTop.current = event.nativeEvent.contentOffset.y <= 0;
  };

  // Pulling the list itself down from its top. On Android the list keeps
  // that drag for itself (its overscroll glow), so the sheet never gets it
  // through the handlers above. The list's own touch events still arrive,
  // though: follow the finger with them, and close on a long enough pull.
  const pull = useRef({ y: 0, fromTop: false, active: false });
  const listTouch = {
    onTouchStart: (event: GestureResponderEvent) => {
      pull.current = { y: event.nativeEvent.pageY, fromTop: atTop.current, active: false };
    },
    onTouchMove: (event: GestureResponderEvent) => {
      const state = pull.current;
      if (!state.fromTop || !atTop.current) return;
      const dy = event.nativeEvent.pageY - state.y;
      if (dy <= 0) return;
      state.active = true;
      translateY.setValue(dy);
    },
    onTouchEnd: (event: GestureResponderEvent) => {
      const state = pull.current;
      if (!state.active) return;
      state.active = false;
      if (event.nativeEvent.pageY - state.y > CLOSE_DISTANCE) {
        closeSheet();
      } else {
        springBack();
      }
    },
    onTouchCancel: () => {
      if (!pull.current.active) return;
      pull.current.active = false;
      springBack();
    },
  };

  return { panHandlers: handlers, transform: [{ translateY }], onScroll, listTouch };
}
