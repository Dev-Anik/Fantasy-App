// Shown instead of a screen that crashed while rendering (Expo Router's
// ErrorBoundary export; see src/app/index.tsx), so the user gets a way back
// rather than a blank screen. Kept deliberately plain: no images, fonts or
// data, nothing that could fail a second time.
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { ErrorBoundaryProps } from "expo-router";
import { THEME } from "./theme";

export function ErrorScreen({ error, retry }: ErrorBoundaryProps) {
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    // The one place every render crash passes through: crash reporting
    // (when it is added) hooks in here.
    console.error("Screen crashed:", error);
  }, [error]);

  const onRetry = async () => {
    setRetrying(true);
    try {
      await retry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: THEME.bg,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{ color: THEME.ink, fontSize: 20, fontWeight: "700", textAlign: "center" }}
      >
        Something went wrong
      </Text>
      <Text style={{ color: THEME.soft, fontSize: 15, lineHeight: 21, textAlign: "center", marginTop: 10 }}>
        This screen ran into a problem. Nothing on your FPL account was changed. Try again, and if it
        keeps happening, restart the app.
      </Text>
      {__DEV__ && (
        <Text selectable style={{ color: THEME.muted, fontSize: 12, textAlign: "center", marginTop: 16 }}>
          {error.message}
        </Text>
      )}
      <Pressable
        onPress={onRetry}
        disabled={retrying}
        accessibilityRole="button"
        style={({ pressed }) => ({
          marginTop: 28,
          paddingVertical: 12,
          paddingHorizontal: 28,
          borderRadius: 12,
          backgroundColor: THEME.accent,
          opacity: pressed || retrying ? 0.7 : 1,
        })}
      >
        <Text style={{ color: THEME.onAccent, fontSize: 16, fontWeight: "700" }}>
          {retrying ? "Trying again…" : "Try again"}
        </Text>
      </Pressable>
    </View>
  );
}
